
import mongoose from "mongoose";

const stickyNoteSchema = new mongoose.Schema(
  {
    spaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Space",
      required: true
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    content: {
      type: String,
      required: true
    },
    color: {
      type: String,
      default: "yellow"
    }
  },
  { timestamps: true }
);

const StickyNote = mongoose.model(
  "StickyNote",
  stickyNoteSchema,
  "stickyNotes"
);

export default StickyNote;