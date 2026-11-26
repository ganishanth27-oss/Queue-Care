import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useNavigate,
} from "react-router-dom";

import { useEffect, useState } from "react";
import axios from "axios";

import "./App.css";

import Home from "./pages/Home";
import HospitalSelection from "./pages/HospitalSelection";

import PatientSignup from "./pages/PatientSignup";
import PatientLogin from "./pages/PatientLogin";
import PatientDashboard from "./pages/PatientDashboard";

import NurseLogin from "./pages/Nurselogin";
import NurseDashboard from "./pages/NurseDashboard";

import DoctorLogin from "./pages/DoctorLogin";
import DoctorDashboard from "./pages/DoctorDashboard";

import SuperAdminDashboard from "./pages/SuperAdminDashboard";

import { supabase } from "./supabaseClient";
import { API_URL } from "./api";


/* =========================================================
   SUPER ADMIN LOGIN
========================================================= */

function SuperAdminLogin() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");


  const handleLogin = async (
    e: React.FormEvent
  ) => {

    e.preventDefault();

    if (loading) {
      return;
    }

    setLoading(true);
    setError("");


    try {

      console.log(
        "STEP 1: Starting Super Admin login"
      );


      /* -----------------------------------------
         SUPABASE LOGIN
      ----------------------------------------- */

      const {
        data,
        error: loginError,
      } =
        await supabase.auth.signInWithPassword({
          email: email.trim(),
          password: password,
        });


      console.log(
        "STEP 2: Supabase response",
        {
          user: data.user,
          session: !!data.session,
          error: loginError,
        }
      );


      if (loginError) {

        throw new Error(
          loginError.message
        );

      }


      if (!data.session) {

        throw new Error(
          "Login session was not created. Please try again."
        );

      }


      console.log(
        "STEP 3: Supabase login successful"
      );


      /* -----------------------------------------
         CHECK BACKEND ROLE
      ----------------------------------------- */

      const response = await axios.get(
        `${API_URL}/auth/me`,
        {
          headers: {
            Authorization:
              `Bearer ${data.session.access_token}`,
          },

          timeout: 10000,
        }
      );


      console.log(
        "STEP 4: Backend /auth/me response",
        response.data
      );


      /* -----------------------------------------
         CHECK SUPER ADMIN ROLE
      ----------------------------------------- */

      if (
        response.data.role !==
        "Super Admin"
      ) {

        await supabase.auth.signOut();

        throw new Error(
          "Access denied. This account is not a Super Admin."
        );

      }


      console.log(
        "STEP 5: Super Admin verified"
      );


      /* -----------------------------------------
         NAVIGATE
      ----------------------------------------- */

      setLoading(false);

      console.log(
        "STEP 6: Navigating to Super Admin Dashboard"
      );


      navigate(
        "/super-admin",
        {
          replace: true,
        }
      );


    } catch (err: any) {

      console.error(
        "SUPER ADMIN LOGIN ERROR:",
        err
      );


      let errorMessage =
        "Unable to login.";


      if (
        err.response?.data?.detail
      ) {

        errorMessage =
          err.response.data.detail;

      } else if (err.message) {

        errorMessage =
          err.message;

      }


      setError(errorMessage);

      setLoading(false);

    }

  };


  return (

    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f4f7fb",
        padding: "20px",
      }}
    >

      <div
        style={{
          width: "100%",
          maxWidth: "430px",
          background: "#ffffff",
          borderRadius: "16px",
          padding: "40px",
          boxShadow:
            "0 10px 35px rgba(0,0,0,0.08)",
        }}
      >

        {/* HEADER */}

        <div
          style={{
            textAlign: "center",
            marginBottom: "30px",
          }}
        >

          <div
            style={{
              width: "60px",
              height: "60px",
              margin: "0 auto 15px",
              borderRadius: "14px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "#eaf2ff",
              fontSize: "28px",
            }}
          >
            ⚙️
          </div>


          <h1
            style={{
              margin: 0,
              fontSize: "26px",
              color: "#101828",
            }}
          >
            Queue Care Hospital
          </h1>


          <p
            style={{
              marginTop: "8px",
              color: "#667085",
            }}
          >
            Super Admin Login
          </p>

        </div>


        {/* ERROR */}

        {error && (

          <div
            style={{
              background: "#fff1f1",
              color: "#c62828",
              padding: "12px 14px",
              borderRadius: "8px",
              marginBottom: "20px",
              fontSize: "14px",
              border:
                "1px solid #ffd6d6",
            }}
          >
            {error}
          </div>

        )}


        {/* LOGIN FORM */}

        <form
          onSubmit={handleLogin}
        >

          {/* EMAIL */}

          <div
            style={{
              marginBottom: "18px",
            }}
          >

            <label
              style={{
                display: "block",
                marginBottom: "7px",
                fontWeight: 600,
                color: "#344054",
              }}
            >
              Email
            </label>


            <input
              type="email"
              placeholder="Enter admin email"
              value={email}
              onChange={(e) =>
                setEmail(e.target.value)
              }
              required
              disabled={loading}
              autoComplete="email"
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "13px",
                border:
                  "1px solid #d0d5dd",
                borderRadius: "8px",
                fontSize: "15px",
                outline: "none",
              }}
            />

          </div>


          {/* PASSWORD */}

          <div
            style={{
              marginBottom: "22px",
            }}
          >

            <label
              style={{
                display: "block",
                marginBottom: "7px",
                fontWeight: 600,
                color: "#344054",
              }}
            >
              Password
            </label>


            <input
              type="password"
              placeholder="Enter admin password"
              value={password}
              onChange={(e) =>
                setPassword(e.target.value)
              }
              required
              disabled={loading}
              autoComplete="current-password"
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "13px",
                border:
                  "1px solid #d0d5dd",
                borderRadius: "8px",
                fontSize: "15px",
                outline: "none",
              }}
            />

          </div>


          {/* SIGN IN */}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "14px",
              border: "none",
              borderRadius: "8px",

              background:
                loading
                  ? "#98b9ee"
                  : "#1769e0",

              color: "#ffffff",
              fontSize: "16px",
              fontWeight: 600,

              cursor:
                loading
                  ? "not-allowed"
                  : "pointer",
            }}
          >
            {loading
              ? "Signing in..."
              : "Sign In"}
          </button>

        </form>


        {/* BACK BUTTON */}

        <button
          type="button"
          onClick={() =>
            navigate("/")
          }
          disabled={loading}
          style={{
            width: "100%",
            marginTop: "15px",
            padding: "12px",
            border: "none",
            background:
              "transparent",
            color: "#667085",
            cursor: "pointer",
          }}
        >
          ← Back to Home
        </button>

      </div>

    </div>
  );
}


