import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./App.css";

import Home from "./pages/Home";
import PatientSignup from "./pages/PatientSignup";
import PatientLogin from "./pages/PatientLogin";
import PatientDashboard from "./pages/PatientDashboard";
import NurseLogin from "./pages/Nurselogin";
import NurseDashboard from "./pages/NurseDashboard";

function App() {
  return (
    <BrowserRouter>
      <Routes>

        {/* Home */}
        <Route path="/" element={<Home />} />

        {/* Patient */}
        <Route path="/patient-login" element={<PatientLogin />} />
        <Route path="/patient-signup" element={<PatientSignup />} />
        <Route path="/patient" element={<PatientDashboard />} />

        {/* Nurse */}
        <Route path="/nurse-login" element={<NurseLogin />} />
        <Route path="/nurse" element={<NurseDashboard />} />

      </Routes>
    </BrowserRouter>
  );
}

export default App;