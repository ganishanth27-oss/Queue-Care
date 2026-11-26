import { Link } from "react-router-dom";
import "./Home.css";

function Home() {
  return (
    <div className="hospital-page">

      {/* ==============================
          HEADER
      ============================== */}

      <header className="hospital-header">
        <div className="header-container">

          <Link to="/" className="brand">

            <div className="brand-icon">
              ✚
            </div>

            <div className="brand-text">

              <div className="brand-name">
                Queue Care
              </div>

              <div className="brand-subtitle">
                Hospital & Medical Centre
              </div>

            </div>

          </Link>

          <nav className="main-nav">
            <a href="#home">Home</a>
            <a href="#services">Services</a>
            <a href="#portals">Portals</a>
            <a href="#contact">Contact</a>
          </nav>

          <Link
            to="/patient-login"
            className="header-login"
          >
            Patient Login
          </Link>

        </div>
      </header>


      {/* ==============================
          MAIN CONTENT
      ============================== */}

      <main id="home">

        {/* ==============================
            HERO
        ============================== */}

        <section className="hero-section">

          <div className="hero-container">

            <div className="hero-content">

              <div className="hero-badge">
                <span className="status-dot"></span>
                Digital Patient Services
              </div>

              <h1>
                Quality care.
                <br />
                <span>Simpler visits.</span>
              </h1>

              <p className="hero-description">
                Manage your hospital visit digitally.
                Get your token, monitor the queue, and
                receive timely updates without waiting
                unnecessarily.
              </p>

              <div className="hero-actions">

                <Link
                  to="/patient-login"
                  className="primary-button"
                >
                  Get Your Token
                  <span>→</span>
                </Link>

                <Link
                  to="/patient-login"
                  className="secondary-button"
                >
                  Patient Login
                </Link>

              </div>

              <div className="hero-trust">

                <div className="trust-item">

                  <div className="trust-icon">
                    ✓
                  </div>

                  <span>Secure</span>

                </div>

                <div className="trust-item">

                  <div className="trust-icon">
                    ✓
                  </div>

                  <span>Simple</span>

                </div>

                <div className="trust-item">

                  <div className="trust-icon">
                    ✓
                  </div>

                  <span>Real-time</span>

                </div>

              </div>

            </div>


            {/* HERO VISUAL */}

            <div className="hero-visual">

              <div className="hero-circle hero-circle-one"></div>

              <div className="hero-circle hero-circle-two"></div>

              <div className="hospital-card">

                <div className="hospital-card-header">

                  <div className="mini-hospital-icon">
                    ✚
                  </div>

                  <div>

                    <strong>
                      Queue Care
                    </strong>

                    <span>
                      Patient Services
                    </span>

                  </div>

                </div>

                <div className="token-display">

                  <span>
                    Your Token
                  </span>

                  <strong>
                    #024
                  </strong>

                  <small>
                    Please wait for your turn
                  </small>

                </div>

                <div className="queue-status">

                  <div>

                    <span>
                      Current Token
                    </span>

                    <strong>
                      #019
                    </strong>

                  </div>

                  <div>

                    <span>
                      Patients Ahead
                    </span>

                    <strong>
                      05
                    </strong>

                  </div>

                </div>

              </div>

            </div>

          </div>

        </section>


        {/* ==============================
            QUICK FEATURES
        ============================== */}

        <section className="quick-section">

          <div className="quick-container">

            <div className="quick-card">

              <div className="quick-icon">
                🎟
              </div>

              <div>

                <h3>
                  Digital Token
                </h3>

                <p>
                  Get your queue number before
                  reaching the counter.
                </p>

              </div>

            </div>


            <div className="quick-card">

              <div className="quick-icon">
                📊
              </div>

              <div>

                <h3>
                  Live Queue
                </h3>

                <p>
                  Track your position while
                  you wait.
                </p>

              </div>

            </div>


            <div className="quick-card">

              <div className="quick-icon">
                📱
              </div>

              <div>

                <h3>
                  SMS Updates
                </h3>

                <p>
                  Know when your consultation
                  is getting close.
                </p>

              </div>

            </div>


            <div className="quick-card emergency-card">

              <div className="quick-icon emergency-icon">
                !
              </div>

              <div>

                <h3>
                  Emergency Priority
                </h3>

                <p>
                  Emergency patients receive
                  appropriate queue priority.
                </p>

              </div>

            </div>

          </div>

        </section>


        {/* ==============================
            SERVICES
        ============================== */}

        <section
          id="services"
          className="services-section"
        >

          <div className="section-container">

            <div className="section-heading">

              <div className="section-label">
                OUR SERVICES
              </div>

              <h2>
                Designed around your visit
              </h2>

              <p>
                Simple digital services that make
                every hospital visit easier to manage.
              </p>

            </div>


            <div className="services-grid">

              <div className="service-card">

                <div className="service-number">
                  01
                </div>

                <div className="service-icon">
                  🎫
                </div>

                <h3>
                  Online Registration
                </h3>

                <p>
                  Register as a patient and receive
                  your digital token without standing
                  in a long queue.
                </p>

              </div>


              <div className="service-card">

                <div className="service-number">
                  02
                </div>

                <div className="service-icon">
                  📍
                </div>

                <h3>
                  Queue Tracking
                </h3>

                <p>
                  Check the current consultation
                  number and understand your position
                  in the queue.
                </p>

              </div>


              <div className="service-card">

                <div className="service-number">
                  03
                </div>

                <div className="service-icon">
                  🔔
                </div>

                <h3>
                  Turn Notifications
                </h3>

                <p>
                  Receive an SMS notification when
                  your consultation is getting close.
                </p>

              </div>

            </div>

          </div>

        </section>


        {/* ==============================
            DIGITAL PORTALS
        ============================== */}

        <section
          id="portals"
          className="portal-section"
        >

          <div className="portal-container">

            <div className="portal-heading">

              <div className="section-label">
                DIGITAL PORTALS
              </div>

              <h2>
                Access the right portal
              </h2>

              <p>
                Patients and hospital staff have
                dedicated secure access.
              </p>

            </div>


            <div className="portal-grid">


              {/* ==============================
                  PATIENT PORTAL
              ============================== */}

              <div className="portal-card patient-portal">

                <div className="portal-top">

                  <div className="portal-icon">
                    👤
                  </div>

                  <span>
                    PATIENT
                  </span>

                </div>

                <h3>
                  Patient Portal
                </h3>

                <p>
                  Register for a token, view your
                  queue position, and receive
                  consultation updates.
                </p>

                <Link
                  to="/patient-login"
                  className="portal-button"
                >
                  Patient Login
                  <span>→</span>
                </Link>

              </div>


              {/* ==============================
                  HOSPITAL STAFF PORTAL
              ============================== */}

              <div className="portal-card nurse-portal">

                <div className="portal-top">

                  <div className="portal-icon">
                    🩺
                  </div>

                  <span>
                    STAFF
                  </span>

                </div>

                <h3>
                  Hospital Staff Portal
                </h3>

                <p>
                  Manage the patient queue,
                  call patients, handle emergencies,
                  and complete consultations.
                </p>

                <Link
                  to="/nurse-login"
                  className="portal-button"
                >
                  Staff Login
                  <span>→</span>
                </Link>

              </div>


              {/* ==============================
                  DOCTOR PORTAL
              ============================== */}

              <div className="portal-card doctor-portal">

                <div className="portal-top">

                  <div className="portal-icon">
                    👨‍⚕️
                  </div>

                  <span>
                    DOCTOR
                  </span>

                </div>

                <h3>
                  Doctor Portal
                </h3>

                <p>
                  View your department queue,
                  call patients, manage consultations,
                  and complete visits.
                </p>

                <Link
                  to="/doctor-login"
                  className="portal-button"
                >
                  Doctor Login
                  <span>→</span>
                </Link>

              </div>


              {/* ==============================
                  SUPER ADMIN PORTAL
              ============================== */}

              <div className="portal-card admin-portal">

                <div className="portal-top">

                  <div className="portal-icon">
                    ⚙️
                  </div>

                  <span>
                    ADMIN
                  </span>

                </div>

                <h3>
                  Super Admin Portal
                </h3>

                <p>
                  Create hospitals, create hospital
                  staff accounts, and assign staff
                  to their respective hospitals.
                </p>

                <Link
                  to="/super-admin-login"
                  className="portal-button"
                >
                  Admin Login
                  <span>→</span>
                </Link>

              </div>

            </div>

          </div>

        </section>


        {/* ==============================
            EMERGENCY
        ============================== */}

        <section className="emergency-section">

          <div className="emergency-container">

            <div className="emergency-symbol">
              !
            </div>

            <div className="emergency-content">

              <div className="emergency-label">
                EMERGENCY INFORMATION
              </div>

              <h2>
                Medical emergency?
              </h2>

              <p>
                For life-threatening emergencies,
                contact your local emergency medical
                service immediately.
              </p>

            </div>

            <div className="emergency-number">

              <span>
                Emergency
              </span>

              <strong>
                108
              </strong>

            </div>

          </div>

        </section>

      </main>


      {/* ==============================
          FOOTER
      ============================== */}

      <footer
        id="contact"
        className="hospital-footer"
      >

        <div className="footer-container">

          <div className="footer-brand">

            <div className="brand footer-brand-inner">

              <div className="brand-icon">
                ✚
              </div>

              <div>

                <div className="brand-name">
                  Queue Care
                </div>

                <div className="brand-subtitle">
                  Hospital & Medical Centre
                </div>

              </div>

            </div>

            <p>
              Making healthcare visits simpler,
              more organized, and patient-friendly.
            </p>

          </div>


          <div className="footer-links">


            {/* PATIENT */}

            <div>

              <h4>
                Patient
              </h4>

              <Link to="/patient-login">
                Get Token
              </Link>

              <Link to="/patient-login">
                Patient Login
              </Link>

            </div>


            {/* STAFF */}

            <div>

              <h4>
                Staff
              </h4>

              <Link to="/nurse-login">
                Hospital Staff Login
              </Link>

              <Link to="/doctor-login">
                Doctor Login
              </Link>

              <Link to="/super-admin-login">
                Super Admin
              </Link>

            </div>


            {/* CONTACT */}

            <div>

              <h4>
                Contact
              </h4>

              <span>
                Hospital Reception
              </span>

              <span>
                Emergency: 108
              </span>

            </div>

          </div>

        </div>


        <div className="footer-bottom">

          <span>
            © 2026 Queue Care
          </span>

          <span>
            Patient Token Management System
          </span>

        </div>

      </footer>

    </div>
  );
}

export default Home;