import logging
from datetime import datetime, timezone
from typing import Optional
from urllib.parse import urlparse

import httpx
from fastapi import APIRouter, BackgroundTasks, HTTPException

from core.config import get_settings
from core.supabase_client import get_supabase
from models.schemas import RiskLevel, ScanResponse, ScanStatus
from services import face_matcher, whatsapp
from services.claude_classifier import ClaudeClassificationError, classify_detection
from services.sightengine import SightengineError, get_deepfake_score
from services.whatsapp import WhatsAppSendError

logger = logging.getLogger(__name__)
router = APIRouter(tags=["scan"])

SERPAPI_ENDPOINT = "https://serpapi.com/search.json"
SERPAPI_TIMEOUT_SECONDS = 30.0
ALERTABLE_RISK_LEVELS = {RiskLevel.HIGH, RiskLevel.CRITICAL}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _search_google_lens(image_url: str, max_results: int) -> list[dict]:
    settings = get_settings()
    params = {"engine": "google_lens", "url": image_url, "api_key": settings.serpapi_key}
    try:
        resp = httpx.get(SERPAPI_ENDPOINT, params=params, timeout=SERPAPI_TIMEOUT_SECONDS)
        resp.raise_for_status()
        data = resp.json()
    except (httpx.HTTPError, httpx.TimeoutException) as exc:
        raise RuntimeError(f"SerpAPI Google Lens request failed: {exc}") from exc

    if "error" in data:
        raise RuntimeError(f"SerpAPI error: {data['error']}")

    visual_matches = data.get("visual_matches", [])
    return visual_matches[:max_results]


def _derive_platform(source_url: Optional[str]) -> Optional[str]:
    if not source_url:
        return None
    try:
        host = urlparse(source_url).netloc
    except ValueError:
        return None
    return host[4:] if host.startswith("www.") else host or None


def _fail_scan(scan_id: str) -> None:
    get_supabase().table("scans").update(
        {"status": ScanStatus.FAILED.value, "completed_at": _now()}
    ).eq("id", scan_id).execute()


