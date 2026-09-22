import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

import { supabase } from "../supabaseClient";
import api from "../api";

type Patient = {
  id: number;
  user_id: string;
  token_number: number;
  name: string;
  phone: string;
  department: string;
  emergency: boolean;
  status: string;
  created_at: string;
};

function NurseDashboard() {
  const navigate = useNavigate();

  const [patients, setPatients] = useState<Patient[]>([]);
  const [currentPatient, setCurrentPatient] =
    useState<Patient | null>(null);

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] =
    useState(false);

  const [message, setMessage] = useState("");

  // ==========================================
  // CHECK NURSE LOGIN
  // ==========================================

  useEffect(() => {
    checkNurse();
  }, []);

  const checkNurse = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        navigate("/nurse-login");
        return;
      }

      const { data: profile, error } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (error || profile?.role !== "nurse") {
        await supabase.auth.signOut();

        navigate("/nurse-login");
        return;
      }

      await loadPatients();
    } catch (error) {
      console.error(
        "Nurse authentication error:",
        error
      );

      navigate("/nurse-login");
    } finally {
      setLoading(false);
    }
  };

  // ==========================================
  // LOAD ALL PATIENTS
  // ==========================================

  const loadPatients = async () => {
    try {
      const response = await api.get("/patients");

      const data: Patient[] = response.data;

      setPatients(data);

      const consulting = data.find(
        (patient) =>
          patient.status === "Consulting"
      );

      setCurrentPatient(
        consulting || null
      );
    } catch (error) {
      console.error(
        "Loading patients failed:",
        error
      );

      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401) {
          setMessage(
            "Your session has expired. Please login again."
          );

          await supabase.auth.signOut();
          navigate("/nurse-login");
          return;
        }

        if (error.response?.status === 403) {
          setMessage(
            "Access denied. Nurse account required."
          );

          await supabase.auth.signOut();
          navigate("/nurse-login");
          return;
        }

        setMessage(
          error.response?.data?.detail ||
            "Unable to load patients."
        );

        return;
      }

      setMessage("Unable to load patients.");
    }
  };

  // ==========================================
  // AUTOMATIC REFRESH
  // ==========================================

  useEffect(() => {
    if (loading) {
      return;
    }

    const interval = setInterval(() => {
      loadPatients();
    }, 5000);

    return () => {
      clearInterval(interval);
    };
  }, [loading]);

  // ==========================================
  // CALL NEXT PATIENT
  // ==========================================

  const callNextPatient = async () => {
    setActionLoading(true);
    setMessage("");

    try {
      const response = await api.put(
        "/patients/next"
      );

      setMessage(
        response.data.next_token
          ? `Next patient called: Token #${response.data.next_token}`
          : response.data.message ||
              `Patient #${response.data.token_number} is now consulting.`
      );

      await loadPatients();
    } catch (error) {
      console.error(
        "Calling next patient failed:",
        error
      );

      if (axios.isAxiosError(error)) {
        setMessage(
          error.response?.data?.detail ||
            "Unable to call next patient."
        );
      } else {
        setMessage(
          "Unable to call next patient."
        );
      }
    } finally {
      setActionLoading(false);
    }
  };

  // ==========================================
  // COMPLETE PATIENT
  // ==========================================

  const completePatient = async (
    patientId: number
  ) => {
    setActionLoading(true);
    setMessage("");

    try {
      const response = await api.put(
        `/patients/${patientId}/completed`
      );

      if (response.data.next_token) {
        setMessage(
          `Patient completed. Next patient #${response.data.next_token} is now consulting.`
        );
      } else {
        setMessage(
          "Patient completed. No waiting patients."
        );
      }

      await loadPatients();
    } catch (error) {
      console.error(
        "Completing patient failed:",
        error
      );

      if (axios.isAxiosError(error)) {
        setMessage(
          error.response?.data?.detail ||
            "Unable to complete patient."
        );
      } else {
        setMessage(
          "Unable to complete patient."
        );
      }
    } finally {
      setActionLoading(false);
    }
  };

  // ==========================================
  // MARK EMERGENCY
  // ==========================================

  const markEmergency = async (
    patientId: number
  ) => {
    setActionLoading(true);
    setMessage("");

    try {
      await api.put(
        `/patients/${patientId}/emergency`
      );

      setMessage(
        "Patient marked as emergency."
      );

      await loadPatients();
    } catch (error) {
      console.error(
        "Emergency update failed:",
        error
      );

      if (axios.isAxiosError(error)) {
        setMessage(
          error.response?.data?.detail ||
            "Unable to mark patient as emergency."
        );
      } else {
        setMessage(
          "Unable to mark patient as emergency."
        );
      }
    } finally {
      setActionLoading(false);
    }
  };

  // ==========================================
  // DELETE COMPLETED PATIENT
  // ==========================================

  const deletePatient = async (
    patientId: number
  ) => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this completed patient?"
    );

    if (!confirmed) {
      return;
    }

    setActionLoading(true);
    setMessage("");

    try {
      await api.delete(
        `/patients/${patientId}`
      );

      setMessage(
        "Completed patient deleted successfully."
      );

      await loadPatients();
    } catch (error) {
      console.error(
        "Deleting patient failed:",
        error
      );

      if (axios.isAxiosError(error)) {
        setMessage(
          error.response?.data?.detail ||
            "Unable to delete patient."
        );
      } else {
        setMessage(
          "Unable to delete patient."
        );
      }
    } finally {
      setActionLoading(false);
    }
  };

  // ==========================================
  // LOGOUT
  // ==========================================

  const logout = async () => {
    await supabase.auth.signOut();

    navigate("/");
  };

  // ==========================================
  // FILTER PATIENTS
  // ==========================================

  const emergencyPatients =
    patients.filter(
      (patient) =>
        patient.emergency &&
        patient.status === "Waiting"
    );

  const waitingPatients =
    patients.filter(
      (patient) =>
        patient.status === "Waiting"
    );

  const completedPatients =
    patients.filter(
      (patient) =>
        patient.status === "Completed"
    );

  // ==========================================
  // LOADING SCREEN
  // ==========================================

  if (loading) {
    return (
      <div className="dashboard-page">
        <div className="dashboard-content">
          <h2>Checking nurse login...</h2>
          <p>Please wait.</p>
        </div>
      </div>
    );
  }

  // ==========================================
  // MAIN DASHBOARD
  // ==========================================

  return (
    <div className="dashboard-page">

      {/* =====================================
          TOP BAR
      ===================================== */}

      <div className="dashboard-topbar">

        <div>
          <h1>
            SPN Care Hospital
          </h1>

          <p>
            Nurse Dashboard
          </p>
        </div>

        <button
          onClick={logout}
          className="logout-button"
        >
          Logout
        </button>

      </div>

      <main className="dashboard-content">

        {/* =====================================
            HEADER
        ===================================== */}

        <section className="dashboard-intro">

          <h2>
            Queue Management
          </h2>

          <p>
            Manage patients and control
            the consultation queue.
          </p>

        </section>

        {/* =====================================
            MESSAGE
        ===================================== */}

        {message && (
          <div className="message">
            {message}
          </div>
        )}

        {/* =====================================
            SUMMARY
        ===================================== */}

        <section className="queue-cards">

          <div className="queue-box">
            <span>
              Total Patients
            </span>

            <strong>
              {patients.length}
            </strong>
          </div>

          <div className="queue-box">
            <span>
              Waiting
            </span>

            <strong>
              {waitingPatients.length}
            </strong>
          </div>

          <div className="queue-box">
            <span>
              Emergency
            </span>

            <strong>
              {emergencyPatients.length}
            </strong>
          </div>

          <div className="queue-box">
            <span>
              Completed
            </span>

            <strong>
              {completedPatients.length}
            </strong>
          </div>

        </section>

        {/* =====================================
            ATTENTION REQUIRED
        ===================================== */}

        {emergencyPatients.length > 0 && (
          <section className="patient-alert">

            <h2>
              🚨 ATTENTION REQUIRED
            </h2>

            <p>
              Emergency patients are waiting
              and have priority.
            </p>

            {emergencyPatients.map(
              (patient) => (
                <div
                  className="queue-item"
                  key={patient.id}
                >

                  <div>
                    <strong>
                      🚨 Token #
                      {patient.token_number}
                    </strong>

                    <p>
                      {patient.name}
                    </p>

                    <small>
                      {patient.department}
                    </small>
                  </div>

                  <button
                    onClick={() =>
                      callNextPatient()
                    }
                    disabled={actionLoading}
                  >
                    Call Patient
                  </button>

                </div>
              )
            )}

          </section>
        )}

        {/* =====================================
            CURRENT PATIENT
        ===================================== */}

        <section className="queue-card">

          <h2>
            🩺 Currently Consulting
          </h2>

          {currentPatient ? (
            <div className="queue-item">

              <div>
                <strong>
                  Token #
                  {currentPatient.token_number}
                </strong>

                <p>
                  {currentPatient.name}
                </p>

                <small>
                  {currentPatient.department}
                </small>
              </div>

              <button
                onClick={() =>
                  completePatient(
                    currentPatient.id
                  )
                }
                disabled={actionLoading}
              >
                {actionLoading
                  ? "Processing..."
                  : "✅ Complete"}
              </button>

            </div>
          ) : (
            <div className="message">
              No patient is currently
              consulting.
            </div>
          )}

        </section>

        {/* =====================================
            CALL NEXT
        ===================================== */}

        <section className="queue-card">

          <h2>
            📢 Queue Control
          </h2>

          <button
            className="primary-button"
            onClick={callNextPatient}
            disabled={
              actionLoading ||
              waitingPatients.length === 0 ||
              currentPatient !== null
            }
          >
            {currentPatient
              ? "Patient Currently Consulting"
              : waitingPatients.length === 0
              ? "No Waiting Patients"
              : "▶️ Call Next Patient"}
          </button>

        </section>

        {/* =====================================
            WAITING PATIENTS
        ===================================== */}

        <section className="queue-card">

          <h2>
            👥 Waiting Patients
          </h2>

          {waitingPatients.length === 0 ? (
            <div className="message">
              No patients are waiting.
            </div>
          ) : (
            waitingPatients.map(
              (patient) => (
                <div
                  className="queue-item"
                  key={patient.id}
                >

                  <div>

                    <strong>
                      {patient.emergency
                        ? "🚨 "
                        : ""}
                      Token #
                      {patient.token_number}
                    </strong>

                    <p>
                      {patient.name}
                    </p>

                    <small>
                      {patient.department}
                      {" • "}
                      {patient.phone}
                    </small>

                  </div>

                  <div>

                    {!patient.emergency && (
                      <button
                        onClick={() =>
                          markEmergency(
                            patient.id
                          )
                        }
                        disabled={actionLoading}
                      >
                        🚨 Emergency
                      </button>
                    )}

                  </div>

                </div>
              )
            )
          )}

        </section>

        {/* =====================================
            COMPLETED PATIENTS
        ===================================== */}

        <section className="queue-card">

          <h2>
            ✅ Completed Patients
          </h2>

          {completedPatients.length === 0 ? (
            <div className="message">
              No completed patients.
            </div>
          ) : (
            completedPatients.map(
              (patient) => (
                <div
                  className="queue-item"
                  key={patient.id}
                >

                  <div>

                    <strong>
                      Token #
                      {patient.token_number}
                    </strong>

                    <p>
                      {patient.name}
                    </p>

                    <small>
                      {patient.department}
                    </small>

                  </div>

                  <button
                    onClick={() =>
                      deletePatient(
                        patient.id
                      )
                    }
                    disabled={actionLoading}
                  >
                    🗑️ Delete
                  </button>

                </div>
              )
            )
          )}

        </section>

        {/* =====================================
            REFRESH
        ===================================== */}

        <button
          className="refresh-button"
          onClick={loadPatients}
          disabled={actionLoading}
        >
          🔄 Refresh Queue
        </button>

      </main>

    </div>
  );
}

export default NurseDashboard;
