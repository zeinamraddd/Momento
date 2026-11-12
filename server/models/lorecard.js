
import mongoose from "mongoose";

const loreCardSchema = new mongoose.Schema(
  {
    spaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Space",
      required: true
    },
    title: {
      type: String,
      required: true
    },
    context: {
      type: String,
      required: true
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    }
  },
  { timestamps: true }
);

const LoreCard = mongoose.model("LoreCard", loreCardSchema, "loreCards");

export default LoreCard;