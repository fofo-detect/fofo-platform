import logging
from typing import Optional

import stripe
from fastapi import APIRouter, Header, HTTPException, Request

from core.supabase_client import get_supabase
from models.schemas import CreateCheckoutRequest, CreateCheckoutResponse
from services.stripe_service import construct_webhook_event, create_checkout_session, handle_webhook_event

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/stripe", tags=["stripe"])


@router.post("/create-checkout-session", response_model=CreateCheckoutResponse)
def create_checkout(payload: CreateCheckoutRequest):
    supabase = get_supabase()
    subscriber = (
        supabase.table("subscribers")
        .select("id, email, name")
        .eq("id", payload.subscriber_id)
        .maybe_single()
        .execute()
    )
    if not subscriber.data:
        raise HTTPException(status_code=404, detail="Subscriber not found")

    try:
        checkout_url = create_checkout_session(
            subscriber_id=subscriber.data["id"],
            email=subscriber.data["email"],
            name=subscriber.data.get("name"),
            plan=payload.plan.value,
        )
    except Exception as exc:  # noqa: BLE001
        logger.error("Failed to create Stripe checkout session: %s", exc)
        raise HTTPException(status_code=502, detail="Could not start checkout") from exc

    return CreateCheckoutResponse(checkout_url=checkout_url)


@router.post("/webhook", status_code=200)
async def stripe_webhook(request: Request, stripe_signature: Optional[str] = Header(default=None)):
    if not stripe_signature:
        raise HTTPException(status_code=400, detail="Missing Stripe-Signature header")

    payload = await request.body()

    try:
        event = construct_webhook_event(payload=payload, sig_header=stripe_signature)
    except (ValueError, stripe.error.SignatureVerificationError) as exc:
        logger.warning("Rejected invalid Stripe webhook: %s", exc)
        raise HTTPException(status_code=400, detail="Invalid webhook signature") from exc

    try:
        handle_webhook_event(event)
    except Exception as exc:  # noqa: BLE001
        logger.error("Error processing Stripe webhook event %s: %s", event.get("type"), exc)
        raise HTTPException(status_code=500, detail="Webhook processing failed") from exc

    return {"received": True}