def _run_scan_background(subscriber_id: str, scan_id: str, reference_image_url: str, subscriber_data: dict) -> None:
    """The actual scan work. Runs after the HTTP response has already been sent -
    a full scan (up to 59 candidates through Rekognition/Sightengine/Claude) takes
    5-7+ minutes, longer than Railway's proxy will hold a client connection open.
    """
    settings = get_settings()
    supabase = get_supabase()

    try:
        reference_image_bytes = face_matcher.download_image(reference_image_url)
        if reference_image_bytes is None:
            logger.error("Scan %s failed: could not fetch subscriber's reference photo", scan_id)
            _fail_scan(scan_id)
            return

        try:
            candidates = _search_google_lens(reference_image_url, settings.max_candidates_per_scan)
        except RuntimeError as exc:
            logger.error("Scan %s failed during SerpAPI search: %s", scan_id, exc)
            _fail_scan(scan_id)
            return

        matches_found = 0

        for candidate in candidates:
            candidate_image_url = candidate.get("image") or candidate.get("thumbnail")
            source_url = candidate.get("link")
            if not candidate_image_url:
                continue

            try:
                match_result = face_matcher.match_candidate(reference_image_bytes, candidate_image_url)
                if not match_result.is_match:
                    continue

                matches_found += 1
                platform = _derive_platform(source_url or candidate.get("source"))

                deepfake_score: Optional[float] = None
                try:
                    deepfake_score = get_deepfake_score(candidate_image_url)
                except SightengineError as exc:
                    logger.warning("Sightengine scoring failed for %s: %s", candidate_image_url, exc)

                try:
                    classification = classify_detection(
                        platform=platform,
                        source_url=source_url,
                        image_url=candidate_image_url,
                        distance_score=match_result.distance,
                        deepfake_score=deepfake_score,
                    )
                    risk_level = classification.risk_level
                    alert_message = classification.alert_message
                except ClaudeClassificationError as exc:
                    logger.error("Claude classification failed for detection: %s", exc)
                    risk_level = RiskLevel.MEDIUM
                    alert_message = "Automatic risk classification failed; manual review recommended."

                detection_row = {
                    "subscriber_id": subscriber_id,
                    "scan_id": scan_id,
                    "image_url": candidate_image_url,
                    "source_url": source_url,
                    "platform": platform,
                    "distance_score": match_result.distance,
                    "deepfake_score": deepfake_score,
                    "risk_level": risk_level.value,
                    "alert_message": alert_message,
                }

                if risk_level in ALERTABLE_RISK_LEVELS and subscriber_data.get("phone"):
                    try:
                        whatsapp.send_detection_alert(
                            phone=subscriber_data["phone"],
                            subscriber_name=subscriber_data.get("name") or "there",
                            platform=platform,
                            risk_level=risk_level.value,
                            alert_message=alert_message,
                            source_url=source_url,
                        )
                        detection_row["alerted_at"] = _now()
                    except WhatsAppSendError as exc:
                        logger.error("WhatsApp alert failed for subscriber %s: %s", subscriber_id, exc)

                supabase.table("detections").insert(detection_row).execute()
            except Exception as exc:  # noqa: BLE001 - one bad candidate must not abort the whole scan
                logger.error("Skipping candidate %s after unexpected error: %s", candidate_image_url, exc)
                continue

        supabase.table("scans").update(
            {
                "status": ScanStatus.COMPLETED.value,
                "candidates_found": len(candidates),
                "matches_found": matches_found,
                "completed_at": _now(),
            }
        ).eq("id", scan_id).execute()
    except Exception:  # noqa: BLE001 - never leave a scan stuck at "running" on an unexpected error
        logger.exception("Scan %s failed with an unexpected error", scan_id)
        _fail_scan(scan_id)


@router.post("/scan/{subscriber_id}", response_model=ScanResponse, status_code=202)
def run_scan(subscriber_id: str, background_tasks: BackgroundTasks):
    supabase = get_supabase()

    subscriber = supabase.table("subscribers").select("*").eq("id", subscriber_id).maybe_single().execute()
    if not subscriber.data:
        raise HTTPException(status_code=404, detail="Subscriber not found")

    reference_image_url = subscriber.data.get("reference_image_url")
    if not reference_image_url:
        raise HTTPException(status_code=400, detail="Subscriber has not completed face enrollment")

    started_at = _now()
    scan_insert = (
        supabase.table("scans")
        .insert(
            {
                "subscriber_id": subscriber_id,
                "status": ScanStatus.RUNNING.value,
                "candidates_found": 0,
                "matches_found": 0,
                "started_at": started_at,
            }
        )
        .execute()
    )
    scan_id = scan_insert.data[0]["id"]

    background_tasks.add_task(_run_scan_background, subscriber_id, scan_id, reference_image_url, subscriber.data)

    return ScanResponse(
        scan_id=scan_id,
        subscriber_id=subscriber_id,
        status=ScanStatus.RUNNING,
        candidates_found=0,
        matches_found=0,
        started_at=started_at,
        completed_at=None,
    )


@router.get("/scan/{scan_id}/status", response_model=ScanResponse)
def get_scan_status(scan_id: str):
    supabase = get_supabase()
    scan = supabase.table("scans").select("*").eq("id", scan_id).maybe_single().execute()
    if not scan.data:
        raise HTTPException(status_code=404, detail="Scan not found")

    return ScanResponse(
        scan_id=scan.data["id"],
        subscriber_id=scan.data["subscriber_id"],
        status=ScanStatus(scan.data["status"]),
        candidates_found=scan.data["candidates_found"],
        matches_found=scan.data["matches_found"],
        started_at=scan.data["started_at"],
        completed_at=scan.data.get("completed_at"),
    )
