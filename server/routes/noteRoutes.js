import express from "express";
import mongoose from "mongoose";

import StickyNote from "../models/stickynote.js";
import Space from "../models/space.js";
import requireAuth from "../middleware/requireAuth.js";

const router = express.Router();

// ==========================================
// HELPER — FORMAT A NOTE
// ==========================================

// Convert MongoDB documents into a format
// that our React frontend can easily use.

const formatNote = (note) => ({
  id: note._id.toString(),
  text: note.content,
  author: note.userId?.username || "Unknown",
  authorId: note.userId?._id?.toString() || "",
  color: note.color,
  createdAt: note.createdAt,
});

// ==========================================
// MIDDLEWARE — VERIFY SPACE MEMBERSHIP
// ==========================================

// Every notes request must come from a
// logged-in member of the selected space.

router.use("/:spaceId/notes", requireAuth, async (req, res, next) => {
  try {
    const { spaceId } = req.params;

    // Validate MongoDB ID
    if (!mongoose.isValidObjectId(spaceId)) {
      return res.status(404).json({
        message: "Space not found",
      });
    }

    // Check whether the logged-in user
    // belongs to this space.
    const space = await Space.findOne({
      _id: spaceId,
      members: req.user._id,
    });

    if (!space) {
      return res.status(404).json({
        message: "Space not found or access denied",
      });
    }

    // Store the verified space for the routes
    req.space = space;

    next();

  } catch (error) {
    console.error("Space membership error:", error);

    return res.status(500).json({
      message: "Could not verify space membership",
    });
  }
});

// ==========================================
// GET — RETRIEVE SPACE NOTES
// ==========================================

router.get("/:spaceId/notes", async (req, res) => {
  try {
    // Retrieve notes belonging only to this space
    const notes = await StickyNote.find({
      spaceId: req.space._id,
    })
      .sort({ createdAt: -1 })
      .populate("userId", "username");

    return res.status(200).json({
      notes: notes.map(formatNote),
    });

  } catch (error) {
    console.error("Get notes error:", error);

    return res.status(500).json({
      message: "Could not load notes",
    });
  }
});

// ==========================================
// POST — CREATE A STICKY NOTE
// ==========================================

router.post("/:spaceId/notes", async (req, res) => {
  try {
    const text =
      typeof req.body?.text === "string"
        ? req.body.text.trim()
        : "";

    // Validate note content
    if (!text || text.length > 240) {
      return res.status(400).json({
        message: "Note must contain 1–240 characters",
      });
    }

    // Save the note in MongoDB
    const note = await StickyNote.create({
      spaceId: req.space._id,
      userId: req.user._id,
      content: text,
    });

    // Retrieve the author's username
    await note.populate("userId", "username");

    return res.status(201).json({
      message: "Note created successfully",
      note: formatNote(note),
    });

  } catch (error) {
    console.error("Create note error:", error);

    return res.status(500).json({
      message: "Could not create note",
    });
  }
});

// ==========================================
// PATCH — EDIT A STICKY NOTE
// ==========================================

router.patch("/:spaceId/notes/:noteId", async (req, res) => {
  try {
    const { noteId } = req.params;

    if (!mongoose.isValidObjectId(noteId)) {
      return res.status(404).json({
        message: "Note not found",
      });
    }

    const text =
      typeof req.body?.text === "string"
        ? req.body.text.trim()
        : "";

    if (!text || text.length > 240) {
      return res.status(400).json({
        message: "Note must contain 1–240 characters",
      });
    }

    // Any member can edit a note,
    // but only inside their own space.
    const note = await StickyNote.findOneAndUpdate(
      {
        _id: noteId,
        spaceId: req.space._id,
      },
      {
        $set: { content: text },
      },
      {
        returnDocument: "after",
        runValidators: true,
      }
    ).populate("userId", "username");

    if (!note) {
      return res.status(404).json({
        message: "Note not found",
      });
    }

    return res.status(200).json({
      message: "Note updated successfully",
      note: formatNote(note),
    });

  } catch (error) {
    console.error("Update note error:", error);

    return res.status(500).json({
      message: "Could not update note",
    });
  }
});

// ==========================================
// DELETE — REMOVE A STICKY NOTE
// ==========================================

router.delete("/:spaceId/notes/:noteId", async (req, res) => {
  try {
    const { noteId } = req.params;

    if (!mongoose.isValidObjectId(noteId)) {
      return res.status(404).json({
        message: "Note not found",
      });
    }

    // Delete only if the note belongs
    // to the selected space.
    const note = await StickyNote.findOneAndDelete({
      _id: noteId,
      spaceId: req.space._id,
    });

    if (!note) {
      return res.status(404).json({
        message: "Note not found",
      });
    }

    return res.status(200).json({
      message: "Note deleted successfully",
    });

  } catch (error) {
    console.error("Delete note error:", error);

    return res.status(500).json({
      message: "Could not delete note",
    });
  }
});

export default router;