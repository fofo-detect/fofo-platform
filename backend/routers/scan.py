import asyncio
import concurrent.futures
import logging
from datetime import datetime, timezone
from typing import Optional, Union
from urllib.parse import urljoin, urlparse

import httpx
from fastapi import APIRouter, BackgroundTasks, HTTPException

from core.config import get_settings
from core.supabase_client import get_supabase
from models.schemas import DEFAULT_ALERT_PREFERENCES, RiskLevel, ScanResponse, ScansListResponse, ScanStatus
from services import face_matcher, whatsapp, youtube_scanner
from services.claude_classifier import ClaudeClassificationError, classify_detection
from services.face_encoder import normalize_to_jpeg_bytes
from services.sightengine import SightengineError, get_deepfake_score
from services.usage_tracker import log_api_call
from services.whatsapp import WhatsAppSendError
from services.youtube_scanner import YouTubeSearchError

logger = logging.getLogger(__name__)
router = APIRouter(tags=["scan"])

SERPAPI_ENDPOINT = "https://serpapi.com/search.json"
SERPAPI_TIMEOUT_SECONDS = 30.0
CANDIDATE_CONCURRENCY = 10

# Name-based text search (Task: find deepfakes that never surface via
# reverse image search because the fabricated content has no visually-
# indexed source photo). Deliberately capped tight - this is the single
# most expensive branch of a scan, since each extracted image costs one
# more Rekognition call on top of everything the visual searches already
# found.
NAME_SEARCH_KEYWORDS = ["deepfake", "fake video", "fake endorsement", "AI generated"]
NAME_SEARCH_MATCH_THRESHOLD = 85.0
NAME_SEARCH_MAX_RESULTS_PER_QUERY = 5
NAME_SEARCH_MAX_IMAGES_PER_PAGE = 5
PAGE_DOWNLOAD_TIMEOUT_SECONDS = 15.0
MAX_PAGE_BYTES = 5 * 1024 * 1024


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


async def _search_google_lens_async(client: httpx.AsyncClient, image_url: str, max_results: int) -> list[dict]:
    """Async counterpart of a single Google Lens search, so every enrolled
    reference photo can be searched concurrently via asyncio.gather() instead
    of one request at a time."""
    settings = get_settings()
    params = {"engine": "google_lens", "url": image_url, "api_key": settings.serpapi_key}
    log_api_call("serpapi")
    try:
        resp = await client.get(SERPAPI_ENDPOINT, params=params, timeout=SERPAPI_TIMEOUT_SECONDS)
        resp.raise_for_status()
        data = resp.json()
    except (httpx.HTTPError, httpx.TimeoutException) as exc:
        raise RuntimeError(f"SerpAPI Google Lens request failed: {exc}") from exc

    if "error" in data:
        raise RuntimeError(f"SerpAPI error: {data['error']}")

    visual_matches = data.get("visual_matches", [])[:max_results]
    for match in visual_matches:
        match["_source"] = "google_lens"
    return visual_matches


async def _search_bing_async(client: httpx.AsyncClient, image_url: str, max_results: int) -> list[dict]:
    """Bing reverse image search via SerpAPI (engine=bing_reverse_image,
    verified live against the real API - this is a distinct SerpAPI product
    from the plain "Bing Images" text-search engine and was confirmed by
    manual testing, not assumed from documentation). Its related_content[]
    entries use original/source instead of Google Lens's image/link -
    normalized to the same {"image", "link"} shape here so every downstream
    candidate looks identical to _process_candidate regardless of source.
    """
    settings = get_settings()
    params = {"engine": "bing_reverse_image", "image_url": image_url, "api_key": settings.serpapi_key}
    log_api_call("serpapi")
    try:
        resp = await client.get(SERPAPI_ENDPOINT, params=params, timeout=SERPAPI_TIMEOUT_SECONDS)
        resp.raise_for_status()
        data = resp.json()
    except (httpx.HTTPError, httpx.TimeoutException) as exc:
        raise RuntimeError(f"SerpAPI Bing request failed: {exc}") from exc

    if "error" in data:
        raise RuntimeError(f"SerpAPI Bing error: {data['error']}")

    results = data.get("related_content", [])[:max_results]
    return [
        {"image": item.get("original"), "link": item.get("source"), "_source": "bing"}
        for item in results
        if item.get("original")
    ]


