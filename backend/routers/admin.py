import logging
import math
from datetime import datetime, timedelta, timezone
from typing import Optional

import httpx
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Request

from core.admin_auth import check_login_rate_limit, create_admin_token, record_failed_login, require_admin, verify_admin_password
from core.config import get_settings
from core.supabase_client import get_supabase
from models.schemas import (
    AdminActivityItem,
    AdminDetectionOut,
    AdminDetectionsListResponse,
    AdminLoginRequest,
    AdminLoginResponse,
    AdminOverviewResponse,
    AdminRevenueResponse,
    AdminScanOut,
    AdminScansListResponse,
    AdminSubscriberDetail,
    AdminSubscriberOut,
    AdminSubscriberPaymentRow,
    AdminSubscribersListResponse,
    AdminSystemStatus,
    DetectionOut,
    MessageResponse,
    RiskLevel,
    ScanResponse,
    ScanStatus,
    UpdateSubscriberStatusRequest,
)
from routers.scan import run_scan as _run_scan_for_subscriber
from services.business_metrics import (
    MONTHLY_PRICE_INR,
    USD_TO_INR_RATE,
    is_active_as_of,
    mrr_as_of,
    next_payment_due as _next_payment_due,
    parse_dt,
    plan_mrr_value,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/admin", tags=["admin"])

SERPAPI_ACCOUNT_ENDPOINT = "https://serpapi.com/account.json"
# Rough placeholder rates for a Sonnet-class model - Anthropic has no usage/
# cost API reachable with a plain API key, so this is intentionally labeled
# as an estimate in the response rather than presented as real billing data.
ANTHROPIC_EST_INPUT_TOKENS_PER_CALL = 450
ANTHROPIC_EST_OUTPUT_TOKENS_PER_CALL = 150
ANTHROPIC_INPUT_COST_PER_MILLION = 3.0
ANTHROPIC_OUTPUT_COST_PER_MILLION = 15.0

# Rough public-pricing estimates, not real invoices - always labeled as such
# wherever displayed. SerpAPI/YouTube are excluded from $ cost: both are
# quota-based against a flat plan/free tier, not billed per call.
PROVIDER_COST_PER_CALL_USD = {
    "rekognition": 0.001,  # ~$1 per 1,000 CompareFaces calls, AWS public pricing tier 1
    "sightengine": 0.01,  # rough placeholder - verify against your actual Sightengine plan
}


@router.post("/login", response_model=AdminLoginResponse)
def admin_login(payload: AdminLoginRequest, request: Request):
    check_login_rate_limit(request)
    if not verify_admin_password(payload.password):
        record_failed_login(request)
        raise HTTPException(status_code=401, detail="Incorrect password")
    return AdminLoginResponse(token=create_admin_token())


def _time_boundaries() -> dict:
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=today_start.weekday())
    month_start = today_start.replace(day=1)
    day_ago = now - timedelta(hours=24)
    return {"today": today_start, "week": week_start, "month": month_start, "day_ago": day_ago, "now": now}


def _count(supabase, table: str, **filters) -> int:
    q = supabase.table(table).select("id", count="exact")
    for col, (op, value) in filters.items():
        q = getattr(q, op)(col, value)
    return q.execute().count or 0


def _usage_counts(supabase, provider: str, b: dict) -> dict:
    """Best-effort, non-fatal (api_usage_events may not exist until migration
    005 is applied)."""
    try:
        today = _count(supabase, "api_usage_events", provider=("eq", provider), created_at=("gte", b["today"].isoformat()))
        month = _count(supabase, "api_usage_events", provider=("eq", provider), created_at=("gte", b["month"].isoformat()))
    except Exception as exc:  # noqa: BLE001
        logger.warning("Usage lookup failed for %s: %s", provider, exc)
        today = month = 0
    return {"calls_today": today, "calls_this_month": month}


