import logging
from typing import Optional

import stripe

from core.config import get_settings
from core.supabase_client import get_supabase

logger = logging.getLogger(__name__)

PLAN_TO_PRICE_ENV = {
    "monthly": "stripe_monthly_price_id",
    "annual": "stripe_annual_price_id",
}


def _stripe():
    settings = get_settings()
    stripe.api_key = settings.stripe_secret_key
    return stripe


def get_or_create_customer(*, subscriber_id: str, email: str, name: Optional[str]) -> str:
    """Return the Stripe customer id for a subscriber, creating one if needed."""
    settings = get_settings()
    supabase = get_supabase()
    _stripe()

    existing = (
        supabase.table("subscribers")
        .select("stripe_customer_id")
        .eq("id", subscriber_id)
        .single()
        .execute()
    )
    if existing.data and existing.data.get("stripe_customer_id"):
        return existing.data["stripe_customer_id"]

    customer = stripe.Customer.create(
        email=email,
        name=name or None,
        metadata={"subscriber_id": subscriber_id},
    )

    supabase.table("subscribers").update({"stripe_customer_id": customer.id}).eq(
        "id", subscriber_id
    ).execute()

    return customer.id


def create_checkout_session(*, subscriber_id: str, email: str, name: Optional[str], plan: str) -> str:
    if plan not in PLAN_TO_PRICE_ENV:
        raise ValueError(f"Unknown plan: {plan}")

    settings = get_settings()
    _stripe()

    customer_id = get_or_create_customer(subscriber_id=subscriber_id, email=email, name=name)
    price_id = getattr(settings, PLAN_TO_PRICE_ENV[plan])

    session = stripe.checkout.Session.create(
        customer=customer_id,
        mode="subscription",
        line_items=[{"price": price_id, "quantity": 1}],
        success_url=f"{settings.frontend_url}/dashboard?checkout=success",
        cancel_url=f"{settings.frontend_url}/subscribe?checkout=cancelled",
        metadata={"subscriber_id": subscriber_id, "plan": plan},
        subscription_data={"metadata": {"subscriber_id": subscriber_id, "plan": plan}},
    )

    if not session.url:
        raise RuntimeError("Stripe did not return a checkout URL")
    return session.url


def construct_webhook_event(*, payload: bytes, sig_header: str):
    settings = get_settings()
    _stripe()
    return stripe.Webhook.construct_event(payload, sig_header, settings.stripe_webhook_secret)


def _subscriber_id_from_metadata(obj) -> Optional[str]:
    metadata = getattr(obj, "metadata", None) or {}
    return metadata.get("subscriber_id")


def handle_webhook_event(event) -> None:
    supabase = get_supabase()
    event_type = event["type"]
    data_object = event["data"]["object"]

    if event_type == "checkout.session.completed":
        subscriber_id = data_object.get("metadata", {}).get("subscriber_id")
        plan = data_object.get("metadata", {}).get("plan")
        subscription_id = data_object.get("subscription")
        if subscriber_id:
            update = {"subscription_status": "active"}
            if subscription_id:
                update["stripe_subscription_id"] = subscription_id
            if plan:
                update["plan"] = plan
            supabase.table("subscribers").update(update).eq("id", subscriber_id).execute()

    elif event_type in ("customer.subscription.updated", "customer.subscription.created"):
        subscriber_id = _subscriber_id_from_metadata(data_object)
        status = data_object.get("status")
        if subscriber_id and status:
            supabase.table("subscribers").update(
                {"subscription_status": status, "stripe_subscription_id": data_object.get("id")}
            ).eq("id", subscriber_id).execute()

    elif event_type == "customer.subscription.deleted":
        subscriber_id = _subscriber_id_from_metadata(data_object)
        if subscriber_id:
            supabase.table("subscribers").update({"subscription_status": "canceled"}).eq(
                "id", subscriber_id
            ).execute()

    elif event_type == "invoice.payment_failed":
        subscription_id = data_object.get("subscription")
        if subscription_id:
            supabase.table("subscribers").update({"subscription_status": "past_due"}).eq(
                "stripe_subscription_id", subscription_id
            ).execute()

    else:
        logger.info("Unhandled Stripe event type: %s", event_type)
