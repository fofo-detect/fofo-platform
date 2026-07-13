import logging
import uuid

import boto3
from botocore.exceptions import BotoCoreError, ClientError

from core.config import get_settings

logger = logging.getLogger(__name__)


class S3UploadError(Exception):
    pass


def _client():
    settings = get_settings()
    return boto3.client(
        "s3",
        aws_access_key_id=settings.aws_access_key_id,
        aws_secret_access_key=settings.aws_secret_access_key,
        region_name=settings.aws_region,
    )


def upload_enrollment_photo(*, subscriber_id: str, image_bytes: bytes, content_type: str = "image/jpeg") -> str:
    """Upload an enrollment photo to S3 and return its public URL.

    This is what SerpAPI Google Lens searches against, since it requires a
    publicly reachable image URL rather than raw bytes.
    """
    settings = get_settings()
    if not settings.aws_access_key_id or not settings.aws_secret_access_key:
        raise S3UploadError("AWS credentials are not configured")

    key = f"enrollment/{subscriber_id}/{uuid.uuid4().hex}.jpg"
    try:
        client = _client()
        client.put_object(
            Bucket=settings.aws_s3_bucket,
            Key=key,
            Body=image_bytes,
            ContentType=content_type,
            ACL="public-read",
        )
    except (BotoCoreError, ClientError) as exc:
        logger.error("S3 upload failed for subscriber %s: %s", subscriber_id, exc)
        raise S3UploadError(str(exc)) from exc

    return f"https://{settings.aws_s3_bucket}.s3.{settings.aws_region}.amazonaws.com/{key}"
