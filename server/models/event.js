import mongoose from "mongoose";

// ==========================================
// EVENT SCHEMA
// ==========================================

const eventSchema = new mongoose.Schema(
  {
    // The shared scrapbook this event belongs to
    spaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Space",
      required: true,
    },

    // Event title
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },

    // Optional event description
    description: {
      type: String,
      default: "",
    },

    // Event date
    date: {
      type: Date,
      required: true,
    },

    // Optional event time, e.g. "19:30"
    time: {
      type: String,
      default: "",
    },

    // Event color
    ccolor: {
      type: String,
      enum: [
        "pink",
        "blue",
        "orange",
        "green",
        "purple",
        "yellow",
        "teal",
        "coral",
        "indigo",
        "sage",
      ],
      default: "pink",
      },
    // User who created the event
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// ==========================================
// EVENT MODEL
// ==========================================

const Event = mongoose.model(
  "Event",
  eventSchema,
  "events"
);

export default Event;