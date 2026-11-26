import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api";

type Hospital = {
  id: number;
  name: string;
  code: string;
  address?: string;
  phone?: string;
  email?: string;
};

function HospitalSelection() {
  const navigate = useNavigate();

  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  // ==========================================
  // LOAD HOSPITALS
  // ==========================================

  useEffect(() => {
    fetchHospitals();
  }, []);

  const fetchHospitals = async () => {
    setLoading(true);
    setMessage("");

    try {
      console.log("Loading available hospitals...");

      const response = await api.get("/public/hospitals");

      console.log("Hospitals:", response.data);

      setHospitals(response.data);
    } catch (error) {
      console.error("Unable to load hospitals:", error);

      setMessage(
        "Unable to load hospitals. Please check the backend server."
      );
    } finally {
      setLoading(false);
    }
  };

  // ==========================================
  // SELECT HOSPITAL
  // ==========================================

  const handleSelect = (hospital: Hospital) => {
    console.log("==========================================");
    console.log("HOSPITAL SELECTED");
    console.log("Hospital ID:", hospital.id);
    console.log("Hospital Name:", hospital.name);
    console.log("Hospital Code:", hospital.code);
    console.log("==========================================");

    // ------------------------------------------
    // SAVE SELECTED HOSPITAL
    // ------------------------------------------

    localStorage.setItem(
      "selectedHospitalId",
      String(hospital.id)
    );

    localStorage.setItem(
      "selectedHospitalName",
      hospital.name
    );

    // ------------------------------------------
    // GO DIRECTLY TO PATIENT DASHBOARD
    // ------------------------------------------

    console.log(
      "Hospital saved. Redirecting to Patient Dashboard..."
    );

    navigate("/patient", { replace: true });
  };

  // ==========================================
  // SEARCH / FILTER HOSPITALS
  // ==========================================

  const filteredHospitals = useMemo(() => {
    const value = search.trim().toLowerCase();

    if (!value) {
      return hospitals;
    }

    return hospitals.filter((hospital) =>
      [
        hospital.name,
        hospital.code,
        hospital.address,
      ]
        .filter(Boolean)
        .some((field) =>
          field!.toLowerCase().includes(value)
        )
    );
  }, [hospitals, search]);

  // ==========================================
  // PAGE
  // ==========================================

  return (
    <div className="selection-page">

      {/* ======================================
          HEADER
      ====================================== */}

      <header className="selection-header">

        <Link
          to="/"
          className="auth-brand"
        >

          <span className="auth-brand-mark">
            +
          </span>

          <span>
            <strong>
              Queue Care Hospital
            </strong>

            <small>
              Hospital Network
            </small>
          </span>

        </Link>

        <Link
          to="/"
          className="auth-back"
        >
          Back to home
        </Link>

      </header>


      {/* ======================================
          MAIN
      ====================================== */}

      <main className="selection-layout">

        {/* ====================================
            INTRO
        ==================================== */}

        <section className="selection-intro">

          <p className="auth-kicker">
            Choose care location
          </p>

          <h1>
            Select your hospital
          </h1>

          <p>
            Choose the hospital where you want
            to manage your patient token and
            consultation queue.
          </p>


          {/* SEARCH */}

          <div className="selection-search">

            <input
              type="search"
              placeholder="Search by hospital name, code, or address"
              value={search}
              onChange={(e) =>
                setSearch(e.target.value)
              }
            />

          </div>

        </section>


        {/* ====================================
            HOSPITAL LIST
        ==================================== */}

        <section className="selection-grid">

          <div className="hospital-list-panel">

            {/* PANEL HEADER */}

            <div className="panel-title-row">

              <div>

                <p>
                  Available hospitals
                </p>

                <h2>
                  {filteredHospitals.length}{" "}
                  {filteredHospitals.length === 1
                    ? "location"
                    : "locations"}
                </h2>

              </div>

              <button
                onClick={fetchHospitals}
                disabled={loading}
                type="button"
              >
                {loading
                  ? "Loading..."
                  : "Refresh"}
              </button>

            </div>


            {/* MESSAGE */}

            {message && (
              <div className="auth-alert">
                {message}
              </div>
            )}


            {/* LOADING */}

            {loading ? (

              <div className="empty-state">
                Loading hospitals...
              </div>

            ) : filteredHospitals.length === 0 ? (

              <div className="empty-state">

                {search.trim()
                  ? "No hospitals match your search."
                  : "No hospitals found."}

              </div>

            ) : (

              /* =================================
                 HOSPITALS
              ================================= */

              <div className="hospital-list">

                {filteredHospitals.map(
                  (hospital) => (

                    <button
                      className="hospital-option"
                      key={hospital.id}
                      onClick={() =>
                        handleSelect(hospital)
                      }
                      type="button"
                    >

                      {/* ICON */}

                      <span className="hospital-icon">
                        +
                      </span>


                      {/* DETAILS */}

                      <span>

                        <strong>
                          {hospital.name}
                        </strong>

                        <small>

                          {hospital.address ||
                            hospital.code}

                          {hospital.phone
                            ? ` | ${hospital.phone}`
                            : ""}

                        </small>

                      </span>


                      {/* SELECT */}

                      <b>
                        Select
                      </b>

                    </button>

                  )
                )}

              </div>

            )}

          </div>

        </section>

      </main>

    </div>
  );
}

export default HospitalSelection;