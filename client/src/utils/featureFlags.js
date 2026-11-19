// Email is available locally, but disabled on Render's free SMTP-restricted tier.
// When an HTTPS email provider is configured, set VITE_EMAIL_RECOVERY_ENABLED=true
// in Vercel and redeploy to restore the password recovery UI.
export const EMAIL_RECOVERY_ENABLED = import.meta.env.VITE_EMAIL_RECOVERY_ENABLED
  ? import.meta.env.VITE_EMAIL_RECOVERY_ENABLED === "true"
  : import.meta.env.DEV;