async def _search_yandex_async(client: httpx.AsyncClient, image_url: str, max_results: int) -> list[dict]:
    """Yandex reverse image search via SerpAPI (engine=yandex_images with
    rpt=imageview - verified live; a plain `image_url` param, unlike Bing,
    returns a 400 for this engine, it needs `url` + rpt=imageview to match
    Yandex's own reverse-image URL scheme). image_results[] entries use
    original_image.link/link, normalized the same way as Bing above.
    """
    settings = get_settings()
    params = {"engine": "yandex_images", "url": image_url, "rpt": "imageview", "api_key": settings.serpapi_key}
    log_api_call("serpapi")
    try:
        resp = await client.get(SERPAPI_ENDPOINT, params=params, timeout=SERPAPI_TIMEOUT_SECONDS)
        resp.raise_for_status()
        data = resp.json()
    except (httpx.HTTPError, httpx.TimeoutException) as exc:
        raise RuntimeError(f"SerpAPI Yandex request failed: {exc}") from exc

    if "error" in data:
        raise RuntimeError(f"SerpAPI Yandex error: {data['error']}")

    results = data.get("image_results", [])[:max_results]
    return [
        {"image": (item.get("original_image") or {}).get("link"), "link": item.get("link"), "_source": "yandex"}
        for item in results
        if (item.get("original_image") or {}).get("link")
    ]


_VISUAL_SEARCH_ENGINES = [
    ("google_lens", _search_google_lens_async),
    ("bing", _search_bing_async),
    ("yandex", _search_yandex_async),
]


async def _gather_searches(
    reference_image_urls: list[str], max_results_each: int
) -> list[tuple[str, str, Union[list[dict], BaseException]]]:
    """Runs Google Lens, Bing, and Yandex reverse image search for every
    enrolled reference photo, all concurrently via one asyncio.gather() call -
    3x len(reference_image_urls) requests fired in parallel, not one engine or
    photo at a time. Returns (engine, image_url, result_or_exception) tuples
    so a failure can be logged precisely instead of just "something failed".
    """
    async with httpx.AsyncClient() as client:
        jobs = [
            (engine_name, image_url, search_fn(client, image_url, max_results_each))
            for image_url in reference_image_urls
            for engine_name, search_fn in _VISUAL_SEARCH_ENGINES
        ]
        outcomes = await asyncio.gather(*(job[2] for job in jobs), return_exceptions=True)
        return [(job[0], job[1], outcome) for job, outcome in zip(jobs, outcomes)]


def _search_all_reference_images(reference_image_urls: list[str], max_results_each: int) -> list[dict]:
    """Search every enrolled photo against three engines concurrently and
    merge the results, deduplicated by candidate image URL - the same match
    often turns up from more than one engine or reference photo. An
    individual (engine, photo) search failure is logged and skipped rather
    than failing the whole scan; only fail outright if every single search
    (all engines, all photos) fails.

    asyncio.run() is safe here because this whole function runs inside a
    BackgroundTasks worker thread, not on FastAPI's main event loop thread.
    """
    results = asyncio.run(_gather_searches(reference_image_urls, max_results_each))

    merged: dict[str, dict] = {}
    failures = 0

    for engine_name, image_url, outcome in results:
        if isinstance(outcome, BaseException):
            failures += 1
            logger.warning("%s search failed for reference image %s: %s", engine_name, image_url, outcome)
            continue

        for candidate in outcome:
            candidate_url = candidate.get("image") or candidate.get("thumbnail")
            if candidate_url and candidate_url not in merged:
                merged[candidate_url] = candidate

    if results and failures == len(results):
        raise RuntimeError("All visual searches failed")

    source_counts: dict[str, int] = {}
    for candidate in merged.values():
        src = candidate.get("_source", "unknown")
        source_counts[src] = source_counts.get(src, 0) + 1
    logger.info("Visual search merged %d unique candidate(s): %s", len(merged), source_counts)

    return list(merged.values())


