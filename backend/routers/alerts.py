from fastapi import APIRouter, HTTPException

from core.supabase_client import get_supabase
from models.schemas import MessageResponse
from services import whatsapp
from services.whatsapp import WhatsAppSendError

router = APIRouter(prefix="/alerts", tags=["alerts"])


@router.post("/test/{subscriber_id}", response_model=MessageResponse)
def send_test_alert(subscriber_id: str):
    supabase = get_supabase()
    subscriber = supabase.table("subscribers").select("*").eq("id", subscriber_id).maybe_single().execute()
    if not subscriber.data:
        raise HTTPException(status_code=404, detail="Subscriber not found")

    phone = subscriber.data.get("phone")
    if not phone:
        raise HTTPException(status_code=400, detail="No WhatsApp number on file for this account")

    try:
        whatsapp.send_detection_alert(
            phone=phone,
            subscriber_name=subscriber.data.get("name") or "there",
            platform="FOFO",
            risk_level="TEST",
            alert_message="This is a test alert to confirm your WhatsApp notifications are working.",
            source_url=None,
        )
    except WhatsAppSendError as exc:
        raise HTTPException(status_code=502, detail="Could not send test alert. Please try again.") from exc

    return MessageResponse(message=f"Test alert sent to {phone}")
