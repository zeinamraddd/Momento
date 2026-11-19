import test, { after, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import express from 'express';
import mongoose from 'mongoose';

import loreRoutes from '../routes/loreRoutes.js';
import User from '../models/user.js';
import Space from '../models/space.js';
import LoreCard from '../models/lorecard.js';

// These tests exercise the actual Express routes while substituting in-memory
// model operations. They never connect to MongoDB or modify real Lore Cards.
const ids = {
  alice: new mongoose.Types.ObjectId(),
  bob: new mongoose.Types.ObjectId(),
  outsider: new mongoose.Types.ObjectId(),
  friendsSpace: new mongoose.Types.ObjectId(),
  otherSpace: new mongoose.Types.ObjectId(),
  friendsCard: new mongoose.Types.ObjectId(),
  otherCard: new mongoose.Types.ObjectId(),
};
const users = [
  { _id: ids.alice, username: 'Alice' },
  { _id: ids.bob, username: 'Bob' },
  { _id: ids.outsider, username: 'Outsider' },
];
const spaces = new Map();
const cards = new Map();
const original = {
  userFindById: User.findById,
  spaceFindOne: Space.findOne,
  cardFind: LoreCard.find,
  cardCreate: LoreCard.create,
  cardFindOne: LoreCard.findOne,
  cardFindOneAndUpdate: LoreCard.findOneAndUpdate,
  cardFindOneAndDelete: LoreCard.findOneAndDelete,
};

const sameId = (a, b) => String(a) === String(b);
const lorePath = `/${ids.friendsSpace}/lore`;
const cardPath = `${lorePath}/${ids.friendsCard}`;
let server;
let baseUrl;
let modelAccesses = 0;
let savedCards = 0;

function makeVersions() {
  const versions = [];
  versions.id = (id) => versions.find((version) => sameId(version._id, id)) || null;
  versions.push = ({ content, userId }) => {
    const version = {
      _id: new mongoose.Types.ObjectId(),
      content,
      userId,
      createdAt: new Date(),
      updatedAt: new Date(),
      deleteOne: () => {
        const index = versions.indexOf(version);
        if (index >= 0) versions.splice(index, 1);
      },
    };
    return Array.prototype.push.call(versions, version);
  };
  return versions;
}

function makeCard(fields) {
  return {
    _id: new mongoose.Types.ObjectId(),
    title: 'The legendary trip',
    quote: 'Are we there yet?',
    context: 'An unforgettable car ride.',
    versions: makeVersions(),
    reactions: [],
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...fields,
    populate: async function () { return this; },
    save: async function () { savedCards += 1; return this; },
  };
}

function findScopedCard({ _id, spaceId }) {
  const card = cards.get(String(_id));
  return card && sameId(card.spaceId, spaceId) ? card : null;
}

function queryWithPopulate(result) {
  const query = Promise.resolve(result);
  query.populate = () => query;
  return query;
}

before(async () => {
  User.findById = (id) => ({
    select: async () => users.find((user) => sameId(user._id, id)) || null,
  });

  Space.findOne = async ({ _id, members }) => {
    const space = spaces.get(String(_id));
    return space && space.members.some((id) => sameId(id, members)) ? space : null;
  };

  LoreCard.find = ({ spaceId }) => {
    modelAccesses += 1;
    const scoped = [...cards.values()].filter((card) => sameId(card.spaceId, spaceId));
    const query = Promise.resolve(scoped);
    query.sort = () => query;
    query.populate = () => query;
    return query;
  };

  LoreCard.create = async (fields) => {
    modelAccesses += 1;
    const card = makeCard(fields);
    cards.set(String(card._id), card);
    return card;
  };

  LoreCard.findOne = async (filter) => {
    modelAccesses += 1;
    return findScopedCard(filter);
  };

  LoreCard.findOneAndUpdate = (filter, update) => {
    modelAccesses += 1;
    const card = findScopedCard(filter);
    if (card) {
      if (update.$set) Object.assign(card, update.$set);
      if (update.$pull?.reactions) {
        card.reactions = card.reactions.filter((id) => !sameId(id, update.$pull.reactions));
      }
      if (update.$addToSet?.reactions &&
          !card.reactions.some((id) => sameId(id, update.$addToSet.reactions))) {
        card.reactions.push(update.$addToSet.reactions);
      }
    }
    return queryWithPopulate(card);
  };

  LoreCard.findOneAndDelete = async (filter) => {
    modelAccesses += 1;
    const card = findScopedCard(filter);
    if (card) cards.delete(String(card._id));
    return card;
  };

  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    const selected = Number(req.headers['x-test-user']);
    req.session = selected >= 1 && selected <= 3
      ? { userId: users[selected - 1]._id.toString() }
      : {};
    next();
  });
  app.use('/api/spaces', loreRoutes);

  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

beforeEach(() => {
  modelAccesses = 0;
  savedCards = 0;
  spaces.clear();
  cards.clear();
  spaces.set(String(ids.friendsSpace), {
    _id: ids.friendsSpace,
    members: [ids.alice, ids.bob],
  });
  spaces.set(String(ids.otherSpace), {
    _id: ids.otherSpace,
    members: [ids.outsider],
  });
  cards.set(String(ids.friendsCard), makeCard({
    _id: ids.friendsCard,
    spaceId: ids.friendsSpace,
    createdBy: ids.alice,
  }));
  cards.set(String(ids.otherCard), makeCard({
    _id: ids.otherCard,
    spaceId: ids.otherSpace,
    createdBy: ids.outsider,
    title: 'Outsider only',
  }));
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  User.findById = original.userFindById;
  Space.findOne = original.spaceFindOne;
  LoreCard.find = original.cardFind;
  LoreCard.create = original.cardCreate;
  LoreCard.findOne = original.cardFindOne;
  LoreCard.findOneAndUpdate = original.cardFindOneAndUpdate;
  LoreCard.findOneAndDelete = original.cardFindOneAndDelete;
});

async function request(path, user, method = 'GET', body) {
  const response = await fetch(`${baseUrl}/api/spaces${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(user ? { 'x-test-user': String(user) } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: response.status, body: await response.json() };
}

const validCard = () => ({
  title: '  Inside joke  ',
  quote: '  You had to be there!  ',
  context: '  A birthday memory  ',
});

test('authentication is required for all Lore operations', async () => {
  assert.equal((await request(lorePath, null)).status, 401);
  assert.equal((await request(lorePath, null, 'POST', validCard())).status, 401);
  assert.equal((await request(cardPath, null, 'PATCH', { title: 'Changed' })).status, 401);
  assert.equal((await request(cardPath, null, 'DELETE')).status, 401);
  assert.equal((await request(`${cardPath}/versions`, null, 'POST', { content: 'No access' })).status, 401);
  assert.equal((await request(`${cardPath}/reactions`, null, 'POST')).status, 401);
  assert.equal(modelAccesses, 0);
});

test('outsiders cannot view or mutate a group\'s Lore Cards', async () => {
  assert.equal((await request(lorePath, 3)).status, 404);
  assert.equal((await request(lorePath, 3, 'POST', validCard())).status, 404);
  assert.equal((await request(cardPath, 3, 'PATCH', { title: 'Hacked' })).status, 404);
  assert.equal((await request(cardPath, 3, 'DELETE')).status, 404);
  assert.equal((await request(`${cardPath}/versions`, 3, 'POST', { content: 'Intrusion' })).status, 404);
  assert.equal((await request(`${cardPath}/reactions`, 3, 'POST')).status, 404);
  assert.equal(modelAccesses, 0, 'membership must be checked before touching Lore data');
  assert.equal(cards.get(String(ids.friendsCard)).title, 'The legendary trip');
});

test('members can create and list cards; creator and space IDs come from the session/URL', async () => {
  const created = await request(lorePath, 2, 'POST', {
    ...validCard(),
    createdBy: String(ids.outsider),
    spaceId: String(ids.otherSpace),
  });
  assert.equal(created.status, 201);
  assert.equal(created.body.card.title, 'Inside joke');
  assert.equal(created.body.card.quote, 'You had to be there!');
  assert.equal(created.body.card.context, 'A birthday memory');
  assert.equal(created.body.card.createdBy, String(ids.bob));

  const list = await request(lorePath, 1);
  assert.equal(list.status, 200);
  assert.equal(list.body.cards.length, 2);
  assert.equal(list.body.cards.some((card) => card.title === 'Outsider only'), false);
  assert.equal((await request(`/${ids.otherSpace}/lore`, 1)).status, 404);
});

test('Lore creation and editing reject missing, oversized, and wrong-type input', async () => {
  const initialCount = cards.size;
  assert.equal((await request(lorePath, 1, 'POST', { title: '', quote: 'q', context: 'c' })).status, 400);
  assert.equal((await request(lorePath, 1, 'POST', { title: { $ne: null }, quote: 'q', context: 'c' })).status, 400);
  assert.equal((await request(lorePath, 1, 'POST', { title: 'x'.repeat(101), quote: 'q', context: 'c' })).status, 400);
  assert.equal((await request(lorePath, 1, 'POST', { title: 't', quote: 'q'.repeat(241), context: 'c' })).status, 400);
  assert.equal((await request(lorePath, 1, 'POST', { title: 't', quote: 'q', context: 'c'.repeat(5001) })).status, 400);
  assert.equal((await request(cardPath, 1, 'PATCH', { createdBy: String(ids.outsider) })).status, 400);
  assert.equal((await request(cardPath, 1, 'PATCH', { title: '  ' })).status, 400);
  assert.equal((await request(cardPath, 1, 'PATCH', { quote: 'x'.repeat(241) })).status, 400);
  assert.equal(cards.size, initialCount);
  assert.equal(cards.get(String(ids.friendsCard)).title, 'The legendary trip');
});

test('any group member can edit and delete the original Lore Card', async () => {
  // Alice created this card, but Bob is a member and is allowed to edit it.
  const edited = await request(cardPath, 2, 'PATCH', { title: '  Bob remembers differently  ' });
  assert.equal(edited.status, 200);
  assert.equal(edited.body.card.title, 'Bob remembers differently');
  assert.equal(edited.body.card.createdBy, String(ids.alice));

  const removed = await request(cardPath, 2, 'DELETE');
  assert.equal(removed.status, 200);
  assert.equal(cards.has(String(ids.friendsCard)), false);
  assert.equal(cards.has(String(ids.otherCard)), true);
});

test('a member cannot use another space\'s card ID through their own space', async () => {
  const wrongCard = `${lorePath}/${ids.otherCard}`;
  assert.equal((await request(wrongCard, 1, 'PATCH', { title: 'Taken over' })).status, 404);
  assert.equal((await request(wrongCard, 1, 'DELETE')).status, 404);
  assert.equal((await request(`${wrongCard}/versions`, 1, 'POST', { content: 'Fake' })).status, 404);
  assert.equal((await request(`${wrongCard}/reactions`, 1, 'POST')).status, 404);
  assert.equal(cards.get(String(ids.otherCard)).title, 'Outsider only');
  assert.equal((await request('/invalid/lore', 1)).status, 404);
  assert.equal((await request(`${lorePath}/invalid`, 1, 'DELETE')).status, 404);
});

test('members can add versions, but only the version author may edit or delete them', async () => {
  const added = await request(`${cardPath}/versions`, 2, 'POST', { content: '  My version!  ' });
  assert.equal(added.status, 201);
  assert.equal(added.body.card.versions.length, 1);
  assert.equal(added.body.card.versions[0].content, 'My version!');
  assert.equal(added.body.card.versions[0].userId, String(ids.bob));
  const versionId = added.body.card.versions[0].id;
  const versionPath = `${cardPath}/versions/${versionId}`;

  assert.equal((await request(versionPath, 1, 'PATCH', { content: 'Not mine' })).status, 403);
  assert.equal((await request(versionPath, 1, 'DELETE')).status, 403);
  assert.equal((await request(versionPath, 2, 'PATCH', { content: ' ' })).status, 400);

  const edited = await request(versionPath, 2, 'PATCH', { content: '  Updated version  ' });
  assert.equal(edited.status, 200);
  assert.equal(edited.body.card.versions[0].content, 'Updated version');

  const deleted = await request(versionPath, 2, 'DELETE');
  assert.equal(deleted.status, 200);
  assert.equal(cards.get(String(ids.friendsCard)).versions.length, 0);
  assert.equal(savedCards, 3, 'add, edit and delete must save the card');
});

test('still-funny reactions toggle per member without duplicating likes', async () => {
  const bobLikes = await request(`${cardPath}/reactions`, 2, 'POST');
  assert.equal(bobLikes.status, 200);
  assert.equal(bobLikes.body.card.reactionCount, 1);
  assert.equal(bobLikes.body.card.hasReacted, true);

  const aliceSees = await request(lorePath, 1);
  assert.equal(aliceSees.body.cards[0].reactionCount, 1);
  assert.equal(aliceSees.body.cards[0].hasReacted, false);

  const aliceLikes = await request(`${cardPath}/reactions`, 1, 'POST');
  assert.equal(aliceLikes.status, 200);
  assert.equal(aliceLikes.body.card.reactionCount, 2);

  const bobUnlikes = await request(`${cardPath}/reactions`, 2, 'POST');
  assert.equal(bobUnlikes.status, 200);
  assert.equal(bobUnlikes.body.card.reactionCount, 1);
  assert.equal(bobUnlikes.body.card.hasReacted, false);
  assert.deepEqual(bobUnlikes.body.card.reactions, [String(ids.alice)]);
});