def _estimate_anthropic_cost(calls: int) -> float:
    input_cost = calls * ANTHROPIC_EST_INPUT_TOKENS_PER_CALL / 1_000_000 * ANTHROPIC_INPUT_COST_PER_MILLION
    output_cost = calls * ANTHROPIC_EST_OUTPUT_TOKENS_PER_CALL / 1_000_000 * ANTHROPIC_OUTPUT_COST_PER_MILLION
    return round(input_cost + output_cost, 2)


def _provider_cost_usd(provider: str, calls: int) -> float:
    if provider == "anthropic":
        return _estimate_anthropic_cost(calls)
    rate = PROVIDER_COST_PER_CALL_USD.get(provider)
    return round(calls * rate, 2) if rate else 0.0


@router.get("/overview", response_model=AdminOverviewResponse, dependencies=[Depends(require_admin)])
def admin_overview():
    supabase = get_supabase()
    b = _time_boundaries()

    all_subs = supabase.table("subscribers").select("*").execute().data or []
    try:
        active_subscribers = sum(1 for s in all_subs if (s.get("account_status") or "active") == "active")
    except Exception:  # noqa: BLE001 - account_status may not exist until migration 005 is applied
        active_subscribers = len(all_subs)

    monthly_subscriber_count = sum(
        1 for s in all_subs if is_active_as_of(s, b["now"]) and (s.get("plan") or "monthly") != "annual"
    )
    annual_subscriber_count = sum(
        1 for s in all_subs if is_active_as_of(s, b["now"]) and s.get("plan") == "annual"
    )
    mrr = mrr_as_of(all_subs, b["now"])

    end_of_last_month = b["month"] - timedelta(seconds=1)
    revenue_this_month = mrr
    revenue_last_month = mrr_as_of(all_subs, end_of_last_month)
    revenue_change_percent = (
        round((revenue_this_month - revenue_last_month) / revenue_last_month * 100, 1)
        if revenue_last_month > 0
        else None
    )

    try:
        churn_this_month = sum(
            1
            for s in all_subs
            if s.get("account_status") == "suspended"
            and (parse_dt(s.get("suspended_at")) or datetime.min.replace(tzinfo=timezone.utc)) >= b["month"]
        )
    except Exception:  # noqa: BLE001 - suspended_at may not exist until migration 006 is applied
        churn_this_month = 0

    today_scans = (
        supabase.table("scans").select("status").gte("started_at", b["today"].isoformat()).execute().data or []
    )
    scans_today = len(today_scans)
    scans_today_completed = sum(1 for s in today_scans if s["status"] == "completed")
    scans_today_failed = sum(1 for s in today_scans if s["status"] == "failed")

    scans_this_week = _count(supabase, "scans", started_at=("gte", b["week"].isoformat()))
    scans_this_month = _count(supabase, "scans", started_at=("gte", b["month"].isoformat()))

    detections_today = _count(supabase, "detections", created_at=("gte", b["today"].isoformat()))
    detections_this_week = _count(supabase, "detections", created_at=("gte", b["week"].isoformat()))
    detections_this_month = _count(supabase, "detections", created_at=("gte", b["month"].isoformat()))

    critical_high_last_24h = (
        supabase.table("detections")
        .select("id", count="exact")
        .in_("risk_level", [RiskLevel.HIGH.value, RiskLevel.CRITICAL.value])
        .gte("created_at", b["day_ago"].isoformat())
        .execute()
        .count
        or 0
    )

    cost_this_month_usd = sum(
        _provider_cost_usd(provider, _usage_counts(supabase, provider, b)["calls_this_month"])
        for provider in ("rekognition", "sightengine", "anthropic")
    )
    gross_profit_this_month_inr = round(revenue_this_month - cost_this_month_usd * USD_TO_INR_RATE, 2)

    try:
        supabase.table("subscribers").select("id").limit(1).execute()
        supabase_healthy = True
    except Exception:  # noqa: BLE001
        supabase_healthy = False

    recent = (
        supabase.table("scans")
        .select("*, subscribers(name, email)")
        .order("started_at", desc=True)
        .limit(10)
        .execute()
        .data
        or []
    )
    recent_activity = [
        AdminActivityItem(
            scan_id=row["id"],
            subscriber_name=(row.get("subscribers") or {}).get("name"),
            subscriber_email=(row.get("subscribers") or {}).get("email"),
            status=ScanStatus(row["status"]),
            candidates_found=row["candidates_found"],
            matches_found=row["matches_found"],
            started_at=row["started_at"],
            completed_at=row.get("completed_at"),
        )
        for row in recent
    ]

    return AdminOverviewResponse(
        active_subscribers=active_subscribers,
        scans_today=scans_today,
        scans_this_week=scans_this_week,
        scans_this_month=scans_this_month,
        detections_today=detections_today,
        detections_this_week=detections_this_week,
        detections_this_month=detections_this_month,
        critical_high_last_24h=critical_high_last_24h,
        system_status=AdminSystemStatus(api_healthy=True, supabase_healthy=supabase_healthy),
        recent_activity=recent_activity,
        mrr=mrr,
        monthly_subscriber_count=monthly_subscriber_count,
        annual_subscriber_count=annual_subscriber_count,
        scans_today_completed=scans_today_completed,
        scans_today_failed=scans_today_failed,
        revenue_this_month=revenue_this_month,
        revenue_last_month=revenue_last_month,
        revenue_change_percent=revenue_change_percent,
        cost_this_month_usd=round(cost_this_month_usd, 2),
        gross_profit_this_month_inr=gross_profit_this_month_inr,
        churn_this_month=churn_this_month,
    )


