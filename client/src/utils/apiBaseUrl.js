// In production, the browser calls Vercel's own origin. Vercel proxies /api
// to Render, keeping express-session cookies first-party for our users.
// Locally, Vite still talks to the Express development server on port 3000.
const configuredOrigin = import.meta.env.VITE_API_URL?.trim();

export const API_BASE_URL = (
  configuredOrigin ||
  (import.meta.env.DEV ? "http://localhost:3000" : window.location.origin)
).replace(/\/+$/, "");
