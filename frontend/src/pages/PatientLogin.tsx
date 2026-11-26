import { useEffect, useState } from "react"; 
import { Link, useNavigate } from "react-router-dom"; 
import api from "../api"; 
import { supabase } from "../supabaseClient"; 
 
function PatientLogin() { 
  const navigate = useNavigate(); 
 
  const [email, setEmail] = useState(""); 
  const [password, setPassword] = useState(""); 
  const [rememberMe, setRememberMe] = useState(true); 
 
  const [message, setMessage] = useState(""); 
  const [loading, setLoading] = useState(false); 
 
  // Existing logged-in user 
  const [existingSessionEmail, setExistingSessionEmail] = useState(""); 
  const [checkingSession, setCheckingSession] = useState(true); 
 
  // ========================================================= 
  // CHECK EXISTING SESSION 
  // ========================================================= 
 
  useEffect(() => { 
    const checkSession = async () => { 
      try { 
        const { 
          data: { session }, 
        } = await supabase.auth.getSession(); 
 
        if (session?.user?.email) { 
          console.log("Existing patient session found."); 
          console.log("Logged in email:", session.user.email); 
 
          setExistingSessionEmail(session.user.email); 
        } 
      } catch (error) { 
        console.error("Session check failed:", error); 
      } finally { 
        setCheckingSession(false); 
      } 
    }; 
 
    checkSession(); 
  }, []); 
 
  // ========================================================= 
  // USE EXISTING SESSION 
  // ========================================================= 
 
  const continueExistingSession = async () => { 
    setLoading(true); 
    setMessage(""); 
 
    try { 
      console.log("Continuing existing patient session..."); 
 
      // Remove old hospital selection 
      localStorage.removeItem("selectedHospitalId"); 
      localStorage.removeItem("selectedHospitalName"); 
 
      // Check patient role 
      await api.post("/auth/patient-role"); 
 
      const profile = await api.get("/auth/me"); 
 
      console.log("Existing session profile:", profile.data); 
 
      if (profile.data.role !== "Patient") { 
        await supabase.auth.signOut(); 
 
        setExistingSessionEmail(""); 
 
        setMessage( 
          "This account does not have Patient access." 
        ); 
 
        return; 
      } 
 
      console.log("Existing patient verified."); 
      console.log("Redirecting to hospital selection..."); 
 
      navigate("/hospital-selection", { 
        replace: true, 
      }); 
    } catch (error) { 
      console.error( 
        "Existing patient session verification failed:", 
        error 
      ); 
 
      setMessage( 
        "Unable to verify your patient account. Please sign in again." 
      ); 
    } finally { 
      setLoading(false); 
    } 
  }; 
 
  // ========================================================= 
  // USE ANOTHER ACCOUNT 
  // ========================================================= 
 
  const useAnotherAccount = async () => { 
    try { 
      await supabase.auth.signOut(); 
 
      localStorage.removeItem("selectedHospitalId"); 
      localStorage.removeItem("selectedHospitalName"); 
 
      sessionStorage.removeItem("tempSession"); 
 
      setExistingSessionEmail(""); 
      setEmail(""); 
      setPassword(""); 
      setMessage(""); 
 
      console.log("Existing session signed out."); 
    } catch (error) { 
      console.error("Sign out failed:", error); 
 
      setMessage( 
        "Unable to sign out. Please try again." 
      ); 
    } 
  }; 
 
  // ========================================================= 
  // PATIENT LOGIN 
  // ========================================================= 
 
  const loginPatient = async (e: React.FormEvent) => { 
    e.preventDefault(); 
 
    if (!email.trim() || !password.trim()) { 
      setMessage("Please enter email and password."); 
      return; 
    } 
 
    setLoading(true); 
    setMessage(""); 
 
    try { 
      console.log("================================="); 
      console.log("STEP 1: Starting Patient login"); 
      console.log("================================="); 
 
      // ----------------------------------------------------- 
      // STEP 1: SUPABASE LOGIN 
      // ----------------------------------------------------- 
 
      const { data, error } = 
        await supabase.auth.signInWithPassword({ 
          email: email.trim(), 
          password, 
        }); 
 
      if (error || !data.user) { 
        console.error( 
          "Patient login failed:", 
          error 
        ); 
 
        setMessage( 
          error?.message || 
            "Invalid email or password." 
        ); 
 
        return; 
      } 
 
      console.log( 
        "STEP 2: Supabase login successful" 
      ); 
 
      console.log( 
        "Patient user ID:", 
        data.user.id 
      ); 
 
      console.log( 
        "Patient email:", 
        data.user.email 
      ); 
 
      // ----------------------------------------------------- 
      // STEP 2: CHECK PATIENT ROLE 
      // ----------------------------------------------------- 
 
      try { 
        await api.post("/auth/patient-role"); 
 
        const profile = await api.get("/auth/me"); 
 
        console.log( 
          "STEP 3: Backend profile:", 
          profile.data 
        ); 
 
        if (profile.data.role !== "Patient") { 
          await supabase.auth.signOut(); 
 
          setMessage( 
            "Your account does not have Patient access." 
          ); 
 
          return; 
        } 
      } catch (roleError) { 
        console.error( 
          "Patient role check failed:", 
          roleError 
        ); 
 
        await supabase.auth.signOut(); 
 
        setMessage( 
          "Unable to verify your patient account. Please try again." 
        ); 
 
        return; 
      } 
 
      // ----------------------------------------------------- 
      // STEP 3: REMEMBER ME 
      // ----------------------------------------------------- 
 
      if (!rememberMe) { 
        sessionStorage.setItem( 
          "tempSession", 
          "true" 
        ); 
      } else { 
        sessionStorage.removeItem( 
          "tempSession" 
        ); 
      } 
 
      // ----------------------------------------------------- 
      // STEP 4: REMOVE OLD HOSPITAL SELECTION 
      // ----------------------------------------------------- 
 
      localStorage.removeItem( 
        "selectedHospitalId" 
      ); 
 
      localStorage.removeItem( 
        "selectedHospitalName" 
      ); 
 
      console.log( 
        "STEP 4: Patient verified" 
      ); 
 
      console.log( 
        "STEP 5: Redirecting to hospital selection" 
      ); 
 
      // ----------------------------------------------------- 
      // STEP 5: GO TO HOSPITAL SELECTION 
      // ----------------------------------------------------- 
 
      navigate("/hospital-selection", { 
        replace: true, 
      }); 
    } catch (error) { 
      console.error( 
        "Patient login error:", 
        error 
      ); 
 
      setMessage( 
        "Unable to connect. Please make sure the backend is running." 
      ); 
    } finally { 
      setLoading(false); 
    } 
  }; 
 
  // ========================================================= 
  // SESSION CHECK LOADING 
  // ========================================================= 
 
  if (checkingSession) { 
    return ( 
      <div className="auth-page patient-auth-page"> 
        <div className="auth-shell"> 
          <section className="auth-panel auth-card"> 
            <div className="auth-card-heading"> 
              <p>Patient login</p> 
 
              <h2> 
                Checking your session... 
              </h2> 
 
              <span> 
                Please wait a moment. 
              </span> 
            </div> 
          </section> 
        </div> 
      </div> 
    ); 
  } 
 
  // ========================================================= 
  // PAGE 
  // ========================================================= 
 
  return ( 
    <div className="auth-page patient-auth-page"> 
      <div className="auth-shell"> 
 
        {/* ================================================= 
            LEFT SIDE 
        ================================================= */} 
 
        <section className="auth-panel auth-copy"> 
 
          <Link 
            to="/" 
            className="auth-brand" 
          > 
            <span className="auth-brand-mark"> 
              + 
            </span> 
 
            <span> 
              <strong> 
                Queue Care
              </strong> 
 
              <small> 
                Patient Portal 
              </small> 
            </span> 
          </Link> 
 
          <div> 
            <p className="auth-kicker"> 
              Digital token access 
            </p> 
 
            <h1> 
              Welcome back to your hospital queue. 
            </h1> 
 
            <p> 
              Sign in to access your patient 
              account. After signing in, choose 
              your hospital and continue to your 
              token dashboard. 
            </p> 
          </div> 
 
          <div className="auth-meta-grid"> 
 
            <div> 
              <strong> 
                Secure 
              </strong> 
 
              <span> 
                Supabase authentication 
              </span> 
            </div> 
 
            <div> 
              <strong> 
                Live 
              </strong> 
 
              <span> 
                Queue status refresh 
              </span> 
            </div> 
 
          </div> 
 
        </section> 
 
        {/* ================================================= 
            LOGIN CARD 
        ================================================= */} 
 
        <section className="auth-panel auth-card"> 
 
          <div className="auth-card-heading"> 
 
            <p> 
              Patient login 
            </p> 
 
            <h2> 
              Access your account 
            </h2> 
 
            <span> 
              New patient?{" "} 
              <Link to="/patient-signup"> 
                Create an account 
              </Link> 
            </span> 
 
          </div> 
 
          {/* ================================================= 
              EXISTING SESSION 
          ================================================= */} 
 
          {existingSessionEmail && ( 
            <div className="auth-alert"> 
              <strong> 
                Already signed in 
              </strong> 
 
              <br /> 
 
              <span> 
                {existingSessionEmail} 
              </span> 
 
              <div 
                style={{ 
                  display: "flex", 
                  gap: "10px", 
                  marginTop: "12px", 
                  flexWrap: "wrap", 
                }} 
              > 
                <button 
                  type="button" 
                  className="auth-submit" 
                  onClick={ 
                    continueExistingSession 
                  } 
                  disabled={loading} 
                > 
                  {loading 
                    ? "Checking..." 
                    : "Continue"} 
                </button> 
 
                <button 
                  type="button" 
                  onClick={ 
                    useAnotherAccount 
                  } 
                  disabled={loading} 
                  style={{ 
                    padding: "10px 14px", 
                    borderRadius: "8px", 
                    border: "1px solid #d1d5db", 
                    background: "#ffffff", 
                    cursor: "pointer", 
                  }} 
                > 
                  Use another account 
                </button> 
              </div> 
            </div> 
          )} 
 
          {/* ================================================= 
              LOGIN FORM 
          ================================================= */} 
 
          <form 
            className="auth-form" 
            onSubmit={loginPatient} 
          > 
 
            {/* EMAIL */} 
 
            <label> 
              Email address 
 
              <input 
                type="email" 
                required 
                placeholder="patient@example.com" 
                value={email} 
                onChange={(e) => 
                  setEmail(e.target.value) 
                } 
                disabled={loading} 
              /> 
            </label> 
 
            {/* PASSWORD */} 
 
            <label> 
              Password 
 
              <input 
                type="password" 
                required 
                placeholder="Enter your password" 
                value={password} 
                onChange={(e) => 
                  setPassword(e.target.value) 
                } 
                disabled={loading} 
              /> 
            </label> 
 
            {/* REMEMBER ME */} 
 
            <div className="auth-row"> 
 
              <label className="auth-check"> 
 
                <input 
                  type="checkbox" 
                  checked={rememberMe} 
                  onChange={(e) => 
                    setRememberMe( 
                      e.target.checked 
                    ) 
                  } 
                  disabled={loading} 
                /> 
 
                Remember me 
 
              </label> 
 
            </div> 
 
            {/* ERROR / STATUS MESSAGE */} 
 
            {message && ( 
              <div className="auth-alert"> 
                {message} 
              </div> 
            )} 
 
            {/* LOGIN BUTTON */} 
 
            <button 
              type="submit" 
              disabled={loading} 
              className="auth-submit" 
            > 
              {loading 
                ? "Signing in..." 
                : "Sign in"} 
            </button> 
 
          </form> 
 
          {/* BACK TO HOME */} 
 
          <Link 
            to="/" 
            className="auth-back" 
          > 
            Back to home 
          </Link> 
 
        </section> 
 
      </div> 
    </div> 
  ); 
} 
 
export default PatientLogin; 