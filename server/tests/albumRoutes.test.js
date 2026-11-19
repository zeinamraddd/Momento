import test, { after, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import express from 'express';
import mongoose from 'mongoose';

import albumRoutes from '../routes/albumRoutes.js';
import User from '../models/user.js';
import Space from '../models/space.js';
import Album from '../models/album.js';
import Photo from '../models/photo.js';
import ScrapbookPage from '../models/scrapbook.js';

// Exercise the real Express routes and authentication/membership middleware.
// Replace only persistence methods: no MongoDB connection or test credentials
// are needed, and no real albums or photos are changed.
const ids = {
  alice: new mongoose.Types.ObjectId(),
  bob: new mongoose.Types.ObjectId(),
  outsider: new mongoose.Types.ObjectId(),
  friendsSpace: new mongoose.Types.ObjectId(),
  otherSpace: new mongoose.Types.ObjectId(),
  friendsAlbum: new mongoose.Types.ObjectId(),
  otherAlbum: new mongoose.Types.ObjectId(),
  photo: new mongoose.Types.ObjectId(),
  file: new mongoose.Types.ObjectId(),
};

const users = [
  { _id: ids.alice, username: 'Alice' },
  { _id: ids.bob, username: 'Bob' },
  { _id: ids.outsider, username: 'Outsider' },
];

const spaces = new Map();
const albums = new Map();
const original = {
  userFindById: User.findById,
  spaceFindOne: Space.findOne,
  albumFind: Album.find,
  albumFindOne: Album.findOne,
  albumCreate: Album.create,
  albumFindOneAndUpdate: Album.findOneAndUpdate,
  albumDeleteOne: Album.deleteOne,
  photoAggregate: Photo.aggregate,
  photoFind: Photo.find,
  photoDeleteMany: Photo.deleteMany,
  scrapbookDeleteMany: ScrapbookPage.deleteMany,
};

const sameId = (left, right) => String(left) === String(right);
const albumAt = (id) => albums.get(String(id));
let server;
let baseUrl;
let albumModelAccesses = 0;

before(async () => {
  User.findById = (id) => ({
    select: async () => users.find((user) => sameId(user._id, id)) || null,
  });

  Space.findOne = async ({ _id, members }) => {
    const space = spaces.get(String(_id));
    return space && space.members.some((id) => sameId(id, members)) ? space : null;
  };

  Album.find = ({ spaceId }) => {
    albumModelAccesses += 1;
    return {
      sort: async () => [...albums.values()].filter((album) => sameId(album.spaceId, spaceId)),
    };
  };

  Album.findOne = async ({ _id, spaceId }) => {
    albumModelAccesses += 1;
    const album = albumAt(_id);
    return album && sameId(album.spaceId, spaceId) ? album : null;
  };

  Album.create = async (fields) => {
    albumModelAccesses += 1;
    const album = {
      _id: new mongoose.Types.ObjectId(),
      coverPhoto: null,
      createdAt: new Date(),
      ...fields,
    };
    albums.set(String(album._id), album);
    return album;
  };

  Album.findOneAndUpdate = async ({ _id, spaceId }, update) => {
    albumModelAccesses += 1;
    const album = albumAt(_id);
    if (!album || !sameId(album.spaceId, spaceId)) return null;
    Object.assign(album, update.$set);
    return album;
  };

  Album.deleteOne = async ({ _id, spaceId }) => {
    albumModelAccesses += 1;
    const album = albumAt(_id);
    if (!album || !sameId(album.spaceId, spaceId)) return { deletedCount: 0 };
    albums.delete(String(_id));
    return { deletedCount: 1 };
  };

  Photo.aggregate = async () => [];
  Photo.find = () => {
    // A promise can be awaited directly by DELETE or chained by GET detail.
    const result = Promise.resolve([]);
    result.sort = () => result;
    result.populate = () => result;
    return result;
  };
  Photo.deleteMany = async () => ({ deletedCount: 0 });
  ScrapbookPage.deleteMany = async () => ({ deletedCount: 0 });

  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    const selected = Number(req.headers['x-test-user']);
    req.session = selected >= 1 && selected <= 3
      ? { userId: users[selected - 1]._id.toString() }
      : {};
    next();
  });
  app.use('/api/spaces', albumRoutes);

  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

beforeEach(() => {
  albumModelAccesses = 0;
  spaces.clear();
  albums.clear();
  spaces.set(String(ids.friendsSpace), {
    _id: ids.friendsSpace,
    name: 'Friends',
    members: [ids.alice, ids.bob],
  });
  spaces.set(String(ids.otherSpace), {
    _id: ids.otherSpace,
    name: 'Another group',
    members: [ids.outsider],
  });
  albums.set(String(ids.friendsAlbum), {
    _id: ids.friendsAlbum,
    title: 'Summer trip',
    description: 'Beach memories',
    spaceId: ids.friendsSpace,
    coverPhoto: null,
    createdAt: new Date('2026-01-01'),
  });
  albums.set(String(ids.otherAlbum), {
    _id: ids.otherAlbum,
    title: 'Private album',
    description: 'Not in the friends space',
    spaceId: ids.otherSpace,
    coverPhoto: null,
    createdAt: new Date('2026-02-01'),
  });
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  User.findById = original.userFindById;
  Space.findOne = original.spaceFindOne;
  Album.find = original.albumFind;
  Album.findOne = original.albumFindOne;
  Album.create = original.albumCreate;
  Album.findOneAndUpdate = original.albumFindOneAndUpdate;
  Album.deleteOne = original.albumDeleteOne;
  Photo.aggregate = original.photoAggregate;
  Photo.find = original.photoFind;
  Photo.deleteMany = original.photoDeleteMany;
  ScrapbookPage.deleteMany = original.scrapbookDeleteMany;
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

const friendsAlbums = `/${ids.friendsSpace}/albums`;

test('unauthenticated users cannot list, create, change, or delete albums', async () => {
  assert.equal((await request(friendsAlbums, null)).status, 401);
  assert.equal((await request(friendsAlbums, null, 'POST', { title: 'No access' })).status, 401);
  assert.equal((await request(`${friendsAlbums}/${ids.friendsAlbum}`, null)).status, 401);
  assert.equal((await request(`${friendsAlbums}/${ids.friendsAlbum}`, null, 'PATCH', { title: 'Changed' })).status, 401);
  assert.equal((await request(`${friendsAlbums}/${ids.friendsAlbum}`, null, 'DELETE')).status, 401);
  assert.equal(albumModelAccesses, 0, 'requests must fail before touching albums');
});

test('a non-member cannot list, create, change, delete, or download another group\'s albums', async () => {
  assert.equal((await request(friendsAlbums, 3)).status, 404);
  assert.equal((await request(friendsAlbums, 3, 'POST', { title: 'Intrusion' })).status, 404);
  assert.equal((await request(`${friendsAlbums}/${ids.friendsAlbum}`, 3)).status, 404);
  assert.equal((await request(`${friendsAlbums}/${ids.friendsAlbum}`, 3, 'PATCH', { title: 'Hacked' })).status, 404);
  assert.equal((await request(`${friendsAlbums}/${ids.friendsAlbum}`, 3, 'DELETE')).status, 404);
  assert.equal((await request(`${friendsAlbums}/${ids.friendsAlbum}/photos/cover`, 3)).status, 404);
  assert.equal((await request(`${friendsAlbums}/${ids.friendsAlbum}/photos/${ids.file}/file`, 3)).status, 404);
  assert.equal(albumModelAccesses, 0, 'membership denial must happen before album lookup');
  assert.equal(albumAt(ids.friendsAlbum).title, 'Summer trip');
});

test('members can list, create, and read albums within their group', async () => {
  const list = await request(friendsAlbums, 2);
  assert.equal(list.status, 200);
  assert.deepEqual(list.body.albums.map((album) => album.title), ['Summer trip']);

  const created = await request(friendsAlbums, 2, 'POST', {
    title: '  Birthday party  ',
    description: '  Photos with friends  ',
    spaceId: String(ids.otherSpace), // must be ignored in favor of the URL space
  });
  assert.equal(created.status, 201);
  assert.equal(created.body.album.title, 'Birthday party');
  assert.equal(created.body.album.description, 'Photos with friends');
  assert.equal(created.body.album.spaceId, String(ids.friendsSpace));

  const detail = await request(`${friendsAlbums}/${created.body.album.id}`, 1);
  assert.equal(detail.status, 200);
  assert.equal(detail.body.album.title, 'Birthday party');
  assert.deepEqual(detail.body.photos, []);

  assert.equal((await request(friendsAlbums, 3)).status, 404);
});

test('album validation rejects empty, non-string, or oversized inputs', async () => {
  const count = albums.size;
  assert.equal((await request(friendsAlbums, 1, 'POST', { title: ' ' })).status, 400);
  assert.equal((await request(friendsAlbums, 1, 'POST', { title: { $ne: null } })).status, 400);
  assert.equal((await request(friendsAlbums, 1, 'POST', { title: 'a'.repeat(81) })).status, 400);
  assert.equal((await request(friendsAlbums, 1, 'POST', { title: 'Valid', description: 'a'.repeat(501) })).status, 400);
  assert.equal((await request(`${friendsAlbums}/${ids.friendsAlbum}`, 1, 'PATCH', { title: '' })).status, 400);
  assert.equal((await request(`${friendsAlbums}/${ids.friendsAlbum}`, 1, 'PATCH', { title: 'a'.repeat(81) })).status, 400);
  assert.equal(albums.size, count, 'invalid payloads must not create albums');
  assert.equal(albumAt(ids.friendsAlbum).title, 'Summer trip');
});

test('album ID and space ID must be valid; cross-space album IDs are not accepted', async () => {
  assert.equal((await request('/not-a-valid-id/albums', 1)).status, 404);
  assert.equal((await request(`${friendsAlbums}/not-a-valid-id`, 1)).status, 404);

  // Bob belongs to the URL space but the target album belongs to a different one.
  assert.equal((await request(`${friendsAlbums}/${ids.otherAlbum}`, 2)).status, 404);
  assert.equal((await request(`${friendsAlbums}/${ids.otherAlbum}`, 2, 'PATCH', { title: 'Taken over' })).status, 404);
  assert.equal((await request(`${friendsAlbums}/${ids.otherAlbum}`, 2, 'DELETE')).status, 404);
  assert.equal(albumAt(ids.otherAlbum).title, 'Private album');
});

test('group members can update and delete their own space albums', async () => {
  const edited = await request(`${friendsAlbums}/${ids.friendsAlbum}`, 2, 'PATCH', {
    title: '  Updated trip  ',
    description: '  Our photos  ',
  });
  assert.equal(edited.status, 200);
  assert.equal(edited.body.album.title, 'Updated trip');
  assert.equal(edited.body.album.description, 'Our photos');
  assert.equal(albumAt(ids.friendsAlbum).title, 'Updated trip');

  const deleted = await request(`${friendsAlbums}/${ids.friendsAlbum}`, 1, 'DELETE');
  assert.equal(deleted.status, 200);
  assert.equal(deleted.body.message, 'Album deleted');
  assert.equal(albums.has(String(ids.friendsAlbum)), false);
  assert.equal(albums.has(String(ids.otherAlbum)), true);
  assert.equal((await request(`${friendsAlbums}/${ids.friendsAlbum}`, 1)).status, 404);
});
