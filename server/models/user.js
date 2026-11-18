
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
    }
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema, "users");

export default User;
