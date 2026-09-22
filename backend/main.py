import os
import requests

from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session
from dotenv import load_dotenv

from database import engine, Base, get_db
from models import Patient
from auth import get_current_user, require_nurse


# ==========================================
# LOAD ENVIRONMENT VARIABLES
# ==========================================

load_dotenv()


# ==========================================
# HTTPSMS CONFIGURATION
# ==========================================

HTTPSMS_API_KEY = os.getenv("HTTPSMS_API_KEY")
HTTPSMS_PHONE_NUMBER = os.getenv("HTTPSMS_PHONE_NUMBER")


# ==========================================
# FASTAPI APP
# ==========================================

app = FastAPI(
    title="SPN Care Hospital Token Management System"
)


# ==========================================
# CORS
# ==========================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ==========================================
# CREATE DATABASE TABLES
# ==========================================

Base.metadata.create_all(bind=engine)


# ==========================================
# PATIENT REQUEST MODEL
# ==========================================

class PatientCreate(BaseModel):
    name: str
    phone: str
    department: str
    emergency: bool = False
    user_id: str


# ==========================================
# HTTPSMS PHONE NUMBER FORMAT
# ==========================================

def normalize_phone_number(phone: str):
    """
    Converts common Indian phone number formats
    into +91XXXXXXXXXX format.

    Examples:

    9047220067
    -> +919047220067

    09047220067
    -> +919047220067

    919047220067
    -> +919047220067

    +919047220067
    -> +919047220067
    """

    phone = phone.strip()
    phone = phone.replace(" ", "")
    phone = phone.replace("-", "")

    # Already in international format
    if phone.startswith("+"):
        return phone

    # Indian number with leading 0
    if phone.startswith("0") and len(phone) == 11:
        return "+91" + phone[1:]

    # Indian number without country code
    if len(phone) == 10 and phone.isdigit():
        return "+91" + phone

    # Number beginning with 91
    if phone.startswith("91") and len(phone) == 12:
        return "+" + phone

    # Return unchanged if format is unknown
    return phone


# ==========================================
# SEND SMS USING HTTPSMS
# ==========================================

def send_sms(phone_number: str, message: str):

    if not HTTPSMS_API_KEY:
        print("ERROR: HTTPSMS_API_KEY is missing")
        return False

    if not HTTPSMS_PHONE_NUMBER:
        print("ERROR: HTTPSMS_PHONE_NUMBER is missing")
        return False

    recipient_number = normalize_phone_number(phone_number)

    try:

        response = requests.post(
            "https://api.httpsms.com/v1/messages/send",

            headers={
                "x-api-key": HTTPSMS_API_KEY,
                "Content-Type": "application/json"
            },

            json={
                "content": message,
                "from": HTTPSMS_PHONE_NUMBER,
                "to": recipient_number
            },

            timeout=15
        )

        print("==========================================")
        print("HTTPSMS SMS")
        print("==========================================")
        print("To:", recipient_number)
        print("Response status:", response.status_code)
        print("Response:", response.text)
        print("==========================================")

        if 200 <= response.status_code < 300:
            return True

        return False

    except requests.RequestException as error:

        print("==========================================")
        print("HTTPSMS ERROR")
        print("==========================================")
        print(error)
        print("==========================================")

        return False


# ==========================================
# HOME
# ==========================================

@app.get("/")
def home():

    return {
        "message": "SPN Care Hospital Token Management System is running"
    }


# ==========================================
# REGISTER PATIENT
# PATIENT LOGIN REQUIRED
# ==========================================

@app.post("/patients")
def create_patient(
    patient: PatientCreate,
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):

    # Always use authenticated Supabase user ID.
    # Do not trust user_id sent from React.

    authenticated_user_id = user["id"]


    # ==========================================
    # CHECK EXISTING ACTIVE TOKEN
    # ==========================================

    existing_patient = (
        db.query(Patient)
        .filter(
            Patient.user_id == authenticated_user_id,
            Patient.status != "Completed"
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
                f"You already have an active token "
                f"#{existing_patient.token_number}."
            )
        )


    # ==========================================
    # FIND LAST TOKEN NUMBER
    # ==========================================

    last_patient = (
        db.query(Patient)
        .order_by(
            Patient.token_number.desc()
        )
        .first()
    )


    if last_patient:

        token_number = last_patient.token_number + 1

    else:

        token_number = 1


    # ==========================================
    # CREATE NEW PATIENT
    # ==========================================

    new_patient = Patient(

        user_id=authenticated_user_id,

        token_number=token_number,

        name=patient.name,

        phone=patient.phone,

        department=patient.department,

        emergency=patient.emergency,

        status="Waiting",

        near_turn_sms_sent=False
    )


    db.add(new_patient)

    db.commit()

    db.refresh(new_patient)


    # ==========================================
    # SEND TOKEN SMS
    # ==========================================

    sms_message = (
        f"SPN Care Hospital\n"
        f"Your token number is #{new_patient.token_number}.\n"
        f"Department: {new_patient.department}\n"
        f"Status: Waiting\n"
        f"Please wait for your turn."
    )


    sms_sent = send_sms(
        new_patient.phone,
        sms_message
    )


    # ==========================================
    # RETURN REGISTRATION RESULT
    # ==========================================

    return {

        "message": "Patient registered successfully",

        "token_number": new_patient.token_number,

        "patient_id": new_patient.id,

        "sms_sent": sms_sent
    }


