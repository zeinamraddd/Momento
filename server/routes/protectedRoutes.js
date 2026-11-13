
import express from "express";
import requireAuth from "../middleware/requireAuth.js";

const router = express.Router();

// Protected route - Only logged-in users can access
router.get("/dashboard", requireAuth, (req, res) => {
  return res.status(200).json({
    message: "Welcome to Momento!",
    user: {
      id: req.user._id,
      username: req.user.username,
      email: req.user.email,
    },
  });
});

export default router;
