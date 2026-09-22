import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "../supabaseClient";

function PatientSignup() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const signupPatient = async () => {
    // Check fields
    if (
      !email.trim() ||
      !password.trim() ||
      !confirmPassword.trim()
    ) {
      setMessage("Please fill all fields.");
      return;
    }

    // Check password
    if (password.length < 6) {
      setMessage(
        "Password must contain at least 6 characters."
      );
      return;
    }

    // Check passwords match
    if (password !== confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }

    setLoading(true);
    setMessage("");

    // Create Supabase account
    const { data, error } =
      await supabase.auth.signUp({
        email: email.trim(),
        password: password,
      });

    if (error) {
      console.error(error);

      setMessage(error.message);
      setLoading(false);

      return;
    }

    if (!data.user) {
      setMessage(
        "Account could not be created."
      );

      setLoading(false);

      return;
    }

    // Create patient profile
    const { error: profileError } =
      await supabase
        .from("profiles")
        .insert({
          id: data.user.id,
          role: "patient",
        });

    if (profileError) {
      console.error(profileError);

      setMessage(
        "Account created, but patient profile could not be created."
      );

      setLoading(false);

      return;
    }

    // If email confirmation is required
    if (!data.session) {
      setMessage(
        "Account created successfully. Please verify your email, then login."
      );

      setLoading(false);

      return;
    }

    // Account and profile created
    setMessage(
      "Patient account created successfully!"
    );

    setLoading(false);

    setTimeout(() => {
      navigate("/patient-login");
    }, 1000);
  };

  return (
    <div className="login-page">

      <div className="login-card">

        <h1>
          SPN Care Hospital
        </h1>

        <h2>
          Patient Signup
        </h2>

        <p>
          Create your patient account.
        </p>

        <input
          type="email"
          placeholder="Email Address"
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

        <input
          type="password"
          placeholder="Confirm Password"
          value={confirmPassword}
          onChange={(e) =>
            setConfirmPassword(
              e.target.value
            )
          }
        />

        <button
          onClick={signupPatient}
          disabled={loading}
        >
          {loading
            ? "Creating Account..."
            : "Create Account"}
        </button>

        {message && (
          <p className="login-message">
            {message}
          </p>
        )}

        <p>
          Already have an account?
        </p>

        <Link to="/patient-login">
          Patient Login
        </Link>

        <br />

        <Link to="/">
          ← Back to Home
        </Link>

      </div>

    </div>
  );
}

export default PatientSignup;
