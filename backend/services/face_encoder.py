import numpy as np
import cv2
from deepface import DeepFace

MODEL_NAME = "ArcFace"
DETECTOR_BACKEND = "opencv"


class FaceNotDetectedError(Exception):
    pass


def _bytes_to_bgr_array(image_bytes: bytes) -> np.ndarray:
    arr = np.frombuffer(image_bytes, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("Could not decode image bytes")
    return img


def encode_face_from_bytes(image_bytes: bytes) -> list[float]:
    """Run DeepFace ArcFace on raw image bytes, return a 512-dim L2-normalized embedding."""
    try:
        img = _bytes_to_bgr_array(image_bytes)
    except ValueError as exc:
        # Undecodable bytes (corrupt/truncated/unsupported format) are just as
        # unusable as "no face found" to every caller, which already only
        # catches FaceNotDetectedError — surface it the same way instead of
        # letting a raw ValueError escape and crash the whole batch.
        raise FaceNotDetectedError(str(exc)) from exc

    try:
        results = DeepFace.represent(
            img_path=img,
            model_name=MODEL_NAME,
            detector_backend=DETECTOR_BACKEND,
            enforce_detection=True,
            align=True,
        )
    except ValueError as exc:
        raise FaceNotDetectedError(str(exc)) from exc

    if not results:
        raise FaceNotDetectedError("No face found in image")

    # Pick the largest detected face if multiple are found
    best = max(results, key=lambda r: r["facial_area"]["w"] * r["facial_area"]["h"])
    embedding = np.array(best["embedding"], dtype=np.float64)
    norm = np.linalg.norm(embedding)
    if norm > 0:
        embedding = embedding / norm
    return embedding.tolist()


def encode_faces_average(images: list[bytes]) -> list[float]:
    """Encode multiple enrollment photos and return a single averaged, re-normalized 512-dim vector."""
    if not images:
        raise ValueError("At least one image is required")

    embeddings = []
    errors = []
    for idx, image_bytes in enumerate(images):
        try:
            embeddings.append(encode_face_from_bytes(image_bytes))
        except FaceNotDetectedError as exc:
            errors.append(f"image {idx + 1}: {exc}")

    if not embeddings:
        raise FaceNotDetectedError(f"No face detected in any enrollment photo ({'; '.join(errors)})")

    stacked = np.array(embeddings, dtype=np.float64)
    mean_vec = stacked.mean(axis=0)
    norm = np.linalg.norm(mean_vec)
    if norm > 0:
        mean_vec = mean_vec / norm
    return mean_vec.tolist()
