import logging
from dataclasses import dataclass
from typing import Optional

import cv2
import httpx
import numpy as np

from core.config import get_settings
from services.face_encoder import FaceNotDetectedError, encode_face_from_bytes

logger = logging.getLogger(__name__)

THUMBNAIL_MAX_DIMENSION = 200
DOWNLOAD_TIMEOUT_SECONDS = 10.0
MAX_IMAGE_BYTES = 15 * 1024 * 1024


@dataclass
class MatchResult:
    is_match: bool
    distance: Optional[float]
    is_thumbnail: bool
    error: Optional[str] = None


def _euclidean_l2_distance(vec_a: list[float], vec_b: list[float]) -> float:
    a = np.array(vec_a, dtype=np.float64)
    b = np.array(vec_b, dtype=np.float64)
    a_norm = a / (np.linalg.norm(a) or 1.0)
    b_norm = b / (np.linalg.norm(b) or 1.0)
    return float(np.linalg.norm(a_norm - b_norm))


def download_image(url: str) -> Optional[bytes]:
    try:
        with httpx.Client(follow_redirects=True, timeout=DOWNLOAD_TIMEOUT_SECONDS) as client:
            resp = client.get(url, headers={"User-Agent": "Mozilla/5.0 (FOFO Face Monitor)"})
            resp.raise_for_status()
            content = resp.content
            if len(content) > MAX_IMAGE_BYTES:
                logger.warning("Skipping oversized image at %s", url)
                return None
            return content
    except (httpx.HTTPError, httpx.TimeoutException) as exc:
        logger.warning("Failed to download candidate image %s: %s", url, exc)
        return None


def _is_thumbnail(image_bytes: bytes) -> bool:
    arr = np.frombuffer(image_bytes, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        return True
    h, w = img.shape[:2]
    return max(h, w) <= THUMBNAIL_MAX_DIMENSION


def match_candidate(reference_vector: list[float], candidate_url: str) -> MatchResult:
    """Download a candidate image and compare it against the subscriber's reference face vector."""
    settings = get_settings()
    image_bytes = download_image(candidate_url)
    if image_bytes is None:
        return MatchResult(is_match=False, distance=None, is_thumbnail=False, error="download_failed")

    is_thumb = _is_thumbnail(image_bytes)
    threshold = (
        settings.face_match_distance_threshold_thumbnail
        if is_thumb
        else settings.face_match_distance_threshold_full
    )

    try:
        candidate_vector = encode_face_from_bytes(image_bytes)
    except FaceNotDetectedError:
        return MatchResult(is_match=False, distance=None, is_thumbnail=is_thumb, error="no_face_detected")

    distance = _euclidean_l2_distance(reference_vector, candidate_vector)
    return MatchResult(is_match=distance <= threshold, distance=distance, is_thumbnail=is_thumb)
