from sqlalchemy import (
    Column,
    Integer,
    String,
    Boolean,
    DateTime,
    ForeignKey
)

from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from database import Base


# ============================================================
# HOSPITAL
# ============================================================

class Hospital(Base):
    __tablename__ = "hospitals"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    name = Column(
        String,
        nullable=False
    )

    code = Column(
        String,
        unique=True,
        index=True,
        nullable=False
    )

    logo = Column(
        String,
        nullable=True
    )

    address = Column(
        String,
        nullable=True
    )

    phone = Column(
        String,
        nullable=True
    )

    email = Column(
        String,
        nullable=True
    )

    status = Column(
        String,
        default="Active"
    )

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now()
    )

    # Relationships

    departments = relationship(
        "Department",
        back_populates="hospital"
    )

    patients = relationship(
        "Patient",
        back_populates="hospital"
    )

    audit_logs = relationship(
        "AuditLog",
        back_populates="hospital"
    )


# ============================================================
# DEPARTMENT
# ============================================================

class Department(Base):
    __tablename__ = "departments"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    hospital_id = Column(
        Integer,
        ForeignKey("hospitals.id"),
        nullable=False
    )

    name = Column(
        String,
        nullable=False
    )

    code = Column(
        String,
        nullable=False
    )

    # Relationship

    hospital = relationship(
        "Hospital",
        back_populates="departments"
    )


# ============================================================
# USER ROLE
# ============================================================

class UserRole(Base):
    __tablename__ = "user_roles"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    # Supabase authenticated user's ID

    user_id = Column(
        String,
        nullable=False,
        index=True
    )

    # Examples:
    #
    # Super Admin
    # Hospital Admin
    # Nurse
    # Doctor
    # Patient

    role = Column(
        String,
        nullable=False
    )

    # Hospital assigned to the user

    hospital_id = Column(
        Integer,
        ForeignKey("hospitals.id"),
        nullable=True
    )

    # ========================================================
    # DOCTOR DEPARTMENT
    # ========================================================
    #
    # Example:
    #
    # General Medicine
    # Cardiology
    # Orthopedics
    # Pediatrics
    # Dermatology
    #
    # Mainly used for Doctor accounts.
    #

    department = Column(
        String,
        nullable=True
    )


# ============================================================
# PATIENT
# ============================================================

class Patient(Base):
    __tablename__ = "patients"

    # --------------------------------------------------------
    # Patient database ID
    # --------------------------------------------------------

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    # --------------------------------------------------------
    # Hospital
    # --------------------------------------------------------

    hospital_id = Column(
        Integer,
        ForeignKey("hospitals.id"),
        nullable=False
    )

    # --------------------------------------------------------
    # Supabase authenticated user's ID
    # --------------------------------------------------------

    user_id = Column(
        String,
        nullable=True
    )

    # --------------------------------------------------------
    # Hospital token number
    #
    # Example:
    # GEN-001
    # CARD-002
    # ORTHO-003
    # --------------------------------------------------------

    token_number = Column(
        String,
        nullable=False
    )

    # --------------------------------------------------------
    # Patient name
    # --------------------------------------------------------

    name = Column(
        String,
        nullable=False
    )

    # --------------------------------------------------------
    # Patient mobile number
    # --------------------------------------------------------

    phone = Column(
        String,
        nullable=False
    )

    # --------------------------------------------------------
    # Hospital department
    # --------------------------------------------------------

    department = Column(
        String,
        nullable=False
    )

    # --------------------------------------------------------
    # Emergency patient
    # --------------------------------------------------------

    emergency = Column(
        Boolean,
        default=False
    )

    # --------------------------------------------------------
    # Queue status
    #
    # Waiting
    # Consulting
    # Completed
    # --------------------------------------------------------

    status = Column(
        String,
        default="Waiting"
    )

    # ========================================================
    # SMART ETA / CONSULTATION TRACKING
    # ========================================================

    consultation_started_at = Column(
        DateTime(timezone=True),
        nullable=True
    )

    consultation_completed_at = Column(
        DateTime(timezone=True),
        nullable=True
    )

    # ========================================================
    # SMART SMS NOTIFICATION TRACKING
    # ========================================================

    notified_10 = Column(
        Boolean,
        default=False
    )

    notified_5 = Column(
        Boolean,
        default=False
    )

    notified_2 = Column(
        Boolean,
        default=False
    )

    # ========================================================
    # PATIENT REGISTRATION
    # ========================================================

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now()
    )

    # ========================================================
    # RELATIONSHIP
    # ========================================================

    hospital = relationship(
        "Hospital",
        back_populates="patients"
    )


# ============================================================
# AUDIT LOG
# ============================================================

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    # Supabase user ID

    user_id = Column(
        String,
        nullable=True
    )

    # Example:
    #
    # PATIENT_CREATED
    # PATIENT_CONSULTING
    # PATIENT_COMPLETED
    # PATIENT_SKIPPED
    # DOCTOR_CREATED

    action = Column(
        String,
        nullable=False
    )

    hospital_id = Column(
        Integer,
        ForeignKey("hospitals.id"),
        nullable=True
    )

    token_id = Column(
        Integer,
        nullable=True
    )

    timestamp = Column(
        DateTime(timezone=True),
        server_default=func.now()
    )

    # Relationship

    hospital = relationship(
        "Hospital",
        back_populates="audit_logs"
    )