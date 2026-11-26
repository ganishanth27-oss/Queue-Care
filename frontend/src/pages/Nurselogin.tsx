import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api";
import { supabase } from "../supabaseClient";

function NurseLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const loginNurse = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim() || !password.trim()) {
      setMessage("Please enter email and password.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error || !data.user) {
        setMessage(error?.message || "Invalid email or password.");
        return;
      }

      const profile = await api.get("/auth/me");

if (profile.data.role !== "Nurse") {
  await supabase.auth.signOut();
  setMessage("Access denied. Nurse account required.");
  return;
}

navigate("/nurse");
    } catch (err) {
      console.error("Login error:", err);
      setMessage("Unable to connect to the authentication service.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page nurse-auth-page">
      <div className="auth-shell">
        <section className="auth-panel auth-copy">
          <Link to="/" className="auth-brand">
            <span className="auth-brand-mark">+</span>
            <span>
              <strong>Queue Care</strong>
              <small>Hospital Staff Portal</small>
            </span>
          </Link>

          <div>
            <p className="auth-kicker">Staff queue control</p>
            <h1>Manage today&apos;s hospital queue with clarity.</h1>
            <p>
              Sign in with your assigned nurse account to call patients, manage
              emergencies, and complete consultations for your hospital only.
            </p>
          </div>

          <div className="auth-meta-grid">
            <div>
              <strong>Scoped</strong>
              <span>Hospital-only records</span>
            </div>
            <div>
              <strong>Fast</strong>
              <span>Live queue controls</span>
            </div>
          </div>
        </section>

        <section className="auth-panel auth-card">
          <div className="auth-card-heading">
            <h1>Hospital Staff Login</h1>
            <h2>Open queue desk</h2>
            <span>Use the credentials assigned by your administrator.</span>
          </div>

          <form className="auth-form" onSubmit={loginNurse}>
            <label>
              Email address
              <input
                type="email"
                required
                placeholder="nurse@hospital.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
            </label>

            <label>
              Password
              <input
                type="password"
                required
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
              />
            </label>

            {message && <div className="auth-alert">{message}</div>}

            <button type="submit" disabled={loading} className="auth-submit">
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>

          <Link to="/" className="auth-back">
            Back to home
          </Link>
        </section>
      </div>
    </div>
  );
}

export default NurseLogin;
