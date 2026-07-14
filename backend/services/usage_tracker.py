import logging

from core.supabase_client import get_supabase

logger = logging.getLogger(__name__)


def log_api_call(provider: str) -> None:
    """Best-effort usage log for the admin API Usage page - self-tracked
    because none of SerpAPI/AWS/Sightengine/Anthropic/YouTube expose a simple
    "calls this month" API. Must never fail the real operation it tracks.
    """
    try:
        get_supabase().table("api_usage_events").insert({"provider": provider}).execute()
    except Exception as exc:  # noqa: BLE001
        logger.warning("Could not log API usage event for %s: %s", provider, exc)
