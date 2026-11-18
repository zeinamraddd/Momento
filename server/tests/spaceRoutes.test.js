import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import express from "express";
import mongoose from "mongoose";
import Space from "../models/space.js";
import User from "../models/user.js";
import spaceRoutes from "../routes/spaceRoutes.js";

// Route tests run without a live database. Only the model persistence methods
// are replaced; the real Express router and requireAuth middleware are tested.
const ids = [new mongoose.Types.ObjectId(), new mongoose.Types.ObjectId(), new mongoose.Types.ObjectId()];
const data = new Map();
const users = ids.map((_id, index) => ({ _id, username: `Tester ${index + 1}` }));
const original = {
  findById: User.findById,
  findUsers: User.find,
  create: Space.create,
  find: Space.find,
  findOne: Space.findOne,
  findOneAndUpdate: Space.findOneAndUpdate,
};

const equalsId = (a, b) => a?.toString() === b?.toString();
let server;
let url;

before(async () => {
  User.findById = (id) => ({ select: async () => users.find((user) => equalsId(user._id, id)) || null });
  User.find = ({ _id }) => ({
    select: async () => users.filter((user) => _id.$in.some((id) => equalsId(id, user._id))),
  });
  Space.create = async (fields) => {
    const space = { _id: new mongoose.Types.ObjectId(), ...fields };
    data.set(space._id.toString(), space);
    return space;
  };
  Space.find = ({ members }) => ({
    sort: async () => [...data.values()].filter((space) => space.members.some((id) => equalsId(id, members))),
  });
  Space.findOne = async ({ inviteCode, _id, members }) =>
    [...data.values()].find((space) =>
      (inviteCode === undefined || space.inviteCode === inviteCode) &&
      (_id === undefined || equalsId(space._id, _id)) &&
      (members === undefined || space.members.some((id) => equalsId(id, members)))) || null;
  Space.findOneAndUpdate = async ({ inviteCode, members, _id }, update) => {
    if (_id !== undefined) {
      const space = data.get(String(_id));
      if (!space || !space.members.some((id) => equalsId(id, members))) return null;
      space.name = update.$set.name;
      return space;
    }
    const space = [...data.values()].find((item) => item.inviteCode === inviteCode);
    if (!space || space.members.some((id) => equalsId(id, members.$ne))) return null;
    space.members.push(update.$addToSet.members);
    return space;
  };

  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    const testUser = Number(req.headers["x-test-user"]);
    req.session = testUser >= 1 && testUser <= 3 ? { userId: ids[testUser - 1].toString() } : {};
    next();
  });
  app.use("/api/spaces", spaceRoutes);
  server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  url = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  User.findById = original.findById;
  User.find = original.findUsers;
  Space.create = original.create;
  Space.find = original.find;
  Space.findOne = original.findOne;
  Space.findOneAndUpdate = original.findOneAndUpdate;
});

async function request(path, user, method = "GET", body) {
  const response = await fetch(`${url}/api/spaces${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(user ? { "x-test-user": String(user) } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: response.status, body: await response.json() };
}

test("only authenticated users can view, create, or join spaces", async () => {
  assert.equal((await request("/", null)).status, 401);
  assert.equal((await request("/", null, "POST", { name: "Friends" })).status, 401);
  assert.equal((await request("/join", null, "POST", { inviteCode: "0123456789AB" })).status, 401);
});

test("space creation validates names and uses the signed-in account", async () => {
  assert.equal((await request("/", 1, "POST", { name: " " })).status, 400);
  assert.equal((await request("/", 1, "POST", { name: "a" })).status, 400);
  const created = await request("/", 1, "POST", { name: "  The Usual Suspects  ", owner: ids[1] });
  assert.equal(created.status, 201);
  assert.equal(created.body.space.name, "The Usual Suspects");
  assert.equal(created.body.space.ownerId, ids[0].toString());
  assert.equal(created.body.space.memberCount, 1);
  assert.match(created.body.space.inviteCode, /^[0-9A-F]{12}$/);
});

test("memberships are private and invitation codes can be used once per user", async () => {
  const mine = await request("/", 1);
  const code = mine.body.spaces[0].inviteCode;
  const spaceId = mine.body.spaces[0].id;

  assert.equal(mine.body.spaces.length, 1);
  assert.equal((await request("/", 2)).body.spaces.length, 0);
  assert.equal((await request(`/${spaceId}`, 3)).status, 404);

  assert.equal((await request("/join", 2, "POST", { inviteCode: "invalid" })).status, 400);
  assert.equal((await request("/join", 2, "POST", { inviteCode: "000000000000" })).status, 404);

  const joined = await request("/join", 2, "POST", { inviteCode: code.toLowerCase() });
  assert.equal(joined.status, 200);
  assert.equal(joined.body.space.memberCount, 2);
  assert.equal((await request("/join", 2, "POST", { inviteCode: code })).status, 409);
  assert.equal((await request(`/${spaceId}`, 2)).status, 200);
  assert.equal((await request(`/${spaceId}`, 3)).status, 404);
});

test("the member list stays private and uses distinct calendar colors", async () => {
  const own = (await request("/", 1)).body.spaces[0];
  assert.equal((await request(`/${own.id}/members`, null)).status, 401);
  assert.equal((await request(`/${own.id}/members`, 3)).status, 404);

  const result = await request(`/${own.id}/members`, 2);
  assert.equal(result.status, 200);
  assert.equal(result.body.members.length, 2);
  assert.equal(new Set(result.body.members.map((member) => member.color)).size, 2);
  assert.equal(result.body.members[0].isOwner, true);
  assert.equal(result.body.members[1].username, "Tester 2");
  assert.equal(Object.hasOwn(result.body.members[0], "email"), false);
});

test("all members can rename the group, but outsiders cannot", async () => {
  const own = (await request("/", 1)).body.spaces[0];
  assert.equal((await request(`/${own.id}`, null, "PATCH", { name: "Hacked" })).status, 401);
  assert.equal((await request(`/${own.id}`, 3, "PATCH", { name: "Hacked" })).status, 404);
  assert.equal((await request(`/${own.id}`, 2, "PATCH", { name: " " })).status, 400);

  const renamed = await request(`/${own.id}`, 2, "PATCH", { name: "  Memory Makers  " });
  assert.equal(renamed.status, 200);
  assert.equal(renamed.body.space.name, "Memory Makers");
  assert.equal((await request(`/${own.id}`, 1)).body.space.name, "Memory Makers");
});
