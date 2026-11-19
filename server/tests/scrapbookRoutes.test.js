import test, { after, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import express from 'express';
import mongoose from 'mongoose';

import scrapbookRoutes from '../routes/scrapbookRoutes.js';
import User from '../models/user.js';
import Space from '../models/space.js';
import Album from '../models/album.js';
import Photo from '../models/photo.js';
import ScrapbookPage from '../models/scrapbook.js';

// Isolated route tests: real Express middleware and payload validation, with
// in-memory persistence in place of MongoDB. Nothing touches users' memories.
const ids = {
  alice: new mongoose.Types.ObjectId(),
  bob: new mongoose.Types.ObjectId(),
  outsider: new mongoose.Types.ObjectId(),
  friendsSpace: new mongoose.Types.ObjectId(),
  otherSpace: new mongoose.Types.ObjectId(),
  friendsAlbum: new mongoose.Types.ObjectId(),
  secondAlbum: new mongoose.Types.ObjectId(),
  otherAlbum: new mongoose.Types.ObjectId(),
  friendsPhoto: new mongoose.Types.ObjectId(),
  secondPhoto: new mongoose.Types.ObjectId(),
  otherPhoto: new mongoose.Types.ObjectId(),
};

const users = [
  { _id: ids.alice, username: 'Alice' },
  { _id: ids.bob, username: 'Bob' },
  { _id: ids.outsider, username: 'Outsider' },
];
const spaces = new Map();
const albums = new Map();
const photos = new Map();
const pages = new Map();
const original = {
  userFindById: User.findById,
  spaceFindOne: Space.findOne,
  albumFindOne: Album.findOne,
  photoFindOne: Photo.findOne,
  photoCountDocuments: Photo.countDocuments,
  pageFindOne: ScrapbookPage.findOne,
  pageFindOneAndUpdate: ScrapbookPage.findOneAndUpdate,
};

const sameId = (left, right) => String(left) === String(right);
const pageKey = (albumId, photoId) => `${albumId}/${photoId}`;
const scrapbookPath = `/${ids.friendsSpace}/albums/${ids.friendsAlbum}/photos/${ids.friendsPhoto}/scrapbook`;
let server;
let baseUrl;
let pageWrites = 0;

const validPage = (elements = []) => ({
  layout: 'collage',
  backgroundLeft: 'dots',
  backgroundRight: 'grid',
  revision: 0,
  elements,
});

const sticker = (changes = {}) => ({
  id: 'sticker-1',
  type: 'sticker',
  page: 0,
  x: 15,
  y: 20,
  w: 30,
  h: 25,
  rotation: 30,
  imageUrl: '/stickers/letters/A.png',
  ...changes,
});

const tape = (changes = {}) => ({
  id: 'tape-1',
  type: 'decoration',
  page: 1,
  x: 40,
  y: 10,
  w: 30,
  h: 8,
  rotation: -20,
  content: 'sage',
  ...changes,
});

before(async () => {
  User.findById = (id) => ({
    select: async () => users.find((user) => sameId(user._id, id)) || null,
  });

  Space.findOne = async ({ _id, members }) => {
    const space = spaces.get(String(_id));
    return space && space.members.some((id) => sameId(id, members)) ? space : null;
  };

  Album.findOne = async ({ _id, spaceId }) => {
    const album = albums.get(String(_id));
    return album && sameId(album.spaceId, spaceId) ? album : null;
  };

  Photo.findOne = async ({ _id, albumId }) => {
    const photo = photos.get(String(_id));
    return photo && sameId(photo.albumId, albumId) ? photo : null;
  };

  Photo.countDocuments = async ({ _id, albumId }) => {
    const requested = _id?.$in || [];
    return requested.filter((id) => {
      const photo = photos.get(String(id));
      return photo && sameId(photo.albumId, albumId);
    }).length;
  };

  ScrapbookPage.findOne = ({ albumId, photoId }) => ({
    lean: async () => pages.get(pageKey(albumId, photoId)) || null,
  });

  ScrapbookPage.findOneAndUpdate = async (filter, update) => {
    pageWrites += 1;
    const key = pageKey(filter.albumId, filter.photoId);
    const previous = pages.get(key);

    // Simulate the unique index and the real route's revision compare-and-save.
    if ((previous && previous.revision !== filter.revision) ||
        (!previous && filter.revision !== 0)) {
      const conflict = new Error('Revision conflict');
      conflict.code = 11000;
      throw conflict;
    }

    const saved = {
      ...previous,
      albumId: filter.albumId,
      photoId: filter.photoId,
      pageNumber: 1,
      ...update.$set,
    };
    pages.set(key, saved);
    return saved;
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
  app.use('/api/spaces', scrapbookRoutes);

  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

beforeEach(() => {
  pageWrites = 0;
  spaces.clear();
  albums.clear();
  photos.clear();
  pages.clear();

  spaces.set(String(ids.friendsSpace), {
    _id: ids.friendsSpace,
    members: [ids.alice, ids.bob],
  });
  spaces.set(String(ids.otherSpace), {
    _id: ids.otherSpace,
    members: [ids.outsider],
  });
  albums.set(String(ids.friendsAlbum), { _id: ids.friendsAlbum, spaceId: ids.friendsSpace });
  albums.set(String(ids.secondAlbum), { _id: ids.secondAlbum, spaceId: ids.friendsSpace });
  albums.set(String(ids.otherAlbum), { _id: ids.otherAlbum, spaceId: ids.otherSpace });
  photos.set(String(ids.friendsPhoto), { _id: ids.friendsPhoto, albumId: ids.friendsAlbum });
  photos.set(String(ids.secondPhoto), { _id: ids.secondPhoto, albumId: ids.secondAlbum });
  photos.set(String(ids.otherPhoto), { _id: ids.otherPhoto, albumId: ids.otherAlbum });
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  User.findById = original.userFindById;
  Space.findOne = original.spaceFindOne;
  Album.findOne = original.albumFindOne;
  Photo.findOne = original.photoFindOne;
  Photo.countDocuments = original.photoCountDocuments;
  ScrapbookPage.findOne = original.pageFindOne;
  ScrapbookPage.findOneAndUpdate = original.pageFindOneAndUpdate;
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

test('only signed-in users can read or save scrapbook pages', async () => {
  assert.equal((await request(scrapbookPath, null)).status, 401);
  assert.equal((await request(scrapbookPath, null, 'PUT', validPage())).status, 401);
  assert.equal(pageWrites, 0);
});

test('outsiders and incorrect album/photo ownership chains are rejected', async () => {
  assert.equal((await request(scrapbookPath, 3)).status, 404);
  assert.equal((await request(scrapbookPath, 3, 'PUT', validPage())).status, 404);

  const wrongAlbum = `/${ids.friendsSpace}/albums/${ids.otherAlbum}/photos/${ids.otherPhoto}/scrapbook`;
  const wrongPhoto = `/${ids.friendsSpace}/albums/${ids.friendsAlbum}/photos/${ids.secondPhoto}/scrapbook`;
  assert.equal((await request(wrongAlbum, 1)).status, 404);
  assert.equal((await request(wrongPhoto, 1)).status, 404);
  assert.equal((await request(wrongPhoto, 1, 'PUT', validPage())).status, 404);
  assert.equal((await request('/invalid/albums/invalid/photos/invalid/scrapbook', 1)).status, 404);
  assert.equal(pageWrites, 0);
});

test('a new scrapbook loads its initial photo and revision zero', async () => {
  const result = await request(scrapbookPath, 2);
  assert.equal(result.status, 200);
  assert.equal(result.body.page.revision, 0);
  assert.equal(result.body.page.layout, 'classic');
  assert.equal(result.body.page.elements.length, 1);
  assert.equal(result.body.page.elements[0].type, 'photo');
  assert.equal(result.body.page.elements[0].photoId, String(ids.friendsPhoto));
});

test('members can save and reload transformed stickers, tape, and text', async () => {
  const textItem = {
    id: 'text-1', type: 'text', page: 1,
    x: 10, y: 30, w: 40, h: 20, rotation: 0,
    content: 'Our favorite day!', fontSize: 28,
    fontFamily: 'serif', color: '#112233',
  };
  const saved = await request(scrapbookPath, 2, 'PUT', validPage([
    sticker({ x: 5, w: 80, rotation: 175 }),
    tape({ y: 60, rotation: -90 }),
    textItem,
  ]));

  assert.equal(saved.status, 200);
  assert.equal(saved.body.page.revision, 1);
  assert.equal(saved.body.page.elements.length, 3);
  assert.equal(saved.body.page.elements[0].rotation, 175);
  assert.equal(saved.body.page.elements[1].content, 'sage');
  assert.equal(saved.body.page.elements[2].content, textItem.content);

  const readByFriend = await request(scrapbookPath, 1);
  assert.equal(readByFriend.status, 200);
  assert.equal(readByFriend.body.page.revision, 1);
  assert.deepEqual(readByFriend.body.page.elements, saved.body.page.elements);
  assert.equal(readByFriend.body.page.backgroundRight, 'grid');
});

test('invalid settings, dimensions, rotation, sticker paths and tape colors are rejected', async () => {
  const invalid = [
    { ...validPage(), layout: 'unlisted-layout' },
    { ...validPage(), revision: -1 },
    validPage([sticker({ x: 101 })]),
    validPage([sticker({ w: 4 })]),
    validPage([sticker({ rotation: 181 })]),
    validPage([sticker({ imageUrl: 'https://evil.example/sticker.png' })]),
    validPage([tape({ content: 'not-a-tape' })]),
    validPage([tape({ page: 2 })]),
    validPage(Array.from({ length: 81 }, (_, index) => sticker({ id: `s-${index}` }))),
  ];
  for (const payload of invalid) {
    const result = await request(scrapbookPath, 1, 'PUT', payload);
    assert.equal(result.status, 400, `invalid payload should fail: ${JSON.stringify(payload).slice(0, 120)}`);
  }
  assert.equal(pageWrites, 0, 'validation errors must not write a scrapbook');
});

test('photo elements must refer only to photos inside the selected album', async () => {
  const photoElement = {
    id: 'another-photo', type: 'photo', page: 0,
    photoId: String(ids.secondPhoto),
    x: 10, y: 10, w: 50, h: 50, rotation: 0,
  };
  assert.equal((await request(scrapbookPath, 1, 'PUT', validPage([photoElement]))).status, 400);
  assert.equal(pageWrites, 0);

  const sameAlbum = { ...photoElement, photoId: String(ids.friendsPhoto) };
  const accepted = await request(scrapbookPath, 1, 'PUT', validPage([sameAlbum]));
  assert.equal(accepted.status, 200);
  assert.equal(accepted.body.page.elements[0].photoId, String(ids.friendsPhoto));
});

test('stale saves return 409 instead of overwriting a friend\'s latest revision', async () => {
  const aliceSaved = await request(scrapbookPath, 1, 'PUT', validPage([sticker()]));
  assert.equal(aliceSaved.status, 200);
  assert.equal(aliceSaved.body.page.revision, 1);

  const stale = await request(scrapbookPath, 2, 'PUT', validPage([tape()]));
  assert.equal(stale.status, 409);
  assert.match(stale.body.message, /friend updated/i);

  const stillAlice = await request(scrapbookPath, 2);
  assert.equal(stillAlice.body.page.revision, 1);
  assert.equal(stillAlice.body.page.elements[0].type, 'sticker');

  const bobSaved = await request(scrapbookPath, 2, 'PUT', {
    ...validPage([sticker(), tape()]),
    revision: 1,
  });
  assert.equal(bobSaved.status, 200);
  assert.equal(bobSaved.body.page.revision, 2);
  assert.equal((await request(scrapbookPath, 1)).body.page.elements.length, 2);
});
