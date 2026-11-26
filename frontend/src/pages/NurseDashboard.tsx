import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

import { supabase } from "../supabaseClient";
import api from "../api";

type Patient = {
  id: number;
  user_id: string;
  token_number: string;
  name: string;
  phone: string;
  department: string;
  emergency: boolean;
  status: string;
  created_at: string;
};

function NurseDashboard() {
  const navigate = useNavigate();

  // ==========================================
  // PATIENT / HOSPITAL STATE
  // ==========================================

  const [patients, setPatients] = useState<Patient[]>([]);
  const [currentPatient, setCurrentPatient] =
    useState<Patient | null>(null);

  const [hospitalId, setHospitalId] =
    useState<number | null>(null);

  // ==========================================
  // HOSPITAL FORM STATE
  // ==========================================

  const [hospitalName, setHospitalName] = useState("");
  const [hospitalAddress, setHospitalAddress] = useState("");
  const [hospitalPhone, setHospitalPhone] = useState("");

  const [creatingHospital, setCreatingHospital] =
    useState(false);

  // ==========================================
  // GENERAL STATE
  // ==========================================

  const [loading, setLoading] = useState(true);

  const [actionLoading, setActionLoading] =
    useState(false);

  const [message, setMessage] = useState("");

  // ==========================================
  // CHECK HOSPITAL STAFF LOGIN
  // ==========================================

  useEffect(() => {
    checkNurse();
  }, []);

  const checkNurse = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      // No logged-in user
      if (!user) {
        navigate("/nurse-login");
        return;
      }

      // Get user profile from backend
      const profile = await api.get("/auth/me");

      // Internal role remains Nurse.
      // Only the displayed name is changed to Hospital Staff.
      if (profile.data.role !== "Nurse") {
        await supabase.auth.signOut();

        navigate("/nurse-login");
        return;
      }

      // ==========================================
      // IMPORTANT:
      // Nurse is allowed into portal even if
      // hospital_id is NULL.
      // ==========================================

      if (!profile.data.hospital_id) {
        setHospitalId(null);

        setMessage(
          "Your Hospital Staff account is not assigned to a hospital yet."
        );

        return;
      }

      // Hospital already assigned
      setHospitalId(profile.data.hospital_id);

      await loadPatients(profile.data.hospital_id);

    } catch (error) {
      console.error(
        "Hospital Staff authentication error:",
        error
      );

      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401) {
          await supabase.auth.signOut();

          navigate("/nurse-login");
          return;
        }

        setMessage(
          error.response?.data?.detail ||
            "Unable to verify Hospital Staff account."
        );
      } else {
        setMessage(
          "Unable to verify Hospital Staff account."
        );
      }
    } finally {
      setLoading(false);
    }
  };

  // ==========================================
  // LOAD ALL PATIENTS
  // ==========================================

  const loadPatients = async (
    selectedHospitalId = hospitalId
  ) => {
    if (!selectedHospitalId) {
      return;
    }

    try {
      const response = await api.get("/patients", {
        params: {
          hospital_id: selectedHospitalId,
        },
      });

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
            error.response?.data?.detail ||
              "Access denied. Hospital Staff account required."
          );

          return;
        }

        setMessage(
          error.response?.data?.detail ||
            "Unable to load patients."
        );

        return;
      }

      setMessage(
        "Unable to load patients."
      );
    }
  };

  // ==========================================
  // AUTOMATIC REFRESH
  // ==========================================

  useEffect(() => {
    // Do not refresh if:
    // - still loading
    // - Hospital Staff has no hospital

    if (
      loading ||
      !hospitalId
    ) {
      return;
    }

    const interval = setInterval(() => {
      loadPatients();
    }, 5000);

    return () => {
      clearInterval(interval);
    };
  }, [loading, hospitalId]);

  // ==========================================
  // CREATE HOSPITAL
  // ==========================================

  const createHospital = async (
    event: React.FormEvent
  ) => {
    event.preventDefault();

    // Validation
    if (!hospitalName.trim()) {
      setMessage(
        "Hospital name is required."
      );

      return;
    }

    setCreatingHospital(true);
    setMessage("");

    try {
      const response = await api.post(
        "/nurse/hospital",
        {
          name: hospitalName.trim(),
          address:
            hospitalAddress.trim() || null,
          phone:
            hospitalPhone.trim() || null,
        }
      );

      const newHospitalId =
        response.data.hospital_id;

      if (!newHospitalId) {
        setMessage(
          "Hospital was created, but hospital ID was not returned."
        );

        return;
      }

      // Assign hospital to current Hospital Staff
      setHospitalId(newHospitalId);

      // Clear form
      setHospitalName("");
      setHospitalAddress("");
      setHospitalPhone("");

      setMessage(
        "Hospital created successfully. Your Hospital Staff account is now assigned to this hospital."
      );

      // Load queue
      await loadPatients(
        newHospitalId
      );

    } catch (error) {
      console.error(
        "Hospital creation failed:",
        error
      );

      if (axios.isAxiosError(error)) {
        setMessage(
          error.response?.data?.detail ||
            "Unable to create hospital."
        );
      } else {
        setMessage(
          "Unable to create hospital."
        );
      }
    } finally {
      setCreatingHospital(false);
    }
  };

  // ==========================================
  // CALL NEXT PATIENT
  // ==========================================

  const callNextPatient = async () => {
    if (!hospitalId) {
      setMessage(
        "Hospital Staff account is not assigned to a hospital."
      );

      return;
    }

    setActionLoading(true);
    setMessage("");

    try {
      const response = await api.put(
        "/patients/next",
        null,
        {
          params: {
            hospital_id: hospitalId,
          },
        }
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
    const confirmed =
      window.confirm(
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

          <h2>
            Checking Hospital Staff login...
          </h2>

          <p>
            Please wait.
          </p>

        </div>
      </div>
    );
  }

  // ==========================================
  // NO HOSPITAL
  // SHOW ADD HOSPITAL INSIDE HOSPITAL STAFF PORTAL
  // ==========================================

  if (!hospitalId) {
    return (
      <div className="dashboard-page">

        {/* TOP BAR */}
        <div className="dashboard-topbar">

          <div>

            <h1>
              Queue Care
            </h1>

            <p>
              Hospital Staff Portal
            </p>

          </div>

          <button
            onClick={logout}
            className="logout-button"
          >
            Logout
          </button>

        </div>

        {/* CONTENT */}
        <main className="dashboard-content">

          <section className="dashboard-intro">

            <h2>
              Set up your hospital
            </h2>

            <p>
              Your Hospital Staff account is not
              assigned to a hospital yet.
              Create your hospital below
              to start managing the patient
              queue.
            </p>

          </section>

          {/* MESSAGE */}
          {message && (
            <div className="message">
              {message}
            </div>
          )}

          {/* ADD HOSPITAL */}
          <section className="queue-card">

            <h2>
              🏥 Add Hospital
            </h2>

            <p>
              Create a hospital and
              automatically assign your
              Hospital Staff account to it.
            </p>

            <form
              onSubmit={createHospital}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "16px",
                marginTop: "20px",
              }}
            >

              {/* HOSPITAL NAME */}
              <div>

                <label
                  style={{
                    display: "block",
                    marginBottom: "6px",
                    fontWeight: 600,
                  }}
                >
                  Hospital name
                </label>

                <input
                  type="text"
                  value={hospitalName}
                  onChange={(event) =>
                    setHospitalName(
                      event.target.value
                    )
                  }
                  placeholder="Queue Care Hospital"
                  disabled={
                    creatingHospital
                  }
                  style={{
                    width: "100%",
                    padding: "12px",
                    borderRadius: "8px",
                    border: "1px solid #ccc",
                    boxSizing: "border-box",
                  }}
                />

              </div>

              {/* ADDRESS */}
              <div>

                <label
                  style={{
                    display: "block",
                    marginBottom: "6px",
                    fontWeight: 600,
                  }}
                >
                  Address
                </label>

                <input
                  type="text"
                  value={hospitalAddress}
                  onChange={(event) =>
                    setHospitalAddress(
                      event.target.value
                    )
                  }
                  placeholder="Hospital address"
                  disabled={
                    creatingHospital
                  }
                  style={{
                    width: "100%",
                    padding: "12px",
                    borderRadius: "8px",
                    border: "1px solid #ccc",
                    boxSizing: "border-box",
                  }}
                />

              </div>

              {/* PHONE */}
              <div>

                <label
                  style={{
                    display: "block",
                    marginBottom: "6px",
                    fontWeight: 600,
                  }}
                >
                  Phone
                </label>

                <input
                  type="tel"
                  value={hospitalPhone}
                  onChange={(event) =>
                    setHospitalPhone(
                      event.target.value
                    )
                  }
                  placeholder="Hospital phone number"
                  disabled={
                    creatingHospital
                  }
                  style={{
                    width: "100%",
                    padding: "12px",
                    borderRadius: "8px",
                    border: "1px solid #ccc",
                    boxSizing: "border-box",
                  }}
                />

              </div>

              {/* SUBMIT */}
              <button
                type="submit"
                className="primary-button"
                disabled={
                  creatingHospital
                }
              >
                {creatingHospital
                  ? "Creating hospital..."
                  : "➕ Add Hospital"}
              </button>

            </form>

          </section>

          {/* INFORMATION */}
          <section className="queue-card">

            <h3>
              Standard departments
            </h3>

            <p>
              New hospitals receive the
              standard departments
              configured by the system.
            </p>

          </section>

        </main>

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
            Queue Care
          </h1>

          <p>
            Hospital Staff Dashboard
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
                    disabled={
                      actionLoading
                    }
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
                disabled={
                  actionLoading
                }
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
            onClick={
              callNextPatient
            }
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
                        disabled={
                          actionLoading
                        }
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
                    disabled={
                      actionLoading
                    }
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
          onClick={() =>
            loadPatients()
          }
          disabled={
            actionLoading
          }
        >
          🔄 Refresh Queue
        </button>

      </main>

    </div>
  );
}

export default NurseDashboard;