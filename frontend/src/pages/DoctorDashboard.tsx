import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  useNavigate,
} from "react-router-dom";

import axios from "axios";

import { supabase } from "../supabaseClient";
import { API_URL } from "../api";

/* =========================================================
   TYPES
========================================================= */

interface Patient {
  id: number;
  token_number: string;
  name: string;
  phone?: string;
  department: string;
  emergency: boolean;
  status: string;
  hospital_id: number;
  consultation_started_at?: string | null;
  consultation_completed_at?: string | null;
  created_at?: string;
}

interface DoctorInfo {
  email?: string;
  hospital_id?: number;
  department?: string;
}

interface QueueResponse {
  hospital_id: number;
  department: string;
  current: Patient | null;
  patients: Patient[];
  waiting_count: number;
  completed_count: number;
}

/* =========================================================
   DOCTOR DASHBOARD
========================================================= */

function DoctorDashboard() {
  const navigate = useNavigate();

  /* =======================================================
     STATE
  ======================================================= */

  const [patients, setPatients] =
    useState<Patient[]>([]);

  const [currentPatient, setCurrentPatient] =
    useState<Patient | null>(null);

  const [doctorInfo, setDoctorInfo] =
    useState<DoctorInfo>({});

  const [waitingCount, setWaitingCount] =
    useState(0);

  const [completedCount, setCompletedCount] =
    useState(0);

  const [loading, setLoading] =
    useState(true);

  const [actionLoading, setActionLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  const [lastUpdated, setLastUpdated] =
    useState<Date | null>(null);

  const [consultationSeconds, setConsultationSeconds] =
    useState(0);

  const [newPatientAlert, setNewPatientAlert] =
    useState(false);

  const previousWaitingIds =
    useRef<number[]>([]);

  /* =======================================================
     GET ACCESS TOKEN
  ======================================================= */

  const getAccessToken = async () => {
    const {
      data,
      error,
    } = await supabase.auth.getSession();

    if (error) {
      throw error;
    }

    const session = data.session;

    if (!session) {
      navigate(
        "/doctor-login",
        {
          replace: true,
        }
      );

      throw new Error(
        "Your session has expired."
      );
    }

    return session.access_token;
  };

  /* =======================================================
     LOAD DOCTOR PROFILE
  ======================================================= */

  const loadDoctorProfile =
    useCallback(
      async () => {
        const token =
          await getAccessToken();

        const response =
          await axios.get(
            `${API_URL}/auth/me`,
            {
              headers: {
                Authorization:
                  `Bearer ${token}`,
              },

              timeout: 10000,
            }
          );

        if (
          response.data.role !==
          "Doctor"
        ) {
          await supabase.auth.signOut();

          navigate(
            "/doctor-login",
            {
              replace: true,
            }
          );

          throw new Error(
            "Doctor access required."
          );
        }

        setDoctorInfo({
          email:
            response.data.user?.email,

          hospital_id:
            response.data.hospital_id,

          department:
            response.data.department,
        });

        if (
          response.data.hospital_id
        ) {
          localStorage.setItem(
            "doctor_hospital_id",
            String(
              response.data.hospital_id
            )
          );
        }

        if (
          response.data.department
        ) {
          localStorage.setItem(
            "doctor_department",
            response.data.department
          );
        }

        if (
          response.data.user?.email
        ) {
          localStorage.setItem(
            "doctor_email",
            response.data.user.email
          );
        }
      },
      [navigate]
    );

  /* =======================================================
     LOAD QUEUE
  ======================================================= */

  const loadQueue =
    useCallback(
      async (
        showLoader = false
      ) => {
        try {
          if (showLoader) {
            setLoading(true);
          }

          setError("");

          const token =
            await getAccessToken();

          const response =
            await axios.get<QueueResponse>(
              `${API_URL}/doctor/queue`,
              {
                headers: {
                  Authorization:
                    `Bearer ${token}`,
                },

                timeout: 10000,
              }
            );

          const newPatients =
            response.data.patients || [];

          /* -----------------------------------------------
             CHECK FOR NEW WAITING PATIENT
          ------------------------------------------------ */

          const currentWaitingIds =
            newPatients
              .filter(
                (patient) =>
                  patient.status ===
                  "Waiting"
              )
              .map(
                (patient) =>
                  patient.id
              );

          if (
            previousWaitingIds.current.length > 0
          ) {
            const hasNewPatient =
              currentWaitingIds.some(
                (id) =>
                  !previousWaitingIds.current.includes(
                    id
                  )
              );

            if (hasNewPatient) {
              setNewPatientAlert(true);

              window.setTimeout(
                () => {
                  setNewPatientAlert(false);
                },
                5000
              );
            }
          }

          previousWaitingIds.current =
            currentWaitingIds;

          setPatients(
            newPatients
          );

          setCurrentPatient(
            response.data.current ||
            null
          );

          setWaitingCount(
            response.data.waiting_count ||
            0
          );

          setCompletedCount(
            response.data.completed_count ||
            0
          );

          setLastUpdated(
            new Date()
          );
        } catch (err: any) {
          console.error(
            "DOCTOR QUEUE ERROR:",
            err
          );

          if (
            err.response?.status === 401
          ) {
            await supabase.auth.signOut();

            navigate(
              "/doctor-login",
              {
                replace: true,
              }
            );

            return;
          }

          if (
            err.response?.status === 403
          ) {
            setError(
              "You are not authorized to access this Doctor queue."
            );

            return;
          }

          setError(
            err.response?.data?.detail ||
            err.message ||
            "Unable to load doctor queue."
          );
        } finally {
          if (showLoader) {
            setLoading(false);
          }
        }
      },
      [navigate]
    );

  /* =======================================================
     INITIAL LOAD
  ======================================================= */

  useEffect(() => {
    let mounted = true;

    const initialize =
      async () => {
        try {
          setLoading(true);
          setError("");

          await loadDoctorProfile();

          if (mounted) {
            await loadQueue(false);
          }
        } catch (err: any) {
          console.error(
            "DOCTOR INITIALIZATION ERROR:",
            err
          );

          if (mounted) {
            setError(
              err.message ||
              "Unable to load Doctor Dashboard."
            );
          }
        } finally {
          if (mounted) {
            setLoading(false);
          }
        }
      };

    initialize();

    return () => {
      mounted = false;
    };
  }, [
    loadDoctorProfile,
    loadQueue,
  ]);

  /* =======================================================
     AUTO REFRESH
  ======================================================= */

  useEffect(() => {
    const interval =
      window.setInterval(
        () => {
          loadQueue(false);
        },
        10000
      );

    return () => {
      window.clearInterval(
        interval
      );
    };
  }, [loadQueue]);

  /* =======================================================
     CONSULTATION TIMER
  ======================================================= */

  useEffect(() => {
    if (
      !currentPatient?.consultation_started_at
    ) {
      setConsultationSeconds(0);
      return;
    }

    const updateTimer =
      () => {
        const started =
          new Date(
            currentPatient.consultation_started_at!
          ).getTime();

        const now =
          Date.now();

        const seconds =
          Math.max(
            0,
            Math.floor(
              (now - started) /
                1000
            )
          );

        setConsultationSeconds(
          seconds
        );
      };

    updateTimer();

    const timer =
      window.setInterval(
        updateTimer,
        1000
      );

    return () => {
      window.clearInterval(
        timer
      );
    };
  }, [
    currentPatient?.consultation_started_at,
  ]);

  /* =======================================================
     SUCCESS MESSAGE
  ======================================================= */

  const showSuccess =
    (message: string) => {
      setSuccess(message);

      window.setTimeout(
        () => {
          setSuccess("");
        },
        3500
      );
    };

  /* =======================================================
     WAITING PATIENTS
  ======================================================= */

  const waitingPatients =
    useMemo(
      () => {
        return patients
          .filter(
            (patient) =>
              patient.status ===
              "Waiting"
          )
          .sort(
            (a, b) => {
              /* Emergency first */

              if (
                a.emergency &&
                !b.emergency
              ) {
                return -1;
              }

              if (
                !a.emergency &&
                b.emergency
              ) {
                return 1;
              }

              /* Then oldest patient */

              const aTime =
                a.created_at
                  ? new Date(
                      a.created_at
                    ).getTime()
                  : a.id;

              const bTime =
                b.created_at
                  ? new Date(
                      b.created_at
                    ).getTime()
                  : b.id;

              return (
                aTime - bTime
              );
            }
          );
      },
      [patients]
    );

  /* =======================================================
     COMPLETED PATIENTS
  ======================================================= */

  const completedPatients =
    useMemo(
      () =>
        patients.filter(
          (patient) =>
            patient.status ===
            "Completed"
        ),
      [patients]
    );

  /* =======================================================
     NEXT PATIENT
  ======================================================= */

  const nextPatient =
    waitingPatients.length > 0
      ? waitingPatients[0]
      : null;

  /* =======================================================
     START CONSULTATION
  ======================================================= */

  const startConsultation =
    async (
      patientId: number
    ) => {
      if (actionLoading) {
        return;
      }

      try {
        setActionLoading(true);
        setError("");
        setSuccess("");

        const token =
          await getAccessToken();

        const response =
          await axios.put(
            `${API_URL}/doctor/patients/${patientId}/consulting`,
            {},
            {
              headers: {
                Authorization:
                  `Bearer ${token}`,
              },

              timeout: 10000,
            }
          );

        showSuccess(
          response.data.message ||
          "Consultation started."
        );

        await loadQueue(false);
      } catch (err: any) {
        console.error(
          "START CONSULTATION ERROR:",
          err
        );

        setError(
          err.response?.data?.detail ||
          "Unable to start consultation."
        );
      } finally {
        setActionLoading(false);
      }
    };

  /* =======================================================
     CALL NEXT PATIENT
  ======================================================= */

  const callNextPatient =
    async () => {
      if (
        actionLoading ||
        currentPatient ||
        !nextPatient
      ) {
        return;
      }

      await startConsultation(
        nextPatient.id
      );
    };

  /* =======================================================
     COMPLETE CONSULTATION
  ======================================================= */

  const completeConsultation =
    async (
      patientId: number
    ) => {
      if (actionLoading) {
        return;
      }

      const confirmed =
        window.confirm(
          "Complete this patient's consultation?"
        );

      if (!confirmed) {
        return;
      }

      try {
        setActionLoading(true);
        setError("");
        setSuccess("");

        const token =
          await getAccessToken();

        const response =
          await axios.put(
            `${API_URL}/doctor/patients/${patientId}/completed`,
            {},
            {
              headers: {
                Authorization:
                  `Bearer ${token}`,
              },

              timeout: 10000,
            }
          );

        if (
          response.data.next_token
        ) {
          showSuccess(
            `Consultation completed. Next token ${response.data.next_token} is now consulting.`
          );
        } else {
          showSuccess(
            "Consultation completed. No more waiting patients."
          );
        }

        await loadQueue(false);
      } catch (err: any) {
        console.error(
          "COMPLETE CONSULTATION ERROR:",
          err
        );

        setError(
          err.response?.data?.detail ||
          "Unable to complete consultation."
        );
      } finally {
        setActionLoading(false);
      }
    };

  /* =======================================================
     LOGOUT
  ======================================================= */

  const handleLogout =
    async () => {
      try {
        await supabase.auth.signOut();
      } catch (error) {
        console.error(
          "Logout error:",
          error
        );
      }

      localStorage.removeItem(
        "doctor_hospital_id"
      );

      localStorage.removeItem(
        "doctor_department"
      );

      localStorage.removeItem(
        "doctor_email"
      );

      navigate(
        "/doctor-login",
        {
          replace: true,
        }
      );
    };

  /* =======================================================
     FORMAT TIMER
  ======================================================= */

  const formatDuration =
    (seconds: number) => {
      const minutes =
        Math.floor(
          seconds / 60
        );

      const remainingSeconds =
        seconds % 60;

      return `${String(
        minutes
      ).padStart(
        2,
        "0"
      )}:${String(
        remainingSeconds
      ).padStart(
        2,
        "0"
      )}`;
    };

  /* =======================================================
     LOADING
  ======================================================= */

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f5f7fb",
        }}
      >
        <div
          style={{
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontSize: "42px",
              marginBottom: "15px",
            }}
          >
            🩺
          </div>

          <h2
            style={{
              margin: 0,
              color: "#101828",
            }}
          >
            Loading Doctor Dashboard...
          </h2>

          <p
            style={{
              color: "#667085",
              marginTop: "8px",
            }}
          >
            Connecting to Queue Care Hospital
          </p>
        </div>
      </div>
    );
  }

  /* =======================================================
     DASHBOARD
  ======================================================= */

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f5f7fb",
      }}
    >
      {/* =================================================
          HEADER
      ================================================= */}

      <header
        style={{
          background: "#ffffff",
          borderBottom:
            "1px solid #eaecf0",
          padding:
            "16px 28px",
          display: "flex",
          justifyContent:
            "space-between",
          alignItems: "center",
          gap: "20px",
          flexWrap: "wrap",
        }}
      >
        {/* BRAND */}

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "12px",
              background: "#eaf2ff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "25px",
            }}
          >
            🩺
          </div>

          <div>
            <h1
              style={{
                margin: 0,
                fontSize: "21px",
                color: "#101828",
              }}
            >
              Queue Care Hospital
            </h1>

            <p
              style={{
                margin:
                  "3px 0 0",
                color: "#667085",
                fontSize: "13px",
              }}
            >
              Doctor Dashboard
            </p>
          </div>
        </div>

        {/* DOCTOR INFO */}

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "18px",
          }}
        >
          <div
            style={{
              textAlign: "right",
            }}
          >
            <div
              style={{
                fontWeight: 600,
                color: "#101828",
                fontSize: "14px",
              }}
            >
              {doctorInfo.email ||
                "Doctor"}
            </div>

            <div
              style={{
                color: "#667085",
                fontSize: "13px",
                marginTop: "3px",
              }}
            >
              {doctorInfo.department ||
                "Department"}
            </div>
          </div>

          <button
            onClick={handleLogout}
            style={{
              border:
                "1px solid #d0d5dd",
              background:
                "#ffffff",
              color: "#344054",
              padding:
                "9px 14px",
              borderRadius: "8px",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Logout
          </button>
        </div>
      </header>

      {/* =================================================
          MAIN
      ================================================= */}

      <main
        style={{
          maxWidth: "1400px",
          margin: "0 auto",
          padding: "28px",
        }}
      >
        {/* TITLE */}

        <div
          style={{
            marginBottom: "24px",
          }}
        >
          <h2
            style={{
              margin: 0,
              color: "#101828",
              fontSize: "27px",
            }}
          >
            Good day, Doctor
          </h2>

          <p
            style={{
              color: "#667085",
              marginTop: "7px",
              marginBottom: 0,
            }}
          >
            Manage your consultation queue
            and patient flow.
          </p>
        </div>

        {/* NEW PATIENT ALERT */}

        {newPatientAlert && (
          <div
            style={{
              background: "#eff8ff",
              color: "#175cd3",
              border:
                "1px solid #b2ddff",
              padding:
                "14px 16px",
              borderRadius: "10px",
              marginBottom: "18px",
              fontSize: "14px",
              fontWeight: 600,
              display: "flex",
              justifyContent:
                "space-between",
              alignItems: "center",
              gap: "10px",
            }}
          >
            <span>
              🔔 A new patient has joined
              your department queue.
            </span>

            <button
              onClick={() =>
                setNewPatientAlert(
                  false
                )
              }
              style={{
                border: "none",
                background:
                  "transparent",
                color: "#175cd3",
                cursor: "pointer",
                fontSize: "18px",
              }}
            >
              ×
            </button>
          </div>
        )}

        {/* ERROR */}

        {error && (
          <div
            style={{
              background: "#fff1f1",
              color: "#b42318",
              border:
                "1px solid #fecdca",
              padding:
                "13px 15px",
              borderRadius: "10px",
              marginBottom: "18px",
              fontSize: "14px",
            }}
          >
            {error}

            <button
              onClick={() =>
                setError("")
              }
              style={{
                float: "right",
                border: "none",
                background:
                  "transparent",
                color: "#b42318",
                cursor: "pointer",
                fontWeight: 700,
              }}
            >
              ×
            </button>
          </div>
        )}

        {/* SUCCESS */}

        {success && (
          <div
            style={{
              background: "#ecfdf3",
              color: "#027a48",
              border:
                "1px solid #abefc6",
              padding:
                "13px 15px",
              borderRadius: "10px",
              marginBottom: "18px",
              fontSize: "14px",
              fontWeight: 500,
            }}
          >
            ✓ {success}
          </div>
        )}

        {/* =================================================
            DEPARTMENT CARD
        ================================================= */}

        <div
          style={{
            background: "#ffffff",
            border:
              "1px solid #eaecf0",
            borderRadius: "14px",
            padding:
              "18px 20px",
            marginBottom: "20px",
            display: "flex",
            justifyContent:
              "space-between",
            alignItems: "center",
            gap: "15px",
            flexWrap: "wrap",
          }}
        >
          <div>
            <div
              style={{
                color: "#667085",
                fontSize: "13px",
                marginBottom: "5px",
              }}
            >
              Assigned Department
            </div>

            <div
              style={{
                fontSize: "20px",
                fontWeight: 700,
                color: "#101828",
              }}
            >
              {doctorInfo.department ||
                "Not assigned"}
            </div>
          </div>

          <button
            onClick={() =>
              loadQueue(true)
            }
            disabled={
              actionLoading
            }
            style={{
              border:
                "1px solid #d0d5dd",
              background:
                "#ffffff",
              padding:
                "10px 16px",
              borderRadius: "8px",
              cursor:
                actionLoading
                  ? "not-allowed"
                  : "pointer",
              fontWeight: 600,
              color: "#344054",
            }}
          >
            ↻ Refresh Queue
          </button>
        </div>

        {/* =================================================
            STAT CARDS
        ================================================= */}

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(210px, 1fr))",
            gap: "16px",
            marginBottom: "22px",
          }}
        >
          {/* WAITING */}

          <div
            style={statCardStyle}
          >
            <div
              style={statLabelStyle}
            >
              Waiting Patients
            </div>

            <div
              style={{
                ...statNumberStyle,
                color: "#1769e0",
              }}
            >
              {waitingCount}
            </div>
          </div>

          {/* CURRENT */}

          <div
            style={statCardStyle}
          >
            <div
              style={statLabelStyle}
            >
              Currently Consulting
            </div>

            <div
              style={{
                ...statNumberStyle,
                color: "#027a48",
              }}
            >
              {currentPatient
                ? currentPatient.token_number
                : "None"}
            </div>
          </div>

          {/* COMPLETED */}

          <div
            style={statCardStyle}
          >
            <div
              style={statLabelStyle}
            >
              Completed Today
            </div>

            <div
              style={{
                ...statNumberStyle,
                color: "#344054",
              }}
            >
              {completedCount}
            </div>
          </div>

          {/* NEXT */}

          <div
            style={statCardStyle}
          >
            <div
              style={statLabelStyle}
            >
              Next Patient
            </div>

            <div
              style={{
                fontSize: "25px",
                fontWeight: 700,
                color:
                  nextPatient?.emergency
                    ? "#b42318"
                    : "#1769e0",
                marginTop: "7px",
              }}
            >
              {nextPatient
                ? nextPatient.token_number
                : "None"}
            </div>
          </div>
        </div>

        {/* =================================================
            QUICK ACTION / NEXT PATIENT
        ================================================= */}

        <section
          style={{
            background:
              nextPatient?.emergency
                ? "#fff8f7"
                : "#ffffff",
            border:
              nextPatient?.emergency
                ? "1px solid #fecdca"
                : "1px solid #eaecf0",
            borderRadius: "14px",
            padding: "22px",
            marginBottom: "22px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent:
                "space-between",
              alignItems: "center",
              gap: "15px",
              flexWrap: "wrap",
            }}
          >
            <div>
              <div
                style={{
                  color: "#667085",
                  fontSize: "13px",
                  marginBottom: "6px",
                }}
              >
                NEXT PATIENT TO CALL
              </div>

              {nextPatient ? (
                <div>
                  <div
                    style={{
                      display: "flex",
                      alignItems:
                        "center",
                      gap: "10px",
                      flexWrap: "wrap",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "29px",
                        fontWeight: 800,
                        color:
                          nextPatient.emergency
                            ? "#b42318"
                            : "#1769e0",
                      }}
                    >
                      {nextPatient.token_number}
                    </span>

                    {nextPatient.emergency && (
                      <span
                        style={{
                          background:
                            "#fef3f2",
                          color:
                            "#b42318",
                          padding:
                            "5px 9px",
                          borderRadius:
                            "15px",
                          fontSize:
                            "11px",
                          fontWeight:
                            700,
                        }}
                      >
                        🚨 EMERGENCY
                      </span>
                    )}
                  </div>

                  <div
                    style={{
                      marginTop: "5px",
                      color: "#344054",
                      fontWeight: 600,
                    }}
                  >
                    {nextPatient.name}
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    color: "#667085",
                    fontSize: "15px",
                  }}
                >
                  No waiting patients
                </div>
              )}
            </div>

            <button
              onClick={
                callNextPatient
              }
              disabled={
                !!currentPatient ||
                !nextPatient ||
                actionLoading
              }
              style={{
                minWidth: "190px",
                padding:
                  "14px 20px",
                border: "none",
                borderRadius: "9px",
                background:
                  currentPatient ||
                  !nextPatient ||
                  actionLoading
                    ? "#d0d5dd"
                    : nextPatient.emergency
                    ? "#b42318"
                    : "#1769e0",
                color: "#ffffff",
                fontWeight: 700,
                cursor:
                  currentPatient ||
                  !nextPatient ||
                  actionLoading
                    ? "not-allowed"
                    : "pointer",
              }}
            >
              {actionLoading
                ? "Processing..."
                : currentPatient
                ? "Consultation Active"
                : nextPatient
                ? "📢 Call Next Patient"
                : "Queue Empty"}
            </button>
          </div>
        </section>

        {/* =================================================
            CURRENT CONSULTATION
        ================================================= */}

        <section
          style={{
            background: "#ffffff",
            border:
              "1px solid #eaecf0",
            borderRadius: "14px",
            padding: "22px",
            marginBottom: "22px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent:
                "space-between",
              alignItems: "center",
              marginBottom: "18px",
              gap: "10px",
            }}
          >
            <h3
              style={{
                margin: 0,
                color: "#101828",
                fontSize: "19px",
              }}
            >
              Current Consultation
            </h3>

            {currentPatient && (
              <span
                style={{
                  background:
                    "#ecfdf3",
                  color: "#027a48",
                  padding:
                    "6px 10px",
                  borderRadius:
                    "20px",
                  fontSize: "12px",
                  fontWeight: 700,
                }}
              >
                CONSULTING
              </span>
            )}
          </div>

          {currentPatient ? (
            <div
              style={{
                background:
                  "#f8fbff",
                border:
                  "1px solid #dbeafe",
                borderRadius:
                  "12px",
                padding: "20px",
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(auto-fit, minmax(180px, 1fr))",
                  gap: "20px",
                  alignItems: "center",
                }}
              >
                {/* TOKEN */}

                <div>
                  <div
                    style={
                      smallLabelStyle
                    }
                  >
                    Token
                  </div>

                  <div
                    style={{
                      fontSize:
                        "28px",
                      fontWeight:
                        800,
                      color:
                        "#1769e0",
                    }}
                  >
                    {
                      currentPatient.token_number
                    }
                  </div>
                </div>

                {/* PATIENT */}

                <div>
                  <div
                    style={
                      smallLabelStyle
                    }
                  >
                    Patient
                  </div>

                  <div
                    style={{
                      fontSize:
                        "18px",
                      fontWeight:
                        700,
                      color:
                        "#101828",
                    }}
                  >
                    {
                      currentPatient.name
                    }
                  </div>
                </div>

                {/* DEPARTMENT */}

                <div>
                  <div
                    style={
                      smallLabelStyle
                    }
                  >
                    Department
                  </div>

                  <div
                    style={{
                      fontWeight:
                        600,
                      color:
                        "#344054",
                    }}
                  >
                    {
                      currentPatient.department
                    }
                  </div>
                </div>

                {/* TIMER */}

                <div>
                  <div
                    style={
                      smallLabelStyle
                    }
                  >
                    Consultation Time
                  </div>

                  <div
                    style={{
                      fontSize:
                        "25px",
                      fontWeight:
                        800,
                      color:
                        consultationSeconds >
                        15 * 60
                          ? "#b42318"
                          : "#027a48",
                      fontVariantNumeric:
                        "tabular-nums",
                    }}
                  >
                    ⏱{" "}
                    {formatDuration(
                      consultationSeconds
                    )}
                  </div>
                </div>

                {/* COMPLETE */}

                <div>
                  <button
                    onClick={() =>
                      completeConsultation(
                        currentPatient.id
                      )
                    }
                    disabled={
                      actionLoading
                    }
                    style={{
                      width:
                        "100%",
                      padding:
                        "13px 18px",
                      border: "none",
                      borderRadius:
                        "9px",
                      background:
                        actionLoading
                          ? "#98b9ee"
                          : "#027a48",
                      color:
                        "#ffffff",
                      fontWeight:
                        700,
                      cursor:
                        actionLoading
                          ? "not-allowed"
                          : "pointer",
                    }}
                  >
                    {actionLoading
                      ? "Processing..."
                      : "✓ Complete Consultation"}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div
              style={{
                background:
                  "#f9fafb",
                border:
                  "1px dashed #d0d5dd",
                borderRadius:
                  "12px",
                padding:
                  "30px",
                textAlign:
                  "center",
              }}
            >
              <div
                style={{
                  fontSize:
                    "35px",
                  marginBottom:
                    "10px",
                }}
              >
                👨‍⚕️
              </div>

              <h4
                style={{
                  margin: 0,
                  color:
                    "#344054",
                  fontSize:
                    "17px",
                }}
              >
                No active consultation
              </h4>

              <p
                style={{
                  color:
                    "#667085",
                  fontSize:
                    "14px",
                  marginBottom:
                    0,
                }}
              >
                Use the
                "Call Next Patient"
                button to begin.
              </p>
            </div>
          )}
        </section>

        {/* =================================================
            WAITING QUEUE
        ================================================= */}

        <section
          style={{
            background:
              "#ffffff",
            border:
              "1px solid #eaecf0",
            borderRadius:
              "14px",
            padding: "22px",
            marginBottom:
              "22px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent:
                "space-between",
              alignItems:
                "center",
              marginBottom:
                "18px",
              gap: "10px",
              flexWrap:
                "wrap",
            }}
          >
            <div>
              <h3
                style={{
                  margin: 0,
                  color:
                    "#101828",
                  fontSize:
                    "19px",
                }}
              >
                Smart Waiting Queue
              </h3>

              <p
                style={{
                  margin:
                    "5px 0 0",
                  color:
                    "#667085",
                  fontSize:
                    "13px",
                }}
              >
                Emergency patients are
                automatically prioritized.
              </p>
            </div>

            <span
              style={{
                background:
                  "#eef4ff",
                color:
                  "#175cd3",
                padding:
                  "7px 11px",
                borderRadius:
                  "20px",
                fontSize:
                  "12px",
                fontWeight:
                  700,
              }}
            >
              {waitingPatients.length}{" "}
              Waiting
            </span>
          </div>

          {waitingPatients.length ===
          0 ? (
            <div
              style={{
                textAlign:
                  "center",
                padding:
                  "35px 20px",
                color:
                  "#667085",
              }}
            >
              <div
                style={{
                  fontSize:
                    "36px",
                  marginBottom:
                    "10px",
                }}
              >
                ✓
              </div>

              <div
                style={{
                  fontWeight:
                    600,
                  color:
                    "#344054",
                }}
              >
                Queue is clear
              </div>

              <div
                style={{
                  fontSize:
                    "13px",
                  marginTop:
                    "5px",
                }}
              >
                There are no waiting
                patients.
              </div>
            </div>
          ) : (
            <div
              style={{
                overflowX:
                  "auto",
              }}
            >
              <table
                style={{
                  width:
                    "100%",
                  borderCollapse:
                    "collapse",
                  minWidth:
                    "760px",
                }}
              >
                <thead>
                  <tr
                    style={{
                      background:
                        "#f9fafb",
                    }}
                  >
                    <th
                      style={
                        tableHeaderStyle
                      }
                    >
                      Priority
                    </th>

                    <th
                      style={
                        tableHeaderStyle
                      }
                    >
                      Token
                    </th>

                    <th
                      style={
                        tableHeaderStyle
                      }
                    >
                      Patient
                    </th>

                    <th
                      style={
                        tableHeaderStyle
                      }
                    >
                      Department
                    </th>

                    <th
                      style={
                        tableHeaderStyle
                      }
                    >
                      Status
                    </th>

                    <th
                      style={{
                        ...tableHeaderStyle,
                        textAlign:
                          "right",
                      }}
                    >
                      Action
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {waitingPatients.map(
                    (
                      patient,
                      index
                    ) => (
                      <tr
                        key={
                          patient.id
                        }
                        style={{
                          borderTop:
                            "1px solid #eaecf0",
                          background:
                            index ===
                              0 &&
                            patient.emergency
                              ? "#fff8f7"
                              : "#ffffff",
                        }}
                      >
                        {/* PRIORITY */}

                        <td
                          style={
                            tableCellStyle
                          }
                        >
                          {patient.emergency ? (
                            <span
                              style={{
                                background:
                                  "#fef3f2",
                                color:
                                  "#b42318",
                                padding:
                                  "5px 9px",
                                borderRadius:
                                  "15px",
                                fontSize:
                                  "11px",
                                fontWeight:
                                  700,
                              }}
                            >
                              🚨 Emergency
                            </span>
                          ) : (
                            <span
                              style={{
                                color:
                                  "#667085",
                                fontSize:
                                  "13px",
                              }}
                            >
                              Normal
                            </span>
                          )}
                        </td>

                        {/* TOKEN */}

                        <td
                          style={
                            tableCellStyle
                          }
                        >
                          <span
                            style={{
                              fontWeight:
                                800,
                              color:
                                "#1769e0",
                            }}
                          >
                            {
                              patient.token_number
                            }
                          </span>

                          {index ===
                            0 && (
                            <div
                              style={{
                                marginTop:
                                  "4px",
                                color:
                                  "#027a48",
                                fontSize:
                                  "10px",
                                fontWeight:
                                  700,
                              }}
                            >
                              NEXT
                            </div>
                          )}
                        </td>

                        {/* PATIENT */}

                        <td
                          style={
                            tableCellStyle
                          }
                        >
                          <div
                            style={{
                              fontWeight:
                                600,
                              color:
                                "#101828",
                            }}
                          >
                            {
                              patient.name
                            }
                          </div>

                          {patient.phone && (
                            <div
                              style={{
                                color:
                                  "#667085",
                                fontSize:
                                  "12px",
                                marginTop:
                                  "3px",
                              }}
                            >
                              {
                                patient.phone
                              }
                            </div>
                          )}
                        </td>

                        {/* DEPARTMENT */}

                        <td
                          style={
                            tableCellStyle
                          }
                        >
                          {
                            patient.department
                          }
                        </td>

                        {/* STATUS */}

                        <td
                          style={
                            tableCellStyle
                          }
                        >
                          <span
                            style={{
                              background:
                                "#fff7ed",
                              color:
                                "#c2410c",
                              padding:
                                "5px 9px",
                              borderRadius:
                                "15px",
                              fontSize:
                                "11px",
                              fontWeight:
                                700,
                            }}
                          >
                            WAITING
                          </span>
                        </td>

                        {/* ACTION */}

                        <td
                          style={{
                            ...tableCellStyle,
                            textAlign:
                              "right",
                          }}
                        >
                          <button
                            onClick={() =>
                              startConsultation(
                                patient.id
                              )
                            }
                            disabled={
                              !!currentPatient ||
                              actionLoading
                            }
                            style={{
                              border:
                                "none",
                              borderRadius:
                                "8px",
                              padding:
                                "9px 13px",
                              background:
                                currentPatient ||
                                actionLoading
                                  ? "#d0d5dd"
                                  : patient.emergency
                                  ? "#b42318"
                                  : "#1769e0",
                              color:
                                "#ffffff",
                              fontWeight:
                                600,
                              cursor:
                                currentPatient ||
                                actionLoading
                                  ? "not-allowed"
                                  : "pointer",
                            }}
                          >
                            {patient.emergency
                              ? "Call Emergency"
                              : "Start"}
                          </button>
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* =================================================
            COMPLETED PATIENTS
        ================================================= */}

        <section
          style={{
            background:
              "#ffffff",
            border:
              "1px solid #eaecf0",
            borderRadius:
              "14px",
            padding: "22px",
            marginBottom:
              "22px",
          }}
        >
          <h3
            style={{
              margin:
                "0 0 18px",
              color:
                "#101828",
              fontSize:
                "19px",
            }}
          >
            Completed Patients
          </h3>

          {completedPatients.length ===
          0 ? (
            <p
              style={{
                color:
                  "#667085",
                margin: 0,
                fontSize:
                  "14px",
              }}
            >
              No completed
              consultations yet.
            </p>
          ) : (
            <div
              style={{
                overflowX:
                  "auto",
              }}
            >
              <table
                style={{
                  width:
                    "100%",
                  borderCollapse:
                    "collapse",
                  minWidth:
                    "650px",
                }}
              >
                <thead>
                  <tr
                    style={{
                      background:
                        "#f9fafb",
                    }}
                  >
                    <th
                      style={
                        tableHeaderStyle
                      }
                    >
                      Token
                    </th>

                    <th
                      style={
                        tableHeaderStyle
                      }
                    >
                      Patient
                    </th>

                    <th
                      style={
                        tableHeaderStyle
                      }
                    >
                      Department
                    </th>

                    <th
                      style={
                        tableHeaderStyle
                      }
                    >
                      Status
                    </th>

                    <th
                      style={{
                        ...tableHeaderStyle,
                        textAlign:
                          "right",
                      }}
                    >
                      Completed
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {completedPatients
                    .slice()
                    .reverse()
                    .slice(
                      0,
                      10
                    )
                    .map(
                      (
                        patient
                      ) => (
                        <tr
                          key={
                            patient.id
                          }
                          style={{
                            borderTop:
                              "1px solid #eaecf0",
                          }}
                        >
                          <td
                            style={
                              tableCellStyle
                            }
                          >
                            <strong>
                              {
                                patient.token_number
                              }
                            </strong>
                          </td>

                          <td
                            style={
                              tableCellStyle
                            }
                          >
                            {
                              patient.name
                            }
                          </td>

                          <td
                            style={
                              tableCellStyle
                            }
                          >
                            {
                              patient.department
                            }
                          </td>

                          <td
                            style={
                              tableCellStyle
                            }
                          >
                            <span
                              style={{
                                background:
                                  "#ecfdf3",
                                color:
                                  "#027a48",
                                padding:
                                  "5px 9px",
                                borderRadius:
                                  "15px",
                                fontSize:
                                  "11px",
                                fontWeight:
                                  700,
                              }}
                            >
                              COMPLETED
                            </span>
                          </td>

                          <td
                            style={{
                              ...tableCellStyle,
                              textAlign:
                                "right",
                            }}
                          >
                            {formatDateTime(
                              patient.consultation_completed_at
                            )}
                          </td>
                        </tr>
                      )
                    )}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* =================================================
            FOOTER
        ================================================= */}

        <div
          style={{
            display: "flex",
            justifyContent:
              "space-between",
            alignItems:
              "center",
            gap: "10px",
            flexWrap:
              "wrap",
            color:
              "#667085",
            fontSize:
              "12px",
            padding:
              "5px 2px 20px",
          }}
        >
          <div>
            Queue automatically
            refreshes every 10 seconds.
          </div>

          <div>
            {lastUpdated
              ? `Last updated: ${formatDateTime(
                  lastUpdated.toISOString()
                )}`
              : "Not updated yet"}
          </div>
        </div>
      </main>
    </div>
  );
}

/* =========================================================
   STYLES
========================================================= */

const statCardStyle: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #eaecf0",
  borderRadius: "14px",
  padding: "20px",
};

const statLabelStyle: React.CSSProperties = {
  color: "#667085",
  fontSize: "13px",
};

const statNumberStyle: React.CSSProperties = {
  fontSize: "30px",
  fontWeight: 700,
  marginTop: "7px",
};

const smallLabelStyle: React.CSSProperties = {
  color: "#667085",
  fontSize: "12px",
  marginBottom: "5px",
};

const tableHeaderStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "12px 14px",
  fontSize: "12px",
  color: "#667085",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.03em",
};

const tableCellStyle: React.CSSProperties = {
  padding: "14px",
  fontSize: "14px",
  color: "#344054",
  verticalAlign: "middle",
};

/* =========================================================
   DATE FORMAT
========================================================= */

function formatDateTime(
  value?: string | Date | null
) {
  if (!value) {
    return "-";
  }

  try {
    const date =
      value instanceof Date
        ? value
        : new Date(value);

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return "-";
    }

    return date.toLocaleString(
      "en-IN",
      {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }
    );
  } catch {
    return "-";
  }
}

export default DoctorDashboard;