@router.get("/revenue", response_model=AdminRevenueResponse, dependencies=[Depends(require_admin)])
def admin_revenue():
    supabase = get_supabase()
    b = _time_boundaries()
    now = b["now"]

    all_subs = supabase.table("subscribers").select("*").order("created_at", desc=True).execute().data or []

    mrr = mrr_as_of(all_subs, now)
    arr = mrr * 12
    monthly_plan_revenue = sum(
        plan_mrr_value(s.get("plan"))
        for s in all_subs
        if is_active_as_of(s, now) and (s.get("plan") or "monthly") != "annual"
    )
    annual_plan_revenue = sum(
        plan_mrr_value(s.get("plan")) for s in all_subs if is_active_as_of(s, now) and s.get("plan") == "annual"
    )

    cost_breakdown_usd = {
        provider: _provider_cost_usd(provider, _usage_counts(supabase, provider, b)["calls_this_month"])
        for provider in ("rekognition", "sightengine", "anthropic")
    }
    total_cost_usd = round(sum(cost_breakdown_usd.values()), 2)
    total_cost_inr = round(total_cost_usd * USD_TO_INR_RATE, 2)
    gross_margin_inr = round(mrr - total_cost_inr, 2)
    break_even_subscribers = math.ceil(total_cost_inr / MONTHLY_PRICE_INR) if total_cost_inr > 0 else 0

    payment_rows = [
        AdminSubscriberPaymentRow(
            id=s["id"],
            name=s.get("name"),
            email=s["email"],
            plan=s.get("plan"),
            mrr_value=plan_mrr_value(s.get("plan")),
            created_at=s.get("created_at"),
            next_payment_due=_next_payment_due(s.get("created_at"), s.get("plan"), now),
        )
        for s in all_subs
    ]

    return AdminRevenueResponse(
        mrr=mrr,
        arr=arr,
        monthly_plan_revenue=monthly_plan_revenue,
        annual_plan_revenue=annual_plan_revenue,
        cost_breakdown_usd=cost_breakdown_usd,
        total_cost_this_month_usd=total_cost_usd,
        total_cost_this_month_inr=total_cost_inr,
        gross_margin_inr=gross_margin_inr,
        break_even_subscribers=break_even_subscribers,
        fx_note=(
            f"Revenue is based on assigned plan price, not verified Stripe billing (not live yet). "
            f"Costs are converted from USD at an illustrative rate of ₹{USD_TO_INR_RATE:.0f}/$ for this "
            f"comparison only. Break-even uses the flat monthly price (₹{MONTHLY_PRICE_INR:,}) as a simple "
            f"blended ARPU proxy."
        ),
        subscribers=payment_rows,
    )


