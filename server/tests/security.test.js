import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import express from "express";
import { requireTrustedOrigin, verifyServerSecrets } from "../middleware/security.js";

let server;
let baseUrl;

before(async () => {
  const app = express();
  app.use("/api", requireTrustedOrigin("http://localhost:5173"));
  app.post("/api/private", (_req, res) => res.json({ changed: true }));
  app.get("/api/private", (_req, res) => res.json({ ok: true }));
  server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
});

test("rejects cross-site writes and allows the trusted frontend", async () => {
  const bad = await fetch(`${baseUrl}/api/private`, { method: "POST", headers: { Origin: "https://evil.example" } });
  assert.equal(bad.status, 403);

  const good = await fetch(`${baseUrl}/api/private`, { method: "POST", headers: { Origin: "http://localhost:5173" } });
  assert.equal(good.status, 200);

  const untrustedFetch = await fetch(`${baseUrl}/api/private`, { method: "POST", headers: { "Sec-Fetch-Site": "cross-site" } });
  assert.equal(untrustedFetch.status, 403);
});

test("read-only requests are allowed without an Origin header", async () => {
  const response = await fetch(`${baseUrl}/api/private`);
  assert.equal(response.status, 200);
});

test("missing secrets fail at startup without printing their values", () => {
  assert.throws(() => verifyServerSecrets({}), /Missing environment variable: MONGODB_URI/);
  assert.throws(() => verifyServerSecrets({ MONGODB_URI: "test" }), /Missing environment variable: SESSION_SECRET/);
  assert.throws(() => verifyServerSecrets({ MONGODB_URI: "test", SESSION_SECRET: "short", NODE_ENV: "production", CLIENT_ORIGIN: "https:\/\/app.example" }), /SESSION_SECRET/);
  assert.doesNotThrow(() => verifyServerSecrets({ MONGODB_URI: "test", SESSION_SECRET: "a".repeat(64), NODE_ENV: "production", CLIENT_ORIGIN: "https://app.example" }));
});
