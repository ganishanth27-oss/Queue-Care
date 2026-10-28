import os
import sqlite3
from sqlalchemy import create_engine, MetaData
from sqlalchemy.orm import sessionmaker
from database import engine, Base
from models import Hospital, Department, Patient, UserRole

def run_migration():
    print("Starting database migration for Queue Care...")
    
    # Ensure tables exist
    Base.metadata.create_all(bind=engine)
    
    Session = sessionmaker(bind=engine)
    session = Session()

    try:
        # Check if Queue Care hospital exists
        queue_care = session.query(Hospital).filter_by(code="QUEUECARE").first()
        if not queue_care:
            print("Creating default Queue Care hospital...")
            queue_care = Hospital(
                name="Queue Care",
                code="QUEUECARE",
                status="Active"
            )
            session.add(queue_care)
            session.commit()
            session.refresh(queue_care)
            print(f"Hospital created with ID: {queue_care.id}")
        else:
            print(f"Queue Care hospital already exists with ID: {queue_care.id}")

        # Update existing patients who might not have a hospital_id
        patients = session.query(Patient).filter(Patient.hospital_id == None).all()
        if patients:
            print(f"Found {len(patients)} legacy patients. Associating them with Queue Care...")
            for p in patients:
                p.hospital_id = queue_care.id
            session.commit()
            print("Successfully migrated patients.")
        else:
            print("No legacy patients needed migration.")

    except Exception as e:
        print(f"Migration error: {e}")
        session.rollback()
    finally:
        session.close()

if __name__ == "__main__":
    run_migration()
