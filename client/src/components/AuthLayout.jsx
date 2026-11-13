import "./AuthLayout.css";

// Transparent PNG images
import logo from "../assets/momento-logo.png";
import polaroids from "../assets/polaroids.png";
import decorations from "../assets/decorations.png";

function AuthLayout({ children }) {
  return (
    <main className="auth-layout">
      {/* LEFT SIDE */}
      <section className="auth-left">
        <img
          src={logo}
          alt="Momento"
          className="auth-logo"
        />

        <h2 className="auth-slogan">
          All your favorite people.
          <br />
          All your favorite moments.
        </h2>

        <p className="auth-description">
          A little scrapbook for the big things.
        </p>

        <img
          src={polaroids}
          alt="Scrapbook memories"
          className="auth-polaroids"
        />
      </section>

      {/* RIGHT SIDE */}
      <section className="auth-right">
        {children}
      </section>

      {/* DECORATIONS */}
      <img
        src={decorations}
        alt=""
        className="auth-decorations"
        aria-hidden="true"
      />
    </main>
  );
}

export default AuthLayout;
