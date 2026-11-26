import os
import re
import requests

from datetime import datetime, timezone
from typing import Optional

from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session
from dotenv import load_dotenv

from database import engine, Base, get_db

from models import (
    Patient,
    Hospital,
    Department,
    AuditLog,
    UserRole,
)

from supabase import create_client

from auth import (
    get_current_user,
    require_nurse,
    require_doctor,
    require_super_admin,
    require_hospital_admin,
    get_user_role,
)


# ============================================================
# LOAD .ENV
# ============================================================

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ENV_FILE = os.path.join(BASE_DIR, ".env")

load_dotenv(
    dotenv_path=ENV_FILE,
    override=True,
)


# ============================================================
# SUPABASE CONFIGURATION
# ============================================================

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv(
    "SUPABASE_SERVICE_ROLE_KEY"
)


# ============================================================
# HTTPSMS CONFIGURATION
# ============================================================

HTTPSMS_API_KEY = os.getenv("HTTPSMS_API_KEY")

HTTPSMS_FROM = (
    os.getenv("HTTPSMS_FROM")
    or os.getenv("HTTPSMS_PHONE_NUMBER")
)

HTTPSMS_PHONE_NUMBER = HTTPSMS_FROM


# ============================================================
# ENV CHECK
# ============================================================

print()
print("========================================")
print("QUEUE CARE HOSPITAL - ENV CHECK")
print("========================================")
print("ENV FILE:", ENV_FILE)
print("ENV FILE EXISTS:", os.path.exists(ENV_FILE))
print("HTTPSMS API KEY LOADED:", bool(HTTPSMS_API_KEY))
print("HTTPSMS FROM:", HTTPSMS_FROM)
print("SUPABASE URL LOADED:", bool(SUPABASE_URL))
print(
    "SUPABASE SERVICE KEY LOADED:",
    bool(SUPABASE_SERVICE_ROLE_KEY)
)
print("========================================")
print()


# ============================================================
# FASTAPI
# ============================================================

app = FastAPI(
    title="Queue Care Hospital Queue Platform"
)


# ============================================================
# CORS
# ============================================================

default_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "https://queue-care-g8gium20f-officialnishanth45-8712.vercel.app",
]

configured_origins_raw = os.getenv("FRONTEND_URLS", "")
configured_origins = []
if configured_origins_raw:
    for raw_origin in configured_origins_raw.split(","):
        cleaned = raw_origin.strip().rstrip("/")
        if cleaned:
            configured_origins.append(cleaned)

allowed_origins = list(
    dict.fromkeys(
        [origin.rstrip("/") for origin in default_origins] + configured_origins
    )
)

print(f"CORS: Allowed origins configured ({len(allowed_origins)} origins): {allowed_origins}")

@app.middleware("http")
async def cors_logging_middleware(request, call_next):
    origin = request.headers.get("origin")
    if origin and origin.rstrip("/") not in allowed_origins:
        print(f"[CORS Warning] Request received from unconfigured origin: {origin}")
    response = await call_next(request)
    return response

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=[
        "Authorization",
        "Content-Type",
        "Accept",
        "Origin",
        "X-Requested-With",
        "apikey",
    ],
    expose_headers=["*"],
    max_age=600,
)


# ============================================================
# HEALTH CHECK
# ============================================================

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "Queue Care Hospital API"
    }


# ============================================================
# DATABASE
# ============================================================

Base.metadata.create_all(bind=engine)


# ============================================================
# TIME
# ============================================================

def utc_now():
    return datetime.now(timezone.utc)


# ============================================================
# TOKEN VALUE
# ============================================================

def token_value(item):
    try:
        return int(
            item.token_number.split("-")[-1]
        )
    except (
        ValueError,
        AttributeError,
        IndexError,
    ):
        return 0


# ============================================================
# AUDIT LOG
# ============================================================

def log_audit(
    db: Session,
    user_id: str,
    action: str,
    hospital_id: int = None,
    token_id: int = None,
):
    log = AuditLog(
        user_id=user_id,
        action=action,
        hospital_id=hospital_id,
        token_id=token_id,
        timestamp=utc_now(),
    )

    db.add(log)
    db.commit()


# ============================================================
# SMART CONSULTATION TIME
# ============================================================

def get_average_consultation_time(
    db: Session,
    hospital_id: int,
    department: str,
):
    completed_patients = (
        db.query(Patient)
        .filter(
            Patient.hospital_id == hospital_id,
            Patient.department == department,
            Patient.status == "Completed",
            Patient.consultation_started_at.isnot(None),
            Patient.consultation_completed_at.isnot(None),
        )
        .all()
    )

    durations = []

    for patient in completed_patients:
        try:
            started = patient.consultation_started_at
            completed = patient.consultation_completed_at

            if not started or not completed:
                continue

            duration_seconds = (
                completed - started
            ).total_seconds()

            duration_minutes = duration_seconds / 60

            if 1 <= duration_minutes <= 60:
                durations.append(duration_minutes)

        except Exception:
            continue

    if not durations:
        return 6.0, 0

    average = sum(durations) / len(durations)

    average = max(
        3.0,
        min(average, 20.0)
    )

    return average, len(durations)


# ============================================================
# REQUEST MODELS
# ============================================================

class HospitalCreate(BaseModel):
    name: str
    code: Optional[str] = None
    logo: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None


class NurseCreate(BaseModel):
    email: str
    password: str
    hospital_id: int


class DoctorCreate(BaseModel):
    email: str
    password: str
    hospital_id: int
    department: str


class DepartmentCreate(BaseModel):
    hospital_id: int
    name: str
    code: Optional[str] = None


class PatientCreate(BaseModel):
    name: str
    phone: str
    department: str
    emergency: bool = False
    user_id: str
    hospital_id: int


# ============================================================
# DEFAULT DEPARTMENTS
# ============================================================

DEFAULT_DEPARTMENTS = [
    ("General Medicine", "GEN"),
    ("Cardiology", "CARD"),
    ("Orthopedics", "ORTH"),
    ("Pediatrics", "PED"),
    ("Dermatology", "DERM"),
]


