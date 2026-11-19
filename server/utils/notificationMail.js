import { createMailTransport } from "./passwordResetMail.js";

// Username is user supplied; never interpolate it into email HTML unescaped.
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}[character]));

function card(title, message) {
  return `<div style="background:#fff4e8;padding:32px;font-family:Arial,sans-serif;color:#4e352e">
    <div style="max-width:530px;margin:auto;background:#fffbf6;border:1px solid #efd7c7;border-radius:22px;padding:34px">
      <div style="background:#e96627;color:white;display:inline-block;padding:8px 16px;border-radius:12px;font-weight:800;letter-spacing:3px">MOMENTO</div>
      <h1 style="font-family:Georgia,serif;color:#4e352e">${title}</h1>
      <p style="font-size:16px;line-height:1.65">${message}</p>
      <p style="margin-top:28px;color:#c36a43">With love,<br>The Momento Team ♡</p>
    </div>
  </div>`;
}

export async function sendWelcomeEmail(email, username) {
  const name = username.trim();
  return createMailTransport().sendMail({
    from: process.env.SMTP_FROM,
    to: email,
    subject: "Welcome to Momento! 💌",
    text: `Hey ${name}!\n\nWelcome to Momento! Your account is ready. Keep your favorite people and memories close.\n\nWith love,\nThe Momento Team`,
    html: card("Welcome to Momento! ♡", `Hey ${escapeHtml(name)}!<br><br>Your account is ready. Here's to adventures, inside jokes, and memories worth keeping!`),
  });
}

export async function sendNewDeviceEmail(email) {
  const when = new Date().toLocaleString("en-GB", { timeZone: "UTC", dateStyle: "long", timeStyle: "short" });
  const resetUrl = new URL("/forgot-password", process.env.CLIENT_ORIGIN || "http://localhost:5173");
  return createMailTransport().sendMail({
    from: process.env.SMTP_FROM,
    to: email,
    subject: "New browser login to your Momento account 🔐",
    text: `A successful login to your Momento account happened from a browser we haven't recognized before.\n\nTime: ${when} UTC\n\nIf this was you, no action is needed. Otherwise, reset your password: ${resetUrl}\n\nThe Momento Team`,
    html: card("A new browser logged in 🔐", `A successful login occurred from a browser we haven't recognized before.<br><br><strong>Time:</strong> ${escapeHtml(when)} UTC<br><br>If this was you, you're all set. If not, <a href="${resetUrl}" style="color:#b45726">reset your password</a> right away.`),
  });
}
