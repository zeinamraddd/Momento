
import mongoose from "mongoose";

const bucketItemSchema = new mongoose.Schema(
  {
    spaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Space",
      required: true
    },
    text: {
      type: String,
      required: true
    },
    isCompleted: {
      type: Boolean,
      default: false
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    }
  },
  { timestamps: true }
);

const BucketItem = mongoose.model(
  "BucketItem",
  bucketItemSchema,
  "bucketItems"
);

export default BucketItem;