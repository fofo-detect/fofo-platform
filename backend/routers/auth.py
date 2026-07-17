import logging

from fastapi import APIRouter, HTTPException
from supabase_auth.errors import AuthApiError

from core.supabase_client import get_auth_client, get_supabase
from models.schemas import AuthResponse, ChangePasswordRequest, LoginRequest, MessageResponse, SignupRequest

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/signup", response_model=AuthResponse, status_code=201)
def signup(payload: SignupRequest):
    # GoTrue calls must run on a throwaway client, never the shared get_supabase()
    # singleton — sign_up/sign_in rewrite the client's PostgREST auth header to the
    # resulting user's session token, which would downgrade every later request on
    # a shared client from the service role to that one user.
    auth_client = get_auth_client()

    try:
        auth_result = auth_client.auth.sign_up(
            {
                "email": payload.email,
                "password": payload.password,
                "options": {"data": {"name": payload.name, "phone": payload.phone}},
            }
        )
    except AuthApiError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    if auth_result.user is None:
        raise HTTPException(status_code=400, detail="Signup failed: no user returned")

    user_id = auth_result.user.id

    subscriber_row = {
        "id": user_id,
        "email": payload.email,
        "name": payload.name,
        "phone": payload.phone,
        "profession": payload.profession,
    }
    try:
        get_supabase().table("subscribers").insert(subscriber_row).execute()
    except Exception as exc:  # noqa: BLE001 - `profession` column may not exist until migration 009 is applied
        logger.warning("Retrying subscriber row for %s without profession: %s", user_id, exc)
        subscriber_row.pop("profession", None)
        try:
            get_supabase().table("subscribers").insert(subscriber_row).execute()
        except Exception as exc2:  # noqa: BLE001
            logger.error("Failed to create subscriber row for %s: %s", user_id, exc2)
            raise HTTPException(
                status_code=500, detail="Signup succeeded but subscriber profile creation failed"
            ) from exc2

    session = auth_result.session
    return AuthResponse(
        access_token=session.access_token if session else None,
        refresh_token=session.refresh_token if session else None,
        user_id=user_id,
        email=payload.email,
        email_confirmation_required=session is None,
    )


@router.post("/login", response_model=AuthResponse)
def login(payload: LoginRequest):
    auth_client = get_auth_client()

    try:
        auth_result = auth_client.auth.sign_in_with_password(
            {"email": payload.email, "password": payload.password}
        )
    except AuthApiError as exc:
        raise HTTPException(status_code=401, detail="Invalid email or password") from exc

    if auth_result.session is None or auth_result.user is None:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    # account_status may not exist yet (pre-migration 005) - treat that as
    # active rather than failing every login until the migration is applied.
    try:
        subscriber = (
            get_supabase()
            .table("subscribers")
            .select("account_status")
            .eq("id", auth_result.user.id)
            .maybe_single()
            .execute()
        )
        if subscriber.data and subscriber.data.get("account_status") == "suspended":
            raise HTTPException(status_code=403, detail="This account has been suspended")
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001
        logger.warning("Could not check account_status for %s: %s", auth_result.user.id, exc)

    return AuthResponse(
        access_token=auth_result.session.access_token,
        refresh_token=auth_result.session.refresh_token,
        user_id=auth_result.user.id,
        email=auth_result.user.email,
    )


@router.post("/change-password", response_model=MessageResponse)
def change_password(payload: ChangePasswordRequest):
    # Two-step, both on throwaway clients: first prove the caller holds a
    # currently valid session for *some* user (get_user), then use the
    # service-role admin API to set that exact user's password. This avoids
    # needing the refresh_token (the frontend only persists access_token) while
    # still not letting an arbitrary caller change a stranger's password.
    auth_client = get_auth_client()
    try:
        user_response = auth_client.auth.get_user(payload.access_token)
    except AuthApiError as exc:
        raise HTTPException(status_code=401, detail="Invalid or expired session") from exc

    if user_response is None or user_response.user is None:
        raise HTTPException(status_code=401, detail="Invalid or expired session")

    admin_client = get_auth_client()
    try:
        admin_client.auth.admin.update_user_by_id(
            user_response.user.id, {"password": payload.new_password}
        )
    except AuthApiError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return MessageResponse(message="Password updated successfully")