def _search_youtube(subscriber_name: Optional[str], scan_id: str) -> list[dict]:
    """Second candidate source alongside Google Lens: search YouTube for videos
    by the subscriber's name and shape the results into the same candidate dict
    convention _process_candidate already understands (image/link), tagged with
    an explicit _platform override so they're recorded as "YouTube" rather than
    whatever _derive_platform would parse from a youtube.com URL.

    Never fatal to the scan - a missing API key, exhausted quota, or network
    error here just means the scan proceeds with Google Lens results only.
    """
    if not subscriber_name:
        logger.info("Scan %s: subscriber has no name on file, skipping YouTube search", scan_id)
        return []

    try:
        videos = youtube_scanner.search_videos(subscriber_name)
    except YouTubeSearchError as exc:
        logger.warning("Scan %s: YouTube search failed, continuing without it: %s", scan_id, exc)
        return []

    return [
        {
            "image": video["thumbnail_url"],
            "link": video["video_url"],
            "_platform": "YouTube",
            "_source": "youtube",
        }
        for video in videos
    ]


def _build_name_search_queries(name: str, profession: Optional[str]) -> list[str]:
    prefix = f"{name} {profession}".strip() if profession else name
    return [f"{prefix} {keyword}" for keyword in NAME_SEARCH_KEYWORDS]


async def _search_google_text_async(client: httpx.AsyncClient, query: str, max_results: int) -> list[dict]:
    settings = get_settings()
    params = {"engine": "google", "q": query, "api_key": settings.serpapi_key}
    log_api_call("serpapi")
    try:
        resp = await client.get(SERPAPI_ENDPOINT, params=params, timeout=SERPAPI_TIMEOUT_SECONDS)
        resp.raise_for_status()
        data = resp.json()
    except (httpx.HTTPError, httpx.TimeoutException) as exc:
        raise RuntimeError(f"SerpAPI Google text search failed for {query!r}: {exc}") from exc

    if "error" in data:
        raise RuntimeError(f"SerpAPI Google error for {query!r}: {data['error']}")

    return data.get("organic_results", [])[:max_results]


async def _fetch_page_image_urls(client: httpx.AsyncClient, page_url: str, max_images: int) -> list[str]:
    """Download a result page and extract absolute image URLs from it.
    Best-effort only: a non-HTML response, an oversized page, a network
    failure, or malformed markup all just yield an empty list rather than
    raising - a single bad page must never abort the name-search branch of
    a scan, let alone the whole scan.
    """
    try:
        resp = await client.get(
            page_url,
            timeout=PAGE_DOWNLOAD_TIMEOUT_SECONDS,
            headers={"User-Agent": "Mozilla/5.0 (FOFO Face Monitor)"},
            follow_redirects=True,
        )
        resp.raise_for_status()
    except (httpx.HTTPError, httpx.TimeoutException) as exc:
        logger.warning("Name-search: could not download page %s: %s", page_url, exc)
        return []

    if "html" not in resp.headers.get("content-type", "").lower():
        return []
    if len(resp.content) > MAX_PAGE_BYTES:
        return []

    from bs4 import BeautifulSoup  # lazy: keeps bs4 off the startup path

    try:
        soup = BeautifulSoup(resp.text, "html.parser")
    except Exception as exc:  # noqa: BLE001 - malformed HTML must not abort the scan
        logger.warning("Name-search: could not parse page %s: %s", page_url, exc)
        return []

    image_urls: list[str] = []
    for img in soup.find_all("img"):
        src = img.get("src") or img.get("data-src")
        if not src:
            continue
        absolute = urljoin(page_url, src)
        if absolute.startswith("http") and absolute not in image_urls:
            image_urls.append(absolute)
        if len(image_urls) >= max_images:
            break

    return image_urls


