import { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

import { supabase } from "../supabaseClient";
import { API_URL } from "../api";

function DoctorLogin() {
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
        "STEP 1: Doctor login started"
      );

      /* =================================================
         SUPABASE LOGIN
      ================================================= */

      const {
        data,
        error: loginError,
      } =
        await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
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

      /* =================================================
         CHECK BACKEND ROLE
      ================================================= */

      const response =
        await axios.get(
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
        "STEP 4: Backend user information",
        response.data
      );

      /* =================================================
         VERIFY DOCTOR
      ================================================= */

      if (
        response.data.role !==
        "Doctor"
      ) {
        await supabase.auth.signOut();

        throw new Error(
          "Access denied. This account is not registered as a Doctor."
        );
      }

      /* =================================================
         VERIFY HOSPITAL
      ================================================= */

      if (
        !response.data.hospital_id
      ) {
        await supabase.auth.signOut();

        throw new Error(
          "This Doctor account is not assigned to a hospital."
        );
      }

      /* =================================================
         VERIFY DEPARTMENT
      ================================================= */

      if (
        !response.data.department
      ) {
        await supabase.auth.signOut();

        throw new Error(
          "This Doctor account is not assigned to a department."
        );
      }

      console.log(
        "STEP 5: Doctor verified",
        {
          hospital_id:
            response.data.hospital_id,

          department:
            response.data.department,
        }
      );

      /* =================================================
         SAVE DOCTOR DETAILS
      ================================================= */

      localStorage.setItem(
        "doctor_hospital_id",
        String(
          response.data.hospital_id
        )
      );

      localStorage.setItem(
        "doctor_department",
        response.data.department
      );

      localStorage.setItem(
        "doctor_email",
        email.trim()
      );

      /* =================================================
         NAVIGATE
      ================================================= */

      console.log(
        "STEP 6: Navigating to Doctor Dashboard"
      );

      navigate(
        "/doctor",
        {
          replace: true,
        }
      );

    } catch (err: any) {
      console.error(
        "DOCTOR LOGIN ERROR:",
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
        background:
          "linear-gradient(135deg, #eef5ff, #f8fbff)",
        padding: "20px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "430px",
          background: "#ffffff",
          borderRadius: "18px",
          padding: "40px",
          boxShadow:
            "0 15px 45px rgba(16, 24, 40, 0.10)",
        }}
      >

        {/* =================================================
            HEADER
        ================================================= */}

        <div
          style={{
            textAlign: "center",
            marginBottom: "30px",
          }}
        >

          <div
            style={{
              width: "68px",
              height: "68px",
              margin:
                "0 auto 16px",
              borderRadius: "18px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "#eaf2ff",
              fontSize: "32px",
            }}
          >
            🩺
          </div>

          <h1
            style={{
              margin: 0,
              fontSize: "27px",
              color: "#101828",
            }}
          >
            Queue Care Hospital
          </h1>

          <p
            style={{
              marginTop: "8px",
              marginBottom: 0,
              color: "#667085",
              fontSize: "15px",
            }}
          >
            Doctor Login
          </p>

        </div>


        {/* =================================================
            ERROR
        ================================================= */}

        {error && (
          <div
            style={{
              background: "#fff1f1",
              color: "#c62828",
              padding: "12px 14px",
              borderRadius: "9px",
              marginBottom: "20px",
              fontSize: "14px",
              border:
                "1px solid #ffd6d6",
              lineHeight: 1.5,
            }}
          >
            {error}
          </div>
        )}


        {/* =================================================
            FORM
        ================================================= */}

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
              Doctor Email
            </label>

            <input
              type="email"
              placeholder="doctor@spncare.com"
              value={email}
              onChange={(e) =>
                setEmail(
                  e.target.value
                )
              }
              required
              disabled={loading}
              autoComplete="email"
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "13px 14px",
                border:
                  "1px solid #d0d5dd",
                borderRadius: "9px",
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
              placeholder="Enter your password"
              value={password}
              onChange={(e) =>
                setPassword(
                  e.target.value
                )
              }
              required
              disabled={loading}
              autoComplete="current-password"
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "13px 14px",
                border:
                  "1px solid #d0d5dd",
                borderRadius: "9px",
                fontSize: "15px",
                outline: "none",
              }}
            />

          </div>


          {/* LOGIN BUTTON */}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "14px",
              border: "none",
              borderRadius: "9px",
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
              : "Sign In as Doctor"}
          </button>

        </form>


        {/* =================================================
            BACK
        ================================================= */}

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
            fontSize: "14px",
          }}
        >
          ← Back to Home
        </button>

      </div>
    </div>
  );
}

export default DoctorLogin;