import nodemailer from "nodemailer";

const mailKeys = ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASSWORD", "SMTP_FROM"];

export function resetEmailIsConfigured() {
  return mailKeys.every((key) => Boolean(process.env[key]?.trim()));
}

// Shared Gmail/SMTP configuration for reset and account notification emails.
export function createMailTransport() {
  if (!resetEmailIsConfigured()) throw new Error("Email delivery is not configured");

  const port = Number(process.env.SMTP_PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("Invalid SMTP_PORT");
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
  });
}

export async function sendPasswordResetEmail(email, token) {
  const clientOrigin = process.env.CLIENT_ORIGIN || "http://localhost:5173";
  const resetUrl = new URL("/reset-password", clientOrigin);
  resetUrl.searchParams.set("token", token);

  const transporter = createMailTransport();

  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to: email,
    subject: "Reset your MOMENTO password",
    text: `Someone requested a password reset for your MOMENTO account.\n\nUse this link within 15 minutes:\n${resetUrl}\n\nIf this wasn't you, ignore this email. Your password will not change.`,
  });
}
