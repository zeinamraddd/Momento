import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import session from "express-session";
import cookieParser from "cookie-parser";
import MongoStore from "connect-mongo";
import mongoose from "mongoose";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { requireTrustedOrigin, verifyServerSecrets } from "./middleware/security.js";

// Import routes
import authRoutes from "./routes/authRoutes.js";
import accountRoutes from "./routes/accountRoutes.js";
import protectedRoutes from "./routes/protectedRoutes.js";
import spaceRoutes from "./routes/spaceRoutes.js";
import noteRoutes from "./routes/noteRoutes.js";
import bucketRoutes from "./routes/bucketRoutes.js";
import eventRoutes from "./routes/eventRoutes.js";
import loreRoutes from "./routes/loreRoutes.js";
import albumRoutes from "./routes/albumRoutes.js";
import scrapbookRoutes from "./routes/scrapbookRoutes.js";
// Import database connection
import connectDB from "./config/db.js";

// Load environment variables
dotenv.config();

verifyServerSecrets();
mongoose.set("sanitizeFilter", true); // Defense in depth against MongoDB operator injection.

// Initialize Express
const app = express();

const PORT = process.env.PORT || 3000;
const production = process.env.NODE_ENV === "production";
const clientOrigin = process.env.CLIENT_ORIGIN || "http://localhost:5173";
const crossSiteCookies = process.env.COOKIE_CROSS_SITE === "true";

// Hosting providers typically terminate HTTPS at a reverse proxy.
if (production) app.set("trust proxy", 1);

app.disable("x-powered-by");
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }, // Private images are still auth protected.
  strictTransportSecurity: production ? undefined : false,
}));

// ==========================================
// CORS CONFIGURATION
// ==========================================

// Allow requests from the React frontend
app.use(
  cors({
    origin: clientOrigin,
    credentials: true,
  })
);

// ==========================================
// MIDDLEWARE
// ==========================================

// Parse incoming JSON requests
// Scrapbook pages may contain many elements; ordinary JSON APIs are capped at 10 KB.
const regularJson = express.json({ limit: "10kb" });
const scrapbookJson = express.json({ limit: "256kb" });
app.use((req, res, next) => (req.path.includes("/scrapbook") ? scrapbookJson : regularJson)(req, res, next));
app.use(cookieParser()); // Read the optional remembered-browser cookie during login.

const apiLimiter = rateLimit({ windowMs: 15 * 60_000, limit: 300, standardHeaders: "draft-8", legacyHeaders: false });
const authLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { message: "Too many attempts. Try again in 15 minutes." },
});

app.use("/api", apiLimiter);
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", authLimiter); // Prevent signup-triggered email spam.
app.use("/api/auth/forgot-password", authLimiter);
app.use("/api/auth/reset-password", authLimiter);
app.use("/api", requireTrustedOrigin(clientOrigin));

// ==========================================
// SESSION CONFIGURATION
// ==========================================

// Configure MongoDB-backed user sessions
app.use(
  session({
    name: "momento.sid",

    secret: process.env.SESSION_SECRET,

    resave: false,
    saveUninitialized: false,

    // Store sessions in MongoDB
    store: MongoStore.create({
      mongoUrl: process.env.MONGODB_URI,
    }),

    // Secure cookie configuration
    cookie: {
      httpOnly: true,
      secure: production || crossSiteCookies,
      sameSite: crossSiteCookies ? "none" : "lax",
      maxAge: 24 * 60 * 60 * 1000,
    },
  })
);

// ==========================================
// API ROUTES
// ==========================================

// Authentication routes
// Registration, login, logout, current user
app.use("/api/auth", authRoutes);
app.use("/api/account", accountRoutes);

// Protected routes
// Accessible only to authenticated users
app.use("/api/protected", protectedRoutes);

// Sticky Notes routes
app.use("/api/spaces", noteRoutes);

// Shared Spaces routes
app.use("/api/spaces", spaceRoutes);

// Bucket List routes
app.use("/api/spaces", bucketRoutes);

// Calendar events routes
app.use("/api/spaces", eventRoutes);

app.use("/api/spaces", loreRoutes);
// Shared Albums and Photos routes
app.use("/api/spaces", albumRoutes);
app.use("/api/spaces", scrapbookRoutes);
// ==========================================
// HEALTH CHECK
// ==========================================

// Check whether the API is running
app.get("/api/health", (req, res) => {
  res.json({
    message: "Momento API is running!",
  });
});

// Keep invalid or oversized requests from returning HTML error pages or stacks.
app.use((error, _req, res, next) => {
  if (res.headersSent) return next(error);
  if (error.type === "entity.too.large") {
    return res.status(413).json({ message: "Request is too large" });
  }
  if (error.type === "entity.parse.failed") {
    return res.status(400).json({ message: "Invalid JSON request" });
  }
  console.error("Unhandled API error:", error);
  return res.status(500).json({ message: "Unexpected server error" });
});

// ==========================================
// START SERVER
// ==========================================

// Connect to MongoDB before starting Express
const startServer = async () => {
  await connectDB();

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
};

// Start the application
startServer();
