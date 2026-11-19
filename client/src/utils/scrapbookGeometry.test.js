import test from "node:test";
import assert from "node:assert/strict";
import { moveElement, pointerAngle, resizeElement, rotateElement } from "./scrapbookGeometry.js";

const page = { left: 10, top: 20, width: 400, height: 500 };
const item = { x: 20, y: 30, w: 25, h: 10, rotation: 0 };

test("dragging moves an item using page-relative percentages", () => {
  assert.deepEqual(moveElement(item, 40, 50, page), { x: 30, y: 40 });
  assert.deepEqual(moveElement(item, -1000, 2000, page), { x: 0, y: 90 });
});

test("dragging a corner resizes both width and height", () => {
  assert.deepEqual(resizeElement(item, 40, 50, page), { w: 35, h: 20 });
  assert.deepEqual(resizeElement(item, -900, -900, page), { w: 5, h: 5 });
});

test("resize respects the rotation of the sticker", () => {
  const verticalSticker = { ...item, rotation: 90 };
  const resized = resizeElement(verticalSticker, 0, 40, page);
  assert.ok(Math.abs(resized.w - 35) < 1e-9);
  assert.ok(Math.abs(resized.h - 10) < 1e-9);
});

test("Shift-resize keeps the item proportions", () => {
  const resized = resizeElement(item, 40, 0, page, true);
  assert.ok(Math.abs(resized.w / resized.h - item.w / item.h) < 1e-9);
});

test("dragging the rotation handle turns the sticker around its center", () => {
  const centerX = page.left + page.width * (item.x + item.w / 2) / 100;
  const centerY = page.top + page.height * (item.y + item.h / 2) / 100;
  const start = pointerAngle(item, page, centerX, centerY - 40);
  assert.ok(Math.abs(rotateElement(item, page, start, centerX + 40, centerY).rotation - 90) < 1e-9);
});
