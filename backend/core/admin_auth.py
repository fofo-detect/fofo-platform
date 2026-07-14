import base64
import hashlib
import hmac
import json
import logging
import time
from typing import Optional

from fastapi import Header, HTTPException, Request

from core.config import get_settings

logger = logging.getLogger(__name__)

TOKEN_TTL_SECONDS = 12 * 60 * 60  # 12 hours

MAX_LOGIN_ATTEMPTS = 5
LOCKOUT_SECONDS = 60

# Per-process, in-memory only - acceptable for a single-instance internal tool
# and resets on redeploy. Not a substitute for real rate limiting at scale,
# but raises the bar against naive password guessing.
_login_attempts: dict[str, list[float]] = {}


def _token_secret() -> str:
    settings = get_settings()
    # Derived from ADMIN_PASSWORD rather than a second env var, so the token
    # can never be forged without knowing the password, and no extra Railway
    # variable is needed beyond what was asked for.
    return hashlib.sha256(f"{settings.admin_password}::fofo-admin-token-v1".encode()).hexdigest()


def create_admin_token() -> str:
    payload = {"exp": time.time() + TOKEN_TTL_SECONDS}
    body = base64.urlsafe_b64encode(json.dumps(payload).encode()).decode()
    signature = hmac.new(_token_secret().encode(), body.encode(), hashlib.sha256).hexdigest()
    return f"{body}.{signature}"


def _verify_admin_token(token: str) -> bool:
    try:
        body, signature = token.split(".", 1)
    except ValueError:
        return False

    expected = hmac.new(_token_secret().encode(), body.encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(signature, expected):
        return False

    try:
        payload = json.loads(base64.urlsafe_b64decode(body.encode()))
    except Exception:  # noqa: BLE001 - any malformed token is simply invalid
        return False

    return payload.get("exp", 0) >= time.time()


def require_admin(authorization: Optional[str] = Header(None)) -> None:
    """FastAPI dependency guarding every admin data endpoint. The frontend
    login-gate is UX only - this is the actual security boundary."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing admin credentials")

    token = authorization.removeprefix("Bearer ").strip()
    if not _verify_admin_token(token):
        raise HTTPException(status_code=401, detail="Invalid or expired admin session")


def _client_key(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def check_login_rate_limit(request: Request) -> None:
    key = _client_key(request)
    now = time.time()
    attempts = [t for t in _login_attempts.get(key, []) if now - t < LOCKOUT_SECONDS]
    _login_attempts[key] = attempts
    if len(attempts) >= MAX_LOGIN_ATTEMPTS:
        raise HTTPException(status_code=429, detail="Too many attempts. Please wait a minute and try again.")


def record_failed_login(request: Request) -> None:
    key = _client_key(request)
    _login_attempts.setdefault(key, []).append(time.time())


def verify_admin_password(password: str) -> bool:
    settings = get_settings()
    if not settings.admin_password:
        logger.error("ADMIN_PASSWORD is not configured - refusing all admin logins")
        return False
    return hmac.compare_digest(password, settings.admin_password)