# ============================================================
# HOSPITAL CODE
# ============================================================

def make_hospital_code(name: str):
    code = re.sub(
        r"[^A-Za-z0-9]+",
        "-",
        name.strip().upper(),
    ).strip("-")

    return code[:24] or "HOSPITAL"


# ============================================================
# DEPARTMENT CODE
# ============================================================

def make_department_code(name: str):
    code = re.sub(
        r"[^A-Za-z0-9]+",
        "-",
        name.strip().upper(),
    ).strip("-")

    return code[:12] or "DEPT"


# ============================================================
# ENSURE DEFAULT DEPARTMENTS
# ============================================================

def ensure_departments(
    db: Session,
    hospital_id: int,
):
    existing = (
        db.query(Department)
        .filter(
            Department.hospital_id == hospital_id
        )
        .count()
    )

    if existing:
        return

    for name, code in DEFAULT_DEPARTMENTS:
        db.add(
            Department(
                hospital_id=hospital_id,
                name=name,
                code=code,
            )
        )

    db.flush()


# ============================================================
# ENSURE ALL EXISTING HOSPITALS HAVE DEPARTMENTS
# ============================================================

def ensure_all_hospital_departments(
    db: Session,
):
    hospitals = (
        db.query(Hospital)
        .all()
    )

    for hospital in hospitals:
        ensure_departments(
            db,
            hospital.id
        )

    db.commit()


# ============================================================
# INITIALIZE EXISTING HOSPITAL DEPARTMENTS
# ============================================================

try:
    with Session(bind=engine) as db:
        ensure_all_hospital_departments(db)
except Exception as error:
    print(
        "Department initialization error:",
        error
    )


# ============================================================
# CREATE HOSPITAL RECORD
# ============================================================

def create_hospital_record(
    db: Session,
    hospital: HospitalCreate,
):
    code = (
        hospital.code
        or make_hospital_code(hospital.name)
    ).strip().upper()

    existing_code = code
    suffix = 2

    while (
        db.query(Hospital)
        .filter(
            Hospital.code == existing_code
        )
        .first()
    ):
        existing_code = (
            f"{code[:20]}-{suffix}"
        )
        suffix += 1

    db_hosp = Hospital(
        name=hospital.name.strip(),
        code=existing_code,
        logo=hospital.logo,
        address=hospital.address,
        phone=hospital.phone,
        email=hospital.email,
        status="Active",
        created_at=utc_now(),
    )

    db.add(db_hosp)
    db.commit()
    db.refresh(db_hosp)

    ensure_departments(
        db,
        db_hosp.id
    )

    db.commit()
    db.refresh(db_hosp)

    return db_hosp


# ============================================================
# CREATE HOSPITAL
# ============================================================

@app.post("/hospitals")
def create_hospital(
    hospital: HospitalCreate,
    db: Session = Depends(get_db),
    role_data=Depends(require_super_admin),
):
    if not hospital.name.strip():
        raise HTTPException(
            status_code=400,
            detail="Hospital name is required",
        )

    db_hosp = create_hospital_record(
        db,
        hospital,
    )

    log_audit(
        db,
        role_data["user"]["id"],
        f"Created hospital {db_hosp.code}",
        db_hosp.id,
    )

    return db_hosp


# ============================================================
# GET HOSPITALS
# ============================================================

@app.get("/hospitals")
def get_hospitals(
    db: Session = Depends(get_db),
    role_data=Depends(get_user_role),
):
    return (
        db.query(Hospital)
        .order_by(Hospital.name.asc())
        .all()
    )


# ============================================================
# PUBLIC HOSPITALS
# ============================================================

@app.get("/public/hospitals")
def get_public_hospitals(
    db: Session = Depends(get_db),
):
    return (
        db.query(Hospital)
        .filter(
            Hospital.status == "Active"
        )
        .order_by(Hospital.name.asc())
        .all()
    )


# ============================================================
# CREATE NURSE
# ============================================================

@app.post("/admin/nurses")
def create_nurse(
    nurse: NurseCreate,
    db: Session = Depends(get_db),
    role_data=Depends(require_super_admin),
):
    if not SUPABASE_URL:
        raise HTTPException(
            status_code=500,
            detail="SUPABASE_URL is not configured",
        )

    if not SUPABASE_SERVICE_ROLE_KEY:
        raise HTTPException(
            status_code=500,
            detail="SUPABASE_SERVICE_ROLE_KEY is not configured",
        )

    email = nurse.email.strip().lower()

    if not email:
        raise HTTPException(
            status_code=400,
            detail="Email is required",
        )

    if len(nurse.password) < 6:
        raise HTTPException(
            status_code=400,
            detail="Password must be at least 6 characters",
        )

    hospital = (
        db.query(Hospital)
        .filter(
            Hospital.id == nurse.hospital_id
        )
        .first()
    )

    if not hospital:
        raise HTTPException(
            status_code=404,
            detail="Hospital not found",
        )

    if hospital.status != "Active":
        raise HTTPException(
            status_code=400,
            detail="Selected hospital is not active",
        )

    try:
        supabase_admin = create_client(
            SUPABASE_URL,
            SUPABASE_SERVICE_ROLE_KEY,
        )

        auth_response = (
            supabase_admin
            .auth
            .admin
            .create_user(
                {
                    "email": email,
                    "password": nurse.password,
                    "email_confirm": True,
                }
            )
        )

        created_user = getattr(
            auth_response,
            "user",
            None,
        )

        if not created_user:
            raise HTTPException(
                status_code=500,
                detail="Nurse user was not returned",
            )

        nurse_user_id = created_user.id

    except HTTPException:
        raise

    except Exception as error:
        print(
            "Supabase nurse creation error:",
            error,
        )

        raise HTTPException(
            status_code=500,
            detail="Unable to create Nurse account",
        )

    try:
        existing_role = (
            db.query(UserRole)
            .filter(
                UserRole.user_id == nurse_user_id
            )
            .first()
        )

        if existing_role:
            existing_role.role = "Nurse"
            existing_role.hospital_id = hospital.id
            existing_role.department = None

        else:
            db.add(
                UserRole(
                    user_id=nurse_user_id,
                    role="Nurse",
                    hospital_id=hospital.id,
                    department=None,
                )
            )

        db.commit()

    except Exception as error:
        db.rollback()

        print(
            "Nurse role database error:",
            error,
        )

        raise HTTPException(
            status_code=500,
            detail="Nurse account could not be assigned to hospital",
        )

    return {
        "message": "Nurse account created successfully",
        "nurse": {
            "user_id": nurse_user_id,
            "email": email,
            "role": "Nurse",
            "hospital_id": hospital.id,
            "hospital_name": hospital.name,
        },
    }


