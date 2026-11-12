
import mongoose from "mongoose";

const spaceSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    members: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
      }
    ],
    theme: {
      type: String,
      default: "classic"
    },
    inviteCode: {
      type: String,
      unique: true,
      required: true
    }
  },
  { timestamps: true }
);

const Space = mongoose.model("Space", spaceSchema, "spaces");

export default Space;
