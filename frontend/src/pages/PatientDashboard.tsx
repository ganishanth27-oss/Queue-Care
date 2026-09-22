import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

import { supabase } from "../supabaseClient";
import api from "../api";

function PatientDashboard() {
  const navigate = useNavigate();

  const [user, setUser] = useState<any>(null);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [department, setDepartment] = useState("");

  const [token, setToken] = useState<number | null>(null);
  const [status, setStatus] = useState("");

  const [currentToken, setCurrentToken] =
    useState<number | null>(null);

  const [patientsBefore, setPatientsBefore] =
    useState<number | null>(null);

  const [queueError, setQueueError] = useState("");

  const [message, setMessage] = useState("");

  const [loading, setLoading] = useState(false);

  const [checkingPatient, setCheckingPatient] =
    useState(true);


  // ==========================================
  // CHECK LOGIN
  // ==========================================

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

      setUser(user);

      console.log(
        "LOGGED-IN SUPABASE USER ID:",
        user.id
      );

      console.log(
        "LOGGED-IN SUPABASE EMAIL:",
        user.email
      );

      await loadExistingPatient();

    } catch (error) {
      console.error(
        "Login check error:",
        error
      );

      navigate("/patient-login");

    } finally {
      setCheckingPatient(false);
    }
  };


  // ==========================================
  // LOAD EXISTING ACTIVE TOKEN
  // ==========================================

  const loadExistingPatient = async () => {
    try {
      const response =
        await api.get("/patients/me");

      const patient = response.data;

      console.log(
        "Existing patient:",
        patient
      );

      setToken(patient.token_number);

      setStatus(patient.status);

      setQueueError("");

      await getQueueStatus(
        patient.token_number
      );

    } catch (error) {

      if (axios.isAxiosError(error)) {

        console.error(
          "Load patient error:",
          error.response?.status
        );

        console.error(
          "Load patient response:",
          JSON.stringify(
            error.response?.data,
            null,
            2
          )
        );

        if (
          error.response?.status === 404
        ) {

          setToken(null);

          setStatus("");

          setCurrentToken(null);

          setPatientsBefore(null);

          setQueueError("");

          return;
        }

        if (
          error.response?.status === 401
        ) {

          await supabase.auth.signOut();

          navigate("/patient-login");

          return;
        }
      }

      console.error(error);
    }
  };


  // ==========================================
  // REGISTER PATIENT
  // ==========================================

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

    setLoading(true);

    setMessage("");

    setQueueError("");

    try {

      const response =
        await api.post(
          "/patients",
          {
            name: name.trim(),

            phone: phone.trim(),

            department:
              department.trim(),

            emergency: false,

            user_id: user.id,
          }
        );

      const newToken =
        response.data.token_number;

      console.log(
        "NEW TOKEN CREATED:",
        newToken
      );

      console.log(
        "CURRENT LOGGED-IN USER:",
        user.id,
        user.email
      );

      setToken(newToken);

      setStatus("Waiting");

      setCurrentToken(null);

      setPatientsBefore(null);

      setMessage(
        `Registration successful! Your token number is ${newToken}.`
      );

      setName("");

      setPhone("");

      setDepartment("");

      await getQueueStatus(
        newToken
      );

    } catch (error) {

      console.error(
        "Registration error:",
        error
      );

      if (
        axios.isAxiosError(error)
      ) {

        console.error(
          "Registration response:",
          JSON.stringify(
            error.response?.data,
            null,
            2
          )
        );

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


  // ==========================================
  // GET QUEUE STATUS
  // ==========================================

  const getQueueStatus = async (
    tokenNumber: number
  ) => {

    try {

      console.log(
        "Checking queue:",
        tokenNumber
      );

      const response =
        await api.get(
          `/queue/${tokenNumber}`
        );

      console.log(
        "Queue response:",
        response.data
      );

      setToken(
        response.data.token_number
      );

      setStatus(
        response.data.status
      );

      setCurrentToken(
        response.data.current_token
      );

      setPatientsBefore(
        response.data.patients_before
      );

      setQueueError("");

    } catch (error) {

      console.error(
        "Queue status error:",
        error
      );

      if (
        axios.isAxiosError(error)
      ) {

        console.error(
          "Queue status:",
          error.response?.status
        );

        console.error(
          "QUEUE ERROR DETAILS:",
          JSON.stringify(
            error.response?.data,
            null,
            2
          )
        );

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


  // ==========================================
  // AUTO REFRESH QUEUE
  // ==========================================

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


  // ==========================================
  // NOTIFICATION
  // ==========================================

  useEffect(() => {

    if (
      patientsBefore !== null &&
      patientsBefore <= 5 &&
      patientsBefore > 0
    ) {

      if (
        "Notification" in window
      ) {

        if (
          Notification.permission ===
          "default"
        ) {

          Notification.requestPermission();

        }

        if (
          Notification.permission ===
          "granted"
        ) {

          new Notification(
            "SPN Care Hospital",
            {
              body:
                `Only ${patientsBefore} patients are before you. Please be ready.`,
            }
          );

        }
      }
    }

  }, [patientsBefore]);


  // ==========================================
  // LOGOUT
  // ==========================================

  const logout = async () => {

    await supabase.auth.signOut();

    navigate("/");
  };


  // ==========================================
  // LOADING SCREEN
  // ==========================================

  if (checkingPatient) {

    return (

      <div className="login-page">

        <div className="login-card">

          <h2>
            Loading your hospital queue...
          </h2>

        </div>

      </div>
    );
  }


  // ==========================================
  // MAIN PAGE
  // ==========================================

  return (

    <div className="dashboard-page">

      <div className="dashboard-card">


        {/* ================================= */}
        {/* HEADER */}
        {/* ================================= */}

        <div className="dashboard-header">

          <div>

            <h1>
              SPN Care Hospital
            </h1>

            <p>
              Patient Dashboard
            </p>

          </div>

          <button
            onClick={logout}
          >
            Logout
          </button>

        </div>


        <hr />


        {/* ================================= */}
        {/* ACTIVE TOKEN */}
        {/* ================================= */}

        {token !== null ? (

          <div className="queue-section">

            <h2>
              Your Queue Status
            </h2>


            <div className="queue-cards">


              {/* YOUR TOKEN */}

              <div className="queue-box">

                <span>
                  Your Token
                </span>

                <strong>
                  #{token}
                </strong>

              </div>


              {/* CURRENT TOKEN */}

              <div className="queue-box">

                <span>
                  Currently Consulting
                </span>

                <strong>

                  {currentToken !== null
                    ? `#${currentToken}`
                    : "Not Started"}

                </strong>

              </div>


              {/* STATUS */}

              <div className="queue-box">

                <span>
                  Status
                </span>

                <strong>
                  {status}
                </strong>

              </div>


              {/* PATIENTS BEFORE */}

              <div className="queue-box">

                <span>
                  Patients Before You
                </span>

                <strong>

                  {patientsBefore !== null
                    ? patientsBefore
                    : "—"}

                </strong>

              </div>

            </div>


            {/* ================================= */}
            {/* QUEUE ERROR */}
            {/* ================================= */}

            {queueError && (

              <div className="attention-box">

                ⚠️

                <strong>
                  Queue Update
                </strong>

                <br />

                {queueError}

                <br />

                <small>
                  The system will automatically retry.
                </small>

              </div>

            )}


            {/* ================================= */}
            {/* READY MESSAGE */}
            {/* ================================= */}

            {!queueError &&
              patientsBefore !== null &&
              patientsBefore <= 5 &&
              patientsBefore > 0 && (

                <div className="attention-box">

                  🔔

                  <strong>
                    Please be ready!
                  </strong>

                  <br />

                  Only {patientsBefore}
                  {" "}
                  patients are before you.

                </div>

            )}


            {/* ================================= */}
            {/* YOUR TURN */}
            {/* ================================= */}

            {status === "Consulting" && (

              <div className="success-box">

                🩺

                <strong>
                  Your turn has arrived!
                </strong>

                <br />

                Please proceed to the
                consultation area.

              </div>

            )}


            {/* ================================= */}
            {/* COMPLETED */}
            {/* ================================= */}

            {status === "Completed" && (

              <div className="success-box">

                ✅

                <strong>
                  Consultation completed.
                </strong>

              </div>

            )}

          </div>

        ) : (

          /* ================================= */
          /* NEW REGISTRATION */
          /* ================================= */

          <>

            <h2>
              Get Your Hospital Token
            </h2>


            <div className="form-grid">


              <input
                type="text"
                placeholder="Patient Name"
                value={name}
                onChange={(e) =>
                  setName(
                    e.target.value
                  )
                }
              />


              <input
                type="tel"
                placeholder="Phone Number"
                value={phone}
                onChange={(e) =>
                  setPhone(
                    e.target.value
                  )
                }
              />


              <select
                value={department}
                onChange={(e) =>
                  setDepartment(
                    e.target.value
                  )
                }
              >

                <option value="">
                  Select Department
                </option>

                <option value="General Medicine">
                  General Medicine
                </option>

                <option value="Cardiology">
                  Cardiology
                </option>

                <option value="Orthopedics">
                  Orthopedics
                </option>

                <option value="Pediatrics">
                  Pediatrics
                </option>

                <option value="Dermatology">
                  Dermatology
                </option>

              </select>

            </div>


            <button
              className="primary-button"
              onClick={registerPatient}
              disabled={loading}
            >

              {loading
                ? "Generating Token..."
                : "Get Token"}

            </button>


            {message && (

              <p className="login-message">
                {message}
              </p>

            )}

          </>

        )}

      </div>

    </div>
  );
}

export default PatientDashboard;