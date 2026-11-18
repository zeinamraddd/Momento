import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import express from "express";
import mongoose from "mongoose";
import User from "../models/user.js";
import Space from "../models/space.js";
import accountRoutes from "../routes/accountRoutes.js";

const id = new mongoose.Types.ObjectId();
const otherId = new mongoose.Types.ObjectId();
const user = { _id: id, username: "Zeina Example", email: "zeina@example.test", createdAt: new Date(), avatarFileId: null };
const original = { findById: User.findById, findByIdAndUpdate: User.findByIdAndUpdate, spaceExists: Space.exists };
let server;
let url;

before(async () => {
  User.findById = (userId) => ({ select: async () => String(userId) === String(id) ? user : null });
  User.findByIdAndUpdate = async (userId, update) => {
    if (String(userId) !== String(id)) return null;
    Object.assign(user, update.$set);
    return user;
  };
  Space.exists = async () => null;

  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.session = req.headers["x-test-login"] === "yes" ? { userId: String(id) } : {};
    next();
  });
  app.use("/api/account", accountRoutes);
  server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  url = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  User.findById = original.findById;
  User.findByIdAndUpdate = original.findByIdAndUpdate;
  Space.exists = original.spaceExists;
});

async function request(path, authenticated, method = "GET", body) {
  const response = await fetch(`${url}/api/account${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(authenticated ? { "x-test-login": "yes" } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: response.status, body: await response.json() };
}

test("profile details are private and never include a password", async () => {
  assert.equal((await request("/", false)).status, 401);
  const result = await request("/", true);
  assert.equal(result.status, 200);
  assert.equal(result.body.user.username, "Zeina Example");
  assert.equal(Object.hasOwn(result.body.user, "passwordHash"), false);
});

test("only the signed-in user can update their own display name", async () => {
  assert.equal((await request("/", false, "PATCH", { username: "Impostor" })).status, 401);
  assert.equal((await request("/", true, "PATCH", { username: " " })).status, 400);
  assert.equal((await request("/", true, "PATCH", { username: "Z" })).status, 400);
  const saved = await request("/", true, "PATCH", { username: "  Zeina M  ", email: "hacker@example.test" });
  assert.equal(saved.status, 200);
  assert.equal(saved.body.user.username, "Zeina M");
  assert.equal(saved.body.user.email, "zeina@example.test");
});

test("an unrelated user cannot fetch someone else's avatar", async () => {
  assert.equal((await request(`/avatar/${otherId}`, false)).status, 401);
  assert.equal((await request(`/avatar/${otherId}`, true)).status, 404);
});