# ==========================================
# GET CURRENT LOGGED-IN PATIENT
# PATIENT LOGIN REQUIRED
# ==========================================

@app.get("/patients/me")
def get_my_patient(

    db: Session = Depends(get_db),

    user=Depends(get_current_user)

):

    patient = (

        db.query(Patient)

        .filter(

            Patient.user_id == user["id"],

            Patient.status != "Completed"

        )

        .order_by(

            Patient.created_at.desc()

        )

        .first()

    )


    if not patient:

        raise HTTPException(

            status_code=404,

            detail="No active patient registration found"

        )


    return {

        "id": patient.id,

        "token_number": patient.token_number,

        "name": patient.name,

        "phone": patient.phone,

        "department": patient.department,

        "emergency": patient.emergency,

        "status": patient.status

    }


# ==========================================
# GET ALL PATIENTS
# NURSE ONLY
# ==========================================

@app.get("/patients")
def get_patients(

    db: Session = Depends(get_db),

    nurse=Depends(require_nurse)

):

    patients = (

        db.query(Patient)

        .order_by(

            Patient.emergency.desc(),

            Patient.token_number.asc()

        )

        .all()

    )


    return patients


# ==========================================
# CALL NEXT PATIENT
# NURSE ONLY
# ==========================================

@app.put("/patients/next")
def next_patient(

    db: Session = Depends(get_db),

    nurse=Depends(require_nurse)

):

    # ==========================================
    # CHECK CURRENT CONSULTING PATIENT
    # ==========================================

    current_patient = (

        db.query(Patient)

        .filter(

            Patient.status == "Consulting"

        )

        .first()

    )


    if current_patient:

        return {

            "message": "A patient is already consulting",

            "token_number": current_patient.token_number,

            "patient_name": current_patient.name,

            "status": current_patient.status

        }


    # ==========================================
    # FIND NEXT WAITING PATIENT
    # EMERGENCY GETS PRIORITY
    # ==========================================

    patient = (

        db.query(Patient)

        .filter(

            Patient.status == "Waiting"

        )

        .order_by(

            Patient.emergency.desc(),

            Patient.token_number.asc()

        )

        .first()

    )


    if not patient:

        return {

            "message": "No waiting patients"

        }


    patient.status = "Consulting"


    db.commit()

    db.refresh(patient)


    return {

        "message": "Next patient called",

        "token_number": patient.token_number,

        "patient_name": patient.name,

        "status": patient.status

    }


# ==========================================
# MARK PATIENT AS CONSULTING
# NURSE ONLY
# ==========================================

@app.put("/patients/{patient_id}/consulting")
def consulting_patient(

    patient_id: int,

    db: Session = Depends(get_db),

    nurse=Depends(require_nurse)

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

            detail="Patient not found"

        )


    patient.status = "Consulting"


    db.commit()

    db.refresh(patient)


    return {

        "message": "Patient is now consulting",

        "token_number": patient.token_number,

        "status": patient.status

    }


# ==========================================
# COMPLETE PATIENT
# NURSE ONLY
# ==========================================

@app.put("/patients/{patient_id}/completed")
def complete_patient(

    patient_id: int,

    db: Session = Depends(get_db),

    nurse=Depends(require_nurse)

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

            detail="Patient not found"

        )


    # ==========================================
    # COMPLETE CURRENT PATIENT
    # ==========================================

    patient.status = "Completed"


    # ==========================================
    # FIND NEXT WAITING PATIENT
    # EMERGENCY GETS PRIORITY
    # ==========================================

    next_patient = (

        db.query(Patient)

        .filter(

            Patient.status == "Waiting"

        )

        .order_by(

            Patient.emergency.desc(),

            Patient.token_number.asc()

        )

        .first()

    )


    # ==========================================
    # AUTOMATICALLY CALL NEXT PATIENT
    # ==========================================

    if next_patient:

        next_patient.status = "Consulting"


    db.commit()


    # ==========================================
    # RETURN RESULT
    # ==========================================

    return {

        "message": "Patient completed",

        "completed_token": patient.token_number,

        "next_token": (

            next_patient.token_number

            if next_patient

            else None

        )

    }


# ==========================================
# MARK EMERGENCY
# NURSE ONLY
# ==========================================