# ============================================================
# GET NURSES
# ============================================================

@app.get("/admin/nurses")
def get_admin_nurses(
    db: Session = Depends(get_db),
    role_data=Depends(require_super_admin),
):
    nurses = (
        db.query(UserRole)
        .filter(
            UserRole.role == "Nurse"
        )
        .all()
    )

    result = []

    for nurse in nurses:
        hospital_name = None

        if nurse.hospital_id:
            hospital = (
                db.query(Hospital)
                .filter(
                    Hospital.id == nurse.hospital_id
                )
                .first()
            )

            if hospital:
                hospital_name = hospital.name

        result.append(
            {
                "id": nurse.id,
                "user_id": nurse.user_id,
                "role": nurse.role,
                "hospital_id": nurse.hospital_id,
                "hospital_name": hospital_name,
            }
        )

    return result


# ============================================================
# CREATE DOCTOR
# ============================================================

@app.post("/admin/doctors")
def create_doctor(
    doctor: DoctorCreate,
    db: Session = Depends(get_db),
    role_data=Depends(require_super_admin),
):
    if not SUPABASE_URL:
        raise HTTPException(
            status_code=500,
            detail="SUPABASE_URL is not configured",
        )

    if not SUPABASE_SERVICE_ROLE_KEY:
        raise HTTPException(
            status_code=500,
            detail="SUPABASE_SERVICE_ROLE_KEY is not configured",
        )

    email = doctor.email.strip().lower()
    department_name = doctor.department.strip()

    if len(doctor.password) < 6:
        raise HTTPException(
            status_code=400,
            detail="Password must be at least 6 characters",
        )

    hospital = (
        db.query(Hospital)
        .filter(
            Hospital.id == doctor.hospital_id
        )
        .first()
    )

    if not hospital:
        raise HTTPException(
            status_code=404,
            detail="Hospital not found",
        )

    department = (
        db.query(Department)
        .filter(
            Department.hospital_id == doctor.hospital_id,
            Department.name == department_name,
        )
        .first()
    )

    if not department:
        raise HTTPException(
            status_code=404,
            detail="Department not found in selected hospital",
        )

    try:
        supabase_admin = create_client(
            SUPABASE_URL,
            SUPABASE_SERVICE_ROLE_KEY,
        )

        auth_response = (
            supabase_admin
            .auth
            .admin
            .create_user(
                {
                    "email": email,
                    "password": doctor.password,
                    "email_confirm": True,
                }
            )
        )

        created_user = getattr(
            auth_response,
            "user",
            None,
        )

        if not created_user:
            raise HTTPException(
                status_code=500,
                detail="Doctor user was not returned",
            )

        doctor_user_id = created_user.id

    except HTTPException:
        raise

    except Exception as error:
        print(
            "Supabase doctor creation error:",
            error,
        )

        raise HTTPException(
            status_code=500,
            detail="Unable to create Doctor account",
        )

    try:
        existing_role = (
            db.query(UserRole)
            .filter(
                UserRole.user_id == doctor_user_id
            )
            .first()
        )

        if existing_role:
            existing_role.role = "Doctor"
            existing_role.hospital_id = hospital.id
            existing_role.department = department.name

        else:
            db.add(
                UserRole(
                    user_id=doctor_user_id,
                    role="Doctor",
                    hospital_id=hospital.id,
                    department=department.name,
                )
            )

        db.commit()

    except Exception as error:
        db.rollback()

        print(
            "Doctor role database error:",
            error,
        )

        raise HTTPException(
            status_code=500,
            detail="Doctor account could not be assigned to hospital",
        )

    return {
        "message": "Doctor account created successfully",
        "doctor": {
            "user_id": doctor_user_id,
            "email": email,
            "role": "Doctor",
            "hospital_id": hospital.id,
            "hospital_name": hospital.name,
            "department": department.name,
        },
    }


# ============================================================
# GET DOCTORS
# ============================================================

@app.get("/admin/doctors")
def get_admin_doctors(
    db: Session = Depends(get_db),
    role_data=Depends(require_super_admin),
):
    doctors = (
        db.query(UserRole)
        .filter(
            UserRole.role == "Doctor"
        )
        .all()
    )

    result = []

    for doctor in doctors:
        hospital_name = None

        if doctor.hospital_id:
            hospital = (
                db.query(Hospital)
                .filter(
                    Hospital.id == doctor.hospital_id
                )
                .first()
            )

            if hospital:
                hospital_name = hospital.name

        result.append(
            {
                "id": doctor.id,
                "user_id": doctor.user_id,
                "role": doctor.role,
                "hospital_id": doctor.hospital_id,
                "hospital_name": hospital_name,
                "department": doctor.department,
            }
        )

    return result


# ============================================================
# AUTH ME
# ============================================================

@app.get("/auth/me")
def auth_me(
    role_data=Depends(get_user_role),
):
    return {
        "user": role_data["user"],
        "role": role_data["role"],
        "hospital_id": role_data["hospital_id"],
        "department": role_data.get("department"),
    }


# ============================================================
# PATIENT ROLE
# ============================================================

