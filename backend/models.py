from sqlalchemy import Column, Integer, String, Boolean, DateTime
from sqlalchemy.sql import func

from database import Base


class Patient(Base):
    __tablename__ = "patients"

    # Patient database ID
    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    # Supabase authenticated user's ID
    user_id = Column(
        String,
        nullable=True
    )

    # Hospital token number
    token_number = Column(
        Integer,
        nullable=False
    )

    # Patient name
    name = Column(
        String,
        nullable=False
    )

    # Patient mobile number
    phone = Column(
        String,
        nullable=False
    )

    # Hospital department
    department = Column(
        String,
        nullable=False
    )

    # Emergency patient
    emergency = Column(
        Boolean,
        default=False
    )

    # Queue status
    # Waiting / Consulting / Completed
    status = Column(
        String,
        default="Waiting"
    )

    # --------------------------------------------------
    # Near-turn SMS tracking
    #
    # False = SMS has not been sent
    # True  = near-turn SMS has already been sent
    #
    # This prevents sending the same SMS repeatedly.
    # --------------------------------------------------

    near_turn_sms_sent = Column(
        Boolean,
        default=False
    )

    # Patient registration time
    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now()
    )