def _to_admin_subscriber_out(sub: dict, last_scan_at, total_detections: int, now: datetime) -> AdminSubscriberOut:
    return AdminSubscriberOut(
        id=sub["id"],
        email=sub["email"],
        name=sub.get("name"),
        phone=sub.get("phone"),
        plan=sub.get("plan"),
        subscription_status=sub.get("subscription_status"),
        account_status=sub.get("account_status") or "active",
        created_at=sub.get("created_at"),
        last_scan_at=last_scan_at,
        total_detections=total_detections,
        mrr_value=plan_mrr_value(sub.get("plan")),
        next_payment_due=_next_payment_due(sub.get("created_at"), sub.get("plan"), now),
        suspended_at=sub.get("suspended_at"),
    )


@router.get("/subscribers", response_model=AdminSubscribersListResponse, dependencies=[Depends(require_admin)])
def list_admin_subscribers():
    supabase = get_supabase()
    subs = supabase.table("subscribers").select("*").order("created_at", desc=True).execute().data or []
    scans = supabase.table("scans").select("subscriber_id, started_at").execute().data or []
    detections = supabase.table("detections").select("subscriber_id").execute().data or []

    last_scan_by_sub: dict[str, str] = {}
    for s in scans:
        sid, started = s.get("subscriber_id"), s.get("started_at")
        if sid and started and (sid not in last_scan_by_sub or started > last_scan_by_sub[sid]):
            last_scan_by_sub[sid] = started

    detection_count_by_sub: dict[str, int] = {}
    for d in detections:
        sid = d.get("subscriber_id")
        if sid:
            detection_count_by_sub[sid] = detection_count_by_sub.get(sid, 0) + 1

    now = datetime.now(timezone.utc)
    result = [
        _to_admin_subscriber_out(sub, last_scan_by_sub.get(sub["id"]), detection_count_by_sub.get(sub["id"], 0), now)
        for sub in subs
    ]
    return AdminSubscribersListResponse(total=len(result), subscribers=result)


@router.get(
    "/subscribers/{subscriber_id}", response_model=AdminSubscriberDetail, dependencies=[Depends(require_admin)]
)
def get_admin_subscriber(subscriber_id: str):
    supabase = get_supabase()
    sub = supabase.table("subscribers").select("*").eq("id", subscriber_id).maybe_single().execute()
    if not sub.data:
        raise HTTPException(status_code=404, detail="Subscriber not found")

    scans_rows = (
        supabase.table("scans")
        .select("*")
        .eq("subscriber_id", subscriber_id)
        .order("started_at", desc=True)
        .execute()
        .data
        or []
    )
    detections_rows = (
        supabase.table("detections")
        .select("*")
        .eq("subscriber_id", subscriber_id)
        .order("created_at", desc=True)
        .execute()
        .data
        or []
    )

    return AdminSubscriberDetail(
        subscriber=_to_admin_subscriber_out(
            sub.data,
            scans_rows[0]["started_at"] if scans_rows else None,
            len(detections_rows),
            datetime.now(timezone.utc),
        ),
        scans=[
            ScanResponse(
                scan_id=row["id"],
                subscriber_id=row["subscriber_id"],
                status=ScanStatus(row["status"]),
                candidates_found=row["candidates_found"],
                matches_found=row["matches_found"],
                started_at=row["started_at"],
                completed_at=row.get("completed_at"),
            )
            for row in scans_rows
        ],
        detections=[DetectionOut(**row) for row in detections_rows],
    )