@app.put("/patients/{patient_id}/emergency")
def mark_emergency(

    patient_id: int,

    db: Session = Depends(get_db),

    nurse=Depends(require_nurse)

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

            detail="Patient not found"

        )


    patient.emergency = True


    db.commit()

    db.refresh(patient)


    return {

        "message": "Patient marked as emergency",

        "token_number": patient.token_number,

        "emergency": True

    }


# ==========================================
# DELETE COMPLETED PATIENT
# NURSE ONLY
# ==========================================

@app.delete("/patients/{patient_id}")
def delete_patient(

    patient_id: int,

    db: Session = Depends(get_db),

    nurse=Depends(require_nurse)

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

            detail="Patient not found"

        )


    # ==========================================
    # ONLY COMPLETED PATIENTS CAN BE DELETED
    # ==========================================

    if patient.status != "Completed":

        raise HTTPException(

            status_code=400,

            detail="Only completed patients can be deleted"

        )


    db.delete(patient)

    db.commit()


    return {

        "message": "Completed patient deleted successfully"

    }


# ==========================================
# PATIENT QUEUE STATUS
# LOGGED-IN USER ONLY
# ==========================================

@app.get("/queue/{token_number}")
def get_queue_status(

    token_number: int,

    db: Session = Depends(get_db),

    user=Depends(get_current_user)

):

    # ==========================================
    # FIND PATIENT TOKEN
    # ==========================================

    patient = (

        db.query(Patient)

        .filter(

            Patient.token_number == token_number

        )

        .first()

    )


    if not patient:

        raise HTTPException(

            status_code=404,

            detail="Token not found"

        )


    # ==========================================
    # VERIFY TOKEN OWNERSHIP
    # ==========================================

    if str(patient.user_id) != str(user["id"]):

        raise HTTPException(

            status_code=403,

            detail="You can only view your own queue"

        )


    # ==========================================
    # FIND CURRENTLY CONSULTING PATIENT
    # ==========================================

    current_patient = (

        db.query(Patient)

        .filter(

            Patient.status == "Consulting"

        )

        .order_by(

            Patient.token_number.asc()

        )

        .first()

    )


    if current_patient:

        current_token = current_patient.token_number

    else:

        current_token = None


    # ==========================================
    # CALCULATE ACTUAL QUEUE ORDER
    # ==========================================
    #
    # Queue order:
    #
    # 1. Current consulting patient
    # 2. Emergency waiting patients
    # 3. Normal waiting patients
    #
    # ==========================================

    active_patients = (

        db.query(Patient)

        .filter(

            Patient.status != "Completed"

        )

        .all()

    )


    # ==========================================
    # CURRENT CONSULTING PATIENTS
    # ==========================================

    consulting_patients = [

        p for p in active_patients

        if p.status == "Consulting"

    ]


    # ==========================================
    # WAITING PATIENTS
    # ==========================================

    waiting_patients = [

        p for p in active_patients

        if p.status == "Waiting"

    ]


    # ==========================================
    # SORT WAITING QUEUE
    # EMERGENCY FIRST
    # ==========================================

    waiting_patients.sort(

        key=lambda p: (

            not p.emergency,

            p.token_number

        )

    )


    # ==========================================
    # COMPLETE QUEUE ORDER
    # ==========================================

    queue_order = (

        consulting_patients +

        waiting_patients

    )


    # ==========================================
    # FIND PATIENT POSITION
    # ==========================================

    patients_before = 0

    patient_found_in_queue = False


    for queue_patient in queue_order:

        if queue_patient.id == patient.id:

            patient_found_in_queue = True

            break

        patients_before += 1


    if not patient_found_in_queue:

        patients_before = 0


    # ==========================================
    # NEAR-TURN SMS
    # ==========================================
    #
    # SMS is sent when 3 or fewer patients
    # are ahead.
    #
    # Example:
    #
    # Current = Token 3
    # Patient = Token 6
    #
    # Patients ahead = 3
    #
    # Therefore SMS is sent.
    #
    # ==========================================

    sms_sent_now = False


    if (

        patient.status == "Waiting"

        and patients_before <= 3

        and not patient.near_turn_sms_sent

    ):

        sms_message = (

            f"SPN Care Hospital\n\n"

            f"Hello {patient.name},\n"

            f"Your token #{patient.token_number} "
            f"is getting close to your turn.\n\n"

            f"Patients ahead: {patients_before}\n"

            f"Please be ready for your consultation.\n\n"

            f"SPN Care Hospital"

        )


        sms_sent = send_sms(

            patient.phone,

            sms_message

        )


        if sms_sent:

            patient.near_turn_sms_sent = True

            db.commit()

            db.refresh(patient)

            sms_sent_now = True


    # ==========================================
    # RETURN QUEUE INFORMATION
    # ==========================================

    return {

        "token_number": patient.token_number,

        "patient_name": patient.name,

        "status": patient.status,

        "current_token": current_token,

        "patients_before": patients_before,

        "emergency": patient.emergency,

        "near_turn_sms_sent": patient.near_turn_sms_sent,

        "sms_sent_now": sms_sent_now

    }