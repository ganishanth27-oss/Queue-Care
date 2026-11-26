import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

import { supabase } from "../supabaseClient";
import api from "../api";

import "./PatientDashboard.css";

interface Department {
  id: number;
  name: string;
  code: string;
}

function PatientDashboard() {
  const navigate = useNavigate();

  const [user, setUser] = useState<any>(null);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [department, setDepartment] = useState("");

  const [departments, setDepartments] = useState<Department[]>([]);

  const [hospitalId, setHospitalId] = useState<number | null>(null);
  const [hospitalName, setHospitalName] = useState("");

  const [token, setToken] = useState<string | null>(null);
  const [status, setStatus] = useState("");

  const [currentToken, setCurrentToken] =
    useState<string | null>(null);

  const [patientsBefore, setPatientsBefore] =
    useState<number | null>(null);

  const [estimatedWaitMinutes, setEstimatedWaitMinutes] =
    useState<number | null>(null);

  const [averageConsultationMinutes, setAverageConsultationMinutes] =
    useState<number | null>(null);

  const [emergencyAhead, setEmergencyAhead] =
    useState<number | null>(null);

  const [historyCount, setHistoryCount] =
    useState<number>(0);

  const [currentRemainingMinutes, setCurrentRemainingMinutes] =
    useState<number | null>(null);

  const [loadingWaitTime, setLoadingWaitTime] =
    useState(false);

  const [lastUpdated, setLastUpdated] =
    useState<Date | null>(null);

  const [queueError, setQueueError] =
    useState("");

  const [message, setMessage] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [loadingDepartments, setLoadingDepartments] =
    useState(false);

  const [checkingPatient, setCheckingPatient] =
    useState(true);

  const [notificationsSent, setNotificationsSent] =
    useState<number[]>([]);

  /* =====================================================
     CHECK LOGIN
  ===================================================== */

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        navigate("/patient-login");
        return;
      }

      const selectedHospitalId = Number(
        localStorage.getItem("selectedHospitalId")
      );

      const selectedHospitalName =
        localStorage.getItem("selectedHospitalName") || "";

      if (!selectedHospitalId) {
        navigate("/hospital-selection");
        return;
      }

      setUser(user);
      setHospitalId(selectedHospitalId);
      setHospitalName(selectedHospitalName);

      await loadDepartments(selectedHospitalId);
      await loadExistingPatient(selectedHospitalId);
    } catch (error) {
      console.error("Login check error:", error);
      navigate("/patient-login");
    } finally {
      setCheckingPatient(false);
    }
  };

  /* =====================================================
     LOAD DEPARTMENTS
  ===================================================== */

  const loadDepartments = async (
    selectedHospitalId: number
  ) => {
    setLoadingDepartments(true);
    setDepartments([]);
    setDepartment("");
    setMessage("");

    try {
      const response = await api.get(
        "/departments",
        {
          params: {
            hospital_id: selectedHospitalId,
          },
        }
      );

      const data = Array.isArray(response.data)
        ? response.data
        : [];

      setDepartments(data);

      if (data.length === 0) {
        setMessage(
          "No departments are available for this hospital."
        );
      }
    } catch (error) {
      console.error(
        "Department load failed:",
        error
      );

      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401) {
          setMessage(
            "Your login session expired. Please login again."
          );

          await supabase.auth.signOut();
          navigate("/patient-login");
          return;
        }

        if (error.response?.status === 404) {
          setMessage(
            "Department service is not available."
          );
          return;
        }
      }

      setMessage(
        "Unable to load departments. Please try again."
      );
    } finally {
      setLoadingDepartments(false);
    }
  };

  /* =====================================================
     LOAD EXISTING TOKEN
  ===================================================== */

  const loadExistingPatient = async (
    selectedHospitalId: number
  ) => {
    try {
      const response = await api.get(
        "/patients/me",
        {
          params: {
            hospital_id: selectedHospitalId,
          },
        }
      );

      const patient = response.data;

      setToken(patient.token_number);
      setStatus(patient.status);
      setQueueError("");

      await getQueueStatus(
        patient.token_number,
        selectedHospitalId
      );
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 404) {
          setToken(null);
          setStatus("");
          setCurrentToken(null);
          setPatientsBefore(null);
          setEstimatedWaitMinutes(null);
          setAverageConsultationMinutes(null);
          setEmergencyAhead(null);
          setHistoryCount(0);
          setCurrentRemainingMinutes(null);
          setLastUpdated(null);
          setQueueError("");
          return;
        }

        if (error.response?.status === 401) {
          await supabase.auth.signOut();
          navigate("/patient-login");
          return;
        }
      }

      console.error(
        "Load patient error:",
        error
      );
    }
  };

  /* =====================================================
     REGISTER PATIENT
  ===================================================== */

  const registerPatient = async () => {
    if (
      !name.trim() ||
      !phone.trim() ||
      !department.trim()
    ) {
      setMessage(
        "Please fill all fields."
      );
      return;
    }

    if (!user) {
      setMessage(
        "Please login again."
      );
      return;
    }

    if (!hospitalId) {
      setMessage(
        "Please select a hospital before generating a token."
      );

      navigate("/hospital-selection");
      return;
    }

    setLoading(true);
    setMessage("");
    setQueueError("");

    try {
      const response = await api.post(
        "/patients",
        {
          name: name.trim(),
          phone: phone.trim(),
          department: department.trim(),
          emergency: false,
          user_id: user.id,
          hospital_id: hospitalId,
        }
      );

      const newToken =
        response.data.token_number;

      setToken(newToken);
      setStatus("Waiting");
      setCurrentToken(null);
      setPatientsBefore(null);

      setEstimatedWaitMinutes(null);
      setAverageConsultationMinutes(null);
      setEmergencyAhead(null);
      setHistoryCount(0);
      setCurrentRemainingMinutes(null);
      setLastUpdated(null);

      setNotificationsSent([]);

      setMessage(
        `Registration successful! Your token number is ${newToken}.`
      );

      setName("");
      setPhone("");
      setDepartment("");

      await getQueueStatus(
        newToken,
        hospitalId
      );
    } catch (error) {
      console.error(
        "Registration error:",
        error
      );

      if (axios.isAxiosError(error)) {
        const detail =
          error.response?.data?.detail;

        setMessage(
          typeof detail === "string"
            ? detail
            : "Unable to register patient."
        );
      } else {
        setMessage(
          "Unable to register patient."
        );
      }
    } finally {
      setLoading(false);
    }
  };

  /* =====================================================
     QUEUE STATUS
  ===================================================== */

  const getQueueStatus = async (
    tokenNumber: string,
    selectedHospitalId = hospitalId
  ) => {
    if (!selectedHospitalId) {
      return;
    }

    try {
      const response = await api.get(
        `/queue/${tokenNumber}`,
        {
          params: {
            hospital_id:
              selectedHospitalId,
          },
        }
      );

      const queueData =
        response.data;

      setToken(
        queueData.token_number
      );

      setStatus(
        queueData.status
      );

      setCurrentToken(
        queueData.current_token
      );

      setPatientsBefore(
        queueData.patients_before
      );

      setLastUpdated(
        new Date()
      );

      setQueueError("");

      await getWaitTime(
        queueData.token_number,
        selectedHospitalId
      );
    } catch (error) {
      console.error(
        "Queue status error:",
        error
      );

      if (
        axios.isAxiosError(error)
      ) {
        if (
          error.response?.status === 401
        ) {
          setQueueError(
            "Your login session expired. Please login again."
          );
          return;
        }

        if (
          error.response?.status === 403
        ) {
          setQueueError(
            "This token does not belong to your account."
          );
          return;
        }

        if (
          error.response?.status === 404
        ) {
          setQueueError(
            "Token not found in the hospital queue."
          );
          return;
        }

        if (
          error.response?.status === 500
        ) {
          setQueueError(
            "Hospital queue server error. Please try again."
          );
          return;
        }
      }

      setQueueError(
        "Unable to load queue information."
      );
    }
  };

  /* =====================================================
     SMART ETA
  ===================================================== */

  const getWaitTime = async (
    tokenNumber: string,
    selectedHospitalId: number
  ) => {
    setLoadingWaitTime(true);

    try {
      const response =
        await api.get(
          `/queue/${tokenNumber}/wait-time`,
          {
            params: {
              hospital_id:
                selectedHospitalId,
            },
          }
        );

      const data =
        response.data;

      setEstimatedWaitMinutes(
        data.estimated_wait_minutes
      );

      setAverageConsultationMinutes(
        data.average_consultation_minutes
      );

      setEmergencyAhead(
        data.emergency_ahead
      );

      setHistoryCount(
        data.history_count ?? 0
      );

      setCurrentRemainingMinutes(
        data.current_remaining_minutes ?? null
      );
    } catch (error) {
      console.error(
        "Waiting time calculation failed:",
        error
      );

      setEstimatedWaitMinutes(null);
      setAverageConsultationMinutes(null);
      setEmergencyAhead(null);
      setHistoryCount(0);
      setCurrentRemainingMinutes(null);
    } finally {
      setLoadingWaitTime(false);
    }
  };

  /* =====================================================
     TOKEN NUMBER
  ===================================================== */

  const extractTokenNumber = (
    tokenValue: string | null
  ) => {
    if (!tokenValue) {
      return null;
    }

    const match =
      tokenValue.match(/(\d+)$/);

    if (!match) {
      return null;
    }

    return Number(match[1]);
  };

  /* =====================================================
     QUEUE PROGRESS
  ===================================================== */

  const calculateQueueProgress = () => {
    if (
      token === null ||
      currentToken === null
    ) {
      return 0;
    }

    const yourToken =
      extractTokenNumber(token);

    const nowToken =
      extractTokenNumber(currentToken);

    if (
      yourToken === null ||
      nowToken === null
    ) {
      return 0;
    }

    if (
      yourToken <= nowToken
    ) {
      return 100;
    }

    const totalDistance =
      Math.max(
        yourToken,
        1
      );

    const remainingDistance =
      Math.max(
        yourToken - nowToken,
        0
      );

    const progress =
      (
        (totalDistance -
          remainingDistance) /
        totalDistance
      ) * 100;

    return Math.min(
      Math.max(progress, 0),
      100
    );
  };

  const queueProgress =
    calculateQueueProgress();

  /* =====================================================
     LAST UPDATED
  ===================================================== */

  const getLastUpdatedText = () => {
    if (!lastUpdated) {
      return "Updating...";
    }

    return lastUpdated.toLocaleTimeString(
      [],
      {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }
    );
  };

  /* =====================================================
     AUTO REFRESH
  ===================================================== */

  useEffect(() => {
    if (token === null) {
      return;
    }

    getQueueStatus(token);

    const interval =
      setInterval(() => {
        getQueueStatus(token);
      }, 5000);

    return () => {
      clearInterval(interval);
    };
  }, [token]);

  /* =====================================================
     BROWSER NOTIFICATIONS
  ===================================================== */

  useEffect(() => {
    if (patientsBefore === null) {
      return;
    }

    const sendBrowserNotification = (
      title: string,
      body: string,
      level: number
    ) => {
      if (
        notificationsSent.includes(level)
      ) {
        return;
      }

      if (
        !("Notification" in window)
      ) {
        return;
      }

      const showNotification = () => {
        new Notification(
          title,
          {
            body,
            icon: "/favicon.ico",
          }
        );

        setNotificationsSent(
          (previous) => [
            ...previous,
            level,
          ]
        );
      };

      if (
        Notification.permission ===
        "default"
      ) {
        Notification.requestPermission()
          .then((permission) => {
            if (
              permission === "granted"
            ) {
              showNotification();
            }
          });

        return;
      }

      if (
        Notification.permission ===
        "granted"
      ) {
        showNotification();
      }
    };

    if (
      patientsBefore <= 10 &&
      patientsBefore > 5
    ) {
      sendBrowserNotification(
        "Queue Care Hospital",
        "Your turn is getting closer. Please stay ready.",
        10
      );
    }

    if (
      patientsBefore <= 5 &&
      patientsBefore > 2
    ) {
      sendBrowserNotification(
        "Queue Care Hospital",
        "Only 5 or fewer patients are ahead of you. Please be ready.",
        5
      );
    }

    if (
      patientsBefore <= 2 &&
      patientsBefore > 0
    ) {
      sendBrowserNotification(
        "Queue Care Hospital",
        "Your turn is very close. Please proceed soon.",
        2
      );
    }
  }, [
    patientsBefore,
    notificationsSent,
  ]);

  /* =====================================================
     YOUR TURN NOTIFICATION
  ===================================================== */

  useEffect(() => {
    if (
      status !== "Consulting"
    ) {
      return;
    }

    if (
      notificationsSent.includes(0)
    ) {
      return;
    }

    if (
      !("Notification" in window)
    ) {
      return;
    }

    const showTurnNotification = () => {
      new Notification(
        "Queue Care Hospital",
        {
          body:
            "Your turn has arrived! Please proceed to the consultation area.",
          icon: "/favicon.ico",
        }
      );

      setNotificationsSent(
        (previous) => [
          ...previous,
          0,
        ]
      );
    };

    if (
      Notification.permission ===
      "granted"
    ) {
      showTurnNotification();
    } else if (
      Notification.permission ===
      "default"
    ) {
      Notification.requestPermission()
        .then((permission) => {
          if (
            permission === "granted"
          ) {
            showTurnNotification();
          }
        });
    }
  }, [
    status,
    notificationsSent,
  ]);

  /* =====================================================
     LOGOUT
  ===================================================== */

  const logout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  /* =====================================================
     STATUS CLASS
  ===================================================== */

  const getStatusClass = () => {
    if (status === "Consulting") {
      return "status-consulting";
    }

    if (status === "Completed") {
      return "status-completed";
    }

    return "status-waiting";
  };

  /* =====================================================
     LOADING
  ===================================================== */

  if (checkingPatient) {
    return (
      <div className="dashboard-loading">

        <div className="loading-card">

          <div className="loading-spinner" />

          <h2>
            Loading your queue...
          </h2>

          <p>
            Please wait while we check
            your hospital status.
          </p>

        </div>

      </div>
    );
  }

  /* =====================================================
     MAIN PAGE
  ===================================================== */

  return (
    <div className="dashboard-page">

      <div className="dashboard-card">

        {/* ================= HEADER ================= */}

        <header className="dashboard-header">

          <div className="brand-area">

            <div className="hospital-logo">
              +
            </div>

            <div>

              <h1>
                Queue Care Hospital
              </h1>

              <p>
                Patient Portal
              </p>

              {hospitalName && (
                <span className="dashboard-hospital">
                  {hospitalName}
                </span>
              )}

            </div>

          </div>

          <button
            className="logout-button"
            onClick={logout}
          >
            Logout
          </button>

        </header>

        <div className="dashboard-divider" />

        {/* ================= WELCOME ================= */}

        {token !== null && (

          <div className="welcome-section">

            <div>

              <span className="welcome-label">
                PATIENT DASHBOARD
              </span>

              <h2>
                Your queue is being monitored
              </h2>

              <p>
                Your position updates automatically
                every 5 seconds.
              </p>

            </div>

            <div className="live-indicator">
              <span className="live-dot" />
              LIVE
            </div>

          </div>

        )}

        {/* ================= ACTIVE TOKEN ================= */}

        {token !== null ? (

          <div className="queue-section">

            <div className="section-heading">

              <div>

                <span>
                  QUEUE OVERVIEW
                </span>

                <h2>
                  Your Queue Status
                </h2>

              </div>

              <div
                className={`status-pill ${getStatusClass()}`}
              >
                <span className="status-dot" />
                {status || "Waiting"}
              </div>

            </div>

            {/* ================= TOKEN HERO ================= */}

            <div className="token-hero">

              <div className="token-hero-left">

                <span>
                  YOUR TOKEN
                </span>

                <strong>
                  #{token}
                </strong>

                <p>
                  {hospitalName || "Queue Care Hospital"}
                </p>

              </div>

              <div className="token-hero-right">

                <div className="department-icon">
                  🏥
                </div>

                <div>

                  <span>
                    Hospital Queue
                  </span>

                  <strong>
                    Active
                  </strong>

                </div>

              </div>

            </div>

            {/* ================= SUMMARY CARDS ================= */}

            <div className="queue-cards">

              <div className="queue-box">

                <div className="queue-box-icon">
                  🎫
                </div>

                <span>
                  Your Token
                </span>

                <strong>
                  #{token}
                </strong>

              </div>

              <div className="queue-box">

                <div className="queue-box-icon">
                  🩺
                </div>

                <span>
                  Now Consulting
                </span>

                <strong>
                  {currentToken
                    ? `#${currentToken}`
                    : "--"}
                </strong>

              </div>

              <div className="queue-box">

                <div className="queue-box-icon">
                  👥
                </div>

                <span>
                  Patients Ahead
                </span>

                <strong>
                  {patientsBefore ?? 0}
                </strong>

              </div>

              <div className="queue-box">

                <div className="queue-box-icon">
                  ⏱
                </div>

                <span>
                  Estimated Wait
                </span>

                <strong>
                  {loadingWaitTime
                    ? "..."
                    : estimatedWaitMinutes !== null
                    ? `~${estimatedWaitMinutes}m`
                    : "--"}
                </strong>

              </div>

            </div>

            {/* ================= LIVE QUEUE ================= */}

            <div className="live-queue-card">

              <div className="live-queue-header">

                <div>

                  <span className="live-queue-label">
                    LIVE QUEUE
                  </span>

                  <h3>
                    Track your position
                  </h3>

                </div>

                <div className="live-status">
                  <span className="live-dot" />
                  LIVE
                </div>

              </div>

              <div className="queue-progress-container">

                <div className="queue-progress-info">

                  <span>
                    Now Serving
                  </span>

                  <strong>
                    #{currentToken ?? "--"}
                  </strong>

                </div>

                <div className="queue-progress-wrapper">

                  <div className="queue-progress-bar">

                    <div
                      className="queue-progress-fill"
                      style={{
                        width:
                          `${queueProgress}%`,
                      }}
                    />

                  </div>

                  <span className="queue-progress-percent">
                    {Math.round(queueProgress)}%
                  </span>

                </div>

                <div className="queue-progress-info">

                  <span>
                    Your Token
                  </span>

                  <strong>
                    #{token}
                  </strong>

                </div>

              </div>

              <div className="queue-live-details">

                <div>

                  <span>
                    Patients Ahead
                  </span>

                  <strong>
                    {patientsBefore ?? 0}
                  </strong>

                </div>

                <div>

                  <span>
                    Auto Refresh
                  </span>

                  <strong>
                    5 sec
                  </strong>

                </div>

                <div>

                  <span>
                    Last Updated
                  </span>

                  <strong>
                    {getLastUpdatedText()}
                  </strong>

                </div>

              </div>

            </div>

            {/* ================= SMART ETA ================= */}

            <div className="wait-time-card">

              <div className="wait-time-icon">
                ⏱
              </div>

              <div className="wait-time-content">

                <span className="wait-time-label">
                  SMART ESTIMATED WAITING TIME
                </span>

                {status === "Consulting" ? (

                  <strong className="wait-time-value">
                    Consulting Now
                  </strong>

                ) : loadingWaitTime ? (

                  <strong className="wait-time-value">
                    Calculating...
                  </strong>

                ) : estimatedWaitMinutes !== null ? (

                  <strong className="wait-time-value">
                    ~{estimatedWaitMinutes} minutes
                  </strong>

                ) : (

                  <strong className="wait-time-value">
                    Calculating...
                  </strong>

                )}

                <p>

                  {status === "Consulting"
                    ? "Your consultation is currently in progress."
                    : historyCount > 0
                    ? `Based on ${historyCount} previous consultations and the current queue.`
                    : "Using an initial estimate. Predictions become more accurate as consultation history builds."}

                </p>

              </div>

            </div>

            {/* ================= ETA DETAILS ================= */}

            {status !== "Completed" && (

              <div className="wait-time-details">

                <div>

                  <span>
                    Patients Ahead
                  </span>

                  <strong>
                    {patientsBefore ?? 0}
                  </strong>

                </div>

                <div>

                  <span>
                    Avg. Consultation
                  </span>

                  <strong>
                    {averageConsultationMinutes !== null
                      ? `${averageConsultationMinutes} min`
                      : "—"}
                  </strong>

                </div>

                <div>

                  <span>
                    Emergency Ahead
                  </span>

                  <strong>
                    {emergencyAhead ?? 0}
                  </strong>

                </div>

              </div>

            )}

            {/* ================= CURRENT CONSULTATION ================= */}

            {status === "Waiting" &&
              currentRemainingMinutes !== null &&
              currentRemainingMinutes > 0 && (

              <div className="attention-box warning-box">

                <div className="alert-icon">
                  ⏳
                </div>

                <div>

                  <strong>
                    Consultation in progress
                  </strong>

                  <p>
                    Approximately{" "}
                    {currentRemainingMinutes} minutes
                    remaining for the current patient.
                  </p>

                </div>

              </div>

            )}

            {/* ================= SMART PREDICTION ================= */}

            {status !== "Completed" &&
              historyCount > 0 && (

              <div className="prediction-info">

                <div className="alert-icon">
                  🧠
                </div>

                <div>

                  <strong>
                    Smart Prediction
                  </strong>

                  <p>
                    This estimate uses real
                    consultation history from{" "}
                    {hospitalName ||
                      "this hospital"}.
                  </p>

                  <small>
                    {historyCount} completed
                    consultations analyzed.
                  </small>

                </div>

              </div>

            )}

            {/* ================= ERROR ================= */}

            {queueError && (

              <div className="attention-box error-box">

                <div className="alert-icon">
                  ⚠️
                </div>

                <div>

                  <strong>
                    Queue Update
                  </strong>

                  <p>
                    {queueError}
                  </p>

                  <small>
                    The system will automatically retry.
                  </small>

                </div>

              </div>

            )}

            {/* ================= 10 PATIENTS ================= */}

            {!queueError &&
              patientsBefore !== null &&
              patientsBefore <= 10 &&
              patientsBefore > 5 && (

              <div className="attention-box notification-box">

                <div className="alert-icon">
                  🔔
                </div>

                <div>

                  <strong>
                    Your turn is getting closer!
                  </strong>

                  <p>
                    There are only{" "}
                    {patientsBefore} patients
                    before you.
                  </p>

                  <small>
                    Please stay ready.
                  </small>

                </div>

              </div>

            )}

            {/* ================= 5 PATIENTS ================= */}

            {!queueError &&
              patientsBefore !== null &&
              patientsBefore <= 5 &&
              patientsBefore > 2 && (

              <div className="attention-box notification-box">

                <div className="alert-icon">
                  🔔
                </div>

                <div>

                  <strong>
                    Please be ready!
                  </strong>

                  <p>
                    Only{" "}
                    {patientsBefore} patients
                    are before you.
                  </p>

                </div>

              </div>

            )}

            {/* ================= 2 PATIENTS ================= */}

            {!queueError &&
              patientsBefore !== null &&
              patientsBefore <= 2 &&
              patientsBefore > 0 && (

              <div className="attention-box urgent-box">

                <div className="alert-icon">
                  🚨
                </div>

                <div>

                  <strong>
                    Your turn is very close!
                  </strong>

                  <p>
                    Only{" "}
                    {patientsBefore} patients
                    are before you.
                  </p>

                  <small>
                    Please proceed towards
                    the consultation area soon.
                  </small>

                </div>

              </div>

            )}

            {/* ================= CONSULTING ================= */}

            {status === "Consulting" && (

              <div className="success-box">

                <div className="success-icon">
                  ✓
                </div>

                <div>

                  <strong>
                    Your turn has arrived!
                  </strong>

                  <p>
                    Please proceed to the
                    consultation area.
                  </p>

                </div>

              </div>

            )}

            {/* ================= COMPLETED ================= */}

            {status === "Completed" && (

              <div className="success-box">

                <div className="success-icon">
                  ✓
                </div>

                <div>

                  <strong>
                    Consultation completed
                  </strong>

                  <p>
                    Thank you for visiting
                     Queue Care Hospital.
                  </p>

                </div>

              </div>

            )}

          </div>

        ) : (

          /* =================================================
             NEW TOKEN REGISTRATION
          ================================================= */

          <div className="registration-section">

            <div className="registration-header">

              <span>
                PATIENT REGISTRATION
              </span>

              <h2>
                Get Your Hospital Token
              </h2>

              <p>
                Enter your details below to join
                the hospital queue.
              </p>

            </div>

            <div className="registration-card">

              <div className="form-grid">

                <div className="form-field">

                  <label>
                    Patient Name
                  </label>

                  <input
                    type="text"
                    placeholder="Enter your full name"
                    value={name}
                    onChange={(e) =>
                      setName(e.target.value)
                    }
                  />

                </div>

                <div className="form-field">

                  <label>
                    Phone Number
                  </label>

                  <input
                    type="tel"
                    placeholder="Enter mobile number"
                    value={phone}
                    onChange={(e) =>
                      setPhone(e.target.value)
                    }
                  />

                </div>

                <div className="form-field">

                  <label>
                    Department
                  </label>

                  <select
                    value={department}
                    onChange={(e) =>
                      setDepartment(
                        e.target.value
                      )
                    }
                    disabled={
                      loadingDepartments ||
                      departments.length === 0
                    }
                  >

                    <option value="">
                      {loadingDepartments
                        ? "Loading departments..."
                        : departments.length === 0
                        ? "No departments available"
                        : "Select department"}
                    </option>

                    {departments.map(
                      (item) => (

                        <option
                          key={item.id}
                          value={item.name}
                        >
                          {item.name}
                        </option>

                      )
                    )}

                  </select>

                </div>

              </div>

              {!loadingDepartments &&
                departments.length === 0 && (

                <div className="login-message">

                  No departments found for{" "}

                  <strong>
                    {hospitalName}
                  </strong>

                  .

                  <br />

                  Please ask the Super Admin
                  to check this hospital.

                </div>

              )}

              <button
                className="primary-button"
                onClick={registerPatient}
                disabled={
                  loading ||
                  loadingDepartments ||
                  departments.length === 0
                }
              >

                {loading
                  ? "Generating Token..."
                  : "Get My Token →"}

              </button>

              {message && (

                <div className="login-message">
                  {message}
                </div>

              )}

            </div>

            <div className="registration-note">

              <span>
                🔒
              </span>

              <p>
                Your queue information is private
                and linked to your hospital account.
              </p>

            </div>

          </div>

        )}

        {/* ================= FOOTER ================= */}

        <div className="dashboard-footer">

          <span>
            Queue Care Hospital
          </span>

          <span>
            •
          </span>

          <span>
            Smart Patient Queue
          </span>

        </div>

      </div>

    </div>
  );
}

export default PatientDashboard;