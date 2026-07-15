import calendar
from datetime import datetime
from typing import Optional

# Matches the prices shown on the subscribe page (frontend/app/subscribe/page.tsx).
# Not read from Stripe - Stripe is not live yet, per the founder's own note, so
# these are the assigned-plan prices, not verified payment amounts.
MONTHLY_PRICE_INR = 50_000
ANNUAL_PRICE_INR = 500_000
ANNUAL_MONTHLY_EQUIVALENT_INR = round(ANNUAL_PRICE_INR / 12)  # 41,667

# Illustrative only, for combining USD API costs with INR revenue into one
# gross-margin figure - not a live FX rate.
USD_TO_INR_RATE = 83.0


def plan_mrr_value(plan: Optional[str]) -> int:
    return ANNUAL_MONTHLY_EQUIVALENT_INR if plan == "annual" else MONTHLY_PRICE_INR


def parse_dt(value) -> Optional[datetime]:
    if not value:
        return None
    if isinstance(value, datetime):
        return value
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None


def is_active_as_of(sub: dict, as_of: datetime) -> bool:
    """A subscriber counts toward MRR as of `as_of` if they had joined by then
    and had not yet been suspended by then. suspended_at may not exist until
    migration 006 is applied, in which case every subscriber with account_status
    != 'suspended' is simply always active (best available approximation)."""
    created = parse_dt(sub.get("created_at"))
    if not created or created > as_of:
        return False
    if "suspended_at" in sub:
        suspended = parse_dt(sub.get("suspended_at"))
        if suspended and suspended <= as_of:
            return False
        return True
    return sub.get("account_status") != "suspended"


def mrr_as_of(subs: list[dict], as_of: datetime) -> float:
    return sum(plan_mrr_value(s.get("plan")) for s in subs if is_active_as_of(s, as_of))


def add_months(dt: datetime, months: int) -> datetime:
    month_index = dt.month - 1 + months
    year = dt.year + month_index // 12
    month = month_index % 12 + 1
    day = min(dt.day, calendar.monthrange(year, month)[1])
    return dt.replace(year=year, month=month, day=day)


def next_payment_due(created_at, plan: Optional[str], now: datetime) -> Optional[datetime]:
    created = parse_dt(created_at)
    if not created:
        return None
    interval_months = 12 if plan == "annual" else 1
    due = created
    for _ in range(1200):  # safety cap against pathological/corrupt data
        if due > now:
            return due
        due = add_months(due, interval_months)
    return due
