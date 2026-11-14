import { randomBytes } from "node:crypto";
import express from "express";
import mongoose from "mongoose";
import Space from "../models/space.js";
import requireAuth from "../middleware/requireAuth.js";

const router = express.Router();

// All space information is private to authenticated members.
router.use(requireAuth);

const spaceView = (space) => ({
  id: space._id.toString(),
  name: space.name,
  ownerId: space.owner.toString(),
  memberCount: space.members.length,
  theme: space.theme,
  inviteCode: space.inviteCode,
});

// A user may be part of several shared spaces.
router.get("/", async (req, res) => {
  try {
    const spaces = await Space.find({ members: req.user._id }).sort({ createdAt: -1 });
    return res.json({ spaces: spaces.map(spaceView) });
  } catch (error) {
    console.error("List spaces error:", error);
    return res.status(500).json({ message: "Could not load your spaces" });
  }
});

router.post("/", async (req, res) => {
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  if (name.length < 2 || name.length > 60) {
    return res.status(400).json({ message: "Space name must be 2–60 characters" });
  }

  // Random codes are independent of usernames, IDs, or personal information.
  // The unique database index is the final guard against the rare collision.
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const space = await Space.create({
        name,
        owner: req.user._id,
        members: [req.user._id],
        inviteCode: randomBytes(6).toString("hex").toUpperCase(),
      });
      return res.status(201).json({ message: "Space created", space: spaceView(space) });
    } catch (error) {
      if (error.code === 11000 && error.keyPattern?.inviteCode) continue;
      console.error("Create space error:", error);
      return res.status(500).json({ message: "Could not create space" });
    }
  }
  return res.status(503).json({ message: "Could not generate an invitation code. Try again." });
});

// Registered users join using a code shared by an existing member.
router.post("/join", async (req, res) => {
  const inviteCode = typeof req.body?.inviteCode === "string"
    ? req.body.inviteCode.trim().replace(/\s+/g, "").toUpperCase()
    : "";

  if (!/^[0-9A-F]{12}$/.test(inviteCode)) {
    return res.status(400).json({ message: "Enter a valid 12-character invitation code" });
  }

  try {
    // Atomic update avoids duplicate membership even with two simultaneous requests.
    const space = await Space.findOneAndUpdate(
      { inviteCode, members: { $ne: req.user._id } },
      { $addToSet: { members: req.user._id } },
      { new: true }
    );

    if (space) return res.json({ message: "You joined the space!", space: spaceView(space) });

    const existingSpace = await Space.findOne({ inviteCode });
    if (!existingSpace) return res.status(404).json({ message: "Invitation code not found" });
    return res.status(409).json({ message: "You're already a member of this space" });
  } catch (error) {
    console.error("Join space error:", error);
    return res.status(500).json({ message: "Could not join space" });
  }
});

router.get("/:spaceId", async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.spaceId)) {
    return res.status(404).json({ message: "Space not found" });
  }

  try {
    const space = await Space.findOne({
      _id: req.params.spaceId,
      members: req.user._id,
    });
    if (!space) return res.status(404).json({ message: "Space not found" });
    return res.json({ space: spaceView(space) });
  } catch (error) {
    console.error("Get space error:", error);
    return res.status(500).json({ message: "Could not load space" });
  }
});

export default router;