@router.patch(
    "/subscribers/{subscriber_id}/status", response_model=MessageResponse, dependencies=[Depends(require_admin)]
)
def update_subscriber_status(subscriber_id: str, payload: UpdateSubscriberStatusRequest):
    supabase = get_supabase()
    existing = supabase.table("subscribers").select("id").eq("id", subscriber_id).maybe_single().execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Subscriber not found")

    update = {"account_status": payload.status}
    try:
        # suspended_at drives churn-this-month and the MRR trend on the
        # Overview/Revenue pages - set on suspend, cleared on reactivate.
        update["suspended_at"] = datetime.now(timezone.utc).isoformat() if payload.status == "suspended" else None
        supabase.table("subscribers").update(update).eq("id", subscriber_id).execute()
    except Exception:  # noqa: BLE001 - suspended_at may not exist until migration 006 is applied
        try:
            supabase.table("subscribers").update({"account_status": payload.status}).eq(
                "id", subscriber_id
            ).execute()
        except Exception as exc:  # noqa: BLE001 - account_status may not exist until migration 005 is applied
            logger.error("Failed to update account_status for %s: %s", subscriber_id, exc)
            raise HTTPException(
                status_code=503, detail="Account status is not available yet. Please try again later."
            ) from exc

    return MessageResponse(message=f"Subscriber {payload.status}")


@router.post("/subscribers/{subscriber_id}/scan", response_model=ScanResponse, dependencies=[Depends(require_admin)])
def admin_trigger_scan(subscriber_id: str, background_tasks: BackgroundTasks):
    return _run_scan_for_subscriber(subscriber_id, background_tasks)


@router.get("/detections", response_model=AdminDetectionsListResponse, dependencies=[Depends(require_admin)])
def list_admin_detections(
    risk_level: Optional[RiskLevel] = None,
    platform: Optional[str] = None,
    subscriber_id: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    limit: int = Query(default=1000, le=2000),
):
    supabase = get_supabase()
    q = supabase.table("detections").select("*, subscribers(name, email)")
    if risk_level:
        q = q.eq("risk_level", risk_level.value)
    if platform:
        q = q.eq("platform", platform)
    if subscriber_id:
        q = q.eq("subscriber_id", subscriber_id)
    if date_from:
        q = q.gte("created_at", date_from)
    if date_to:
        q = q.lte("created_at", date_to)

    rows = q.order("created_at", desc=True).limit(limit).execute().data or []
    detections = [
        AdminDetectionOut(
            **{k: v for k, v in row.items() if k != "subscribers"},
            subscriber_name=(row.get("subscribers") or {}).get("name"),
            subscriber_email=(row.get("subscribers") or {}).get("email"),
        )
        for row in rows
    ]
    return AdminDetectionsListResponse(total=len(detections), detections=detections)


@router.get("/scans", response_model=AdminScansListResponse, dependencies=[Depends(require_admin)])
def list_admin_scans(
    status: Optional[ScanStatus] = None,
    subscriber_id: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    limit: int = Query(default=1000, le=2000),
):
    supabase = get_supabase()
    q = supabase.table("scans").select("*, subscribers(name, email)")
    if status:
        q = q.eq("status", status.value)
    if subscriber_id:
        q = q.eq("subscriber_id", subscriber_id)
    if date_from:
        q = q.gte("started_at", date_from)
    if date_to:
        q = q.lte("started_at", date_to)

    rows = q.order("started_at", desc=True).limit(limit).execute().data or []
    scans = [
        AdminScanOut(
            scan_id=row["id"],
            subscriber_id=row["subscriber_id"],
            status=ScanStatus(row["status"]),
            candidates_found=row["candidates_found"],
            matches_found=row["matches_found"],
            started_at=row["started_at"],
            completed_at=row.get("completed_at"),
            subscriber_name=(row.get("subscribers") or {}).get("name"),
            subscriber_email=(row.get("subscribers") or {}).get("email"),
            error_message=row.get("error_message"),
        )
        for row in rows
    ]
    return AdminScansListResponse(total=len(scans), scans=scans)


