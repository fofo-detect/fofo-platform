import json
import logging
import re
from typing import Optional

from anthropic import Anthropic

from core.config import get_settings
from models.schemas import ClaudeClassification, RiskLevel

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = (
    "You are a risk analyst for FOFO, a face identity protection platform. "
    "You receive data about a detected unauthorized use of someone's face online. "
    "Analyze the detection and return a JSON object with: risk_level (LOW/MEDIUM/HIGH/CRITICAL), "
    "alert_message (one clear sentence for the subscriber), and reason (brief explanation). "
    "Base risk_level on: platform type, deepfake probability score, context clues in the URL. "
    "CRITICAL = confirmed deepfake on financial or political platform. "
    "HIGH = likely deepfake or high-profile misuse. "
    "MEDIUM = possible misuse, unclear context. "
    "LOW = low confidence match or benign context. "
    "Return only valid JSON."
)

_JSON_BLOCK_RE = re.compile(r"\{.*\}", re.DOTALL)


class ClaudeClassificationError(Exception):
    pass


def _extract_json(text: str) -> dict:
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        match = _JSON_BLOCK_RE.search(text)
        if not match:
            raise
        return json.loads(match.group(0))


def classify_detection(
    *,
    platform: Optional[str],
    source_url: Optional[str],
    image_url: Optional[str],
    distance_score: Optional[float],
    deepfake_score: Optional[float],
) -> ClaudeClassification:
    settings = get_settings()
    client = Anthropic(api_key=settings.anthropic_api_key)

    detection_payload = {
        "platform": platform,
        "source_url": source_url,
        "image_url": image_url,
        "face_match_distance": distance_score,
        "deepfake_probability": deepfake_score,
    }

    try:
        response = client.messages.create(
            model=settings.anthropic_model,
            max_tokens=512,
            system=SYSTEM_PROMPT,
            messages=[
                {
                    "role": "user",
                    "content": json.dumps(detection_payload),
                }
            ],
        )
    except Exception as exc:  # noqa: BLE001 - surface any SDK error uniformly
        logger.error("Claude classification request failed: %s", exc)
        raise ClaudeClassificationError(str(exc)) from exc

    text_parts = [block.text for block in response.content if getattr(block, "type", None) == "text"]
    raw_text = "".join(text_parts).strip()

    try:
        parsed = _extract_json(raw_text)
        risk_level = RiskLevel(parsed["risk_level"].upper())
        return ClaudeClassification(
            risk_level=risk_level,
            alert_message=parsed["alert_message"],
            reason=parsed.get("reason", ""),
        )
    except (json.JSONDecodeError, KeyError, ValueError) as exc:
        logger.error("Failed to parse Claude classification response: %s | raw=%s", exc, raw_text)
        raise ClaudeClassificationError(f"Could not parse Claude response: {exc}") from exc
