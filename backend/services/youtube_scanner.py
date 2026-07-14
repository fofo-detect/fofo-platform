import logging

import httpx

from core.config import get_settings

logger = logging.getLogger(__name__)

YOUTUBE_SEARCH_ENDPOINT = "https://www.googleapis.com/youtube/v3/search"
REQUEST_TIMEOUT_SECONDS = 15.0
# YouTube Data API v3 search.list returns at most 50 results per call - this
# is a hard API ceiling, not a tunable like SerpAPI's max_candidates_per_scan.
MAX_RESULTS = 50


class YouTubeSearchError(Exception):
    pass


def search_videos(query: str, max_results: int = MAX_RESULTS) -> list[dict]:
    """Search YouTube for videos matching `query` (the subscriber's name) and
    return candidate thumbnails with their source video URLs.

    Costs 100 of the 10,000 free daily quota units per call (100 searches/day).
    """
    settings = get_settings()
    if not settings.youtube_api_key:
        raise YouTubeSearchError("YOUTUBE_API_KEY is not configured")

    params = {
        "part": "snippet",
        "q": query,
        "type": "video",
        "maxResults": min(max_results, MAX_RESULTS),
        "key": settings.youtube_api_key,
    }
    try:
        resp = httpx.get(YOUTUBE_SEARCH_ENDPOINT, params=params, timeout=REQUEST_TIMEOUT_SECONDS)
        resp.raise_for_status()
        data = resp.json()
    except (httpx.HTTPError, httpx.TimeoutException) as exc:
        raise YouTubeSearchError(f"YouTube search request failed: {exc}") from exc

    if "error" in data:
        raise YouTubeSearchError(f"YouTube API error: {data['error']}")

    results: list[dict] = []
    for item in data.get("items", []):
        video_id = item.get("id", {}).get("videoId")
        if not video_id:
            continue

        snippet = item.get("snippet", {})
        thumbnails = snippet.get("thumbnails", {})
        thumbnail_url = (
            thumbnails.get("high", {}).get("url")
            or thumbnails.get("medium", {}).get("url")
            or thumbnails.get("default", {}).get("url")
        )
        if not thumbnail_url:
            continue

        results.append(
            {
                "video_id": video_id,
                "title": snippet.get("title"),
                "thumbnail_url": thumbnail_url,
                "video_url": f"https://www.youtube.com/watch?v={video_id}",
                "channel_name": snippet.get("channelTitle"),
            }
        )

    return results
