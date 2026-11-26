import { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { supabase } from "../supabaseClient";
import { API_URL } from "../api";

function SuperAdminLogin() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    setLoading(true);
    setError("");

    try {
      const { data, error: loginError } =
        await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

      if (loginError) {
        throw new Error(loginError.message);
      }

      if (!data.session) {
        throw new Error("Login session was not created.");
      }

      const response = await axios.get(
        `${API_URL}/auth/me`,
        {
          headers: {
            Authorization: `Bearer ${data.session.access_token}`,
          },
        }
      );

      if (response.data.role !== "Super Admin") {
        await supabase.auth.signOut();

        setError(
          "Access denied. This account is not a Super Admin."
        );

        return;
      }

      navigate("/super-admin");
    } catch (err: any) {
      console.error(err);

      setError(
        err.response?.data?.detail ||
          err.message ||
          "Unable to login."
      );
    } finally {
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
          boxShadow: "0 10px 35px rgba(0,0,0,0.08)",
        }}
      >
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

        {error && (
          <div
            style={{
              background: "#fff1f1",
              color: "#c62828",
              padding: "12px",
              borderRadius: "8px",
              marginBottom: "20px",
              fontSize: "14px",
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: "18px" }}>
            <label
              style={{
                display: "block",
                marginBottom: "7px",
                fontWeight: 600,
              }}
            >
              Email
            </label>

            <input
              type="email"
              placeholder="Enter admin email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "13px",
                border: "1px solid #d0d5dd",
                borderRadius: "8px",
                fontSize: "15px",
              }}
            />
          </div>

          <div style={{ marginBottom: "22px" }}>
            <label
              style={{
                display: "block",
                marginBottom: "7px",
                fontWeight: 600,
              }}
            >
              Password
            </label>

            <input
              type="password"
              placeholder="Enter admin password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "13px",
                border: "1px solid #d0d5dd",
                borderRadius: "8px",
                fontSize: "15px",
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "14px",
              border: "none",
              borderRadius: "8px",
              background: "#1769e0",
              color: "#ffffff",
              fontSize: "16px",
              fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <button
          onClick={() => navigate("/")}
          style={{
            width: "100%",
            marginTop: "15px",
            padding: "12px",
            border: "none",
            background: "transparent",
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

export default SuperAdminLogin;