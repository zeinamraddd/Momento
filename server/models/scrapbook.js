
import mongoose from "mongoose";

const elementSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true
    },
    type: {
      type: String,
      enum: ["text", "photo", "sticker", "decoration"],
      required: true
    },
    page: { type: Number, enum: [0, 1], default: 0 },
    content: {
      type: String,
      default: ""
    },
    photoId: { type: mongoose.Schema.Types.ObjectId, ref: "Photo", default: null },
    imageUrl: {
      type: String,
      default: ""
    },
    x: {
      type: Number,
      default: 0
    },
    y: {
      type: Number,
      default: 0
    },
    w: { type: Number, default: 40 },
    h: { type: Number, default: 35 },
    rotation: { type: Number, default: 0 },
    fontSize: { type: Number, default: 24 },
    fontFamily: { type: String, enum: ["hand", "serif", "sans"], default: "hand" },
    color: { type: String, default: "#30251d" }
  },
  { _id: false }
);

const scrapbookPageSchema = new mongoose.Schema(
  {
    albumId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Album",
      required: true
    },
    // Each album photo has one collaboratively editable two-page spread.
    photoId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Photo",
      required: true
    },
    pageNumber: {
      type: Number,
      required: true
    },
    layout: {
      type: String,
      enum: ["classic", "collage", "minimal"],
      default: "classic"
    },
    backgroundLeft: {
      type: String,
      enum: ["lined", "plain", "dots", "grid"],
      default: "lined"
    },
    backgroundRight: {
      type: String,
      enum: ["lined", "plain", "dots", "grid"],
      default: "plain"
    },
    revision: {
      type: Number,
      default: 0
    },
    elements: [elementSchema]
  },
  { timestamps: true }
);

scrapbookPageSchema.index(
  { albumId: 1, photoId: 1 },
  { unique: true, partialFilterExpression: { photoId: { $exists: true } } }
);

const ScrapbookPage = mongoose.model(
  "ScrapbookPage",
  scrapbookPageSchema,
  "scrapbookPages"
);

export default ScrapbookPage;
