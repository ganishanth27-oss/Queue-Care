import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "../supabaseClient";

function PatientLogin() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const loginPatient = async () => {
    if (!email.trim() || !password.trim()) {
      setMessage("Please enter email and password.");
      return;
    }

    setLoading(true);
    setMessage("");

    const { data, error } =
      await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

    if (error) {
      console.error(error);

      setMessage(error.message);
      setLoading(false);

      return;
    }

    if (!data.user) {
      setMessage("Unable to login.");
      setLoading(false);

      return;
    }

    // Check patient profile
    const { data: profile, error: profileError } =
      await supabase
        .from("profiles")
        .select("role")
        .eq("id", data.user.id)
        .single();

    if (profileError || !profile) {
      console.error(profileError);

      await supabase.auth.signOut();

      setMessage("Patient profile not found.");
      setLoading(false);

      return;
    }

    // Make sure this is a patient account
    if (profile.role !== "patient") {
      await supabase.auth.signOut();

      setMessage(
        "Access denied. Patient account required."
      );

      setLoading(false);

      return;
    }

    // Login successful
    navigate("/patient");

    setLoading(false);
  };

  return (
    <div className="login-page">

      <div className="login-card">

        <h1>
          SPN Care Hospital
        </h1>

        <h2>
          Patient Login
        </h2>

        <p>
          Login to manage your hospital token.
        </p>

        <input
          type="email"
          placeholder="Patient Email"
          value={email}
          onChange={(e) =>
            setEmail(e.target.value)
          }
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) =>
            setPassword(e.target.value)
          }
        />

        <button
          onClick={loginPatient}
          disabled={loading}
        >
          {loading
            ? "Logging in..."
            : "Login"}
        </button>

        {message && (
          <p className="login-message">
            {message}
          </p>
        )}

        <p>
          Don't have an account?
        </p>

        <Link to="/patient-signup">
          Create Patient Account
        </Link>

        <br />

        <Link to="/">
          ← Back to Home
        </Link>

      </div>

    </div>
  );
}

export default PatientLogin;
