// Session-cookie CSRF defense: reject cross-origin browser writes before routes.
// Combined with SameSite=Lax (or Secure; SameSite=None for separate hosts),
// this prevents a third-party website from submitting changes as a member.
export function requireTrustedOrigin(clientOrigin) {
  const expected = new URL(clientOrigin).origin;
  return (req, res, next) => {
    if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();

    const origin = req.get("origin");
    const fetchSite = req.get("sec-fetch-site");
    if ((origin && origin !== expected) || (!origin && fetchSite === "cross-site")) {
      return res.status(403).json({ message: "Cross-site request blocked" });
    }
    next();
  };
}

export function verifyServerSecrets(env = process.env) {
  for (const key of ["MONGODB_URI", "SESSION_SECRET"]) {
    if (!env[key]?.trim()) throw new Error(`Missing environment variable: ${key}`);
  }
  if (env.NODE_ENV === "production") {
    if (env.SESSION_SECRET.length < 32) {
      throw new Error("SESSION_SECRET must have at least 32 random characters in production");
    }
    if (!env.CLIENT_ORIGIN?.startsWith("https://")) {
      throw new Error("CLIENT_ORIGIN must be an HTTPS origin in production");
    }
  }
}