async def _gather_name_search_candidates(queries: list[str]) -> list[dict]:
    async with httpx.AsyncClient() as client:
        query_results = await asyncio.gather(
            *[_search_google_text_async(client, q, NAME_SEARCH_MAX_RESULTS_PER_QUERY) for q in queries],
            return_exceptions=True,
        )

        page_urls: list[str] = []
        for results in query_results:
            if isinstance(results, BaseException):
                continue
            for result in results:
                link = result.get("link")
                if link and link not in page_urls:
                    page_urls.append(link)

        if not page_urls:
            return []

        pages_images = await asyncio.gather(
            *[_fetch_page_image_urls(client, url, NAME_SEARCH_MAX_IMAGES_PER_PAGE) for url in page_urls],
            return_exceptions=True,
        )

    candidates: list[dict] = []
    for page_url, images in zip(page_urls, pages_images):
        if isinstance(images, BaseException):
            continue
        for image_url in images:
            candidates.append(
                {
                    "image": image_url,
                    "link": page_url,
                    "_source": "name_search",
                    "_min_similarity": NAME_SEARCH_MATCH_THRESHOLD,
                }
            )
    return candidates


def _search_by_name(subscriber_name: Optional[str], profession: Optional[str], scan_id: str) -> list[dict]:
    """Text-based search for deepfakes reverse image search never finds (a
    fabricated video with no visually-indexed source thumbnail, for example).
    Never fatal to the scan - any failure just means this bonus source
    contributes nothing.

    Candidates are NOT pre-matched here; they carry a _min_similarity tag so
    the shared _process_candidate pipeline below is the one and only place
    that actually calls Rekognition on them, gated at 85% confidence instead
    of the usual 80/90 thumbnail/full threshold - a common name alone must
    never be enough to create a detection, only a confirmed face match is.
    """
    if not subscriber_name:
        logger.info("Scan %s: subscriber has no name on file, skipping name-based search", scan_id)
        return []

    queries = _build_name_search_queries(subscriber_name, profession)
    try:
        candidates = asyncio.run(_gather_name_search_candidates(queries))
    except Exception as exc:  # noqa: BLE001
        logger.warning("Scan %s: name-based search failed, continuing without it: %s", scan_id, exc)
        return []

    logger.info(
        "Scan %s: name-based search extracted %d image(s) to face-match at %.0f%%+ confidence",
        scan_id,
        len(candidates),
        NAME_SEARCH_MATCH_THRESHOLD,
    )
    return candidates


def _derive_platform(source_url: Optional[str]) -> Optional[str]:
    if not source_url:
        return None
    try:
        host = urlparse(source_url).netloc
    except ValueError:
        return None
    return host[4:] if host.startswith("www.") else host or None


def _resolve_reference_image_urls(subscriber_data: dict) -> list[str]:
    """reference_image_urls (plural) holds every enrolled angle from the camera
    capture flow. Older subscribers enrolled before that existed only have the
    singular reference_image_url, so fall back to a one-element list. Shared
    by the manual /scan endpoint and the scheduled sweep (core/scheduler.py)."""
    reference_image_urls = subscriber_data.get("reference_image_urls")
    if not reference_image_urls:
        single = subscriber_data.get("reference_image_url")
        reference_image_urls = [single] if single else []
    return reference_image_urls


def _fail_scan(scan_id: str, error_message: Optional[str] = None) -> None:
    update = {"status": ScanStatus.FAILED.value, "completed_at": _now()}
    try:
        get_supabase().table("scans").update({**update, "error_message": error_message}).eq(
            "id", scan_id
        ).execute()
    except Exception:  # noqa: BLE001 - error_message column may not exist until migration 005 is applied
        get_supabase().table("scans").update(update).eq("id", scan_id).execute()


