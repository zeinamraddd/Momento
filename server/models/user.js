
import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    passwordHash: {
      type: String,
      required: true
    },
    // The actual image bytes live in MongoDB GridFS, just like album photos.
    avatarFileId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null
    },
    // Single-use email reset tokens are stored as SHA-256 hashes, not raw links.
    passwordResetTokenHash: { type: String, select: false, default: null },
    passwordResetExpiresAt: { type: Date, select: false, default: null },
    // Incrementing this value after reset invalidates previously issued sessions.
    sessionVersion: { type: Number, default: 0 },

    // A remembered browser receives a random cookie. Only its hash is saved.
    trustedDeviceHashes: {
      type: [String],
      default: [],
      select: false
    }
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema, "users");

export default User;
