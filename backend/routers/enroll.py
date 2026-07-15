import concurrent.futures
import logging

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from core.supabase_client import get_supabase
from models.schemas import EnrollResponse
from services.face_encoder import FaceNotDetectedError, index_faces_for_subscriber
from services.s3_storage import S3UploadError, upload_enrollment_photo

logger = logging.getLogger(__name__)
router = APIRouter(tags=["enroll"])

ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/jpg", "image/png", "image/webp"}
MIN_PHOTO_COUNT = 3
MAX_PHOTO_COUNT = 8


@router.post("/enroll", response_model=EnrollResponse)
async def enroll(subscriber_id: str = Form(...), files: list[UploadFile] = File(...)):
    if not (MIN_PHOTO_COUNT <= len(files) <= MAX_PHOTO_COUNT):
        raise HTTPException(
            status_code=400,
            detail=f"Between {MIN_PHOTO_COUNT} and {MAX_PHOTO_COUNT} photos are required",
        )

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
        face_ids = index_faces_for_subscriber(subscriber_id, images)
    except FaceNotDetectedError as exc:
        raise HTTPException(status_code=422, detail=f"Could not enroll: {exc}") from exc

    # Every enrolled photo is uploaded, not just one - the scan endpoint runs a
    # separate Google Lens search per reference image, so more enrolled angles
    # means more search seeds and a wider net of candidates per scan. Uploaded
    # concurrently (was a sequential loop) so up to 8 S3 uploads take roughly
    # the time of one instead of stacking up inside the same request a mobile
    # client is waiting on.
    upload_results: list[str | None] = [None] * len(images)
    with concurrent.futures.ThreadPoolExecutor(max_workers=len(images)) as executor:
        futures = {
            executor.submit(upload_enrollment_photo, subscriber_id=subscriber_id, image_bytes=img): idx
            for idx, img in enumerate(images)
        }
        for future in concurrent.futures.as_completed(futures):
            idx = futures[future]
            try:
                upload_results[idx] = future.result()
            except S3UploadError as exc:
                logger.warning("Skipping one reference image upload for %s: %s", subscriber_id, exc)
    reference_image_urls = [url for url in upload_results if url]

    update_payload: dict = {}
    if reference_image_urls:
        update_payload["reference_image_url"] = reference_image_urls[0]
        update_payload["reference_image_urls"] = reference_image_urls

    if update_payload:
        supabase.table("subscribers").update(update_payload).eq("id", subscriber_id).execute()

    return EnrollResponse(
        subscriber_id=subscriber_id,
        message="Face enrolled successfully",
        faces_indexed=len(face_ids),
    )
