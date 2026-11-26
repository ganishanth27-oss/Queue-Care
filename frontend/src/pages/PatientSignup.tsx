import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api";
import { supabase } from "../supabaseClient";

function PatientSignup() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const signupPatient = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim() || !password.trim() || !confirmPassword.trim()) {
      setMessage("Please fill all fields.");
      return;
    }

    if (password.length < 6) {
      setMessage("Password must contain at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });

      if (error) {
        setMessage(error.message);
        return;
      }

      if (!data.user) {
        setMessage("Account could not be created.");
        return;
      }

      if (data.session) {
        await api.post("/auth/patient-role");
        setMessage("Patient account created successfully.");

        setTimeout(() => {
          navigate(
            localStorage.getItem("selectedHospitalId")
              ? "/patient"
              : "/hospital-selection"
          );
        }, 800);
      } else {
        setMessage(
          "Account created successfully. Please verify your email, then login."
        );
      }
    } catch (err) {
      console.error(err);
      setMessage("Account created, but patient setup could not be completed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page patient-auth-page">
      <div className="auth-shell">
        <section className="auth-panel auth-copy">
          <Link to="/" className="auth-brand">
            <span className="auth-brand-mark">+</span>
            <span>
              <strong>Queue Care</strong>
              <small>Patient Portal</small>
            </span>
          </Link>

          <div>
            <p className="auth-kicker">New patient account</p>
            <h1>Create one account for hospital token access.</h1>
            <p>
              After signup, choose a hospital and generate your token from the
              patient dashboard.
            </p>
          </div>
        </section>

        <section className="auth-panel auth-card">
          <div className="auth-card-heading">
            <p>Patient signup</p>
            <h2>Create account</h2>
            <span>
              Already registered? <Link to="/patient-login">Sign in</Link>
            </span>
          </div>

          <form className="auth-form" onSubmit={signupPatient}>
            <label>
              Email address
              <input
                type="email"
                required
                placeholder="patient@example.com"
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
                placeholder="Minimum 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
              />
            </label>

            <label>
              Confirm password
              <input
                type="password"
                required
                placeholder="Re-enter your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={loading}
              />
            </label>

            {message && <div className="auth-alert">{message}</div>}

            <button type="submit" disabled={loading} className="auth-submit">
              {loading ? "Creating account..." : "Create account"}
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

export default PatientSignup;
