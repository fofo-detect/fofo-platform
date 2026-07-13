import logging

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from core.supabase_client import get_supabase
from models.schemas import EnrollResponse
from services.face_encoder import FaceNotDetectedError, encode_faces_average
from services.s3_storage import S3UploadError, upload_enrollment_photo

logger = logging.getLogger(__name__)
router = APIRouter(tags=["enroll"])

ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/jpg", "image/png", "image/webp"}
REQUIRED_PHOTO_COUNT = 3


@router.post("/enroll", response_model=EnrollResponse)
async def enroll(subscriber_id: str = Form(...), files: list[UploadFile] = File(...)):
    if len(files) != REQUIRED_PHOTO_COUNT:
        raise HTTPException(status_code=400, detail=f"Exactly {REQUIRED_PHOTO_COUNT} photos are required")

    supabase = get_supabase()
    existing = (
        supabase.table("subscribers").select("id").eq("id", subscriber_id).maybe_single().execute()
    )
    if not existing.data:
        raise HTTPException(status_code=404, detail="Subscriber not found")

    images: list[bytes] = []
    for f in files:
        if f.content_type not in ALLOWED_CONTENT_TYPES:
            raise HTTPException(status_code=400, detail=f"Unsupported file type: {f.content_type}")
        content = await f.read()
        if not content:
            raise HTTPException(status_code=400, detail=f"Empty file: {f.filename}")
        images.append(content)

    try:
        face_vector = encode_faces_average(images)
    except FaceNotDetectedError as exc:
        raise HTTPException(status_code=422, detail=f"Could not enroll: {exc}") from exc

    update_payload: dict = {"face_vector": face_vector}

    try:
        reference_image_url = upload_enrollment_photo(subscriber_id=subscriber_id, image_bytes=images[0])
        update_payload["reference_image_url"] = reference_image_url
    except S3UploadError as exc:
        logger.warning("Skipping reference image upload for %s: %s", subscriber_id, exc)

    supabase.table("subscribers").update(update_payload).eq("id", subscriber_id).execute()

    return EnrollResponse(
        subscriber_id=subscriber_id,
        message="Face enrolled successfully",
        vector_dimensions=len(face_vector),
    )
