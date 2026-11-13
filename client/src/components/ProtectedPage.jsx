
import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

function ProtectedPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [space, setSpace] = useState(null);
  const [spaceError, setSpaceError] = useState("");
  const requestedSpaceId = new URLSearchParams(location.search).get("space");

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

  // This is a temporary dashboard while the full scrapbook UI is being built.
  // The server only returns space details to members of that space.
  useEffect(() => {
    if (!user) return undefined;
    if (!requestedSpaceId) return undefined;

    const controller = new AbortController();
    fetch(`${API_URL}/api/spaces/${encodeURIComponent(requestedSpaceId)}`, {
      credentials: "include",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Couldn't open this space");
        return response.json();
      })
      .then((data) => {
        setSpace(data.space);
        setSpaceError("");
      })
      .catch((err) => {
        if (err.name !== "AbortError") setSpaceError(err.message);
      });
    return () => controller.abort();
  }, [API_URL, requestedSpaceId, user]);

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
    } catch {
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
    <div className="register-container">
      <h1>Welcome to Momento!</h1>
      <p>You are successfully logged in.</p>

      <h2>Hello, {user.username}!</h2>
      <p>Email: {user.email}</p>

      {space && space.id === requestedSpaceId && (
        <div style={{ margin: "20px 0", padding: 18, border: "1px solid #e8d9c8", borderRadius: 12 }}>
          <h2>{space.name}</h2>
          <p>{space.memberCount} {space.memberCount === 1 ? "member" : "members"} · Theme: {space.theme}</p>
          <p>Invite your friends with code: <strong>{space.inviteCode}</strong></p>
          <p style={{ marginTop: 10 }}>Your full scrapbook dashboard is coming in Phase 5!</p>
        </div>
      )}
      {spaceError && <p role="alert">{spaceError}</p>}

      <p><Link to="/spaces">My Spaces / Create or Join</Link></p>

      <button type="button" onClick={handleLogout}>
        Log Out
      </button>
    </div>
  );
}

export default ProtectedPage;
