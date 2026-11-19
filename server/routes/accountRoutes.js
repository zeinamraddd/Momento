import express from "express";
import mongoose from "mongoose";
import multer from "multer";
import { GridFSBucket } from "mongodb";
import { Readable } from "node:stream";
import requireAuth from "../middleware/requireAuth.js";
import User from "../models/user.js";
import Space from "../models/space.js";
import { userView } from "../utils/userView.js";
import { accountInput, validate } from "../middleware/validate.js";

const router = express.Router();
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Map([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"],
]);

const avatarBucket = () => new GridFSBucket(mongoose.connection.db, { bucketName: "profilePictures" });

function detectedType(buffer) {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    return "image/png";
  }
  if (buffer.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") {
    return "image/webp";
  }
  return null;
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { files: 1, fileSize: MAX_AVATAR_BYTES },
  fileFilter: (_req, file, callback) => callback(null, ALLOWED_TYPES.has(file.mimetype)),
});

function receiveAvatar(req, res, next) {
  upload.single("avatar")(req, res, (error) => {
    if (error) {
      return res.status(400).json({
        message: error.code === "LIMIT_FILE_SIZE" ? "Profile picture must be 5 MB or smaller" : "Invalid image upload",
      });
    }
    next();
  });
}

router.use(requireAuth);

router.get("/", (req, res) => res.json({ user: userView(req.user) }));

router.patch("/", validate(accountInput), async (req, res) => {
  const username = typeof req.body?.username === "string" ? req.body.username.trim() : "";
  if (username.length < 2 || username.length > 60) {
    return res.status(400).json({ message: "Display name must be 2–60 characters" });
  }

  try {
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: { username } },
      { new: true, runValidators: true }
    );
    if (!user) return res.status(401).json({ message: "Account not found" });
    return res.json({ message: "Profile updated", user: userView(user) });
  } catch (error) {
    console.error("Update profile error:", error);
    return res.status(500).json({ message: "Could not update profile" });
  }
});

router.post("/avatar", receiveAvatar, async (req, res) => {
  const type = req.file && detectedType(req.file.buffer);
  if (!type || type !== req.file.mimetype) {
    return res.status(400).json({ message: "Choose a valid JPG, PNG or WebP image" });
  }

  const bucket = avatarBucket();
  const stream = bucket.openUploadStream(`avatar${ALLOWED_TYPES.get(type)}`, {
    contentType: type,
    metadata: { userId: req.user._id },
  });

  try {
    await new Promise((resolve, reject) => {
      Readable.from(req.file.buffer).pipe(stream).on("finish", resolve).on("error", reject);
    });

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: { avatarFileId: stream.id } },
      { new: true }
    );
    if (!user) throw new Error("Account no longer exists");

    // A failed cleanup must not undo a successful profile update.
    if (req.user.avatarFileId) {
      try { await bucket.delete(req.user.avatarFileId); }
      catch (error) { console.error("Old profile picture cleanup error:", error); }
    }
    return res.json({ message: "Profile picture updated", user: userView(user) });
  } catch (error) {
    try { await bucket.delete(stream.id); } catch { /* Nothing to clean if the upload failed early. */ }
    console.error("Profile picture upload error:", error);
    return res.status(500).json({ message: "Could not save profile picture" });
  }
});

router.delete("/avatar", async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: { avatarFileId: null } },
      { new: true }
    );
    if (!user) return res.status(401).json({ message: "Account not found" });
    if (req.user.avatarFileId) {
      try { await avatarBucket().delete(req.user.avatarFileId); }
      catch (error) { console.error("Profile picture cleanup error:", error); }
    }
    return res.json({ message: "Profile picture removed", user: userView(user) });
  } catch (error) {
    console.error("Remove profile picture error:", error);
    return res.status(500).json({ message: "Could not remove profile picture" });
  }
});

// Avatar images are visible only to the account owner and people sharing a space.
router.get("/avatar/:userId", async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.userId)) {
    return res.status(404).json({ message: "Profile picture not found" });
  }

  try {
    if (String(req.user._id) !== req.params.userId) {
      const sharedSpace = await Space.exists({
        members: mongoose.trusted({ $all: [req.user._id, new mongoose.Types.ObjectId(req.params.userId)] }),
      });
      if (!sharedSpace) return res.status(404).json({ message: "Profile picture not found" });
    }

    const user = await User.findById(req.params.userId).select("avatarFileId");
    if (!user?.avatarFileId) return res.status(404).json({ message: "Profile picture not found" });

    const bucket = avatarBucket();
    const files = await bucket.find({ _id: user.avatarFileId }).toArray();
    if (!files.length) return res.status(404).json({ message: "Profile picture not found" });

    const contentType = files[0].contentType;
    if (!ALLOWED_TYPES.has(contentType)) return res.status(404).json({ message: "Invalid profile picture" });

    res.set("Content-Type", contentType);
    res.set("Cache-Control", "private, no-store");
    bucket.openDownloadStream(user.avatarFileId)
      .on("error", (error) => {
        console.error("Profile picture download error:", error);
        if (!res.headersSent) res.status(500).end();
        else res.destroy();
      })
      .pipe(res);
  } catch (error) {
    console.error("Load profile picture error:", error);
    if (!res.headersSent) return res.status(500).json({ message: "Could not load profile picture" });
  }
});

export default router;
