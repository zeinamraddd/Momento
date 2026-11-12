
import mongoose from "mongoose";

const elementSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["text", "photo", "sticker", "decoration"],
      required: true
    },
    content: {
      type: String,
      default: ""
    },
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
    }
  },
  { _id: true }
);

const scrapbookPageSchema = new mongoose.Schema(
  {
    albumId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Album",
      required: true
    },
    pageNumber: {
      type: Number,
      required: true
    },
    layout: {
      type: String,
      default: "default"
    },
    elements: [elementSchema]
  },
  { timestamps: true }
);

const ScrapbookPage = mongoose.model(
  "ScrapbookPage",
  scrapbookPageSchema,
  "scrapbookPages"
);

export default ScrapbookPage;