
import express from "express";
import mongoose from "mongoose";

import LoreCard from "../models/lorecard.js";
import Space from "../models/space.js";
import requireAuth from "../middleware/requireAuth.js";

const router = express.Router();

// Verify authentication and space membership.
router.use("/:spaceId/lore", requireAuth, async (req, res, next) => {
  try {
    const { spaceId } = req.params;

    if (!mongoose.isValidObjectId(spaceId)) {
      return res.status(404).json({ message: "Space not found" });
    }

    const space = await Space.findOne({
      _id: spaceId,
      members: req.user._id,
    });

    if (!space) {
      return res.status(404).json({
        message: "Space not found or access denied",
      });
    }

    req.space = space;
    next();
  } catch (error) {
    console.error("Lore membership error:", error);
    return res.status(500).json({
      message: "Could not verify space membership",
    });
  }
});

// Format a card for the frontend.

const formatLoreCard = (card, currentUserId) => ({
  id: card._id.toString(),
  title: card.title,
  quote: card.quote,
  context: card.context,
  createdBy: card.createdBy?._id?.toString() || card.createdBy?.toString(),
  creatorName: card.createdBy?.username || "Unknown",
  createdAt: card.createdAt,
  updatedAt: card.updatedAt,
  versions: card.versions.map((version) => ({
    id: version._id.toString(),
    content: version.content,
    userId: version.userId?._id?.toString() || version.userId?.toString(),
    contributorName: version.userId?.username || "Unknown",
    createdAt: version.createdAt,
    updatedAt: version.updatedAt,
  })),
  reactions: card.reactions.map((user) =>
    user?._id?.toString() || user.toString()
  ),
  reactionCount: card.reactions.length,
  hasReacted: card.reactions.some(
    (user) => (user?._id || user).toString() === currentUserId.toString()
  ),
});


// GET all cards in the selected space.
router.get("/:spaceId/lore", async (req, res) => {
  try {
    const cards = await LoreCard.find({
      spaceId: req.space._id,
    })
      .sort({ createdAt: -1 })
      .populate("createdBy", "username")
      .populate("versions.userId", "username");

    return res.status(200).json({
    cards: cards.map((card) => formatLoreCard(card, req.user._id)),});
  } catch (error) {
    console.error("Get lore cards error:", error);
    return res.status(500).json({
      message: "Could not load Lore Cards",
    });
  }
});

// CREATE a Lore Card.
router.post("/:spaceId/lore", async (req, res) => {
  try {
    const title = typeof req.body?.title === "string"
      ? req.body.title.trim() : "";
    const quote = typeof req.body?.quote === "string"
      ? req.body.quote.trim() : "";
    const context = typeof req.body?.context === "string"
      ? req.body.context.trim() : "";

    if (!title || !quote || !context) {
      return res.status(400).json({
        message: "Title, quote, and context are required",
      });
    }

    if (title.length > 100 || quote.length > 240 || context.length > 5000) {
      return res.status(400).json({
        message: "One or more fields exceed the allowed length",
      });
    }

    const card = await LoreCard.create({
      spaceId: req.space._id,
      title,
      quote,
      context,
      createdBy: req.user._id,
    });

    await card.populate("createdBy", "username");

    card.currentUserId = req.user._id;

    return res.status(201).json({
      message: "Lore Card created successfully",
     card: formatLoreCard(card, req.user._id),
    });
  } catch (error) {
    console.error("Create Lore Card error:", error);
    return res.status(500).json({
      message: "Could not create Lore Card",
    });
  }
});

// EDIT a Lore Card's original title, quote, and context.
router.patch("/:spaceId/lore/:cardId", async (req, res) => {
  try {
    const { cardId } = req.params;

    if (!mongoose.isValidObjectId(cardId)) {
      return res.status(404).json({ message: "Lore Card not found" });
    }

    const updates = {};
    for (const field of ["title", "quote", "context"]) {
      if (typeof req.body?.[field] === "string") {
        updates[field] = req.body[field].trim();
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: "No valid fields provided" });
    }

    if (
      (updates.title !== undefined && (!updates.title || updates.title.length > 100)) ||
      (updates.quote !== undefined && (!updates.quote || updates.quote.length > 240)) ||
      (updates.context !== undefined && (!updates.context || updates.context.length > 5000))
    ) {
      return res.status(400).json({ message: "Invalid field length or empty value" });
    }

    const card = await LoreCard.findOneAndUpdate(
      { _id: cardId, spaceId: req.space._id },
      { $set: updates },
      { returnDocument: "after", runValidators: true }
    )
      .populate("createdBy", "username")
      .populate("versions.userId", "username");

    if (!card) {
      return res.status(404).json({ message: "Lore Card not found" });
    }

    card.currentUserId = req.user._id;

    return res.status(200).json({
      message: "Lore Card updated successfully",
      card: formatLoreCard(card, req.user._id),
    });
  } catch (error) {
    console.error("Update Lore Card error:", error);
    return res.status(500).json({
      message: "Could not update Lore Card",
    });
  }
});

