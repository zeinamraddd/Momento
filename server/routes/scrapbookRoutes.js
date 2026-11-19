import express from "express";
import mongoose from "mongoose";
import requireAuth from "../middleware/requireAuth.js";
import Space from "../models/space.js";
import Album from "../models/album.js";
import Photo from "../models/photo.js";
import ScrapbookPage from "../models/scrapbook.js";

const router = express.Router();
const validId = (id) => mongoose.isValidObjectId(id);
const layouts = new Set(["classic", "collage", "minimal"]);
const backgrounds = new Set(["lined", "plain", "dots", "grid"]);
const fonts = new Set(["hand", "serif", "sans"]);
const tapes = new Set(["pink", "blue", "beige", "yellow", "sage", "red-orange"]);
const numbers = (value, min, max) =>
  typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;

// Verify membership and the ownership chain for every selected album photo.
router.use("/:spaceId/albums/:albumId/photos/:photoId/scrapbook", requireAuth, async (req, res, next) => {
  const { spaceId, albumId, photoId } = req.params;
  if (![spaceId, albumId, photoId].every(validId)) {
    return res.status(404).json({ message: "Scrapbook photo not found" });
  }
  try {
    const space = await Space.findOne({ _id: spaceId, members: req.user._id });
    if (!space) return res.status(404).json({ message: "Space not found or access denied" });
    const album = await Album.findOne({ _id: albumId, spaceId: space._id });
    if (!album) return res.status(404).json({ message: "Album not found" });
    const photo = await Photo.findOne({ _id: photoId, albumId: album._id });
    if (!photo) return res.status(404).json({ message: "Photo not found" });
    req.scrapbookAlbum = album;
    req.scrapbookPhoto = photo;
    next();
  } catch (error) {
    console.error("Scrapbook membership error:", error);
    return res.status(500).json({ message: "Could not open scrapbook" });
  }
});

function defaultPage(photoId) {
  return {
    layout: "classic",
    backgroundLeft: "lined",
    backgroundRight: "plain",
    revision: 0,
    elements: [{
      id: "original-" + photoId,
      type: "photo",
      page: 0,
      photoId: String(photoId),
      content: "",
      imageUrl: "",
      x: 14,
      y: 16,
      w: 72,
      h: 58,
      rotation: -4,
      fontSize: 24,
      fontFamily: "hand",
      color: "#30251d",
    }],
  };
}

router.get("/:spaceId/albums/:albumId/photos/:photoId/scrapbook", async (req, res) => {
  try {
    const page = await ScrapbookPage.findOne({
      albumId: req.scrapbookAlbum._id,
      photoId: req.scrapbookPhoto._id,
    }).lean();
    res.json({ page: page || defaultPage(req.scrapbookPhoto._id) });
  } catch (error) {
    console.error("Load scrapbook error:", error);
    res.status(500).json({ message: "Could not load scrapbook page" });
  }
});

function validateElements(elements) {
  if (!Array.isArray(elements) || elements.length > 80) {
    throw new Error("A scrapbook page can contain at most 80 items");
  }
  return elements.map((item) => {
    if (!item || typeof item !== "object" || !["text", "photo", "sticker", "decoration"].includes(item.type)) {
      throw new Error("Invalid scrapbook item");
    }
    if (typeof item.id !== "string" || item.id.length < 1 || item.id.length > 90 ||
        ![0, 1].includes(item.page) ||
        !numbers(item.x, 0, 100) || !numbers(item.y, 0, 100) ||
        !numbers(item.w, 5, 100) || !numbers(item.h, 5, 100) ||
        !numbers(item.rotation, -180, 180)) {
      throw new Error("Invalid item position or size");
    }
    const result = {
      id: item.id,
      type: item.type,
      page: item.page,
      x: item.x,
      y: item.y,
      w: item.w,
      h: item.h,
      rotation: item.rotation,
      content: "",
      imageUrl: "",
      photoId: null,
      fontSize: 24,
      fontFamily: "hand",
      color: "#30251d",
    };

    if (item.type === "text") {
      if (typeof item.content !== "string" || item.content.length > 1000 ||
          !numbers(item.fontSize, 12, 64) || !fonts.has(item.fontFamily) ||
          !/^#[0-9a-fA-F]{6}$/.test(item.color)) {
        throw new Error("Invalid text formatting");
      }
      Object.assign(result, {
        content: item.content,
        fontSize: item.fontSize,
        fontFamily: item.fontFamily,
        color: item.color,
      });
    } else if (item.type === "photo") {
      if (!validId(item.photoId)) throw new Error("Invalid album photo");
      result.photoId = item.photoId;
    } else if (item.type === "sticker") {
      if (typeof item.imageUrl !== "string" ||
          !/^\/stickers\/(?:letters|numbers|pixel_art|stamps)\/[A-Za-z0-9_-]+\.png$/.test(item.imageUrl)) {
        throw new Error("Invalid sticker");
      }
      result.imageUrl = item.imageUrl;
    } else if (item.type === "decoration") {
      if (!tapes.has(item.content)) throw new Error("Invalid washi tape");
      result.content = item.content;
    }
    return result;
  });
}

router.put("/:spaceId/albums/:albumId/photos/:photoId/scrapbook", async (req, res) => {
  const { layout, backgroundLeft, backgroundRight, elements, revision } = req.body || {};
  if (!layouts.has(layout) || !backgrounds.has(backgroundLeft) ||
      !backgrounds.has(backgroundRight) || !Number.isInteger(revision) ||
      revision < 0) {
    return res.status(400).json({ message: "Invalid scrapbook settings" });
  }

  let cleanElements;
  try {
    cleanElements = validateElements(elements);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }

  try {
    const photoIds = [...new Set(
      cleanElements.filter((item) => item.type === "photo").map((item) => String(item.photoId))
    )];
    if (photoIds.length) {
      const count = await Photo.countDocuments({
        _id: mongoose.trusted({ $in: photoIds }),
        albumId: req.scrapbookAlbum._id,
      });
      if (count !== photoIds.length) {
        return res.status(400).json({ message: "Photos must belong to this album" });
      }
    }

    // Compare-and-save prevents a friend from silently overwriting another friend's changes.
    const page = await ScrapbookPage.findOneAndUpdate(
      { albumId: req.scrapbookAlbum._id, photoId: req.scrapbookPhoto._id, revision },
      {
        $set: { layout, backgroundLeft, backgroundRight, elements: cleanElements, revision: revision + 1 },
        $setOnInsert: { pageNumber: 1 },
      },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );
    return res.json({ page, message: "Scrapbook page saved" });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: "A friend updated this scrapbook page. Reload to see their changes before saving.",
      });
    }
    console.error("Save scrapbook error:", error);
    return res.status(500).json({ message: "Could not save scrapbook page" });
  }
});

export default router;
