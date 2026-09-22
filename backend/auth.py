import os
import requests

from dotenv import load_dotenv
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from database import get_db

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_PUBLISHABLE_KEY = os.getenv(
    "SUPABASE_PUBLISHABLE_KEY"
)

security = HTTPBearer()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(
        security
    )
):
    token = credentials.credentials

    if not SUPABASE_URL:
        raise HTTPException(
            status_code=500,
            detail="SUPABASE_URL is not configured"
        )

    if not SUPABASE_PUBLISHABLE_KEY:
        raise HTTPException(
            status_code=500,
            detail="SUPABASE_PUBLISHABLE_KEY is not configured"
        )

    try:
        response = requests.get(
            f"{SUPABASE_URL}/auth/v1/user",
            headers={
                "Authorization": f"Bearer {token}",
                "apikey": SUPABASE_PUBLISHABLE_KEY
            },
            timeout=10
        )

    except requests.RequestException:
        raise HTTPException(
            status_code=503,
            detail="Unable to verify Supabase authentication"
        )

    if response.status_code != 200:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired authentication token"
        )

    user = response.json()

    if not user.get("id"):
        raise HTTPException(
            status_code=401,
            detail="Invalid Supabase user"
        )

    return user


def require_nurse(
    user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    user_id = user.get("id")

    from sqlalchemy import text

    result = db.execute(
        text("""
            SELECT role
            FROM profiles
            WHERE id = :user_id
        """),
        {
            "user_id": user_id
        }
    )

    profile = result.mappings().first()

    if not profile:
        raise HTTPException(
            status_code=403,
            detail="User profile not found"
        )

    if profile["role"] != "nurse":
        raise HTTPException(
            status_code=403,
            detail="Nurse access required"
        )

    return user