def _is_url_already_scanned(supabase, subscriber_id: str, url: str) -> bool:
    result = (
        supabase.table("scanned_urls")
        .select("id")
        .eq("subscriber_id", subscriber_id)
        .eq("url", url)
        .limit(1)
        .execute()
    )
    return len(result.data) > 0


def _mark_url_scanned(supabase, subscriber_id: str, url: str) -> None:
    try:
        supabase.table("scanned_urls").insert(
            {"subscriber_id": subscriber_id, "url": url, "first_checked_at": _now()}
        ).execute()
    except Exception as exc:  # noqa: BLE001 - a duplicate-key race here should never abort the candidate
        logger.warning("Could not record scanned_urls entry for %s: %s", url, exc)


def _detection_already_exists(supabase, subscriber_id: str, image_url: str) -> bool:
    result = (
        supabase.table("detections")
        .select("id")
        .eq("subscriber_id", subscriber_id)
        .eq("image_url", image_url)
        .limit(1)
        .execute()
    )
    return len(result.data) > 0


def _process_candidate(
    candidate: dict,
    subscriber_id: str,
    scan_id: str,
    reference_image_bytes: bytes,
    subscriber_data: dict,
) -> bool:
    """Full per-candidate pipeline: dedup check, Rekognition face comparison,
    deepfake scoring, risk classification, alerting, and the detections
    insert. Runs inside a thread pool (up to CANDIDATE_CONCURRENCY at once,
    since boto3/httpx here are synchronous - this is genuine thread-level
    parallelism, not asyncio). Every failure mode is caught internally so a
    single bad candidate never propagates out of the pool. Returns True if
    this candidate produced a new detection.
    """
    supabase = get_supabase()
    candidate_image_url = candidate.get("image") or candidate.get("thumbnail")
    source_url = candidate.get("link")
    if not candidate_image_url:
        return False

    try:
        # Cross-scan dedup: never re-download/re-compare a URL this subscriber
        # has already had checked in a previous scan, whether or not it turned
        # out to be a match.
        if _is_url_already_scanned(supabase, subscriber_id, candidate_image_url):
            return False
        _mark_url_scanned(supabase, subscriber_id, candidate_image_url)

        match_result = face_matcher.match_candidate(reference_image_bytes, candidate_image_url)
        # Name-search candidates carry their own stricter bar (85% by default)
        # instead of the usual thumbnail/full is_match threshold - a common
        # name alone must never be enough to create a detection.
        min_similarity = candidate.get("_min_similarity")
        if min_similarity is not None:
            if match_result.distance is None or match_result.distance < min_similarity:
                return False
        elif not match_result.is_match:
            return False

        # Belt-and-braces: don't insert a second detections row for the same
        # image even if it somehow slipped past the scanned_urls gate.
        if _detection_already_exists(supabase, subscriber_id, candidate_image_url):
            return False

        platform = candidate.get("_platform") or _derive_platform(source_url or candidate.get("source"))

        deepfake_score: Optional[float] = None
        try:
            deepfake_score = get_deepfake_score(candidate_image_url)
        except SightengineError as exc:
            logger.warning("Sightengine scoring failed for %s: %s", candidate_image_url, exc)

        try:
            classification = classify_detection(
                platform=platform,
                source_url=source_url,
                image_url=candidate_image_url,
                distance_score=match_result.distance,
                deepfake_score=deepfake_score,
            )
            risk_level = classification.risk_level
            alert_message = classification.alert_message
        except ClaudeClassificationError as exc:
            logger.error("Claude classification failed for detection: %s", exc)
            risk_level = RiskLevel.MEDIUM
            alert_message = "Automatic risk classification failed; manual review recommended."

        detection_row = {
            "subscriber_id": subscriber_id,
            "scan_id": scan_id,
            "image_url": candidate_image_url,
            "source_url": source_url,
            "platform": platform,
            "source": candidate.get("_source"),
            "distance_score": match_result.distance,
            "deepfake_score": deepfake_score,
            "risk_level": risk_level.value,
            "alert_message": alert_message,
        }

        alert_preferences = subscriber_data.get("alert_preferences") or DEFAULT_ALERT_PREFERENCES
        if alert_preferences.get(risk_level.value, False) and subscriber_data.get("phone"):
            try:
                whatsapp.send_detection_alert(
                    phone=subscriber_data["phone"],
                    subscriber_name=subscriber_data.get("name") or "there",
                    platform=platform,
                    risk_level=risk_level.value,
                    alert_message=alert_message,
                    source_url=source_url,
                )
                detection_row["alerted_at"] = _now()
            except WhatsAppSendError as exc:
                logger.error("WhatsApp alert failed for subscriber %s: %s", subscriber_id, exc)

        try:
            supabase.table("detections").insert(detection_row).execute()
        except Exception:  # noqa: BLE001 - `source` column may not exist until migration 008 is applied
            detection_row.pop("source", None)
            supabase.table("detections").insert(detection_row).execute()
        return True
    except Exception as exc:  # noqa: BLE001 - one bad candidate must not abort the whole scan
        logger.error("Skipping candidate %s after unexpected error: %s", candidate_image_url, exc)
        return False


