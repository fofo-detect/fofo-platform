import concurrent.futures
import logging
from io import BytesIO

import boto3
from botocore.exceptions import ClientError

from core.config import get_settings

logger = logging.getLogger(__name__)


class FaceNotDetectedError(Exception):
    pass


def normalize_to_jpeg_bytes(image_bytes: bytes) -> bytes:
    """Re-encode as JPEG so AWS Rekognition, which only accepts JPEG/PNG, never
    rejects a genuinely valid photo just because it arrived as WebP/GIF/BMP/etc.
    Returns the original bytes unchanged if they can't be decoded as an image
    at all - the caller's existing error handling deals with that case.
    """
    from PIL import Image, UnidentifiedImageError  # lazy: keeps Pillow off the startup path

    try:
        with Image.open(BytesIO(image_bytes)) as img:
            rgb = img.convert("RGB")
            buf = BytesIO()
            rgb.save(buf, format="JPEG", quality=90)
            return buf.getvalue()
    except UnidentifiedImageError:
        return image_bytes


def _client():
    settings = get_settings()
    return boto3.client(
        "rekognition",
        aws_access_key_id=settings.aws_access_key_id,
        aws_secret_access_key=settings.aws_secret_access_key,
        region_name=settings.aws_region,
    )


def _ensure_collection_exists(client, collection_id: str) -> None:
    try:
        client.create_collection(CollectionId=collection_id)
        logger.info("Created Rekognition collection %s", collection_id)
    except client.exceptions.ResourceAlreadyExistsException:
        pass


def index_face_bytes(subscriber_id: str, image_bytes: bytes, *, ensure_collection: bool = True) -> str:
    """Index one enrollment photo into the shared Rekognition collection.

    ExternalImageId is set to subscriber_id so matches can be attributed back
    to a subscriber. Returns the resulting FaceId.

    ensure_collection=False skips the create_collection check - used by the
    batch path below, which already checked once for the whole batch instead
    of once per image (this used to run on every single enrollment photo,
    adding a redundant AWS round trip - always a guaranteed-to-fail
    "already exists" call after the very first enrollment ever - to each of
    up to 8 sequential requests).
    """
    settings = get_settings()
    client = _client()
    if ensure_collection:
        _ensure_collection_exists(client, settings.aws_rekognition_collection_id)
    image_bytes = normalize_to_jpeg_bytes(image_bytes)

    try:
        response = client.index_faces(
            CollectionId=settings.aws_rekognition_collection_id,
            Image={"Bytes": image_bytes},
            ExternalImageId=subscriber_id,
            MaxFaces=1,
            QualityFilter="AUTO",
            DetectionAttributes=[],
        )
    except ClientError as exc:
        raise FaceNotDetectedError(str(exc)) from exc

    face_records = response.get("FaceRecords", [])
    if not face_records:
        reasons = [u.get("Reasons") for u in response.get("UnindexedFaces", [])]
        raise FaceNotDetectedError(f"No usable face found in image ({reasons})")

    return face_records[0]["Face"]["FaceId"]


def index_faces_for_subscriber(subscriber_id: str, images: list[bytes]) -> list[str]:
    """Index all enrollment photos for a subscriber concurrently (thread pool,
    same pattern as scan.py's candidate processing - boto3 is synchronous, so
    this is genuine thread-level parallelism), returning the FaceIds that
    succeeded.

    This used to index one photo at a time, sequentially, inside a single
    request - up to 8 photos x a redundant collection check each meant as
    many as 16 sequential AWS round trips before a mobile client ever got a
    response, which was slow enough on a mobile upload to risk the
    connection dropping before the request finished.
    """
    if not images:
        raise ValueError("At least one image is required")

    settings = get_settings()
    _ensure_collection_exists(_client(), settings.aws_rekognition_collection_id)

    face_ids: list[str] = []
    errors: list[str] = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=len(images)) as executor:
        futures = {
            executor.submit(index_face_bytes, subscriber_id, image_bytes, ensure_collection=False): idx
            for idx, image_bytes in enumerate(images)
        }
        for future in concurrent.futures.as_completed(futures):
            idx = futures[future]
            try:
                face_ids.append(future.result())
            except FaceNotDetectedError as exc:
                errors.append(f"image {idx + 1}: {exc}")

    if not face_ids:
        raise FaceNotDetectedError(f"No face detected in any enrollment photo ({'; '.join(errors)})")

    return face_ids
