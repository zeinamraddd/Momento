
import mongoose from "mongoose";

const photoSchema = new mongoose.Schema(
  {
    albumId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Album",
      required: true
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    imageUrl: {
      type: String,
      required: true
    },
    caption: {
      type: String,
      default: ""
    }
  },
  { timestamps: true }
);

const Photo = mongoose.model("Photo", photoSchema, "photos");

export default Photo;