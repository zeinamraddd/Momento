import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import session from "express-session";
import MongoStore from "connect-mongo";

// Import routes
import authRoutes from "./routes/authRoutes.js";
import protectedRoutes from "./routes/protectedRoutes.js";
import spaceRoutes from "./routes/spaceRoutes.js";
import noteRoutes from "./routes/noteRoutes.js";
import bucketRoutes from "./routes/bucketRoutes.js";
import eventRoutes from "./routes/eventRoutes.js";
import loreRoutes from "./routes/loreRoutes.js";
// Import database connection
import connectDB from "./config/db.js";

// Load environment variables
dotenv.config();

// Initialize Express
const app = express();

const PORT = process.env.PORT || 3000;

// ==========================================
// CORS CONFIGURATION
// ==========================================

// Allow requests from the React frontend
app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
    credentials: true,
  })
);

// ==========================================
// MIDDLEWARE
// ==========================================

// Parse incoming JSON requests
app.use(express.json());

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
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
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

// Protected routes
// Accessible only to authenticated users
app.use("/api/protected", protectedRoutes);

// Sticky Notes routes
app.use("/api/spaces", noteRoutes);

// Shared Spaces routes
app.use("/api/spaces", spaceRoutes);

//bucket list routes
app.use("/api/spaces", bucketRoutes);

app.use("/api/spaces", eventRoutes);

app.use("/api/spaces", loreRoutes);
// ==========================================
// HEALTH CHECK
// ==========================================

// Check whether the API is running
app.get("/api/health", (req, res) => {
  res.json({
    message: "Momento API is running!",
  });
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