import { useState } from "react";
import { Link } from "react-router-dom";
import AuthLayout from "./AuthLayout";
import "./Register.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    setMessage(""); setError(""); setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Could not request a reset link");
      setMessage(data.message || "If the address is registered, you'll receive a reset link.");
    } catch (err) {
      setError(err.message || "Could not connect to the server");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout>
      <div className="register-container">
        <h1>Forgot your password?</h1>
        <p>It happens! We'll send you a link to get back to your memories.</p>
        <form onSubmit={submit}>
          <label htmlFor="reset-email">Email address</label>
          <input id="reset-email" type="email" autoComplete="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" />
          {error && <p role="alert" style={{ color: "#c0392b" }}>{error}</p>}
          {message && <p role="status" style={{ color: "#255a44" }}>{message}</p>}
          <button type="submit" disabled={loading}>{loading ? "Sending…" : "Send reset link"}</button>
        </form>
        <p><Link to="/login">← Back to login</Link></p>
      </div>
    </AuthLayout>
  );
}
