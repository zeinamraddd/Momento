import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import express from "express";
import cookieParser from "cookie-parser";
import bcrypt from "bcrypt";
import mongoose from "mongoose";
import nodemailer from "nodemailer";
import User from "../models/user.js";
import authRoutes from "../routes/authRoutes.js";

let server;
let url;
let currentUser;
let messages = [];
let lastCookie = "";
const recognizedHashes = new Set();
const original = {
  findOne: User.findOne,
  create: User.create,
  exists: User.exists,
  updateOne: User.updateOne,
  createTransport: nodemailer.createTransport,
};
const envNames = ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASSWORD", "SMTP_FROM", "CLIENT_ORIGIN"];
const oldEnv = Object.fromEntries(envNames.map((name) => [name, process.env[name]]));

before(async () => {
  Object.assign(process.env, {
    SMTP_HOST: "smtp.example.test",
    SMTP_PORT: "587",
    SMTP_USER: "test@example.test",
    SMTP_PASSWORD: "not-a-real-password",
    SMTP_FROM: "Momento <test@example.test>",
    CLIENT_ORIGIN: "http://localhost:5173",
  });
  nodemailer.createTransport = () => ({
    sendMail: async (message) => { messages.push(message); return { messageId: "mock-mail" }; },
  });
  User.findOne = async ({ email }) => currentUser?.email === email ? currentUser : null;
  User.create = async (values) => {
    currentUser = { ...values, _id: new mongoose.Types.ObjectId(), sessionVersion: 0 };
    return currentUser;
  };
  User.exists = async ({ trustedDeviceHashes }) => recognizedHashes.has(trustedDeviceHashes) ? { _id: currentUser._id } : null;
  User.updateOne = async (_query, update) => {
    const hashes = update.$push?.trustedDeviceHashes?.$each || [];
    for (const hash of hashes) recognizedHashes.add(hash);
    return { matchedCount: 1 };
  };

  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use((req, _res, next) => {
    req.session = { regenerate(callback) { callback(); }, save(callback) { callback(); } };
    next();
  });
  app.use("/api/auth", authRoutes);
  server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  url = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  User.findOne = original.findOne;
  User.create = original.create;
  User.exists = original.exists;
  User.updateOne = original.updateOne;
  nodemailer.createTransport = original.createTransport;
  for (const [name, value] of Object.entries(oldEnv)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

async function post(path, body, cookie) {
  const response = await fetch(`${url}/api/auth/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
    body: JSON.stringify(body),
  });
  return { status: response.status, data: await response.json(), cookie: response.headers.get("set-cookie") };
}

async function expectMessages(count) {
  for (let i = 0; i < 25 && messages.length < count; i++) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.equal(messages.length, count);
}

test("successful registration sends a welcome email with escaped user text", async () => {
  const register = await post("register", { username: "Zeina <script>", email: "zeina@example.test", password: "password123" });
  assert.equal(register.status, 201);
  await expectMessages(1);
  assert.match(messages[0].subject, /Welcome/);
  assert.match(messages[0].html, /Zeina &lt;script&gt;/);
  assert.doesNotMatch(messages[0].html, /<script>/);
  assert.equal(Object.hasOwn(register.data.user, "trustedDeviceHashes"), false);
});

test("wrong password does not create a trusted device or send a notification", async () => {
  const response = await post("login", { email: "zeina@example.test", password: "incorrect" });
  assert.equal(response.status, 401);
  assert.equal(recognizedHashes.size, 0);
  await new Promise((resolve) => setTimeout(resolve, 25));
  assert.equal(messages.length, 1);
});

test("first successful login from a browser emails an alert and remembers it", async () => {
  const response = await post("login", { email: "zeina@example.test", password: "password123" });
  assert.equal(response.status, 200);
  assert.match(response.cookie, /momento\.device\./);
  assert.match(response.cookie, /HttpOnly/);
  assert.match(response.cookie, /SameSite=Lax/);
  lastCookie = response.cookie.split(";")[0];
  assert.equal(recognizedHashes.size, 1);
  await expectMessages(2);
  assert.match(messages[1].subject, /New browser login/);
  assert.equal(await bcrypt.compare("password123", currentUser.passwordHash), true);
});

test("recognized browser logs in again without another email", async () => {
  const response = await post("login", { email: "zeina@example.test", password: "password123" }, lastCookie);
  assert.equal(response.status, 200);
  assert.equal(recognizedHashes.size, 1);
  await new Promise((resolve) => setTimeout(resolve, 25));
  assert.equal(messages.length, 2);
});

test("another browser gets a new device alert", async () => {
  const response = await post("login", { email: "zeina@example.test", password: "password123" });
  assert.equal(response.status, 200);
  assert.equal(recognizedHashes.size, 2);
  await expectMessages(3);
});

test("an existing email cannot register again or trigger a welcome email", async () => {
  const response = await post("register", { username: "Another name", email: "zeina@example.test", password: "another123" });
  assert.equal(response.status, 409);
  await new Promise((resolve) => setTimeout(resolve, 25));
  assert.equal(messages.length, 3);
});

test("a simulated SMTP outage never blocks successful registration or login", async () => {
  nodemailer.createTransport = () => ({ sendMail: async () => { throw new Error("simulated SMTP failure"); } });
  const registered = await post("register", { username: "Second account", email: "second@example.test", password: "another123" });
  assert.equal(registered.status, 201);
  const loggedIn = await post("login", { email: "second@example.test", password: "another123" });
  assert.equal(loggedIn.status, 200);
});
