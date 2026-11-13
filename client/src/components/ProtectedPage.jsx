import Sidebar from "./layout/Sidebar";
import Home from "../pages/Home";
import { useTheme } from "../themes/ThemeContext";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

function ProtectedPage() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const API_URL =
    import.meta.env.VITE_API_URL || "http://localhost:3000";

  // Check if the user is authenticated
  useEffect(() => {
    const controller = new AbortController();

    const checkAuth = async () => {
      try {
        const response = await fetch(`${API_URL}/api/auth/me`, {
          credentials: "include",
          signal: controller.signal,
        });

        if (response.status === 401) {
          navigate("/login", { replace: true });
          return;
        }

        if (!response.ok) {
          throw new Error("Could not verify authentication");
        }

        const data = await response.json();
        setUser(data.user);
      } catch (error) {
        if (error.name !== "AbortError") {
          setError("Could not connect to the server");
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    checkAuth();

    return () => controller.abort();
  }, [API_URL, navigate]);

  // Log out and destroy session
  const handleLogout = async () => {
    try {
      const response = await fetch(`${API_URL}/api/auth/logout`, {
        method: "POST",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Logout failed");
      }

      navigate("/login", { replace: true });
    } catch (error) {
      setError("Could not log out");
    }
  };

  if (loading) {
    return <p>Checking authentication...</p>;
  }

  if (error) {
    return (
      <div>
        <p role="alert">{error}</p>
        <Link to="/login">Back to Login</Link>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
  <div className="momento-app" data-theme={theme}>

    <div className="momento-shell">

      {/* Sidebar */}
      <Sidebar onLogout={handleLogout} />

      {/* Main content */}
      <main className="momento-main">
       <Home user={user} />
      </main>

    </div>

  </div>
);
}

export default ProtectedPage;
