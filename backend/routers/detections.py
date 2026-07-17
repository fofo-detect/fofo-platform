from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException

from core.supabase_client import get_supabase
from models.schemas import DetectionOut, DetectionsListResponse

router = APIRouter(tags=["detections"])


@router.get("/detections/{subscriber_id}", response_model=DetectionsListResponse)
def list_detections(subscriber_id: str):
    supabase = get_supabase()

    subscriber = (
        supabase.table("subscribers").select("id").eq("id", subscriber_id).maybe_single().execute()
    )
    if not subscriber.data:
        raise HTTPException(status_code=404, detail="Subscriber not found")

    result = (
        supabase.table("detections")
        .select("*")
        .eq("subscriber_id", subscriber_id)
        .order("created_at", desc=True)
        .execute()
    )
    rows = result.data or []

    return DetectionsListResponse(
        subscriber_id=subscriber_id,
        total=len(rows),
        detections=[DetectionOut(**row) for row in rows],
    )


@router.patch("/detections/{detection_id}/report", response_model=DetectionOut)
def report_detection(detection_id: str):
    supabase = get_supabase()

    # maybe_single().execute() returns None (not a response with .data = None)
    # when zero rows match, rather than raising - confirmed by direct testing,
    # not assumed from the same pattern used elsewhere in this codebase.
    existing = supabase.table("detections").select("id").eq("id", detection_id).maybe_single().execute()
    if not existing or not existing.data:
        raise HTTPException(status_code=404, detail="Detection not found")

    try:
        result = (
            supabase.table("detections")
            .update({"reported": True, "reported_at": datetime.now(timezone.utc).isoformat()})
            .eq("id", detection_id)
            .execute()
        )
    except Exception as exc:  # noqa: BLE001 - reported/reported_at may not exist until migration 007 is applied
        raise HTTPException(
            status_code=503, detail="Reporting is not available yet. Please try again later."
        ) from exc

    return DetectionOut(**result.data[0])
