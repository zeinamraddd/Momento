import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import AuthLayout from "./AuthLayout";
import "./Register.css";

function Register() {
  const navigate = useNavigate();

  // Form fields
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Password visibility states
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Error and loading states
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Handle registration
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    // Check if passwords match
    if (password !== confirmPassword) {
      setError("Passwords do not match!");
      return;
    }

    // Check password length
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setLoading(true);

    try {
      const API_URL =
        import.meta.env.VITE_API_URL || "http://localhost:3000";

      // Send registration data to the backend
      const response = await fetch(`${API_URL}/api/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: username.trim(),
          email: email.trim().toLowerCase(),
          password,
        }),
      });

      const data = await response.json();

      // Handle backend errors
      if (!response.ok) {
        setError(data.message || "Registration failed");
        return;
      }

      // Registration successful
      alert("Account created successfully!");

      // Redirect to Login
      navigate("/login");

    } catch (error) {
      console.error("Registration error:", error);
      setError("Could not connect to the server");

    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <div className="register-container">
        <h1>Create an account</h1>
        <p>Let's start collecting memories.</p>

        <form onSubmit={handleSubmit}>

          {/* Username */}
          <label htmlFor="username">Username</label>
          <input
            id="username"
            type="text"
            placeholder="Your name"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />

          {/* Email */}
          <label htmlFor="email">Email address</label>
          <input
            id="email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          {/* Password */}
          <label htmlFor="password">Password</label>

          <div className="password-wrapper">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="Create a password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
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

          {/* Confirm Password */}
          <label htmlFor="confirmPassword">
            Confirm password
          </label>

          <div className="password-wrapper">
            <input
              id="confirmPassword"
              type={showConfirmPassword ? "text" : "password"}
              placeholder="Repeat password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              minLength={8}
              required
            />

            <button
              type="button"
              className="password-toggle"
              onClick={() =>
                setShowConfirmPassword(!showConfirmPassword)
              }
              aria-label={
                showConfirmPassword
                  ? "Hide confirm password"
                  : "Show confirm password"
              }
              aria-pressed={showConfirmPassword}
            >
              {showConfirmPassword ? "Hide" : "Show"}
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
            {loading ? "Creating account..." : "Create Account"}
          </button>
        </form>

        <p>
          Already have an account?{" "}
          <Link to="/login">Log In</Link>
        </p>
      </div>
    </AuthLayout>
  );
}

export default Register;
