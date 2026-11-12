
import mongoose from "mongoose";

const eventSchema = new mongoose.Schema(
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
    description: {
      type: String,
      default: ""
    },
    date: {
      type: Date,
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

const Event = mongoose.model("Event", eventSchema, "events");

export default Event;