@app.post("/auth/patient-role")
def ensure_patient_role(
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    role_record = (
        db.query(UserRole)
        .filter(
            UserRole.user_id == user["id"]
        )
        .first()
    )

    if not role_record:
        role_record = UserRole(
            user_id=user["id"],
            role="Patient",
            hospital_id=None,
            department=None,
        )

        db.add(role_record)
        db.commit()
        db.refresh(role_record)

    return {
        "role": role_record.role,
        "hospital_id": role_record.hospital_id,
        "department": role_record.department,
    }


# ============================================================
# CREATE DEPARTMENT - SUPER ADMIN
# ============================================================

@app.post("/admin/departments")
def create_admin_department(
    dept: DepartmentCreate,
    db: Session = Depends(get_db),
    role_data=Depends(require_super_admin),
):
    name = dept.name.strip()

    if not name:
        raise HTTPException(
            status_code=400,
            detail="Department name is required",
        )

    hospital = (
        db.query(Hospital)
        .filter(
            Hospital.id == dept.hospital_id
        )
        .first()
    )

    if not hospital:
        raise HTTPException(
            status_code=404,
            detail="Hospital not found",
        )

    if hospital.status != "Active":
        raise HTTPException(
            status_code=400,
            detail="Selected hospital is not active",
        )

    existing_department = (
        db.query(Department)
        .filter(
            Department.hospital_id == dept.hospital_id,
            Department.name.ilike(name),
        )
        .first()
    )

    if existing_department:
        raise HTTPException(
            status_code=400,
            detail="Department already exists in this hospital",
        )

    if dept.code and dept.code.strip():
        code = dept.code.strip().upper()
    else:
        code = make_department_code(name)

    base_code = code
    suffix = 2

    while (
        db.query(Department)
        .filter(
            Department.hospital_id == dept.hospital_id,
            Department.code == code,
        )
        .first()
    ):
        code = f"{base_code[:9]}-{suffix}"
        suffix += 1

    new_department = Department(
        hospital_id=dept.hospital_id,
        name=name,
        code=code,
    )

    db.add(new_department)
    db.commit()
    db.refresh(new_department)

    log_audit(
        db,
        role_data["user"]["id"],
        f"Created department {name}",
        hospital.id,
    )

    return {
        "message": "Department created successfully",
        "department": {
            "id": new_department.id,
            "name": new_department.name,
            "code": new_department.code,
            "hospital_id": new_department.hospital_id,
            "hospital_name": hospital.name,
        },
    }


# ============================================================
# GET ALL DEPARTMENTS - SUPER ADMIN
# ============================================================

@app.get("/admin/departments")
def get_admin_departments(
    db: Session = Depends(get_db),
    role_data=Depends(require_super_admin),
):
    departments = (
        db.query(Department)
        .order_by(
            Department.name.asc()
        )
        .all()
    )

    result = []

    for department in departments:
        hospital = (
            db.query(Hospital)
            .filter(
                Hospital.id == department.hospital_id
            )
            .first()
        )

        result.append(
            {
                "id": department.id,
                "name": department.name,
                "code": department.code,
                "hospital_id": department.hospital_id,
                "hospital_name": (
                    hospital.name
                    if hospital
                    else None
                ),
            }
        )

    return result


# ============================================================
# GET DEPARTMENTS FOR HOSPITAL
# ============================================================

@app.get("/departments")
def get_departments(
    hospital_id: int,
    db: Session = Depends(get_db),
):
    return (
        db.query(Department)
        .filter(
            Department.hospital_id == hospital_id
        )
        .order_by(
            Department.name.asc()
        )
        .all()
    )


# ============================================================
# PHONE NORMALIZATION
# ============================================================

def normalize_phone_number(phone: str):
    if not phone:
        return None

    phone = str(phone).strip()

    phone = re.sub(
        r"[\s\-\(\)]",
        "",
        phone,
    )

    if phone.startswith("+91"):
        if (
            len(phone) == 13
            and phone[3:].isdigit()
        ):
            return phone

        return None

    if (
        phone.startswith("91")
        and len(phone) == 12
        and phone.isdigit()
    ):
        return "+" + phone

    if (
        phone.startswith("0")
        and len(phone) == 11
        and phone.isdigit()
    ):
        return "+91" + phone[1:]

    if (
        len(phone) == 10
        and phone.isdigit()
    ):
        return "+91" + phone

    print(
        "INVALID PHONE NUMBER:",
        phone
    )

    return None


# ============================================================
# SEND SMS
# ============================================================

def send_sms(
    phone_number: str,
    message: str,
):
    print()
    print("========================================")
    print("QUEUE CARE HOSPITAL SMS")
    print("========================================")

    if not HTTPSMS_API_KEY:
        print("ERROR: HTTPSMS_API_KEY is missing")
        return False

    if not HTTPSMS_FROM:
        print("ERROR: HTTPSMS_FROM is missing")
        return False

    if not phone_number:
        print("ERROR: Patient phone number is missing")
        return False

    recipient_number = normalize_phone_number(
        phone_number
    )

    if not recipient_number:
        print("ERROR: Invalid recipient phone number")
        return False

    print("From:", HTTPSMS_FROM)
    print("To:", recipient_number)
    print("Message:")
    print(message)
    print("========================================")

    try:
        response = requests.post(
            "https://api.httpsms.com/v1/messages/send",
            headers={
                "x-api-key": HTTPSMS_API_KEY,
                "Content-Type": "application/json",
            },
            json={
                "content": message,
                "from": HTTPSMS_FROM,
                "to": recipient_number,
            },
            timeout=15,
        )

        print(
            "httpSMS STATUS:",
            response.status_code
        )

        print(
            "httpSMS RESPONSE:",
            response.text
        )

        if 200 <= response.status_code < 300:
            print("SMS accepted by httpSMS")
            return True

        print("SMS sending failed")
        return False

    except requests.RequestException as error:
        print(
            "HTTPSMS CONNECTION ERROR:",
            error
        )
        return False

    except Exception as error:
        print(
            "UNEXPECTED SMS ERROR:",
            error
        )
        return False


# ============================================================
# TEST SMS
# ============================================================

@app.get("/test-sms")
def test_sms():
    test_phone = "+919585604504"

    test_message = (
        "Queue Care Hospital\n\n"
        "This is a test SMS.\n"
        "Your SMS notification system is working correctly."
    )

    success = send_sms(
        test_phone,
        test_message,
    )

    return {
        "success": success,
        "from": HTTPSMS_FROM,
        "to": normalize_phone_number(
            test_phone
        ),
        "message": (
            "SMS sent successfully"
            if success
            else "SMS sending failed"
        ),
    }


# ============================================================
# SMART QUEUE NOTIFICATIONS
# ============================================================

def send_smart_queue_notifications(
    db: Session,
    hospital_id: int,
    department: str,
):
    waiting_patients = (
        db.query(Patient)
        .filter(
            Patient.hospital_id == hospital_id,
            Patient.department == department,
            Patient.status == "Waiting",
        )
        .order_by(
            Patient.emergency.desc(),
            Patient.token_number.asc(),
        )
        .all()
    )

    for index, patient in enumerate(
        waiting_patients
    ):
        patients_ahead = index

        if (
            patients_ahead <= 2
            and not patient.notified_2
        ):
            message = (
                "Queue Care Hospital\n\n"
                f"Hello {patient.name},\n"
                f"Your token #{patient.token_number} "
                "is very close.\n\n"
                "Only about 2 or fewer patients "
                "are ahead of you.\n"
                "Please proceed towards the "
                "consultation area soon."
            )

            if send_sms(
                patient.phone,
                message,
            ):
                patient.notified_2 = True

        elif (
            patients_ahead <= 5
            and not patient.notified_5
        ):
            message = (
                "Queue Care Hospital\n\n"
                f"Hello {patient.name},\n"
                f"Your token #{patient.token_number} "
                "is approaching.\n\n"
                "There are approximately 5 or fewer "
                "patients ahead of you.\n"
                "Please be ready for your consultation."
            )

            if send_sms(
                patient.phone,
                message,
            ):
                patient.notified_5 = True

        elif (
            patients_ahead <= 10
            and not patient.notified_10
        ):
            message = (
                "Queue Care Hospital\n\n"
                f"Hello {patient.name},\n"
                f"Your token #{patient.token_number} "
                "is getting closer.\n\n"
                "There are approximately 10 or fewer "
                "patients ahead of you.\n"
                "Please stay ready for your consultation."
            )

            if send_sms(
                patient.phone,
                message,
            ):
                patient.notified_10 = True

    db.commit()


# ============================================================
# HOME
# ============================================================

@app.get("/")
def home():
    return {
        "message":
            "Queue Care Hospital Queue Platform is running"
    }


# ============================================================
# REGISTER PATIENT
# ============================================================

@app.post("/patients")
def create_patient(
    patient: PatientCreate,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    authenticated_user_id = user["id"]

    hospital = (
        db.query(Hospital)
        .filter(
            Hospital.id == patient.hospital_id
        )
        .first()
    )

    if not hospital:
        raise HTTPException(
            status_code=404,
            detail="Hospital not found",
        )

    if hospital.status != "Active":
        raise HTTPException(
            status_code=400,
            detail="Selected hospital is not active",
        )

    existing_patient = (
        db.query(Patient)
        .filter(
            Patient.user_id == authenticated_user_id,
            Patient.hospital_id == patient.hospital_id,
            Patient.status != "Completed",
        )
        .order_by(
            Patient.created_at.desc()
        )
        .first()
    )

    if existing_patient:
        raise HTTPException(
            status_code=400,
            detail=(
                "You already have an active token "
                f"#{existing_patient.token_number}."
            ),
        )

    dept = (
        db.query(Department)
        .filter(
            Department.hospital_id == patient.hospital_id,
            Department.name == patient.department,
        )
        .first()
    )

    if not dept:
        raise HTTPException(
            status_code=404,
            detail="Selected department not found",
        )

    last_patient = (
        db.query(Patient)
        .filter(
            Patient.hospital_id == patient.hospital_id,
            Patient.department == patient.department,
        )
        .order_by(
            Patient.id.desc()
        )
        .first()
    )

    if (
        last_patient
        and "-"
        in last_patient.token_number
    ):
        try:
            last_num = int(
                last_patient.token_number
                .split("-")[-1]
            )
            new_num = last_num + 1

        except Exception:
            new_num = 1

    else:
        new_num = 1

    token_number = (
        f"{dept.code}-{new_num:03d}"
    )

    new_patient = Patient(
        user_id=authenticated_user_id,
        hospital_id=patient.hospital_id,
        token_number=token_number,
        name=patient.name,
        phone=patient.phone,
        department=patient.department,
        emergency=patient.emergency,
        status="Waiting",
        consultation_started_at=None,
        consultation_completed_at=None,
        notified_10=False,
        notified_5=False,
        notified_2=False,
        created_at=utc_now(),
    )

    db.add(new_patient)
    db.commit()
    db.refresh(new_patient)

    log_audit(
        db,
        authenticated_user_id,
        f"Registered token {token_number}",
        patient.hospital_id,
        new_patient.id,
    )

    sms_message = (
        f"{hospital.name}\n\n"
        f"Hello {new_patient.name},\n"
        f"Your token number is "
        f"#{new_patient.token_number}.\n"
        f"Department: "
        f"{new_patient.department}\n"
        f"Status: Waiting\n\n"
        "Please wait for your turn.\n\n"
        f"{hospital.name}"
    )

    sms_sent = send_sms(
        new_patient.phone,
        sms_message,
    )

    send_smart_queue_notifications(
        db,
        patient.hospital_id,
        patient.department,
    )

    return {
        "message":
            "Patient registered successfully",
        "token_number":
            new_patient.token_number,
        "patient_id":
            new_patient.id,
        "hospital_id":
            hospital.id,
        "hospital_name":
            hospital.name,
        "sms_sent":
            sms_sent,
    }


# ============================================================
# PATIENT ME
# ============================================================

@app.get("/patients/me")
def get_my_patient(
    hospital_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    patient = (
        db.query(Patient)
        .filter(
            Patient.user_id == user["id"],
            Patient.hospital_id == hospital_id,
            Patient.status != "Completed",
        )
        .order_by(
            Patient.created_at.desc()
        )
        .first()
    )

    if not patient:
        raise HTTPException(
            status_code=404,
            detail="No active patient registration found",
        )

    hospital = (
        db.query(Hospital)
        .filter(
            Hospital.id == patient.hospital_id
        )
        .first()
    )

    return {
        "id": patient.id,
        "token_number": patient.token_number,
        "name": patient.name,
        "phone": patient.phone,
        "department": patient.department,
        "emergency": patient.emergency,
        "status": patient.status,
        "hospital_id": patient.hospital_id,
        "hospital_name": (
            hospital.name
            if hospital
            else None
        ),
    }


# ============================================================
# GET PATIENTS
# ============================================================

@app.get("/patients")
def get_patients(
    hospital_id: int,
    db: Session = Depends(get_db),
    role_data=Depends(require_nurse),
):
    if (
        role_data["role"] != "Super Admin"
        and role_data["hospital_id"] != hospital_id
    ):
        raise HTTPException(
            status_code=403,
            detail="Not authorized for this hospital",
        )

    return (
        db.query(Patient)
        .filter(
            Patient.hospital_id == hospital_id
        )
        .order_by(
            Patient.emergency.desc(),
            Patient.token_number.asc(),
        )
        .all()
    )


# ============================================================
# NEXT PATIENT
# ============================================================

@app.put("/patients/next")
def next_patient(
    hospital_id: int,
    db: Session = Depends(get_db),
    role_data=Depends(require_nurse),
):
    if (
        role_data["role"] != "Super Admin"
        and role_data["hospital_id"] != hospital_id
    ):
        raise HTTPException(
            status_code=403,
            detail="Not authorized",
        )

    current_patient = (
        db.query(Patient)
        .filter(
            Patient.status == "Consulting",
            Patient.hospital_id == hospital_id,
        )
        .first()
    )

    if current_patient:
        return {
            "message":
                "A patient is already consulting",
            "token_number":
                current_patient.token_number,
            "patient_name":
                current_patient.name,
            "status":
                current_patient.status,
        }

    patient = (
        db.query(Patient)
        .filter(
            Patient.status == "Waiting",
            Patient.hospital_id == hospital_id,
        )
        .order_by(
            Patient.emergency.desc(),
            Patient.token_number.asc(),
        )
        .first()
    )

    if not patient:
        return {
            "message":
                "No waiting patients"
        }

    patient.status = "Consulting"
    patient.consultation_started_at = utc_now()

    db.commit()
    db.refresh(patient)

    return {
        "message":
            "Next patient called",
        "token_number":
            patient.token_number,
        "patient_name":
            patient.name,
        "status":
            patient.status,
        "consultation_started_at":
            patient.consultation_started_at,
    }


# ============================================================
# NURSE CONSULTING
# ============================================================

@app.put("/patients/{patient_id}/consulting")
def consulting_patient(
    patient_id: int,
    db: Session = Depends(get_db),
    role_data=Depends(require_nurse),
):
    patient = (
        db.query(Patient)
        .filter(
            Patient.id == patient_id
        )
        .first()
    )

    if not patient:
        raise HTTPException(
            status_code=404,
            detail="Patient not found",
        )

    if (
        role_data["role"] != "Super Admin"
        and role_data["hospital_id"] != patient.hospital_id
    ):
        raise HTTPException(
            status_code=403,
            detail="Not authorized for this hospital",
        )

    patient.status = "Consulting"

    if not patient.consultation_started_at:
        patient.consultation_started_at = utc_now()

    patient.consultation_completed_at = None

    db.commit()
    db.refresh(patient)

    return {
        "message":
            "Patient is now consulting",
        "token_number":
            patient.token_number,
        "status":
            patient.status,
        "consultation_started_at":
            patient.consultation_started_at,
    }


# ============================================================
# COMPLETE PATIENT
# ============================================================

@app.put("/patients/{patient_id}/completed")
def complete_patient(
    patient_id: int,
    db: Session = Depends(get_db),
    role_data=Depends(require_nurse),
):
    patient = (
        db.query(Patient)
        .filter(
            Patient.id == patient_id
        )
        .first()
    )

    if not patient:
        raise HTTPException(
            status_code=404,
            detail="Patient not found",
        )

    if (
        role_data["role"] != "Super Admin"
        and role_data["hospital_id"] != patient.hospital_id
    ):
        raise HTTPException(
            status_code=403,
            detail="Not authorized",
        )

    hospital_id = patient.hospital_id
    department = patient.department

    patient.status = "Completed"
    patient.consultation_completed_at = utc_now()

    next_patient = (
        db.query(Patient)
        .filter(
            Patient.status == "Waiting",
            Patient.hospital_id == hospital_id,
            Patient.department == department,
        )
        .order_by(
            Patient.emergency.desc(),
            Patient.token_number.asc(),
        )
        .first()
    )

    if next_patient:
        next_patient.status = "Consulting"
        next_patient.consultation_started_at = utc_now()
        next_patient.consultation_completed_at = None

    db.commit()
    db.refresh(patient)

    if next_patient:
        db.refresh(next_patient)

    send_smart_queue_notifications(
        db,
        hospital_id,
        department,
    )

    return {
        "message":
            "Patient completed",
        "completed_token":
            patient.token_number,
        "next_token": (
            next_patient.token_number
            if next_patient
            else None
        ),
        "consultation_completed_at":
            patient.consultation_completed_at,
        "next_consultation_started_at": (
            next_patient.consultation_started_at
            if next_patient
            else None
        ),
    }


# ============================================================
# MARK EMERGENCY
# ============================================================

@app.put("/patients/{patient_id}/emergency")
def mark_emergency(
    patient_id: int,
    db: Session = Depends(get_db),
    role_data=Depends(require_nurse),
):
    patient = (
        db.query(Patient)
        .filter(
            Patient.id == patient_id
        )
        .first()
    )

    if not patient:
        raise HTTPException(
            status_code=404,
            detail="Patient not found",
        )

    if (
        role_data["role"] != "Super Admin"
        and role_data["hospital_id"] != patient.hospital_id
    ):
        raise HTTPException(
            status_code=403,
            detail="Not authorized",
        )

    patient.emergency = True

    db.commit()
    db.refresh(patient)

    send_smart_queue_notifications(
        db,
        patient.hospital_id,
        patient.department,
    )

    return {
        "message":
            "Patient marked as emergency",
        "token_number":
            patient.token_number,
        "emergency":
            True,
    }


# ============================================================
# DELETE COMPLETED PATIENT
# ============================================================

@app.delete("/patients/{patient_id}")
def delete_patient(
    patient_id: int,
    db: Session = Depends(get_db),
    role_data=Depends(require_nurse),
):
    patient = (
        db.query(Patient)
        .filter(
            Patient.id == patient_id
        )
        .first()
    )

    if not patient:
        raise HTTPException(
            status_code=404,
            detail="Patient not found",
        )

    if (
        role_data["role"] != "Super Admin"
        and role_data["hospital_id"] != patient.hospital_id
    ):
        raise HTTPException(
            status_code=403,
            detail="Not authorized",
        )

    if patient.status != "Completed":
        raise HTTPException(
            status_code=400,
            detail="Only completed patients can be deleted",
        )

    db.delete(patient)
    db.commit()

    return {
        "message":
            "Completed patient deleted successfully"
    }


# ============================================================
# DOCTOR QUEUE
# ============================================================

@app.get("/doctor/queue")
def get_doctor_queue(
    db: Session = Depends(get_db),
    role_data=Depends(require_doctor),
):
    hospital_id = role_data.get("hospital_id")
    department = role_data.get("department")

    if not hospital_id:
        raise HTTPException(
            status_code=400,
            detail="Doctor is not assigned to a hospital",
        )

    if not department:
        raise HTTPException(
            status_code=400,
            detail="Doctor is not assigned to a department",
        )

    patients = (
        db.query(Patient)
        .filter(
            Patient.hospital_id == hospital_id,
            Patient.department == department,
        )
        .order_by(
            Patient.emergency.desc(),
            Patient.token_number.asc(),
        )
        .all()
    )

    current_patient = (
        db.query(Patient)
        .filter(
            Patient.hospital_id == hospital_id,
            Patient.department == department,
            Patient.status == "Consulting",
        )
        .first()
    )

    waiting_count = (
        db.query(Patient)
        .filter(
            Patient.hospital_id == hospital_id,
            Patient.department == department,
            Patient.status == "Waiting",
        )
        .count()
    )

    completed_count = (
        db.query(Patient)
        .filter(
            Patient.hospital_id == hospital_id,
            Patient.department == department,
            Patient.status == "Completed",
        )
        .count()
    )

    return {
        "hospital_id": hospital_id,
        "department": department,
        "current": current_patient,
        "patients": patients,
        "waiting_count": waiting_count,
        "completed_count": completed_count,
    }


# ============================================================
# DOCTOR CURRENT
# ============================================================

@app.get("/doctor/current")
def get_doctor_current_patient(
    db: Session = Depends(get_db),
    role_data=Depends(require_doctor),
):
    hospital_id = role_data.get("hospital_id")
    department = role_data.get("department")

    if not hospital_id or not department:
        raise HTTPException(
            status_code=400,
            detail="Doctor hospital or department assignment is missing",
        )

    patient = (
        db.query(Patient)
        .filter(
            Patient.hospital_id == hospital_id,
            Patient.department == department,
            Patient.status == "Consulting",
        )
        .first()
    )

    return {
        "current": patient
    }


# ============================================================
# DOCTOR START CONSULTATION
# ============================================================

@app.put("/doctor/patients/{patient_id}/consulting")
def doctor_start_consultation(
    patient_id: int,
    db: Session = Depends(get_db),
    role_data=Depends(require_doctor),
):
    hospital_id = role_data.get("hospital_id")
    department = role_data.get("department")

    patient = (
        db.query(Patient)
        .filter(
            Patient.id == patient_id
        )
        .first()
    )

    if not patient:
        raise HTTPException(
            status_code=404,
            detail="Patient not found",
        )

    if (
        patient.hospital_id != hospital_id
        or patient.department != department
    ):
        raise HTTPException(
            status_code=403,
            detail="Doctor is not assigned to this patient",
        )

    existing_consultation = (
        db.query(Patient)
        .filter(
            Patient.hospital_id == hospital_id,
            Patient.department == department,
            Patient.status == "Consulting",
            Patient.id != patient_id,
        )
        .first()
    )

    if existing_consultation:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Token {existing_consultation.token_number} "
                "is already consulting"
            ),
        )

    if patient.status != "Waiting":
        raise HTTPException(
            status_code=400,
            detail="Only a waiting patient can start consultation",
        )

    patient.status = "Consulting"
    patient.consultation_started_at = utc_now()

    db.commit()
    db.refresh(patient)

    return {
        "message":
            "Consultation started successfully",
        "patient_id":
            patient.id,
        "token_number":
            patient.token_number,
        "status":
            patient.status,
        "consultation_started_at":
            patient.consultation_started_at,
    }


# ============================================================
# DOCTOR COMPLETE
# ============================================================

@app.put("/doctor/patients/{patient_id}/completed")
def doctor_complete_consultation(
    patient_id: int,
    db: Session = Depends(get_db),
    role_data=Depends(require_doctor),
):
    hospital_id = role_data.get("hospital_id")
    department = role_data.get("department")

    patient = (
        db.query(Patient)
        .filter(
            Patient.id == patient_id
        )
        .first()
    )

    if not patient:
        raise HTTPException(
            status_code=404,
            detail="Patient not found",
        )

    if (
        patient.hospital_id != hospital_id
        or patient.department != department
    ):
        raise HTTPException(
            status_code=403,
            detail="Doctor is not assigned to this patient",
        )

    if patient.status != "Consulting":
        raise HTTPException(
            status_code=400,
            detail="Only a consulting patient can be completed",
        )

    patient.status = "Completed"
    patient.consultation_completed_at = utc_now()

    next_patient = (
        db.query(Patient)
        .filter(
            Patient.status == "Waiting",
            Patient.hospital_id == hospital_id,
            Patient.department == department,
        )
        .order_by(
            Patient.emergency.desc(),
            Patient.token_number.asc(),
        )
        .first()
    )

    if next_patient:
        next_patient.status = "Consulting"
        next_patient.consultation_started_at = utc_now()
        next_patient.consultation_completed_at = None

    db.commit()
    db.refresh(patient)

    if next_patient:
        db.refresh(next_patient)

    send_smart_queue_notifications(
        db,
        hospital_id,
        department,
    )

    return {
        "message":
            "Consultation completed successfully",
        "completed_token":
            patient.token_number,
        "next_token": (
            next_patient.token_number
            if next_patient
            else None
        ),
        "consultation_completed_at":
            patient.consultation_completed_at,
        "next_consultation_started_at": (
            next_patient.consultation_started_at
            if next_patient
            else None
        ),
    }


# ============================================================
# QUEUE STATUS
# ============================================================

@app.get("/queue/{token_number}")
def get_queue_status(
    token_number: str,
    hospital_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    patient = (
        db.query(Patient)
        .filter(
            Patient.token_number == token_number,
            Patient.hospital_id == hospital_id,
            Patient.user_id == user["id"],
            Patient.status != "Completed",
        )
        .first()
    )

    if not patient:
        raise HTTPException(
            status_code=404,
            detail="Token not found",
        )

    current_patient = (
        db.query(Patient)
        .filter(
            Patient.hospital_id == hospital_id,
            Patient.department == patient.department,
            Patient.status == "Consulting",
        )
        .first()
    )

    waiting_patients = (
        db.query(Patient)
        .filter(
            Patient.hospital_id == hospital_id,
            Patient.department == patient.department,
            Patient.status == "Waiting",
        )
        .all()
    )

    patient_token_value = token_value(patient)

    if patient.emergency:
        patients_ahead_list = [
            item
            for item in waiting_patients
            if (
                item.emergency
                and token_value(item)
                < patient_token_value
            )
        ]

    else:
        patients_ahead_list = [
            item
            for item in waiting_patients
            if (
                item.emergency
                or (
                    not item.emergency
                    and token_value(item)
                    < patient_token_value
                )
            )
        ]

    return {
        "token_number":
            patient.token_number,
        "status":
            patient.status,
        "current_token": (
            current_patient.token_number
            if current_patient
            else None
        ),
        "patients_before":
            len(patients_ahead_list),
        "emergency":
            patient.emergency,
        "department":
            patient.department,
        "sms_sent_now":
            False,
    }


# ============================================================
# SMART WAIT TIME
# ============================================================

@app.get("/queue/{token_number}/wait-time")
def get_wait_time(
    token_number: str,
    hospital_id: int,
    db: Session = Depends(get_db),
    role_data=Depends(get_user_role),
):
    current_user_id = role_data["user"].get("id")

    patient = (
        db.query(Patient)
        .filter(
            Patient.token_number == token_number,
            Patient.hospital_id == hospital_id,
            Patient.user_id == current_user_id,
            Patient.status.in_(
                [
                    "Waiting",
                    "Consulting",
                ]
            ),
        )
        .first()
    )

    if not patient:
        raise HTTPException(
            status_code=404,
            detail="Patient token not found",
        )

    waiting_patients = (
        db.query(Patient)
        .filter(
            Patient.hospital_id == hospital_id,
            Patient.department == patient.department,
            Patient.status == "Waiting",
        )
        .all()
    )

    current_token_value = token_value(patient)

    if patient.emergency:
        patients_ahead = [
            item
            for item in waiting_patients
            if (
                item.emergency
                and token_value(item)
                < current_token_value
            )
        ]

    else:
        patients_ahead = [
            item
            for item in waiting_patients
            if (
                item.emergency
                or (
                    not item.emergency
                    and token_value(item)
                    < current_token_value
                )
            )
        ]

    emergency_ahead = [
        item
        for item in patients_ahead
        if item.emergency
    ]

    total_ahead = len(
        patients_ahead
    )

    (
        average_consultation_minutes,
        history_count,
    ) = get_average_consultation_time(
        db,
        hospital_id,
        patient.department,
    )

    current_patient = (
        db.query(Patient)
        .filter(
            Patient.hospital_id == hospital_id,
            Patient.department == patient.department,
            Patient.status == "Consulting",
        )
        .first()
    )

    current_remaining_minutes = 0.0

    if (
        current_patient
        and current_patient.consultation_started_at
    ):
        try:
            started_at = (
                current_patient.consultation_started_at
            )

            elapsed_seconds = (
                utc_now() - started_at
            ).total_seconds()

            elapsed_minutes = (
                elapsed_seconds / 60
            )

            current_remaining_minutes = max(
                0.0,
                (
                    average_consultation_minutes
                    - elapsed_minutes
                ),
            )

        except Exception:
            current_remaining_minutes = (
                average_consultation_minutes
            )

    if patient.status == "Consulting":
        estimated_minutes = 0.0

    else:
        estimated_minutes = (
            current_remaining_minutes
            + (
                total_ahead
                * average_consultation_minutes
            )
        )

    estimated_minutes = max(
        0,
        round(estimated_minutes),
    )

    prediction_type = (
        "historical_consultation_data"
        if history_count > 0
        else "default_estimate"
    )

    return {
        "token_number":
            patient.token_number,
        "department":
            patient.department,
        "status":
            patient.status,
        "patients_ahead":
            total_ahead,
        "emergency_ahead":
            len(emergency_ahead),
        "average_consultation_minutes":
            round(
                average_consultation_minutes,
                1,
            ),
        "current_consulting_token": (
            current_patient.token_number
            if current_patient
            else None
        ),
        "current_remaining_minutes":
            round(
                current_remaining_minutes,
                1,
            ),
        "estimated_wait_minutes":
            estimated_minutes,
        "history_count":
            history_count,
        "prediction_type":
            prediction_type,
    }