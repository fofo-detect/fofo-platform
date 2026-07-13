import logging

import httpx

from core.config import get_settings

logger = logging.getLogger(__name__)

SIGHTENGINE_ENDPOINT = "https://api.sightengine.com/1.0/check.json"
REQUEST_TIMEOUT_SECONDS = 15.0


class SightengineError(Exception):
    pass


def get_deepfake_score(image_url: str) -> float:
    """Return a 0.0-1.0 deepfake probability score for an image URL via Sightengine."""
    settings = get_settings()
    params = {
        "url": image_url,
        "models": "deepfake",
        "api_user": settings.sightengine_api_user,
        "api_secret": settings.sightengine_api_secret,
    }
    try:
        resp = httpx.get(SIGHTENGINE_ENDPOINT, params=params, timeout=REQUEST_TIMEOUT_SECONDS)
        resp.raise_for_status()
        data = resp.json()
    except (httpx.HTTPError, httpx.TimeoutException) as exc:
        logger.warning("Sightengine request failed for %s: %s", image_url, exc)
        raise SightengineError(str(exc)) from exc

    if data.get("status") != "success":
        error_msg = data.get("error", {}).get("message", "unknown error")
        raise SightengineError(f"Sightengine returned an error: {error_msg}")

    score = data.get("type", {}).get("deepfake")
    if score is None:
        raise SightengineError("Sightengine response missing deepfake score")
    return float(score)
