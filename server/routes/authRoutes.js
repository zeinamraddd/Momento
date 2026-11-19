
import express from "express";
import bcrypt from "bcrypt";
import { createHash, randomBytes } from "node:crypto";
import mongoose from "mongoose";
import User from "../models/user.js";
import { userView } from "../utils/userView.js";
import {
  forgotPasswordInput,
  loginInput,
  registerInput,
  resetPasswordInput,
  validate,
} from "../middleware/validate.js";
import { resetEmailIsConfigured, sendPasswordResetEmail } from "../utils/passwordResetMail.js";
import { sendNewDeviceEmail, sendWelcomeEmail } from "../utils/notificationMail.js";
import { recognizeDevice } from "../utils/deviceRecognition.js";

const router = express.Router();

// REGISTER - Create a new account
router.post("/register", validate(registerInput), async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Validate required fields
    if (
      typeof username !== "string" ||
      typeof email !== "string" ||
      typeof password !== "string" ||
      !username.trim() ||
      !email.trim() ||
      !password
    ) {
      return res.status(400).json({
        message: "All fields are required",
      });
    }

    // Validate password length
    if (password.length < 8) {
      return res.status(400).json({
        message: "Password must be at least 8 characters",
      });
    }

    // Check existing email
    const existingUser = await User.findOne({
      email: email.trim().toLowerCase(),
    });

    if (existingUser) {
      return res.status(409).json({
        message: "Email already registered",
      });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Save user in MongoDB
    const user = await User.create({
      username: username.trim(),
      email: email.trim().toLowerCase(),
      passwordHash,
    });

    // Mail is optional: a temporary Gmail outage must not undo registration.
    if (resetEmailIsConfigured()) {
      void sendWelcomeEmail(user.email, user.username).catch((error) => {
        console.error("Welcome email failed:", error.message);
      });
    }

    return res.status(201).json({
      message: "Account created successfully",
      user: userView(user),
    });
  } catch (error) {
    console.error("Registration error:", error);

    if (error.code === 11000) {
      return res.status(409).json({
        message: "Email already registered",
      });
    }

    return res.status(500).json({
      message: "Server error",
    });
  }
});

// LOGIN - Authenticate user and create session
router.post("/login", validate(loginInput), async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate required fields
    if (
      typeof email !== "string" ||
      typeof password !== "string" ||
      !email.trim() ||
      !password
    ) {
      return res.status(400).json({
        message: "Email and password are required",
      });
    }

    // Find user
    const user = await User.findOne({
      email: email.trim().toLowerCase(),
    });

    if (!user) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    // Verify password
    const isMatch = await bcrypt.compare(
      password,
      user.passwordHash
    );

    if (!isMatch) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    // Regenerate session after login
    req.session.regenerate((error) => {
      if (error) {
        console.error("Session error:", error);

        return res.status(500).json({
          message: "Could not create session",
        });
      }

      // Store user ID
      req.session.userId = user._id.toString();
      req.session.sessionVersion = user.sessionVersion ?? 0;

      // Save session
      req.session.save(async (error) => {
        if (error) {
          console.error("Session save error:", error);

          return res.status(500).json({
            message: "Could not save session",
          });
        }

        // Only a successful login can register a browser or trigger an alert.
        // A failure in device tracking must not lock the user out.
        let isNewDevice = false;
        try {
          isNewDevice = await recognizeDevice(req, res, user);
        } catch (deviceError) {
          console.error("Device recognition error:", deviceError.message);
        }

        if (isNewDevice && resetEmailIsConfigured()) {
          void sendNewDeviceEmail(user.email).catch((mailError) => {
            console.error("New-device email failed:", mailError.message);
          });
        }

        return res.status(200).json({
          message: "Login successful",
          user: userView(user),
        });
      });
    });
  } catch (error) {
    console.error("Login error:", error);

    return res.status(500).json({
      message: "Server error",
    });
  }
});

// CURRENT USER - Check active session
router.get("/me", async (req, res) => {
  try {
    // Check if user is logged in
    if (!req.session.userId) {
      return res.status(401).json({
        message: "Not authenticated",
      });
    }

    // Find user without password hash
    const user = await User.findById(
      req.session.userId
    ).select("-passwordHash");

    if (!user) {
      return res.status(401).json({
        message: "Not authenticated",
      });
    }

    if ((req.session.sessionVersion ?? 0) !== (user.sessionVersion ?? 0)) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    return res.status(200).json({
      user: userView(user),
    });
  } catch (error) {
    console.error("Current user error:", error);

    return res.status(500).json({
      message: "Server error",
    });
  }
});

// Request a single-use email link without revealing whether the account exists.
router.post("/forgot-password", validate(forgotPasswordInput), async (req, res) => {
  if (!resetEmailIsConfigured()) {
    return res.status(503).json({ message: "Password reset email is not configured yet" });
  }

  const generic = { message: "If this email belongs to an account, a reset link will arrive shortly." };
  try {
    const user = await User.findOne({ email: req.body.email });
    if (!user) return res.json(generic);

    const token = randomBytes(32).toString("hex");
    const passwordResetTokenHash = createHash("sha256").update(token).digest("hex");
    await User.updateOne(
      { _id: user._id },
      { $set: { passwordResetTokenHash, passwordResetExpiresAt: new Date(Date.now() + 15 * 60_000) } }
    );

    try {
      await sendPasswordResetEmail(user.email, token);
    } catch (error) {
      // Revoke the unsent link. Keep the response generic to avoid account enumeration.
      await User.updateOne(
        { _id: user._id, passwordResetTokenHash },
        { $unset: { passwordResetTokenHash: 1, passwordResetExpiresAt: 1 } }
      );
      console.error("Password reset email delivery failed:", error.message);
    }
    return res.json(generic);
  } catch (error) {
    console.error("Request password reset error:", error);
    return res.status(500).json({ message: "Could not process password reset" });
  }
});

// Hash the new password, consume the reset token atomically, and revoke old sessions.
router.post("/reset-password", validate(resetPasswordInput), async (req, res) => {
  try {
    const tokenHash = createHash("sha256").update(req.body.token).digest("hex");
    const passwordHash = await bcrypt.hash(req.body.password, 10);
    const user = await User.findOneAndUpdate(
      { passwordResetTokenHash: tokenHash, passwordResetExpiresAt: mongoose.trusted({ $gt: new Date() }) },
      {
        // Forget remembered browsers after a password reset as well as old sessions.
        $set: { passwordHash, trustedDeviceHashes: [] },
        $unset: { passwordResetTokenHash: 1, passwordResetExpiresAt: 1 },
        $inc: { sessionVersion: 1 },
      },
      { new: true }
    );
    if (!user) return res.status(400).json({ message: "Reset link is invalid or expired" });
    return res.json({ message: "Password updated. You can log in now." });
  } catch (error) {
    console.error("Reset password error:", error);
    return res.status(500).json({ message: "Could not reset password" });
  }
});

// LOGOUT - Destroy user session
router.post("/logout", (req, res) => {
  req.session.destroy((error) => {
    if (error) {
      console.error("Logout error:", error);

      return res.status(500).json({
        message: "Could not log out",
      });
    }

    // Remove session cookie
    res.clearCookie("momento.sid", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production" || process.env.COOKIE_CROSS_SITE === "true",
      sameSite: process.env.COOKIE_CROSS_SITE === "true" ? "none" : "lax",
      path: "/",
    });

    return res.status(200).json({
      message: "Logout successful",
    });
  });
});

export default router;
