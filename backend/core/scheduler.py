import logging
from datetime import datetime, timezone
from typing import Optional

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger

from core.config import get_settings
from core.supabase_client import get_supabase

logger = logging.getLogger(__name__)

_JOB_ID = "fofo-auto-scan-sweep"
_scheduler: Optional[BackgroundScheduler] = None


def _run_scheduled_scan_sweep() -> None:
    """Runs every SCAN_INTERVAL_HOURS. For every subscriber with
    account_status = 'active', starts a scan unless one is already running
    for them - each one runs sequentially within the sweep (not in parallel
    across subscribers), which doubles as a natural rate limiter against
    bursting the SerpAPI quota across every subscriber at once.
    """
    # Imported here, not at module load time, to avoid a circular import
    # (routers.scan imports nothing from core.scheduler, but core.scheduler
    # needs routers.scan's internals - importing lazily inside the job avoids
    # ordering issues between the two modules at app startup).
    from routers.scan import _resolve_reference_image_urls, _run_scan_background

    supabase = get_supabase()
    logger.info("Scheduled scan sweep starting")

    try:
        subscribers = (
            supabase.table("subscribers").select("*").eq("account_status", "active").execute().data or []
        )
    except Exception as exc:  # noqa: BLE001 - a bad sweep must not crash the scheduler thread
        logger.error("Scheduled scan sweep: could not fetch active subscribers: %s", exc)
        return

    logger.info("Scheduled scan sweep: %d active subscriber(s) found", len(subscribers))
    started = 0

    for subscriber in subscribers:
        subscriber_id = subscriber["id"]

        try:
            running_count = (
                supabase.table("scans")
                .select("id", count="exact")
                .eq("subscriber_id", subscriber_id)
                .eq("status", "running")
                .execute()
                .count
                or 0
            )
        except Exception as exc:  # noqa: BLE001
            logger.warning(
                "Scheduled scan: could not check running status for subscriber %s, skipping: %s",
                subscriber_id,
                exc,
            )
            continue

        if running_count > 0:
            logger.info("Scheduled scan skipped for subscriber %s: a scan is already running", subscriber_id)
            continue

        reference_image_urls = _resolve_reference_image_urls(subscriber)
        if not reference_image_urls:
            logger.info("Scheduled scan skipped for subscriber %s: no enrolled face on file", subscriber_id)
            continue

        started_at = datetime.now(timezone.utc).isoformat()
        try:
            scan_insert = (
                supabase.table("scans")
                .insert(
                    {
                        "subscriber_id": subscriber_id,
                        "status": "running",
                        "candidates_found": 0,
                        "matches_found": 0,
                        "started_at": started_at,
                    }
                )
                .execute()
            )
            scan_id = scan_insert.data[0]["id"]
        except Exception as exc:  # noqa: BLE001
            logger.error("Scheduled scan: could not create scan row for subscriber %s: %s", subscriber_id, exc)
            continue

        logger.info("Scheduled scan %s starting for subscriber %s", scan_id, subscriber_id)
        _run_scan_background(subscriber_id, scan_id, reference_image_urls, subscriber)
        logger.info("Scheduled scan %s finished for subscriber %s", scan_id, subscriber_id)
        started += 1

    logger.info("Scheduled scan sweep complete: %d scan(s) started", started)


def start_scheduler() -> None:
    """Called once from main.py's startup event. Safe to call more than once -
    a second call is a no-op rather than starting a duplicate scheduler."""
    global _scheduler
    if _scheduler is not None:
        logger.info("Scan scheduler already running, skipping start")
        return

    settings = get_settings()
    scheduler = BackgroundScheduler(timezone="UTC")
    scheduler.add_job(
        _run_scheduled_scan_sweep,
        trigger=IntervalTrigger(hours=settings.scan_interval_hours),
        id=_JOB_ID,
        max_instances=1,
        coalesce=True,
        replace_existing=True,
    )
    scheduler.start()
    _scheduler = scheduler
    logger.info("Scan scheduler started: sweeping every %s hour(s)", settings.scan_interval_hours)


def stop_scheduler() -> None:
    global _scheduler
    if _scheduler is not None:
        _scheduler.shutdown(wait=False)
        _scheduler = None


def get_scheduler_status() -> dict:
    settings = get_settings()
    if _scheduler is None:
        return {"running": False, "next_run_at": None, "interval_hours": settings.scan_interval_hours}

    job = _scheduler.get_job(_JOB_ID)
    next_run_at = job.next_run_time.isoformat() if job and job.next_run_time else None
    return {
        "running": _scheduler.running,
        "next_run_at": next_run_at,
        "interval_hours": settings.scan_interval_hours,
    }
