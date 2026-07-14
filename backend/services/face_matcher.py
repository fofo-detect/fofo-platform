import logging
from dataclasses import dataclass
from io import BytesIO
from typing import Optional

import boto3
import httpx
from botocore.exceptions import ClientError

from core.config import get_settings
from services.face_encoder import normalize_to_jpeg_bytes
from services.usage_tracker import log_api_call

logger = logging.getLogger(__name__)

THUMBNAIL_MAX_DIMENSION = 200
DOWNLOAD_TIMEOUT_SECONDS = 10.0
MAX_IMAGE_BYTES = 15 * 1024 * 1024


@dataclass
class MatchResult:
    is_match: bool
    # AWS Rekognition CompareFaces similarity score, 0-100 (higher = more
    # similar) — not a distance metric, despite the field name kept for
    # compatibility with the existing `distance_score` DB column / API field.
    distance: Optional[float]
    is_thumbnail: bool
    error: Optional[str] = None


def _rekognition_client():
    settings = get_settings()
    return boto3.client(
        "rekognition",
        aws_access_key_id=settings.aws_access_key_id,
        aws_secret_access_key=settings.aws_secret_access_key,
        region_name=settings.aws_region,
    )


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
    from PIL import Image, UnidentifiedImageError  # lazy: keeps Pillow off the startup path

    try:
        with Image.open(BytesIO(image_bytes)) as img:
            width, height = img.size
    except UnidentifiedImageError:
        return True
    return max(width, height) <= THUMBNAIL_MAX_DIMENSION


def match_candidate(reference_image_bytes: bytes, candidate_url: str) -> MatchResult:
    """Download a candidate image and compare it against the subscriber's reference
    face photo via AWS Rekognition CompareFaces.

    reference_image_bytes must already be JPEG/PNG (normalize_to_jpeg_bytes) -
    normalizing it here too would mean re-encoding the same reference photo on
    every single candidate instead of once per scan.
    """
    settings = get_settings()
    image_bytes = download_image(candidate_url)
    if image_bytes is None:
        return MatchResult(is_match=False, distance=None, is_thumbnail=False, error="download_failed")

    is_thumb = _is_thumbnail(image_bytes)
    threshold = (
        settings.face_match_similarity_threshold_thumbnail
        if is_thumb
        else settings.face_match_similarity_threshold_full
    )

    # AWS Rekognition only accepts JPEG/PNG - candidates scraped from the web
    # arrive in every format (WebP, GIF, BMP, ...), and would otherwise be
    # silently dropped with InvalidImageFormatException despite being valid,
    # real, sometimes-matching photos.
    normalized_image_bytes = normalize_to_jpeg_bytes(image_bytes)

    client = _rekognition_client()
    log_api_call("rekognition")
    try:
        response = client.compare_faces(
            SourceImage={"Bytes": reference_image_bytes},
            TargetImage={"Bytes": normalized_image_bytes},
            SimilarityThreshold=0,
        )
    except ClientError as exc:
        logger.warning("Rekognition compare_faces failed for %s: %s", candidate_url, exc)
        return MatchResult(is_match=False, distance=None, is_thumbnail=is_thumb, error="compare_failed")

    matches = response.get("FaceMatches", [])
    if not matches:
        return MatchResult(is_match=False, distance=None, is_thumbnail=is_thumb, error="no_face_detected")

    best_similarity = max(m["Similarity"] for m in matches)
    return MatchResult(is_match=best_similarity >= threshold, distance=best_similarity, is_thumbnail=is_thumb)
