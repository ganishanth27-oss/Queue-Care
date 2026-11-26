import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { supabase } from "../supabaseClient";
import { API_URL } from "../api";

/* =========================================================
   TYPES
========================================================= */

interface Hospital {
  id: number;
  name: string;
  code: string;
  logo?: string;
  address?: string;
  phone?: string;
  email?: string;
  status?: string;
}

interface Nurse {
  id: number;
  user_id: string;
  role: string;
  hospital_id?: number | null;
  hospital_name?: string | null;
}

interface Doctor {
  id: number;
  user_id: string;
  role: string;
  hospital_id?: number | null;
  hospital_name?: string | null;
  department?: string | null;
}

interface Department {
  id: number;
  name: string;
  code?: string;
  hospital_id?: number;
  hospital_name?: string | null;
}

/* =========================================================
   COMPONENT
========================================================= */

function SuperAdminDashboard() {
  const navigate = useNavigate();

  /* =======================================================
     DATA
  ======================================================= */

  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [nurses, setNurses] = useState<Nurse[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);

  /* =======================================================
     LOADING STATES
  ======================================================= */

  const [loading, setLoading] = useState(true);

  const [creatingHospital, setCreatingHospital] =
    useState(false);

  const [creatingNurse, setCreatingNurse] =
    useState(false);

  const [creatingDoctor, setCreatingDoctor] =
    useState(false);

  const [creatingDepartment, setCreatingDepartment] =
    useState(false);

  /* =======================================================
     ERROR
  ======================================================= */

  const [error, setError] = useState("");

  /* =======================================================
     HOSPITAL FORM
  ======================================================= */

  const [hospitalName, setHospitalName] =
    useState("");

  const [hospitalCode, setHospitalCode] =
    useState("");

  const [hospitalAddress, setHospitalAddress] =
    useState("");

  const [hospitalPhone, setHospitalPhone] =
    useState("");

  const [hospitalEmail, setHospitalEmail] =
    useState("");

  /* =======================================================
     NURSE FORM
  ======================================================= */

  const [nurseEmail, setNurseEmail] =
    useState("");

  const [nursePassword, setNursePassword] =
    useState("");

  const [nurseHospitalId, setNurseHospitalId] =
    useState("");

  /* =======================================================
     DOCTOR FORM
  ======================================================= */

  const [doctorEmail, setDoctorEmail] =
    useState("");

  const [doctorPassword, setDoctorPassword] =
    useState("");

  const [doctorHospitalId, setDoctorHospitalId] =
    useState("");

  const [doctorDepartment, setDoctorDepartment] =
    useState("");

  /* =======================================================
     DEPARTMENT FORM
  ======================================================= */

  const [departmentName, setDepartmentName] =
    useState("");

  const [departmentCode, setDepartmentCode] =
    useState("");

  const [departmentHospitalId, setDepartmentHospitalId] =
    useState("");

  /* =======================================================
     INITIAL LOAD
  ======================================================= */

  useEffect(() => {
    checkAdmin();
  }, []);

  /* =======================================================
     CHECK SUPER ADMIN
  ======================================================= */

  const checkAdmin = async () => {
    try {
      setLoading(true);
      setError("");

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        navigate("/super-admin-login");
        return;
      }

      const response = await axios.get(
        `${API_URL}/auth/me`,
        {
          headers: {
            Authorization:
              `Bearer ${session.access_token}`,
          },
        }
      );

      if (response.data.role !== "Super Admin") {
        await supabase.auth.signOut();

        alert("Super Admin access required.");

        navigate("/super-admin-login");

        return;
      }

      await loadData(session.access_token);

    } catch (err: any) {
      console.error(
        "SUPER ADMIN CHECK ERROR:",
        err
      );

      if (err.response?.status === 401) {
        await supabase.auth.signOut();

        navigate("/super-admin-login");

        return;
      }

      setError(
        err.response?.data?.detail ||
          "Unable to verify Super Admin access."
      );

    } finally {
      setLoading(false);
    }
  };

  /* =======================================================
     LOAD DATA
  ======================================================= */

  const loadData = async (
    accessToken: string
  ) => {
    const headers = {
      Authorization:
        `Bearer ${accessToken}`,
    };

    /* =====================================================
       HOSPITALS
    ===================================================== */

    try {
      const hospitalsResponse =
        await axios.get(
          `${API_URL}/hospitals`,
          {
            headers,
          }
        );

      setHospitals(
        hospitalsResponse.data
      );

    } catch (hospitalError) {
      console.error(
        "HOSPITAL API ERROR:",
        hospitalError
      );

      throw new Error(
        "Unable to load hospitals."
      );
    }

    /* =====================================================
       NURSES
    ===================================================== */

    try {
      const nursesResponse =
        await axios.get(
          `${API_URL}/admin/nurses`,
          {
            headers,
          }
        );

      setNurses(
        nursesResponse.data
      );

    } catch (nurseError) {
      console.warn(
        "Nurse API is not available:",
        nurseError
      );

      setNurses([]);
    }

    /* =====================================================
       DOCTORS
    ===================================================== */

    try {
      const doctorsResponse =
        await axios.get(
          `${API_URL}/admin/doctors`,
          {
            headers,
          }
        );

      setDoctors(
        doctorsResponse.data
      );

    } catch (doctorError) {
      console.warn(
        "Doctor API is not available yet:",
        doctorError
      );

      setDoctors([]);
    }

    /* =====================================================
       DEPARTMENTS
    ===================================================== */

    try {
      const departmentsResponse =
        await axios.get(
          `${API_URL}/admin/departments`,
          {
            headers,
          }
        );

      setDepartments(
        departmentsResponse.data
      );

    } catch (departmentError) {
      console.warn(
        "Department API is not available:",
        departmentError
      );

      setDepartments([]);
    }
  };

  /* =======================================================
     GET ACCESS TOKEN
  ======================================================= */

  const getAccessToken = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      navigate("/super-admin-login");

      return null;
    }

    return session.access_token;
  };

  /* =======================================================
     CREATE HOSPITAL
  ======================================================= */

  const createHospital = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();

    if (!hospitalName.trim()) {
      setError(
        "Hospital name is required."
      );

      return;
    }

    try {
      setCreatingHospital(true);
      setError("");

      const token =
        await getAccessToken();

      if (!token) {
        return;
      }

      const generatedCode =
        hospitalName
          .trim()
          .toUpperCase()
          .replace(
            /[^A-Z0-9]+/g,
            "-"
          )
          .replace(
            /^-|-$/g,
            ""
          )
          .substring(
            0,
            20
          );

      await axios.post(
        `${API_URL}/hospitals`,
        {
          name:
            hospitalName.trim(),

          code:
            hospitalCode.trim() ||
            generatedCode,

          address:
            hospitalAddress.trim(),

          phone:
            hospitalPhone.trim(),

          email:
            hospitalEmail.trim(),
        },
        {
          headers: {
            Authorization:
              `Bearer ${token}`,
          },
        }
      );

      setHospitalName("");
      setHospitalCode("");
      setHospitalAddress("");
      setHospitalPhone("");
      setHospitalEmail("");

      const updatedHospitals =
        await axios.get(
          `${API_URL}/hospitals`,
          {
            headers: {
              Authorization:
                `Bearer ${token}`,
            },
          }
        );

      setHospitals(
        updatedHospitals.data
      );

      alert(
        "Hospital created successfully."
      );

    } catch (err: any) {
      console.error(
        "CREATE HOSPITAL ERROR:",
        err
      );

      setError(
        err.response?.data?.detail ||
          "Unable to create hospital."
      );

    } finally {
      setCreatingHospital(false);
    }
  };

  /* =======================================================
     CREATE NURSE
  ======================================================= */

  const createNurse = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();

    if (!nurseEmail.trim()) {
      setError(
        "Nurse email is required."
      );

      return;
    }

    if (!nursePassword) {
      setError(
        "Nurse password is required."
      );

      return;
    }

    if (!nurseHospitalId) {
      setError(
        "Please select a hospital for the nurse."
      );

      return;
    }

    try {
      setCreatingNurse(true);
      setError("");

      const token =
        await getAccessToken();

      if (!token) {
        return;
      }

      await axios.post(
        `${API_URL}/admin/nurses`,
        {
          email:
            nurseEmail.trim(),

          password:
            nursePassword,

          hospital_id:
            Number(
              nurseHospitalId
            ),
        },
        {
          headers: {
            Authorization:
              `Bearer ${token}`,
          },
        }
      );

      setNurseEmail("");
      setNursePassword("");
      setNurseHospitalId("");

      try {
        const updatedNurses =
          await axios.get(
            `${API_URL}/admin/nurses`,
            {
              headers: {
                Authorization:
                  `Bearer ${token}`,
              },
            }
          );

        setNurses(
          updatedNurses.data
        );

      } catch {
        // Nurse was created successfully.
      }

      alert(
        "Nurse account created successfully."
      );

    } catch (err: any) {
      console.error(
        "CREATE NURSE ERROR:",
        err
      );

      setError(
        err.response?.data?.detail ||
          "Unable to create nurse."
      );

    } finally {
      setCreatingNurse(false);
    }
  };

  /* =======================================================
     CREATE DOCTOR
  ======================================================= */

  const createDoctor = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();

    if (!doctorEmail.trim()) {
      setError(
        "Doctor email is required."
      );

      return;
    }

    if (!doctorPassword) {
      setError(
        "Doctor password is required."
      );

      return;
    }

    if (!doctorHospitalId) {
      setError(
        "Please select a hospital for the doctor."
      );

      return;
    }

    if (!doctorDepartment.trim()) {
      setError(
        "Please select a department for the doctor."
      );

      return;
    }

    try {
      setCreatingDoctor(true);
      setError("");

      const token =
        await getAccessToken();

      if (!token) {
        return;
      }

      await axios.post(
        `${API_URL}/admin/doctors`,
        {
          email:
            doctorEmail.trim(),

          password:
            doctorPassword,

          hospital_id:
            Number(
              doctorHospitalId
            ),

          department:
            doctorDepartment.trim(),
        },
        {
          headers: {
            Authorization:
              `Bearer ${token}`,
          },
        }
      );

      setDoctorEmail("");
      setDoctorPassword("");
      setDoctorHospitalId("");
      setDoctorDepartment("");

      try {
        const updatedDoctors =
          await axios.get(
            `${API_URL}/admin/doctors`,
            {
              headers: {
                Authorization:
                  `Bearer ${token}`,
              },
            }
          );

        setDoctors(
          updatedDoctors.data
        );

      } catch {
        // Doctor was created successfully.
      }

      alert(
        "Doctor account created successfully."
      );

    } catch (err: any) {
      console.error(
        "CREATE DOCTOR ERROR:",
        err
      );

      setError(
        err.response?.data?.detail ||
          "Unable to create doctor."
      );

    } finally {
      setCreatingDoctor(false);
    }
  };

  /* =======================================================
     CREATE DEPARTMENT
  ======================================================= */

  const createDepartment = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();

    if (!departmentHospitalId) {
      setError(
        "Please select a hospital for the department."
      );

      return;
    }

    if (!departmentName.trim()) {
      setError(
        "Department name is required."
      );

      return;
    }

    if (!departmentCode.trim()) {
      setError(
        "Department code is required."
      );

      return;
    }

    try {
      setCreatingDepartment(true);
      setError("");

      const token =
        await getAccessToken();

      if (!token) {
        return;
      }

      await axios.post(
        `${API_URL}/admin/departments`,
        {
          hospital_id:
            Number(
              departmentHospitalId
            ),

          name:
            departmentName.trim(),

          code:
            departmentCode
              .trim()
              .toUpperCase(),
        },
        {
          headers: {
            Authorization:
              `Bearer ${token}`,
          },
        }
      );

      setDepartmentName("");
      setDepartmentCode("");
      setDepartmentHospitalId("");

      /* -----------------------------------------------
         REFRESH DEPARTMENTS
      ------------------------------------------------ */

      const updatedDepartments =
        await axios.get(
          `${API_URL}/admin/departments`,
          {
            headers: {
              Authorization:
                `Bearer ${token}`,
            },
          }
        );

      setDepartments(
        updatedDepartments.data
      );

      alert(
        "Department added successfully."
      );

    } catch (err: any) {
      console.error(
        "CREATE DEPARTMENT ERROR:",
        err
      );

      setError(
        err.response?.data?.detail ||
          "Unable to create department."
      );

    } finally {
      setCreatingDepartment(false);
    }
  };

  /* =======================================================
     LOGOUT
  ======================================================= */

  const logout = async () => {
    await supabase.auth.signOut();

    navigate(
      "/super-admin-login"
    );
  };

  /* =======================================================
     GET DEPARTMENTS FOR DOCTOR HOSPITAL
  ======================================================= */

  const selectedHospitalDepartments =
    departments.filter(
      (department) =>
        Number(
          department.hospital_id
        ) ===
        Number(
          doctorHospitalId
        )
    );


  /* =======================================================
     LOADING
  ======================================================= */

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f4f7fb",
          fontSize: "18px",
          color: "#475467",
        }}
      >
        Loading Super Admin Dashboard...
      </div>
    );
  }

  /* =======================================================
     UI
  ======================================================= */

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f4f7fb",
      }}
    >

      {/* =================================================
          HEADER
      ================================================= */}

      <header
        style={{
          background: "#ffffff",
          borderBottom:
            "1px solid #e4e7ec",
          padding:
            "18px 30px",
          display: "flex",
          alignItems: "center",
          justifyContent:
            "space-between",
          gap: "20px",
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: "24px",
              color: "#101828",
            }}
          >
            Queue Care Hospital
          </h1>

          <p
            style={{
              margin:
                "5px 0 0",
              color: "#667085",
              fontSize: "14px",
            }}
          >
            Super Admin Dashboard
          </p>
        </div>

        <button
          onClick={logout}
          style={{
            border: "none",
            background: "#fff1f1",
            color: "#c62828",
            padding:
              "10px 18px",
            borderRadius: "8px",
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          Logout
        </button>
      </header>

      {/* =================================================
          MAIN
      ================================================= */}

      <main
        style={{
          maxWidth: "1200px",
          margin: "0 auto",
          padding:
            "30px 20px",
        }}
      >

        {/* ERROR */}

        {error && (
          <div
            style={{
              background: "#fff1f1",
              color: "#c62828",
              padding:
                "14px 16px",
              borderRadius: "8px",
              marginBottom:
                "24px",
              border:
                "1px solid #ffd5d5",
            }}
          >
            {error}

            <button
              onClick={() =>
                setError("")
              }
              style={{
                float: "right",
                border: "none",
                background:
                  "transparent",
                color: "#c62828",
                cursor: "pointer",
                fontWeight: 700,
              }}
            >
              ×
            </button>
          </div>
        )}

        {/* =================================================
            STATISTICS
        ================================================= */}

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "18px",
            marginBottom:
              "30px",
          }}
        >

          <div
            style={statCardStyle}
          >
            <p
              style={statLabelStyle}
            >
              Total Hospitals
            </p>

            <h2
              style={{
                ...statNumberStyle,
                color: "#1769e0",
              }}
            >
              {hospitals.length}
            </h2>
          </div>

          <div
            style={statCardStyle}
          >
            <p
              style={statLabelStyle}
            >
              Total Nurses
            </p>

            <h2
              style={{
                ...statNumberStyle,
                color: "#027a48",
              }}
            >
              {nurses.length}
            </h2>
          </div>

          <div
            style={statCardStyle}
          >
            <p
              style={statLabelStyle}
            >
              Total Doctors
            </p>

            <h2
              style={{
                ...statNumberStyle,
                color: "#7f56d9",
              }}
            >
              {doctors.length}
            </h2>
          </div>

          <div
            style={statCardStyle}
          >
            <p
              style={statLabelStyle}
            >
              Total Departments
            </p>

            <h2
              style={{
                ...statNumberStyle,
                color: "#d97706",
              }}
            >
              {departments.length}
            </h2>
          </div>

        </div>

        {/* =================================================
            CREATE HOSPITAL
        ================================================= */}

        <section
          style={sectionStyle}
        >
          <h2
            style={sectionTitleStyle}
          >
            Create Hospital
          </h2>

          <p
            style={sectionDescriptionStyle}
          >
            Add a hospital to the Queue Care Hospital system.
          </p>

          <form
            onSubmit={
              createHospital
            }
          >
            <div
              style={formGridStyle}
            >

              <input
                type="text"
                placeholder="Hospital name"
                value={
                  hospitalName
                }
                onChange={(e) =>
                  setHospitalName(
                    e.target.value
                  )
                }
                required
                style={inputStyle}
              />

              <input
                type="text"
                placeholder="Hospital code"
                value={
                  hospitalCode
                }
                onChange={(e) =>
                  setHospitalCode(
                    e.target.value
                  )
                }
                style={inputStyle}
              />

              <input
                type="text"
                placeholder="Address"
                value={
                  hospitalAddress
                }
                onChange={(e) =>
                  setHospitalAddress(
                    e.target.value
                  )
                }
                style={inputStyle}
              />

              <input
                type="text"
                placeholder="Phone"
                value={
                  hospitalPhone
                }
                onChange={(e) =>
                  setHospitalPhone(
                    e.target.value
                  )
                }
                style={inputStyle}
              />

              <input
                type="email"
                placeholder="Email"
                value={
                  hospitalEmail
                }
                onChange={(e) =>
                  setHospitalEmail(
                    e.target.value
                  )
                }
                style={inputStyle}
              />

            </div>

            <button
              type="submit"
              disabled={
                creatingHospital
              }
              style={{
                ...primaryButtonStyle,
                opacity:
                  creatingHospital
                    ? 0.7
                    : 1,
              }}
            >
              {creatingHospital
                ? "Creating..."
                : "Create Hospital"}
            </button>
          </form>
        </section>

        {/* =================================================
            HOSPITALS
        ================================================= */}

        <section
          style={sectionStyle}
        >
          <h2
            style={sectionTitleStyle}
          >
            Hospitals
          </h2>

          {hospitals.length ===
          0 ? (
            <p
              style={{
                color: "#667085",
              }}
            >
              No hospitals created yet.
            </p>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(260px, 1fr))",
                gap: "15px",
              }}
            >
              {hospitals.map(
                (hospital) => (
                  <div
                    key={
                      hospital.id
                    }
                    style={{
                      border:
                        "1px solid #eaecf0",
                      borderRadius:
                        "10px",
                      padding:
                        "18px",
                      background:
                        "#ffffff",
                    }}
                  >
                    <h3
                      style={{
                        margin:
                          "0 0 8px",
                        color:
                          "#101828",
                      }}
                    >
                      {hospital.name}
                    </h3>

                    <p
                      style={{
                        margin:
                          "5px 0",
                        color:
                          "#667085",
                      }}
                    >
                      Code:{" "}
                      {hospital.code}
                    </p>

                    {hospital.address && (
                      <p
                        style={{
                          margin:
                            "5px 0",
                          color:
                            "#667085",
                        }}
                      >
                        {
                          hospital.address
                        }
                      </p>
                    )}

                    <span
                      style={{
                        display:
                          "inline-block",
                        marginTop:
                          "8px",
                        background:
                          "#ecfdf3",
                        color:
                          "#027a48",
                        padding:
                          "5px 10px",
                        borderRadius:
                          "20px",
                        fontSize:
                          "12px",
                        fontWeight:
                          600,
                      }}
                    >
                      {hospital.status ||
                        "Active"}
                    </span>
                  </div>
                )
              )}
            </div>
          )}
        </section>

        {/* =================================================
            ADD DEPARTMENT
        ================================================= */}

        <section
          style={{
            ...sectionStyle,
            border:
              "1px solid #fedf89",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems:
                "center",
              justifyContent:
                "space-between",
              gap: "15px",
              flexWrap: "wrap",
              marginBottom:
                "8px",
            }}
          >
            <div>
              <h2
                style={{
                  ...sectionTitleStyle,
                  marginBottom:
                    "5px",
                }}
              >
                Departments
              </h2>

              <p
                style={{
                  margin: 0,
                  color:
                    "#667085",
                  fontSize:
                    "14px",
                }}
              >
                Add more departments to any hospital.
              </p>
            </div>

            <span
              style={{
                background:
                  "#fffaeb",
                color:
                  "#b54708",
                padding:
                  "7px 12px",
                borderRadius:
                  "20px",
                fontSize:
                  "12px",
                fontWeight: 700,
              }}
            >
              {departments.length} Departments
            </span>
          </div>

          {/* ADD DEPARTMENT FORM */}

          <form
            onSubmit={
              createDepartment
            }
            style={{
              marginTop:
                "20px",
            }}
          >
            <div
              style={formGridStyle}
            >

              {/* HOSPITAL */}

              <select
                value={
                  departmentHospitalId
                }
                onChange={(e) => {
                  setDepartmentHospitalId(
                    e.target.value
                  );
                }}
                required
                style={inputStyle}
              >
                <option value="">
                  Select Hospital
                </option>

                {hospitals.map(
                  (hospital) => (
                    <option
                      key={
                        hospital.id
                      }
                      value={
                        hospital.id
                      }
                    >
                      {hospital.name}
                    </option>
                  )
                )}
              </select>

              {/* NAME */}

              <input
                type="text"
                placeholder="Department name"
                value={
                  departmentName
                }
                onChange={(e) =>
                  setDepartmentName(
                    e.target.value
                  )
                }
                required
                style={inputStyle}
              />

              {/* CODE */}

              <input
                type="text"
                placeholder="Department code e.g. NEU"
                value={
                  departmentCode
                }
                onChange={(e) =>
                  setDepartmentCode(
                    e.target.value
                      .toUpperCase()
                  )
                }
                required
                maxLength={10}
                style={inputStyle}
              />

            </div>

            <button
              type="submit"
              disabled={
                creatingDepartment
              }
              style={{
                ...primaryButtonStyle,
                background:
                  "#d97706",
                opacity:
                  creatingDepartment
                    ? 0.7
                    : 1,
              }}
            >
              {creatingDepartment
                ? "Adding Department..."
                : "+ Add Department"}
            </button>
          </form>

          {/* EXISTING DEPARTMENTS */}

          <div
            style={{
              marginTop:
                "25px",
            }}
          >
            <h3
              style={{
                margin:
                  "0 0 15px",
                color:
                  "#344054",
                fontSize:
                  "16px",
              }}
            >
              Existing Departments
            </h3>

            {departments.length ===
            0 ? (
              <div
                style={{
                  padding:
                    "20px",
                  background:
                    "#f9fafb",
                  border:
                    "1px dashed #d0d5dd",
                  borderRadius:
                    "10px",
                  color:
                    "#667085",
                  textAlign:
                    "center",
                }}
              >
                No departments found.
              </div>
            ) : (
              <div
                style={{
                  display:
                    "grid",
                  gridTemplateColumns:
                    "repeat(auto-fit, minmax(240px, 1fr))",
                  gap:
                    "12px",
                }}
              >
                {departments.map(
                  (department) => (
                    <div
                      key={
                        department.id
                      }
                      style={{
                        border:
                          "1px solid #eaecf0",
                        borderRadius:
                          "10px",
                        padding:
                          "15px",
                        background:
                          "#ffffff",
                        display:
                          "flex",
                        alignItems:
                          "center",
                        justifyContent:
                          "space-between",
                        gap:
                          "10px",
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontWeight:
                              600,
                            color:
                              "#101828",
                          }}
                        >
                          {
                            department.name
                          }
                        </div>

                        <div
                          style={{
                            marginTop:
                              "4px",
                            color:
                              "#667085",
                            fontSize:
                              "13px",
                          }}
                        >
                          Hospital:{" "}
                          {
                            department.hospital_name ||
                            "Not assigned"
                          }
                        </div>
                      </div>

                      <span
                        style={{
                          background:
                            "#eef4ff",
                          color:
                            "#175cd3",
                          padding:
                            "5px 9px",
                          borderRadius:
                            "15px",
                          fontSize:
                            "12px",
                          fontWeight:
                            700,
                          whiteSpace:
                            "nowrap",
                        }}
                      >
                        {
                          department.code ||
                          "CODE"
                        }
                      </span>
                    </div>
                  )
                )}
              </div>
            )}
          </div>
        </section>

        {/* =================================================
            CREATE NURSE
        ================================================= */}

        <section
          style={sectionStyle}
        >
          <h2
            style={sectionTitleStyle}
          >
            Create Nurse Account
          </h2>

          <p
            style={sectionDescriptionStyle}
          >
            Create a nurse login and assign the nurse to a hospital.
          </p>

          <form
            onSubmit={
              createNurse
            }
          >
            <div
              style={formGridStyle}
            >

              <input
                type="email"
                placeholder="Nurse email"
                value={
                  nurseEmail
                }
                onChange={(e) =>
                  setNurseEmail(
                    e.target.value
                  )
                }
                required
                style={inputStyle}
              />

              <input
                type="password"
                placeholder="Nurse password"
                value={
                  nursePassword
                }
                onChange={(e) =>
                  setNursePassword(
                    e.target.value
                  )
                }
                required
                minLength={6}
                style={inputStyle}
              />

              <select
                value={
                  nurseHospitalId
                }
                onChange={(e) =>
                  setNurseHospitalId(
                    e.target.value
                  )
                }
                required
                style={inputStyle}
              >
                <option value="">
                  Select Hospital
                </option>

                {hospitals.map(
                  (hospital) => (
                    <option
                      key={
                        hospital.id
                      }
                      value={
                        hospital.id
                      }
                    >
                      {hospital.name}
                    </option>
                  )
                )}
              </select>

            </div>

            <button
              type="submit"
              disabled={
                creatingNurse
              }
              style={{
                ...primaryButtonStyle,
                opacity:
                  creatingNurse
                    ? 0.7
                    : 1,
              }}
            >
              {creatingNurse
                ? "Creating Nurse..."
                : "Create Nurse"}
            </button>
          </form>
        </section>

        {/* =================================================
            NURSES
        ================================================= */}

        <section
          style={sectionStyle}
        >
          <h2
            style={sectionTitleStyle}
          >
            Nurses
          </h2>

          {nurses.length ===
          0 ? (
            <p
              style={{
                color: "#667085",
              }}
            >
              No nurses found yet.
            </p>
          ) : (
            <div
              style={{
                overflowX:
                  "auto",
              }}
            >
              <table
                style={{
                  width: "100%",
                  borderCollapse:
                    "collapse",
                }}
              >
                <thead>
                  <tr>
                    <th
                      style={
                        tableHeaderStyle
                      }
                    >
                      Nurse ID
                    </th>

                    <th
                      style={
                        tableHeaderStyle
                      }
                    >
                      Role
                    </th>

                    <th
                      style={
                        tableHeaderStyle
                      }
                    >
                      Hospital
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {nurses.map(
                    (nurse) => (
                      <tr
                        key={
                          nurse.id
                        }
                      >
                        <td
                          style={
                            tableCellStyle
                          }
                        >
                          {
                            nurse.user_id
                          }
                        </td>

                        <td
                          style={
                            tableCellStyle
                          }
                        >
                          <span
                            style={{
                              background:
                                "#eef4ff",
                              color:
                                "#175cd3",
                              padding:
                                "5px 9px",
                              borderRadius:
                                "15px",
                              fontSize:
                                "12px",
                              fontWeight:
                                600,
                            }}
                          >
                            {
                              nurse.role
                            }
                          </span>
                        </td>

                        <td
                          style={
                            tableCellStyle
                          }
                        >
                          {
                            nurse.hospital_name ||
                            "Not assigned"
                          }
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* =================================================
            CREATE DOCTOR
        ================================================= */}

        <section
          style={{
            ...sectionStyle,
            border:
              "1px solid #d9d6fe",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems:
                "center",
              gap: "12px",
              marginBottom:
                "8px",
            }}
          >
            <div
              style={{
                width: "42px",
                height: "42px",
                borderRadius:
                  "10px",
                background:
                  "#f4f3ff",
                display: "flex",
                alignItems:
                  "center",
                justifyContent:
                  "center",
                fontSize:
                  "22px",
              }}
            >
              🩺
            </div>

            <h2
              style={{
                ...sectionTitleStyle,
                margin: 0,
              }}
            >
              Create Doctor Account
            </h2>
          </div>

          <p
            style={
              sectionDescriptionStyle
            }
          >
            Create a doctor login and assign the doctor to a hospital and department.
          </p>

          <form
            onSubmit={
              createDoctor
            }
          >
            <div
              style={formGridStyle}
            >

              <input
                type="email"
                placeholder="Doctor email"
                value={
                  doctorEmail
                }
                onChange={(e) =>
                  setDoctorEmail(
                    e.target.value
                  )
                }
                required
                style={inputStyle}
              />

              <input
                type="password"
                placeholder="Doctor password"
                value={
                  doctorPassword
                }
                onChange={(e) =>
                  setDoctorPassword(
                    e.target.value
                  )
                }
                required
                minLength={6}
                style={inputStyle}
              />

              <select
                value={
                  doctorHospitalId
                }
                onChange={(e) => {
                  setDoctorHospitalId(
                    e.target.value
                  );

                  setDoctorDepartment(
                    ""
                  );
                }}
                required
                style={inputStyle}
              >
                <option value="">
                  Select Hospital
                </option>

                {hospitals.map(
                  (hospital) => (
                    <option
                      key={
                        hospital.id
                      }
                      value={
                        hospital.id
                      }
                    >
                      {hospital.name}
                    </option>
                  )
                )}
              </select>

              <select
                value={
                  doctorDepartment
                }
                onChange={(e) =>
                  setDoctorDepartment(
                    e.target.value
                  )
                }
                required
                disabled={
                  !doctorHospitalId
                }
                style={{
                  ...inputStyle,
                  background:
                    doctorHospitalId
                      ? "#ffffff"
                      : "#f2f4f7",
                  cursor:
                    doctorHospitalId
                      ? "pointer"
                      : "not-allowed",
                }}
              >
                <option value="">
                  {doctorHospitalId
                    ? "Select Department"
                    : "Select Hospital First"}
                </option>

                {selectedHospitalDepartments.map(
                  (
                    department
                  ) => (
                    <option
                      key={
                        department.id
                      }
                      value={
                        department.name
                      }
                    >
                      {
                        department.name
                      }
                    </option>
                  )
                )}
              </select>

            </div>

            <div
              style={{
                marginTop:
                  "16px",
                padding:
                  "12px 14px",
                background:
                  "#f9f8ff",
                border:
                  "1px solid #e9e7ff",
                borderRadius:
                  "8px",
                color:
                  "#6941c6",
                fontSize:
                  "13px",
              }}
            >
              The doctor will only be able to access the queue of the selected hospital and department.
            </div>

            <button
              type="submit"
              disabled={
                creatingDoctor
              }
              style={{
                ...primaryButtonStyle,
                background:
                  "#7f56d9",
                opacity:
                  creatingDoctor
                    ? 0.7
                    : 1,
              }}
            >
              {creatingDoctor
                ? "Creating Doctor..."
                : "Create Doctor"}
            </button>
          </form>
        </section>

        {/* =================================================
            DOCTORS
        ================================================= */}

        <section
          style={sectionStyle}
        >
          <div
            style={{
              display: "flex",
              alignItems:
                "center",
              justifyContent:
                "space-between",
              gap: "15px",
              marginBottom:
                "18px",
              flexWrap:
                "wrap",
            }}
          >
            <div>
              <h2
                style={{
                  ...sectionTitleStyle,
                  marginBottom:
                    "5px",
                }}
              >
                Doctors
              </h2>

              <p
                style={{
                  margin: 0,
                  color:
                    "#667085",
                  fontSize:
                    "14px",
                }}
              >
                Manage doctors assigned to hospitals and departments.
              </p>
            </div>

            <span
              style={{
                background:
                  "#f4f3ff",
                color:
                  "#6941c6",
                padding:
                  "7px 12px",
                borderRadius:
                  "20px",
                fontSize:
                  "12px",
                fontWeight:
                  700,
              }}
            >
              {doctors.length} Doctors
            </span>
          </div>

          {doctors.length ===
          0 ? (
            <div
              style={{
                textAlign:
                  "center",
                padding:
                  "35px 20px",
                background:
                  "#f9fafb",
                border:
                  "1px dashed #d0d5dd",
                borderRadius:
                  "10px",
              }}
            >
              <div
                style={{
                  fontSize:
                    "34px",
                  marginBottom:
                    "10px",
                }}
              >
                🩺
              </div>

              <p
                style={{
                  margin: 0,
                  color:
                    "#667085",
                }}
              >
                No doctors found yet.
              </p>
            </div>
          ) : (
            <div
              style={{
                overflowX:
                  "auto",
              }}
            >
              <table
                style={{
                  width: "100%",
                  borderCollapse:
                    "collapse",
                  minWidth:
                    "700px",
                }}
              >
                <thead>
                  <tr>
                    <th
                      style={
                        tableHeaderStyle
                      }
                    >
                      Doctor
                    </th>

                    <th
                      style={
                        tableHeaderStyle
                      }
                    >
                      Role
                    </th>

                    <th
                      style={
                        tableHeaderStyle
                      }
                    >
                      Hospital
                    </th>

                    <th
                      style={
                        tableHeaderStyle
                      }
                    >
                      Department
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {doctors.map(
                    (doctor) => (
                      <tr
                        key={
                          doctor.id
                        }
                      >
                        <td
                          style={
                            tableCellStyle
                          }
                        >
                          <div
                            style={{
                              fontWeight:
                                600,
                              color:
                                "#101828",
                            }}
                          >
                            {
                              doctor.user_id
                            }
                          </div>
                        </td>

                        <td
                          style={
                            tableCellStyle
                          }
                        >
                          <span
                            style={{
                              background:
                                "#f4f3ff",
                              color:
                                "#6941c6",
                              padding:
                                "5px 9px",
                              borderRadius:
                                "15px",
                              fontSize:
                                "12px",
                              fontWeight:
                                600,
                            }}
                          >
                            {
                              doctor.role ||
                              "Doctor"
                            }
                          </span>
                        </td>

                        <td
                          style={
                            tableCellStyle
                          }
                        >
                          {
                            doctor.hospital_name ||
                            "Not assigned"
                          }
                        </td>

                        <td
                          style={
                            tableCellStyle
                          }
                        >
                          <span
                            style={{
                              background:
                                "#eef4ff",
                              color:
                                "#175cd3",
                              padding:
                                "5px 9px",
                              borderRadius:
                                "15px",
                              fontSize:
                                "12px",
                              fontWeight:
                                600,
                            }}
                          >
                            {
                              doctor.department ||
                              "Not assigned"
                            }
                          </span>
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* =================================================
            FOOTER
        ================================================= */}

        <div
          style={{
            textAlign:
              "center",
            color:
              "#98a2b3",
            fontSize:
              "12px",
            padding:
              "25px 0 10px",
          }}
        >
          Queue Care Hospital • Super Admin Management
        </div>

      </main>
    </div>
  );
}

/* =========================================================
   STYLES
========================================================= */

const statCardStyle:
  React.CSSProperties = {
    background:
      "#ffffff",
    padding:
      "22px",
    borderRadius:
      "12px",
    border:
      "1px solid #eaecf0",
  };

const statLabelStyle:
  React.CSSProperties = {
    margin: 0,
    color:
      "#667085",
    fontSize:
      "14px",
  };

const statNumberStyle:
  React.CSSProperties = {
    margin:
      "8px 0 0",
    fontSize:
      "30px",
    fontWeight:
      700,
  };

const sectionStyle:
  React.CSSProperties = {
    background:
      "#ffffff",
    borderRadius:
      "14px",
    padding:
      "25px",
    marginBottom:
      "25px",
    border:
      "1px solid #eaecf0",
  };

const sectionTitleStyle:
  React.CSSProperties = {
    marginTop: 0,
    color:
      "#101828",
    fontSize:
      "21px",
  };

const sectionDescriptionStyle:
  React.CSSProperties = {
    color:
      "#667085",
    marginBottom:
      "22px",
    fontSize:
      "14px",
  };

const formGridStyle:
  React.CSSProperties = {
    display:
      "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(220px, 1fr))",
    gap:
      "15px",
  };

const inputStyle:
  React.CSSProperties = {
    width:
      "100%",
    boxSizing:
      "border-box",
    padding:
      "12px 13px",
    border:
      "1px solid #d0d5dd",
    borderRadius:
      "8px",
    fontSize:
      "15px",
    outline:
      "none",
  };

const primaryButtonStyle:
  React.CSSProperties = {
    marginTop:
      "18px",
    padding:
      "13px 20px",
    border:
      "none",
    borderRadius:
      "8px",
    background:
      "#1769e0",
    color:
      "#ffffff",
    fontSize:
      "15px",
    fontWeight:
      600,
    cursor:
      "pointer",
  };

const tableHeaderStyle:
  React.CSSProperties = {
    textAlign:
      "left",
    padding:
      "12px",
    borderBottom:
      "1px solid #eaecf0",
    color:
      "#475467",
    fontSize:
      "14px",
  };

const tableCellStyle:
  React.CSSProperties = {
    padding:
      "13px 12px",
    borderBottom:
      "1px solid #f2f4f7",
    color:
      "#344054",
    fontSize:
      "14px",
  };

export default SuperAdminDashboard;