import express from "express";
import mongoose from "mongoose";

import Event from "../models/event.js";
import Space from "../models/space.js";
import requireAuth from "../middleware/requireAuth.js";
import { getMemberColor } from "../utils/memberColors.js";
const router = express.Router();

// ==========================================
// VALIDATION HELPERS
// ==========================================

// Validate optional time in HH:mm format
const isValidTime = (time) => {
  return (
    time === "" ||
    /^([01]\d|2[0-3]):[0-5]\d$/.test(time)
  );
};

// Convert YYYY-MM-DD into a UTC Date.
// This prevents local timezone shifts.
const parseEventDate = (dateString) => {
  if (
    typeof dateString !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(dateString)
  ) {
    return null;
  }

  const date = new Date(`${dateString}T00:00:00.000Z`);

  // Reject invalid dates such as February 30
  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== dateString
  ) {
    return null;
  }

  return date;
};

// ==========================================
// FORMAT EVENTS FOR REACT
// ==========================================

const formatEvent = (event, space) => ({
  id: event._id.toString(),
  title: event.title,

  // React expects YYYY-MM-DD
  date: event.date.toISOString().slice(0, 10),

  time: event.time || "",
  color:
  getMemberColor(space, event.createdBy) ||
  event.color ||
  "pink",

  description: event.description || "",
  createdBy: event.createdBy.toString(),
  createdAt: event.createdAt,
});

// ==========================================
// VERIFY AUTHENTICATION AND SPACE MEMBERSHIP
// ==========================================

router.use(
  "/:spaceId/events",
  requireAuth,
  async (req, res, next) => {
    try {
      const { spaceId } = req.params;

      if (!mongoose.isValidObjectId(spaceId)) {
        return res.status(404).json({
          message: "Space not found",
        });
      }

      // Only members can access this space's events
      const space = await Space.findOne({
        _id: spaceId,
        members: req.user._id,
      });

      if (!space) {
        return res.status(404).json({
          message: "Space not found",
        });
      }

      req.space = space;

      next();

    } catch (error) {
      console.error("Event membership error:", error);

      res.status(500).json({
        message: "Could not verify space membership",
      });
    }
  }
);

// ==========================================
// GET ALL EVENTS FOR A SPACE
// ==========================================

router.get("/:spaceId/events", async (req, res) => {
  try {
    const events = await Event.find({
      spaceId: req.space._id,
    }).sort({
      date: 1,
      time: 1,
    });

    res.json({
        events: events.map((event) =>
            formatEvent(event, req.space)
        ),
        });

  } catch (error) {
    console.error("Load events error:", error);

    res.status(500).json({
      message: "Could not load events",
    });
  }
});

// ==========================================
// CREATE AN EVENT
// ==========================================

router.post("/:spaceId/events", async (req, res) => {
  try {
    const title =
      typeof req.body?.title === "string"
        ? req.body.title.trim()
        : "";

    const date = parseEventDate(req.body?.date);

    const time = req.body?.time ?? "";
    // Automatically assign the creator's color
        const color = getMemberColor(
        req.space,
        req.user._id
        );

    // Validate title
    if (title.length < 1 || title.length > 80) {
      return res.status(400).json({
        message: "Event title must contain 1–80 characters",
      });
    }

    // Validate date
    if (!date) {
      return res.status(400).json({
        message: "Enter a valid event date",
      });
    }

    // Validate time
    if (typeof time !== "string" || !isValidTime(time)) {
      return res.status(400).json({
        message: "Enter a valid event time",
      });
    }


    // Save event to MongoDB
    const event = await Event.create({
      spaceId: req.space._id,
      title,
      date,
      time,
      color,
      createdBy: req.user._id,
    });

    res.status(201).json({
      message: "Event created successfully",
      event: formatEvent(event, req.space),
    });

  } catch (error) {
    console.error("Create event error:", error);

    res.status(500).json({
      message: "Could not create event",
    });
  }
});

// ==========================================
// EDIT AN EVENT
// ==========================================

router.patch("/:spaceId/events/:eventId", async (req, res) => {
  try {
    const { eventId } = req.params;

    if (!mongoose.isValidObjectId(eventId)) {
      return res.status(404).json({
        message: "Event not found",
      });
    }

    const updates = {};

    // Update title
    if (req.body?.title !== undefined) {
      const title =
        typeof req.body.title === "string"
          ? req.body.title.trim()
          : "";

      if (title.length < 1 || title.length > 80) {
        return res.status(400).json({
          message: "Event title must contain 1–80 characters",
        });
      }

      updates.title = title;
    }

    // Update date
    if (req.body?.date !== undefined) {
      const date = parseEventDate(req.body.date);

      if (!date) {
        return res.status(400).json({
          message: "Enter a valid event date",
        });
      }

      updates.date = date;
    }

    // Update time
    if (req.body?.time !== undefined) {
      if (
        typeof req.body.time !== "string" ||
        !isValidTime(req.body.time)
      ) {
        return res.status(400).json({
          message: "Enter a valid event time",
        });
      }

      updates.time = req.body.time;
    }

    

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        message: "No valid changes provided",
      });
    }

    // Update only an event belonging to this space
    const event = await Event.findOneAndUpdate(
      {
        _id: eventId,
        spaceId: req.space._id,
      },
      {
        $set: updates,
      },
      {
        returnDocument: "after",
        runValidators: true,
      }
    );

    if (!event) {
      return res.status(404).json({
        message: "Event not found",
      });
    }

    res.json({
      message: "Event updated successfully",
      event: formatEvent(event, req.space),
    });

  } catch (error) {
    console.error("Update event error:", error);

    res.status(500).json({
      message: "Could not update event",
    });
  }
});

// ==========================================
// DELETE AN EVENT
// ==========================================

router.delete("/:spaceId/events/:eventId", async (req, res) => {
  try {
    const { eventId } = req.params;

    if (!mongoose.isValidObjectId(eventId)) {
      return res.status(404).json({
        message: "Event not found",
      });
    }

    const event = await Event.findOneAndDelete({
      _id: eventId,
      spaceId: req.space._id,
    });

    if (!event) {
      return res.status(404).json({
        message: "Event not found",
      });
    }

    res.json({
      message: "Event deleted successfully",
    });

  } catch (error) {
    console.error("Delete event error:", error);

    res.status(500).json({
      message: "Could not delete event",
    });
  }
});

export default router;