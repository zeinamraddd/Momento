import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AuthLayout from "./AuthLayout";
import "./Register.css";

function Login() {
  const navigate = useNavigate();

  // Form fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Error and loading states
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Handle login
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const API_URL =
        import.meta.env.VITE_API_URL || "http://localhost:3000";

      // Send login request with session cookies
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
        }),
      });

      const data = await response.json();

      // Handle backend errors
      if (!response.ok) {
        setError(data.message || "Login failed");
        return;
      }

      // Redirect to Dashboard after successful login
      navigate("/dashboard", { replace: true });

    } catch (error) {
      console.error("Login error:", error);
      setError("Could not connect to the server");

    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <div className="register-container">
        <h1>Welcome back!</h1>
        <p>Log in to continue making memories.</p>

        <form onSubmit={handleSubmit}>
          {/* Email */}
          <label htmlFor="login-email">Email address</label>
          <input
            id="login-email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          {/* Password */}
          <label htmlFor="login-password">Password</label>

          <div className="password-wrapper">
            <input
              id="login-password"
              type={showPassword ? "text" : "password"}
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            <button
              type="button"
              className="password-toggle"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={
                showPassword ? "Hide password" : "Show password"
              }
              aria-pressed={showPassword}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>

          {/* Error message */}
          {error && (
            <p role="alert" style={{ color: "#c0392b" }}>
              {error}
            </p>
          )}

          {/* Submit button */}
          <button type="submit" disabled={loading}>
            {loading ? "Logging in..." : "Log In"}
          </button>
        </form>

        <p>
          Don't have an account?{" "}
          <Link to="/register">Sign Up</Link>
        </p>
      </div>
    </AuthLayout>
  );
}

export default Login;
