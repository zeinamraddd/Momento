import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import Sidebar from "./layout/Sidebar";
import Home from "../pages/Home";
import Albums from "../pages/Albums";
import { useTheme } from "../themes/ThemeContext";

function ProtectedPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const { theme } = useTheme();

  // ==========================================
  // STATE
  // ==========================================

  const [user, setUser] = useState(null);
  const [space, setSpace] = useState(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Backend URL
  const API_URL =
    import.meta.env.VITE_API_URL || "http://localhost:3000";

  // Get the selected space ID from the URL
  const spaceId = new URLSearchParams(location.search).get("space");

  // Check which page should be displayed
  const isAlbumsPage = location.pathname === "/albums";

  // ==========================================
  // VERIFY AUTHENTICATION AND SPACE
  // ==========================================

  useEffect(() => {
    const controller = new AbortController();

    const loadDashboard = async () => {
      setLoading(true);
      setError("");
      setUser(null);
      setSpace(null);

      try {
        // STEP 1: Verify the logged-in user
        const authResponse = await fetch(
          `${API_URL}/api/auth/me`,
          {
            credentials: "include",
            signal: controller.signal,
          }
        );

        // Not logged in
        if (authResponse.status === 401) {
          navigate("/login", { replace: true });
          return;
        }

        if (!authResponse.ok) {
          throw new Error("Could not verify authentication");
        }

        const authData = await authResponse.json();

        // STEP 2: Make sure a space was selected
        if (!spaceId) {
          navigate("/spaces", { replace: true });
          return;
        }

        // STEP 3: Retrieve the selected space
        const spaceResponse = await fetch(
          `${API_URL}/api/spaces/${encodeURIComponent(spaceId)}`,
          {
            credentials: "include",
            signal: controller.signal,
          }
        );

        if (spaceResponse.status === 401) {
          navigate("/login", { replace: true });
          return;
        }

        // The user doesn't belong to this space
        if (spaceResponse.status === 404) {
          setError("Space not found or you don't have access to it.");
          return;
        }

        if (!spaceResponse.ok) {
          throw new Error("Could not load your space");
        }

        const spaceData = await spaceResponse.json();

        // STEP 4: Store user and space information
        if (!controller.signal.aborted) {
          setUser(authData.user);
          setSpace(spaceData.space);
        }

      } catch (err) {
        if (err.name !== "AbortError" && !controller.signal.aborted) {
          setError(err.message || "Could not connect to the server");
        }

      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    loadDashboard();

    return () => controller.abort();

  }, [API_URL, spaceId, navigate]);

  // ==========================================
  // LOGOUT
  // ==========================================

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

    } catch {
      setError("Could not log out");
    }
  };

  // ==========================================
  // LOADING
  // ==========================================

  if (loading) {
    return <p>Opening your scrapbook...</p>;
  }

  // ==========================================
  // ERROR
  // ==========================================

  if (error) {
    return (
      <div>
        <p role="alert">{error}</p>
        <Link to="/spaces">Back to My Spaces</Link>
      </div>
    );
  }

  // Never display private content without
  // an authenticated user and authorized space
  if (!user || !space) {
    return null;
  }

  // ==========================================
  // MAIN APPLICATION
  // ==========================================

  return (
    <div className="momento-app" data-theme={theme}>
      <div className="momento-shell">

        {/* Sidebar */}
        <Sidebar
          onLogout={handleLogout}
          spaceId={space.id}
        />

        {/* Main content */}
        <main className="momento-main">
          {isAlbumsPage ? (
            <Albums space={space} />
          ) : (
            <Home
              user={user}
              space={space}
            />
          )}
        </main>

      </div>
    </div>
  );
}

export default ProtectedPage;
