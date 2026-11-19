import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import express from "express";
import bcrypt from "bcrypt";
import User from "../models/user.js";
import authRoutes from "../routes/authRoutes.js";

let server;
let baseUrl;
const original = { findOneAndUpdate: User.findOneAndUpdate };
const token = "a".repeat(64);
let validToken = true;
let savedHash = "";
let sessionVersion = 0;

before(async () => {
  User.findOneAndUpdate = async (filter, update) => {
    if (!validToken || filter.passwordResetExpiresAt.$gt <= new Date(0)) return null;
    validToken = false;
    savedHash = update.$set.passwordHash;
    assert.deepEqual(update.$set.trustedDeviceHashes, []);
    sessionVersion += update.$inc.sessionVersion;
    return { _id: "user-1" };
  };
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.session = {}; next(); });
  app.use("/api/auth", authRoutes);
  server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  User.findOneAndUpdate = original.findOneAndUpdate;
});

async function post(path, body) {
  const response = await fetch(`${baseUrl}/api/auth/${path}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
}

test("Zod rejects MongoDB objects, missing fields and excessive passwords", async () => {
  assert.equal((await post("register", { username: { $ne: "" }, email: "x@y.com", password: "password123" })).status, 400);
  assert.equal((await post("login", { email: { $ne: "" }, password: "pass" })).status, 400);
  assert.equal((await post("reset-password", { token: "bad", password: "password123" })).status, 400);
  assert.equal((await post("reset-password", { token, password: "x".repeat(73) })).status, 400);
});

test("forgot-password returns a clear setup error when email is not configured", async () => {
  const oldHost = process.env.SMTP_HOST;
  delete process.env.SMTP_HOST;
  try {
    const result = await post("forgot-password", { email: "unknown@example.test" });
    assert.equal(result.status, 503);
  } finally {
    if (oldHost === undefined) delete process.env.SMTP_HOST;
    else process.env.SMTP_HOST = oldHost;
  }
});

test("reset consumes the token, hashes the password and revokes earlier sessions", async () => {
  const result = await post("reset-password", { token, password: "new-secret-password" });
  assert.equal(result.status, 200);
  assert.equal(await bcrypt.compare("new-secret-password", savedHash), true);
  assert.equal(sessionVersion, 1);
  assert.equal((await post("reset-password", { token, password: "another-secret" })).status, 400);
});
