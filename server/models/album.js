
import mongoose from "mongoose";

const albumSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      default: ""
    },
    spaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Space",
      required: true
    },
    coverPhoto: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Photo",
      default: null
    }
  },
  { timestamps: true }
);

const Album = mongoose.model("Album", albumSchema);

export default Album;
