import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "../supabaseClient";

function NurseLogin() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  const loginNurse = async () => {
    if (!email || !password) {
      setMessage("Please enter email and password.");
      return;
    }

    setMessage("");

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error(error);
      setMessage(error.message);
      return;
    }

    if (!data.user) {
      setMessage("Unable to login.");
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", data.user.id)
      .single();

    if (profileError) {
      console.error(profileError);

      await supabase.auth.signOut();

      setMessage("Nurse profile not found.");
      return;
    }

    if (profile.role !== "nurse") {
      await supabase.auth.signOut();

      setMessage("Access denied. Nurse account required.");
      return;
    }

    navigate("/nurse");
  };

  return (
    <div className="login-page">
      <div className="login-card">

        <h1>SPN Care Hospital</h1>

        <h2>Nurse Login</h2>

        <input
          type="email"
          placeholder="Nurse Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <button onClick={loginNurse}>
          Login
        </button>

        {message && (
          <p className="login-message">
            {message}
          </p>
        )}

        <Link to="/">
          ← Back to Home
        </Link>

      </div>
    </div>
  );
}

export default NurseLogin;
