
import mongoose from "mongoose";

// Each alternative version belongs to one contributor.
const loreVersionSchema = new mongoose.Schema(
  {
    content: {
      type: String,
      required: true,
      trim: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

// Main Lore Card schema.
const loreCardSchema = new mongoose.Schema(
  {
    spaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Space",
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    quote: {
      type: String,
      required: true,
      trim: true,
    },
    context: {
      type: String,
      required: true,
      trim: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    versions: [loreVersionSchema],
    reactions: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
  },
  { timestamps: true }
);

// Helps retrieve cards belonging to a specific space.
loreCardSchema.index({ spaceId: 1, createdAt: -1 });

const LoreCard = mongoose.model(
  "LoreCard",
  loreCardSchema,
  "loreCards"
);

export default LoreCard;
