import logging

import boto3
from botocore.exceptions import ClientError

from core.config import get_settings

logger = logging.getLogger(__name__)


class FaceNotDetectedError(Exception):
    pass


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


def index_face_bytes(subscriber_id: str, image_bytes: bytes) -> str:
    """Index one enrollment photo into the shared Rekognition collection.

    ExternalImageId is set to subscriber_id so matches can be attributed back
    to a subscriber. Returns the resulting FaceId.
    """
    settings = get_settings()
    client = _client()
    _ensure_collection_exists(client, settings.aws_rekognition_collection_id)

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
    """Index all enrollment photos for a subscriber, return the FaceIds that succeeded."""
    if not images:
        raise ValueError("At least one image is required")

    face_ids = []
    errors = []
    for idx, image_bytes in enumerate(images):
        try:
            face_ids.append(index_face_bytes(subscriber_id, image_bytes))
        except FaceNotDetectedError as exc:
            errors.append(f"image {idx + 1}: {exc}")

    if not face_ids:
        raise FaceNotDetectedError(f"No face detected in any enrollment photo ({'; '.join(errors)})")

    return face_ids