def _run_scan_background(
    subscriber_id: str, scan_id: str, reference_image_urls: list[str], subscriber_data: dict
) -> None:
    """The actual scan work. Runs after the HTTP response has already been sent -
    even parallelized, a full scan (Rekognition/Sightengine/Claude across up to
    ~472 candidates) takes longer than Railway's proxy will hold a client
    connection open.
    """
    settings = get_settings()
    supabase = get_supabase()

    try:
        # Rekognition CompareFaces only needs one good source image per candidate
        # comparison, unlike the Google Lens search below which benefits from
        # searching with every enrolled angle - so only the first reference photo
        # is downloaded and normalized here.
        reference_image_bytes = face_matcher.download_image(reference_image_urls[0])
        if reference_image_bytes is None:
            logger.error("Scan %s failed: could not fetch subscriber's reference photo", scan_id)
            _fail_scan(scan_id, "Could not download the subscriber's reference photo")
            return
        reference_image_bytes = normalize_to_jpeg_bytes(reference_image_bytes)

        try:
            candidates = _search_all_reference_images(reference_image_urls, settings.max_candidates_per_scan)
        except RuntimeError as exc:
            logger.error("Scan %s failed during SerpAPI search: %s", scan_id, exc)
            _fail_scan(scan_id, f"Image search failed: {exc}")
            return

        # Additional candidate sources: YouTube videos matching the subscriber's
        # name, and images extracted from pages found by name-based deepfake
        # text searches. Merged into the same candidate pool/thread pool below
        # rather than run as separate passes, so dedup, progress tracking, and
        # matches_found all naturally cover every source together.
        candidates = candidates + _search_youtube(subscriber_data.get("name"), scan_id)
        candidates = candidates + _search_by_name(
            subscriber_data.get("name"), subscriber_data.get("profession"), scan_id
        )

        # candidates_found doubles as the live "checked so far" counter while the
        # scan is running (polled by the dashboard) - it converges to len(candidates)
        # once every future has completed, the same value the old executor.map
        # version wrote in a single update at the very end.
        checked = 0
        matches_found = 0
        with concurrent.futures.ThreadPoolExecutor(max_workers=CANDIDATE_CONCURRENCY) as executor:
            futures = [
                executor.submit(
                    _process_candidate, candidate, subscriber_id, scan_id, reference_image_bytes, subscriber_data
                )
                for candidate in candidates
            ]
            for future in concurrent.futures.as_completed(futures):
                checked += 1
                if future.result():
                    matches_found += 1
                # Throttled (every 3rd candidate) and best-effort: this is a progress
                # indicator for the dashboard, not correctness-critical, and the final
                # update below always writes the true count regardless. A transient
                # Supabase/network blip here must never abort an otherwise-successful
                # scan - it previously did, because this write was unguarded and ran
                # on every single candidate (~59 sequential requests per scan).
                if checked % 3 == 0 or checked == len(candidates):
                    try:
                        supabase.table("scans").update({"candidates_found": checked}).eq(
                            "id", scan_id
                        ).execute()
                    except Exception as exc:  # noqa: BLE001
                        logger.warning("Scan %s progress update failed, continuing: %s", scan_id, exc)

        supabase.table("scans").update(
            {
                "status": ScanStatus.COMPLETED.value,
                "candidates_found": len(candidates),
                "matches_found": matches_found,
                "completed_at": _now(),
            }
        ).eq("id", scan_id).execute()
    except Exception as exc:  # noqa: BLE001 - never leave a scan stuck at "running" on an unexpected error
        logger.exception("Scan %s failed with an unexpected error", scan_id)
        _fail_scan(scan_id, f"Unexpected error: {exc}")