@router.get("/api-usage", dependencies=[Depends(require_admin)])
def admin_api_usage():
    supabase = get_supabase()
    b = _time_boundaries()

    serpapi_usage = _usage_counts(supabase, "serpapi", b)
    settings = get_settings()
    try:
        resp = httpx.get(SERPAPI_ACCOUNT_ENDPOINT, params={"api_key": settings.serpapi_key}, timeout=10.0)
        resp.raise_for_status()
        account = resp.json()
        serpapi_usage["plan_searches_left"] = account.get("plan_searches_left")
        serpapi_usage["this_month_usage"] = account.get("this_month_usage")
        serpapi_usage["total_searches_left"] = account.get("total_searches_left")
    except Exception as exc:  # noqa: BLE001 - live account check is best-effort
        logger.warning("SerpAPI account check failed: %s", exc)
        serpapi_usage["plan_searches_left"] = None

    # Burn-rate projection: average daily usage so far this month, applied to
    # whatever SerpAPI reports as remaining. None if we don't have both numbers.
    days_elapsed_this_month = max(1, (b["now"] - b["month"]).days + 1)
    daily_burn_rate = serpapi_usage["calls_this_month"] / days_elapsed_this_month
    plan_searches_left = serpapi_usage.get("plan_searches_left")
    serpapi_usage["days_until_exhausted"] = (
        round(plan_searches_left / daily_burn_rate, 1)
        if plan_searches_left is not None and daily_burn_rate > 0
        else None
    )

    youtube_usage = _usage_counts(supabase, "youtube", b)
    rekognition_usage = _usage_counts(supabase, "rekognition", b)
    sightengine_usage = _usage_counts(supabase, "sightengine", b)
    anthropic_usage = _usage_counts(supabase, "anthropic", b)

    rekognition_usage["estimated_cost_usd_this_month"] = _provider_cost_usd(
        "rekognition", rekognition_usage["calls_this_month"]
    )
    sightengine_usage["estimated_cost_usd_this_month"] = _provider_cost_usd(
        "sightengine", sightengine_usage["calls_this_month"]
    )
    anthropic_usage["estimated_cost_usd_this_month"] = _estimate_anthropic_cost(anthropic_usage["calls_this_month"])
    anthropic_usage["cost_note"] = (
        "Rough estimate based on typical tokens per call, not exact billing "
        "(Anthropic does not expose a usage API for this key type)."
    )

    total_cost_usd = (
        rekognition_usage["estimated_cost_usd_this_month"]
        + sightengine_usage["estimated_cost_usd_this_month"]
        + anthropic_usage["estimated_cost_usd_this_month"]
    )

    try:
        active_subscribers = _count(supabase, "subscribers", account_status=("eq", "active"))
    except Exception:  # noqa: BLE001 - account_status may not exist until migration 005 is applied
        active_subscribers = _count(supabase, "subscribers")

    return {
        "serpapi": serpapi_usage,
        "youtube": youtube_usage,
        "rekognition": rekognition_usage,
        "sightengine": sightengine_usage,
        "anthropic": anthropic_usage,
        "total_estimated_cost_usd_this_month": round(total_cost_usd, 2),
        "cost_per_subscriber_this_month_usd": round(total_cost_usd / active_subscribers, 4)
        if active_subscribers
        else None,
        "cost_scope_note": (
            "Total cost covers AWS Rekognition, Sightengine, and Anthropic only. "
            "SerpAPI and YouTube are quota-based against a flat plan/free tier, "
            "not billed per call, so they are excluded from the $ total."
        ),
    }
