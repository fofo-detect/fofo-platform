from functools import lru_cache

from supabase import Client, create_client

from core.config import get_settings


@lru_cache
def get_supabase() -> Client:
    """Server-side Supabase client using the secret key. Bypasses RLS — backend only.

    This instance is a process-wide singleton and must never have `.auth.sign_up` /
    `.auth.sign_in_with_password` called on it: supabase-py rewrites the client's
    internal PostgREST auth header to the resulting user's session token, which would
    silently downgrade every subsequent request on this shared client from the
    service role to that one user for as long as the process lives. GoTrue (auth)
    operations must use `get_auth_client()` instead, which returns a fresh,
    unshared client every time.
    """
    settings = get_settings()
    return create_client(settings.supabase_url, settings.supabase_secret_key)


def get_auth_client() -> Client:
    """Fresh, unshared Supabase client for GoTrue auth calls (sign_up / sign_in).

    Never cache or reuse this across requests — see get_supabase() for why.
    """
    settings = get_settings()
    return create_client(settings.supabase_url, settings.supabase_secret_key)
