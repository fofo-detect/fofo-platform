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