/* =========================================================
   AUTH PROTECTED ROUTE
========================================================= */

function ProtectedRoute({
  allowedRoles,
  children,
}: {
  allowedRoles: string[];
  children: React.ReactNode;
}) {

  const [checking, setChecking] =
    useState(true);

  const [authorized, setAuthorized] =
    useState(false);


  useEffect(() => {

    let mounted = true;


    const checkUser = async () => {

      try {

        const {
          data: sessionData,
        } =
          await supabase.auth.getSession();


        const session =
          sessionData.session;


        if (!session) {

          if (mounted) {
            setAuthorized(false);
            setChecking(false);
          }

          return;
        }


        const response =
          await axios.get(
            `${API_URL}/auth/me`,
            {
              headers: {
                Authorization:
                  `Bearer ${session.access_token}`,
              },

              timeout: 10000,
            }
          );


        const role =
          response.data.role;


        if (
          allowedRoles.includes(role)
        ) {

          if (mounted) {
            setAuthorized(true);
          }

        } else {

          if (mounted) {
            setAuthorized(false);
          }

        }


      } catch (error) {

        console.error(
          "Protected route error:",
          error
        );


        if (mounted) {
          setAuthorized(false);
        }

      } finally {

        if (mounted) {
          setChecking(false);
        }

      }

    };


    checkUser();


    return () => {
      mounted = false;
    };

  }, [allowedRoles]);


  /* -----------------------------------------
     CHECKING
  ----------------------------------------- */

  if (checking) {

    return (

      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f4f7fb",
          color: "#344054",
          fontSize: "16px",
          fontWeight: 600,
        }}
      >
        Checking access...
      </div>

    );

  }


  /* -----------------------------------------
     NOT AUTHORIZED
  ----------------------------------------- */

  if (!authorized) {

    return (
      <Navigate
        to="/"
        replace
      />
    );

  }


  return <>{children}</>;
}


/* =========================================================
   MAIN APP
========================================================= */

function App() {

  return (

    <BrowserRouter>

      <Routes>


        {/* =================================================
            HOME
        ================================================= */}

        <Route
          path="/"
          element={
            <Home />
          }
        />


        {/* =================================================
            HOSPITAL SELECTION
        ================================================= */}

        <Route
          path="/hospital-selection"
          element={
            <HospitalSelection />
          }
        />


        {/* =================================================
            PATIENT
        ================================================= */}

        <Route
          path="/patient-login"
          element={
            <PatientLogin />
          }
        />


        <Route
          path="/patient-signup"
          element={
            <PatientSignup />
          }
        />


        <Route
          path="/patient"
          element={
            <ProtectedRoute
              allowedRoles={[
                "Patient",
              ]}
            >
              <PatientDashboard />
            </ProtectedRoute>
          }
        />


        {/* =================================================
            NURSE
        ================================================= */}

        <Route
          path="/nurse-login"
          element={
            <NurseLogin />
          }
        />


        <Route
          path="/nurse"
          element={
            <ProtectedRoute
              allowedRoles={[
                "Nurse",
                "Hospital Admin",
                "Super Admin",
              ]}
            >
              <NurseDashboard />
            </ProtectedRoute>
          }
        />


        {/* =================================================
            DOCTOR
        ================================================= */}

        <Route
          path="/doctor-login"
          element={
            <DoctorLogin />
          }
        />


        <Route
          path="/doctor"
          element={
            <ProtectedRoute
              allowedRoles={[
                "Doctor",
              ]}
            >
              <DoctorDashboard />
            </ProtectedRoute>
          }
        />


        {/* =================================================
            SUPER ADMIN
        ================================================= */}

        <Route
          path="/super-admin-login"
          element={
            <SuperAdminLogin />
          }
        />


        <Route
          path="/super-admin"
          element={
            <ProtectedRoute
              allowedRoles={[
                "Super Admin",
              ]}
            >
              <SuperAdminDashboard />
            </ProtectedRoute>
          }
        />


        {/* =================================================
            FALLBACK
        ================================================= */}

        <Route
          path="*"
          element={
            <Navigate
              to="/"
              replace
            />
          }
        />


      </Routes>

    </BrowserRouter>
  );
}


export default App;