import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import AuthLayout from "./AuthLayout";
import { API_BASE_URL as API_URL } from "../utils/apiBaseUrl";
import { EMAIL_RECOVERY_ENABLED } from "../utils/featureFlags";
import "./Register.css";

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const validLink = /^[a-f0-9]{64}$/.test(token);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    setError("");
    if (password !== confirm) return setError("Passwords do not match");
    if (password.length < 8 || password.length > 72) return setError("Use a password between 8 and 72 characters");
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Could not reset password");
      setMessage("Your password has been changed! You can log in now.");
      setPassword(""); setConfirm("");
    } catch (err) {
      setError(err.message || "Could not connect to the server");
    } finally {
      setLoading(false);
    }
  }

  if (!EMAIL_RECOVERY_ENABLED) {
    return (
      <AuthLayout>
        <div className="register-container">
          <h1>Password recovery is temporarily unavailable</h1>
          <p>This free hosted demo cannot send password reset emails yet.</p>
          <p><Link to="/login">← Back to login</Link></p>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div className="register-container">
        <h1>A fresh start ♡</h1>
        {!validLink ? <p role="alert">This reset link is invalid. <Link to="/forgot-password">Request another</Link>.</p> : message ? (
          <><p role="status">{message}</p><p><Link to="/login">Go to Login →</Link></p></>
        ) : (
          <form onSubmit={submit}>
            <p>Choose a new password for your MOMENTO account.</p>
            <label htmlFor="new-password">New password</label>
            <input id="new-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" minLength={8} maxLength={72} required />
            <label htmlFor="confirm-password">Confirm new password</label>
            <input id="confirm-password" type="password" value={confirm} onChange={(event) => setConfirm(event.target.value)} autoComplete="new-password" minLength={8} maxLength={72} required />
            {error && <p role="alert" style={{ color: "#c0392b" }}>{error}</p>}
            <button type="submit" disabled={loading}>{loading ? "Updating…" : "Reset password"}</button>
          </form>
        )}
        <p><Link to="/login">← Back to login</Link></p>
      </div>
    </AuthLayout>
  );
}
