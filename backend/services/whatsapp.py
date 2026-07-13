import logging
from typing import Optional

import httpx

from core.config import get_settings

logger = logging.getLogger(__name__)

MSG91_ENDPOINT = "https://control.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/"
REQUEST_TIMEOUT_SECONDS = 15.0


class WhatsAppSendError(Exception):
    pass


def send_detection_alert(
    *,
    phone: str,
    subscriber_name: str,
    platform: Optional[str],
    risk_level: str,
    alert_message: str,
    source_url: Optional[str],
) -> None:
    """Send a WhatsApp template alert via MSG91 for a HIGH/CRITICAL risk detection."""
    settings = get_settings()

    payload = {
        "integrated_number": settings.msg91_integrated_number,
        "content_type": "template",
        "payload": {
            "messaging_product": "whatsapp",
            "type": "template",
            "template": {
                "name": settings.msg91_template_id,
                "language": {"code": "en", "policy": "deterministic"},
                "to_and_components": [
                    {
                        "to": [phone],
                        "components": {
                            "body_1": {"type": "text", "value": subscriber_name},
                            "body_2": {"type": "text", "value": risk_level},
                            "body_3": {"type": "text", "value": alert_message},
                            "body_4": {"type": "text", "value": platform or "unknown platform"},
                            "body_5": {"type": "text", "value": source_url or "N/A"},
                        },
                    }
                ],
            },
        },
    }

    headers = {"authkey": settings.msg91_auth_key, "Content-Type": "application/json"}

    try:
        resp = httpx.post(MSG91_ENDPOINT, json=payload, headers=headers, timeout=REQUEST_TIMEOUT_SECONDS)
        resp.raise_for_status()
    except (httpx.HTTPError, httpx.TimeoutException) as exc:
        logger.error("MSG91 WhatsApp alert failed for %s: %s", phone, exc)
        raise WhatsAppSendError(str(exc)) from exc
