
import User from "../models/user.js";

// Middleware to protect private routes
const requireAuth = async (req, res, next) => {
  try {
    // Check if the user has an active session
    if (!req.session?.userId) {
      return res.status(401).json({
        message: "Authentication required",
      });
    }

    // Check if the user still exists
    const user = await User.findById(
      req.session.userId
    ).select("-passwordHash");

    if (!user) {
      return res.status(401).json({
        message: "Authentication required",
      });
    }

    // Make user available to the next route
    req.user = user;

    // Allow access
    next();
  } catch (error) {
    console.error("Authentication error:", error);

    return res.status(500).json({
      message: "Server error",
    });
  }
};

export default requireAuth;
