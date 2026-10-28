import os
import requests

from dotenv import load_dotenv

from fastapi import (
    Depends,
    HTTPException
)

from fastapi.security import (
    HTTPBearer,
    HTTPAuthorizationCredentials
)

from sqlalchemy.orm import Session

from database import get_db

from models import UserRole


# ============================================================
# LOAD ENVIRONMENT
# ============================================================

load_dotenv()

SUPABASE_URL = os.getenv(
    "SUPABASE_URL"
)

SUPABASE_PUBLISHABLE_KEY = os.getenv(
    "SUPABASE_PUBLISHABLE_KEY"
)


# ============================================================
# HTTP SECURITY
# ============================================================

security = HTTPBearer()


# ============================================================
# GET CURRENT SUPABASE USER
# ============================================================

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(
        security
    )
):

    token = credentials.credentials

    # --------------------------------------------------------
    # Check Supabase URL
    # --------------------------------------------------------

    if not SUPABASE_URL:

        raise HTTPException(
            status_code=500,
            detail=(
                "SUPABASE_URL is not configured"
            )
        )

    # --------------------------------------------------------
    # Check Supabase publishable key
    # --------------------------------------------------------

    if not SUPABASE_PUBLISHABLE_KEY:

        raise HTTPException(
            status_code=500,
            detail=(
                "SUPABASE_PUBLISHABLE_KEY "
                "is not configured"
            )
        )

    # --------------------------------------------------------
    # Verify token with Supabase
    # --------------------------------------------------------

    try:

        response = requests.get(

            f"{SUPABASE_URL}/auth/v1/user",

            headers={
                "Authorization": f"Bearer {token}",
                "apikey": SUPABASE_PUBLISHABLE_KEY,
            },

            timeout=10
        )

    except requests.RequestException:

        raise HTTPException(
            status_code=503,
            detail=(
                "Unable to verify Supabase "
                "authentication"
            )
        )

    # --------------------------------------------------------
    # Invalid token
    # --------------------------------------------------------

    if response.status_code != 200:

        raise HTTPException(
            status_code=401,
            detail=(
                "Invalid or expired "
                "authentication token"
            )
        )

    user = response.json()

    # --------------------------------------------------------
    # Validate user ID
    # --------------------------------------------------------

    if not user.get("id"):

        raise HTTPException(
            status_code=401,
            detail="Invalid Supabase user"
        )

    return user


# ============================================================
# GET USER ROLE
# ============================================================

def get_user_role(
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):

    user_id = user.get("id")

    role_record = (
        db.query(UserRole)
        .filter(
            UserRole.user_id == user_id
        )
        .first()
    )

    # --------------------------------------------------------
    # No role = Patient
    # --------------------------------------------------------

    if not role_record:

        return {
            "user": user,
            "role": "Patient",
            "hospital_id": None,
            "department": None,
        }

    # --------------------------------------------------------
    # Return complete role information
    # --------------------------------------------------------

    return {
        "user": user,
        "role": role_record.role,
        "hospital_id": role_record.hospital_id,
        "department": role_record.department,
    }


# ============================================================
# REQUIRE SUPER ADMIN
# ============================================================

def require_super_admin(
    role_data: dict = Depends(
        get_user_role
    ),
):

    if role_data["role"] != "Super Admin":

        raise HTTPException(
            status_code=403,
            detail="Super Admin access required"
        )

    return role_data


# ============================================================
# REQUIRE HOSPITAL ADMIN
# ============================================================

def require_hospital_admin(
    role_data: dict = Depends(
        get_user_role
    ),
):

    if role_data["role"] not in [
        "Super Admin",
        "Hospital Admin",
    ]:

        raise HTTPException(
            status_code=403,
            detail=(
                "Hospital Admin access required"
            )
        )

    return role_data


# ============================================================
# REQUIRE NURSE
# ============================================================

def require_nurse(
    role_data: dict = Depends(
        get_user_role
    ),
):

    if role_data["role"] not in [
        "Super Admin",
        "Hospital Admin",
        "Nurse",
    ]:

        raise HTTPException(
            status_code=403,
            detail="Nurse access required"
        )

    return role_data


# ============================================================
# REQUIRE DOCTOR
# ============================================================

def require_doctor(
    role_data: dict = Depends(
        get_user_role
    ),
):

    if role_data["role"] not in [
        "Super Admin",
        "Hospital Admin",
        "Doctor",
    ]:

        raise HTTPException(
            status_code=403,
            detail="Doctor access required"
        )

    return role_data


# ============================================================
# REQUIRE NURSE OR DOCTOR
# ============================================================

def require_nurse_or_doctor(
    role_data: dict = Depends(
        get_user_role
    ),
):

    if role_data["role"] not in [
        "Super Admin",
        "Hospital Admin",
        "Nurse",
        "Doctor",
    ]:

        raise HTTPException(
            status_code=403,
            detail=(
                "Nurse or Doctor access required"
            )
        )

    return role_data