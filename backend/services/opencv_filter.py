import logging
from typing import Optional, Union

import cv2
import httpx
import numpy as np

logger = logging.getLogger(__name__)

DOWNLOAD_TIMEOUT_SECONDS = 10.0

_FACE_CASCADE = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")


def _download(url: str) -> Optional[bytes]:
    try:
        with httpx.Client(follow_redirects=True, timeout=DOWNLOAD_TIMEOUT_SECONDS) as client:
            resp = client.get(url, headers={"User-Agent": "Mozilla/5.0 (FOFO Face Monitor)"})
            resp.raise_for_status()
            return resp.content
    except (httpx.HTTPError, httpx.TimeoutException) as exc:
        logger.warning("OpenCV pre-filter: could not download %s: %s", url, exc)
        return None


def has_face(image: Union[str, bytes]) -> bool:
    """Cheap local pre-filter run before every AWS Rekognition CompareFaces call.

    Rekognition is billed per call; a Haar Cascade face detector running
    locally can reject the large share of candidate images that contain no
    face at all (logos, text screenshots, landscape/product photos) for free,
    so only genuine face candidates are ever sent to Rekognition.

    Accepts either an image URL (downloaded here) or raw image bytes already
    in hand. Fails open: any error - download failure, an undecodable image,
    a cascade error - returns True so the candidate still reaches Rekognition
    rather than being silently dropped.
    """
    try:
        image_bytes = _download(image) if isinstance(image, str) else image
        if not image_bytes:
            return True

        array = np.frombuffer(image_bytes, dtype=np.uint8)
        img = cv2.imdecode(array, cv2.IMREAD_GRAYSCALE)
        if img is None:
            return True

        faces = _FACE_CASCADE.detectMultiScale(img, scaleFactor=1.1, minNeighbors=5, minSize=(30, 30))
        return len(faces) > 0
    except Exception as exc:  # noqa: BLE001 - fail open, never block a candidate on a local CV error
        logger.warning("OpenCV pre-filter failed, passing candidate through to Rekognition: %s", exc)
        return True
