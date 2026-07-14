import logging

from fastapi import APIRouter, HTTPException

from core.supabase_client import get_supabase
from models.schemas import (
    DEFAULT_ALERT_PREFERENCES,
    AlertPreferences,
    SubscriberOut,
    UpdateAlertPreferencesRequest,
    UpdateSubscriberRequest,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/subscribers", tags=["subscribers"])


def _to_subscriber_out(row: dict) -> SubscriberOut:
    data = {**row}
    data["reference_image_urls"] = row.get("reference_image_urls") or []
    data["alert_preferences"] = AlertPreferences(**(row.get("alert_preferences") or DEFAULT_ALERT_PREFERENCES))
    return SubscriberOut(**data)


@router.get("/{subscriber_id}", response_model=SubscriberOut)
def get_subscriber(subscriber_id: str):
    supabase = get_supabase()
    result = supabase.table("subscribers").select("*").eq("id", subscriber_id).maybe_single().execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Subscriber not found")
    return _to_subscriber_out(result.data)


@router.patch("/{subscriber_id}", response_model=SubscriberOut)
def update_subscriber(subscriber_id: str, payload: UpdateSubscriberRequest):
    supabase = get_supabase()
    existing = supabase.table("subscribers").select("id").eq("id", subscriber_id).maybe_single().execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Subscriber not found")

    update_fields = payload.model_dump(exclude_none=True)
    if not update_fields:
        raise HTTPException(status_code=400, detail="No fields to update")

    result = supabase.table("subscribers").update(update_fields).eq("id", subscriber_id).execute()
    return _to_subscriber_out(result.data[0])


@router.patch("/{subscriber_id}/alert-preferences", response_model=SubscriberOut)
def update_alert_preferences(subscriber_id: str, payload: UpdateAlertPreferencesRequest):
    supabase = get_supabase()
    existing = supabase.table("subscribers").select("*").eq("id", subscriber_id).maybe_single().execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Subscriber not found")

    current = existing.data.get("alert_preferences") or DEFAULT_ALERT_PREFERENCES
    updates = payload.model_dump(exclude_none=True)
    merged = {**DEFAULT_ALERT_PREFERENCES, **current, **updates}

    try:
        result = (
            supabase.table("subscribers")
            .update({"alert_preferences": merged})
            .eq("id", subscriber_id)
            .execute()
        )
    except Exception as exc:  # noqa: BLE001 - column may not exist until migration 004 is applied
        logger.error("Failed to update alert preferences for %s: %s", subscriber_id, exc)
        raise HTTPException(
            status_code=503,
            detail="Alert preferences aren't available yet. Please try again later.",
        ) from exc

    return _to_subscriber_out(result.data[0])
