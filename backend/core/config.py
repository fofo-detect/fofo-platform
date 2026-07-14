from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Supabase
    supabase_url: str
    supabase_secret_key: str
    supabase_publishable_key: str

    # Face search
    serpapi_key: str

    # YouTube Data API v3 (video candidate search). Optional - defaults to ""
    # so a missing key doesn't break startup; scan.py skips YouTube search
    # gracefully and logs a warning when this is unset.
    youtube_api_key: str = ""

    # Claude
    anthropic_api_key: str
    anthropic_model: str = "claude-sonnet-4-6"

    # AWS (S3 for enrollment photos, Rekognition for face indexing/matching)
    aws_access_key_id: str = ""
    aws_secret_access_key: str = ""
    aws_region: str = "us-east-1"
    aws_s3_bucket: str = "fofo-face-uploads"
    aws_rekognition_collection_id: str = "fofo-faces"

    # Sightengine
    sightengine_api_user: str
    sightengine_api_secret: str

    # MSG91 WhatsApp
    msg91_auth_key: str
    msg91_template_id: str
    msg91_integrated_number: str = ""

    # Stripe
    stripe_secret_key: str
    stripe_webhook_secret: str
    stripe_monthly_price_id: str
    stripe_annual_price_id: str

    # App
    # Falls back to the known production Vercel domain if CORS_ORIGINS isn't
    # set on the deploy platform, so a missing env var doesn't silently take
    # down every browser request with a CORS block.
    cors_origins: str = (
        "http://localhost:3000,https://fofo-platform-xi.vercel.app,"
        "https://fofo-platform-mwkszyfxx-fofo-platform.vercel.app,"
        "https://fofo-platform-pi.vercel.app"
    )
    # Vercel mints a new, unpredictable preview URL per branch/deploy, so an
    # explicit allowlist alone constantly falls behind. Scope the regex to our
    # own project's subdomains rather than every *.vercel.app tenant.
    cors_origin_regex: str = r"^https://fofo-platform(-[a-z0-9]+)*\.vercel\.app$"
    frontend_url: str = "http://localhost:3000"
    # AWS Rekognition CompareFaces similarity score is 0-100 (higher = more
    # similar) — the inverse direction of the old DeepFace Euclidean distance.
    face_match_similarity_threshold_thumbnail: float = 80.0
    face_match_similarity_threshold_full: float = 90.0
    max_candidates_per_scan: int = 59

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
