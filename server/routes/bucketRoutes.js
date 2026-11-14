import express from "express";
import mongoose from "mongoose";

import BucketItem from "../models/bucketitem.js";
import Space from "../models/space.js";
import requireAuth from "../middleware/requireAuth.js";

const router = express.Router();

// ==========================================
// FORMAT BUCKET LIST ITEMS
// ==========================================

// Convert MongoDB documents into the format
// expected by the React frontend.

const formatItem = (item) => ({
  id: item._id.toString(),
  text: item.text,
  completed: item.isCompleted,
  createdBy: item.createdBy.toString(),
  createdAt: item.createdAt,
});

// ==========================================
// AUTHENTICATION AND SPACE MEMBERSHIP
// ==========================================

// Every bucket-list operation requires:
// 1. An authenticated user
// 2. Membership in the requested space

router.use(
  "/:spaceId/bucket-items",
  requireAuth,
  async (req, res, next) => {
    try {
      const { spaceId } = req.params;

      if (!mongoose.isValidObjectId(spaceId)) {
        return res.status(404).json({
          message: "Space not found",
        });
      }

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
      console.error("Space verification error:", error);

      res.status(500).json({
        message: "Could not verify space membership",
      });
    }
  }
);

// ==========================================
// GET ALL BUCKET LIST ITEMS
// ==========================================

router.get("/:spaceId/bucket-items", async (req, res) => {
  try {
    const items = await BucketItem.find({
      spaceId: req.space._id,
    }).sort({ createdAt: 1 });

    res.json({
      items: items.map(formatItem),
    });

  } catch (error) {
    console.error("Load bucket list error:", error);

    res.status(500).json({
      message: "Could not load bucket list",
    });
  }
});

// ==========================================
// CREATE A BUCKET LIST ITEM
// ==========================================

router.post("/:spaceId/bucket-items", async (req, res) => {
  try {
    const text =
      typeof req.body?.text === "string"
        ? req.body.text.trim()
        : "";

    if (text.length < 1 || text.length > 120) {
      return res.status(400).json({
        message: "Wish must contain between 1 and 120 characters",
      });
    }

    const item = await BucketItem.create({
      spaceId: req.space._id,
      text,
      isCompleted: false,
      createdBy: req.user._id,
    });

    res.status(201).json({
      message: "Wish created successfully",
      item: formatItem(item),
    });

  } catch (error) {
    console.error("Create wish error:", error);

    res.status(500).json({
      message: "Could not create wish",
    });
  }
});

// ==========================================
// EDIT OR COMPLETE A BUCKET LIST ITEM
// ==========================================

router.patch("/:spaceId/bucket-items/:itemId", async (req, res) => {
  try {
    const { itemId } = req.params;

    if (!mongoose.isValidObjectId(itemId)) {
      return res.status(404).json({
        message: "Wish not found",
      });
    }

    const updates = {};

    // Update wish text if provided
    if (req.body?.text !== undefined) {
      const text =
        typeof req.body.text === "string"
          ? req.body.text.trim()
          : "";

      if (text.length < 1 || text.length > 120) {
        return res.status(400).json({
          message: "Wish must contain between 1 and 120 characters",
        });
      }

      updates.text = text;
    }

    // Update completion status if provided
    if (req.body?.completed !== undefined) {
      if (typeof req.body.completed !== "boolean") {
        return res.status(400).json({
          message: "Completed must be true or false",
        });
      }

      updates.isCompleted = req.body.completed;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        message: "No valid changes provided",
      });
    }

    const item = await BucketItem.findOneAndUpdate(
      {
        _id: itemId,
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

    if (!item) {
      return res.status(404).json({
        message: "Wish not found",
      });
    }

    res.json({
      message: "Wish updated successfully",
      item: formatItem(item),
    });

  } catch (error) {
    console.error("Update wish error:", error);

    res.status(500).json({
      message: "Could not update wish",
    });
  }
});

// ==========================================
// DELETE A BUCKET LIST ITEM
// ==========================================

router.delete("/:spaceId/bucket-items/:itemId", async (req, res) => {
  try {
    const { itemId } = req.params;

    if (!mongoose.isValidObjectId(itemId)) {
      return res.status(404).json({
        message: "Wish not found",
      });
    }

    const item = await BucketItem.findOneAndDelete({
      _id: itemId,
      spaceId: req.space._id,
    });

    if (!item) {
      return res.status(404).json({
        message: "Wish not found",
      });
    }

    res.json({
      message: "Wish deleted successfully",
    });

  } catch (error) {
    console.error("Delete wish error:", error);

    res.status(500).json({
      message: "Could not delete wish",
    });
  }
});

export default router;