// DELETE a Lore Card.
router.delete("/:spaceId/lore/:cardId", async (req, res) => {
  try {
    const { cardId } = req.params;

    if (!mongoose.isValidObjectId(cardId)) {
      return res.status(404).json({ message: "Lore Card not found" });
    }

    const card = await LoreCard.findOneAndDelete({
      _id: cardId,
      spaceId: req.space._id,
    });

    if (!card) {
      return res.status(404).json({ message: "Lore Card not found" });
    }

    return res.status(200).json({
      message: "Lore Card deleted successfully",
    });
  } catch (error) {
    console.error("Delete Lore Card error:", error);
    return res.status(500).json({
      message: "Could not delete Lore Card",
    });
  }
});
// ADD AN ALTERNATIVE STORY
router.post("/:spaceId/lore/:cardId/versions", async (req, res) => {
  try {
    const { cardId } = req.params;
    const content = typeof req.body?.content === "string"
      ? req.body.content.trim()
      : "";

    if (!mongoose.isValidObjectId(cardId)) {
      return res.status(404).json({ message: "Lore Card not found" });
    }

    if (!content || content.length > 5000) {
      return res.status(400).json({ message: "Invalid story version" });
    }

    const card = await LoreCard.findOne({
      _id: cardId,
      spaceId: req.space._id,
    });

    if (!card) {
      return res.status(404).json({ message: "Lore Card not found" });
    }

    card.versions.push({
      content,
      userId: req.user._id,
    });

    await card.save();
    await card.populate("createdBy", "username");
    await card.populate("versions.userId", "username");

    return res.status(201).json({
      message: "Alternative story added successfully",
      card: formatLoreCard(card, req.user._id),
    });
  } catch (error) {
    console.error("Add story version error:", error);
    return res.status(500).json({
      message: "Could not add alternative story",
    });
  }
});
// EDIT YOUR OWN ALTERNATIVE STORY
router.patch(
  "/:spaceId/lore/:cardId/versions/:versionId",
  async (req, res) => {
    try {
      const { cardId, versionId } = req.params;
      const content = typeof req.body?.content === "string"
        ? req.body.content.trim()
        : "";

      if (
        !mongoose.isValidObjectId(cardId) ||
        !mongoose.isValidObjectId(versionId)
      ) {
        return res.status(404).json({ message: "Version not found" });
      }

      if (!content || content.length > 5000) {
        return res.status(400).json({ message: "Invalid story version" });
      }

      const card = await LoreCard.findOne({
        _id: cardId,
        spaceId: req.space._id,
      });

      if (!card) {
        return res.status(404).json({ message: "Lore Card not found" });
      }

      const version = card.versions.id(versionId);

      if (!version) {
        return res.status(404).json({ message: "Version not found" });
      }

      if (version.userId.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          message: "You can only edit your own versions",
        });
      }

      version.content = content;
      await card.save();

      await card.populate("createdBy", "username");
      await card.populate("versions.userId", "username");

      return res.status(200).json({
        message: "Version updated successfully",
        card: formatLoreCard(card, req.user._id),
      });
    } catch (error) {
      console.error("Edit story version error:", error);
      return res.status(500).json({
        message: "Could not update story version",
      });
    }
  }
);
// DELETE YOUR OWN ALTERNATIVE STORY
router.delete(
  "/:spaceId/lore/:cardId/versions/:versionId",
  async (req, res) => {
    try {
      const { cardId, versionId } = req.params;

      if (
        !mongoose.isValidObjectId(cardId) ||
        !mongoose.isValidObjectId(versionId)
      ) {
        return res.status(404).json({ message: "Version not found" });
      }

      const card = await LoreCard.findOne({
        _id: cardId,
        spaceId: req.space._id,
      });

      if (!card) {
        return res.status(404).json({ message: "Lore Card not found" });
      }

      const version = card.versions.id(versionId);

      if (!version) {
        return res.status(404).json({ message: "Version not found" });
      }

      if (version.userId.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          message: "You can only delete your own versions",
        });
      }

      version.deleteOne();
      await card.save();

      return res.status(200).json({
        message: "Alternative story deleted successfully",
      });
    } catch (error) {
      console.error("Delete story version error:", error);
      return res.status(500).json({
        message: "Could not delete story version",
      });
    }
  }
);

// TOGGLE "STILL FUNNY" REACTION
router.post("/:spaceId/lore/:cardId/reactions", async (req, res) => {
  try {
    const { cardId } = req.params;

    if (!mongoose.isValidObjectId(cardId)) {
      return res.status(404).json({ message: "Lore Card not found" });
    }

    const card = await LoreCard.findOne({
      _id: cardId,
      spaceId: req.space._id,
    });

    if (!card) {
      return res.status(404).json({ message: "Lore Card not found" });
    }

    const alreadyReacted = card.reactions.some(
      (userId) => userId.toString() === req.user._id.toString()
    );

    const updatedCard = await LoreCard.findOneAndUpdate(
      {
        _id: cardId,
        spaceId: req.space._id,
      },
      alreadyReacted
        ? { $pull: { reactions: req.user._id } }
        : { $addToSet: { reactions: req.user._id } },
      { returnDocument: "after" }
    )
      .populate("createdBy", "username")
      .populate("versions.userId", "username");

    return res.status(200).json({
      message: alreadyReacted ? "Reaction removed" : "Reaction added",
      card: formatLoreCard(updatedCard, req.user._id),
    });
  } catch (error) {
    console.error("Toggle reaction error:", error);
    return res.status(500).json({
      message: "Could not update reaction",
    });
  }
});

export default router;