@router.post("/scan/{subscriber_id}", response_model=ScanResponse, status_code=202)
def run_scan(subscriber_id: str, background_tasks: BackgroundTasks):
    supabase = get_supabase()

    subscriber = supabase.table("subscribers").select("*").eq("id", subscriber_id).maybe_single().execute()
    if not subscriber.data:
        raise HTTPException(status_code=404, detail="Subscriber not found")

    if subscriber.data.get("account_status") == "suspended":
        raise HTTPException(status_code=403, detail="This account has been suspended")

    reference_image_urls = _resolve_reference_image_urls(subscriber.data)

    if not reference_image_urls:
        raise HTTPException(status_code=400, detail="Subscriber has not completed face enrollment")

    started_at = _now()
    scan_insert = (
        supabase.table("scans")
        .insert(
            {
                "subscriber_id": subscriber_id,
                "status": ScanStatus.RUNNING.value,
                "candidates_found": 0,
                "matches_found": 0,
                "started_at": started_at,
            }
        )
        .execute()
    )
    scan_id = scan_insert.data[0]["id"]

    background_tasks.add_task(
        _run_scan_background, subscriber_id, scan_id, reference_image_urls, subscriber.data
    )

    return ScanResponse(
        scan_id=scan_id,
        subscriber_id=subscriber_id,
        status=ScanStatus.RUNNING,
        candidates_found=0,
        matches_found=0,
        started_at=started_at,
        completed_at=None,
    )


@router.get("/scans/{subscriber_id}", response_model=ScansListResponse)
def list_scans(subscriber_id: str):
    supabase = get_supabase()

    subscriber = supabase.table("subscribers").select("id").eq("id", subscriber_id).maybe_single().execute()
    if not subscriber.data:
        raise HTTPException(status_code=404, detail="Subscriber not found")

    result = (
        supabase.table("scans")
        .select("*")
        .eq("subscriber_id", subscriber_id)
        .order("started_at", desc=True)
        .execute()
    )
    rows = result.data or []

    return ScansListResponse(
        subscriber_id=subscriber_id,
        total=len(rows),
        scans=[
            ScanResponse(
                scan_id=row["id"],
                subscriber_id=row["subscriber_id"],
                status=ScanStatus(row["status"]),
                candidates_found=row["candidates_found"],
                matches_found=row["matches_found"],
                started_at=row["started_at"],
                completed_at=row.get("completed_at"),
            )
            for row in rows
        ],
    )


@router.get("/scan/{scan_id}/status", response_model=ScanResponse)
def get_scan_status(scan_id: str):
    supabase = get_supabase()
    scan = supabase.table("scans").select("*").eq("id", scan_id).maybe_single().execute()
    if not scan.data:
        raise HTTPException(status_code=404, detail="Scan not found")

    return ScanResponse(
        scan_id=scan.data["id"],
        subscriber_id=scan.data["subscriber_id"],
        status=ScanStatus(scan.data["status"]),
        candidates_found=scan.data["candidates_found"],
        matches_found=scan.data["matches_found"],
        started_at=scan.data["started_at"],
        completed_at=scan.data.get("completed_at"),
    )
