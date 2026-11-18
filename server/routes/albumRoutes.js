import express from 'express';
import mongoose from 'mongoose';
import { GridFSBucket } from 'mongodb';
import { Readable } from 'node:stream';
import Album from '../models/album.js';
import Photo from '../models/photo.js';
import ScrapbookPage from '../models/scrapbook.js';
import Space from '../models/space.js';
import requireAuth from '../middleware/requireAuth.js';

const router = express.Router();
const MAX_BYTES = 8 * 1024 * 1024;
const TYPES = new Map([['image/jpeg', '.jpg'], ['image/png', '.png'], ['image/webp', '.webp'], ['image/gif', '.gif']]);
const valid = (id) => mongoose.isValidObjectId(id);
const bucket = () => new GridFSBucket(mongoose.connection.db, { bucketName: 'albumImages' });
const albumView = (a, count = 0) => ({ id: String(a._id), title: a.title, description: a.description, spaceId: String(a.spaceId), coverPhoto: a.coverPhoto ? String(a.coverPhoto) : null, photoCount: count, createdAt: a.createdAt });
const photoView = (p) => ({ id: String(p._id), albumId: String(p.albumId), uploadedBy: p.uploadedBy?._id ? String(p.uploadedBy._id) : String(p.uploadedBy), uploader: p.uploadedBy?.username || 'Member', imageUrl: p.imageUrl, caption: p.caption, createdAt: p.createdAt });

router.use('/:spaceId/albums', requireAuth, async (req, res, next) => {
  if (!valid(req.params.spaceId)) return res.status(404).json({ message: 'Space not found' });
  try {
    const space = await Space.findOne({ _id: req.params.spaceId, members: req.user._id });
    if (!space) return res.status(404).json({ message: 'Space not found or access denied' });
    req.space = space;
    next();
  } catch (e) { console.error(e); res.status(500).json({ message: 'Could not verify membership' }); }
});

async function getAlbum(req, res) {
  if (!valid(req.params.albumId)) { res.status(404).json({ message: 'Album not found' }); return null; }
  const album = await Album.findOne({ _id: req.params.albumId, spaceId: req.space._id });
  if (!album) res.status(404).json({ message: 'Album not found' });
  return album;
}

router.get('/:spaceId/albums', async (req, res) => {
  try {
    const albums = await Album.find({ spaceId: req.space._id }).sort({ createdAt: -1 });
    const counts = await Photo.aggregate([{ $match: { albumId: { $in: albums.map(a => a._id) } } }, { $group: { _id: '$albumId', count: { $sum: 1 } } }]);
    const map = new Map(counts.map(c => [String(c._id), c.count]));
    res.json({ albums: albums.map(a => albumView(a, map.get(String(a._id)) || 0)) });
  } catch (e) { console.error(e); res.status(500).json({ message: 'Could not load albums' }); }
});

router.post('/:spaceId/albums', async (req, res) => {
  const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
  const description = typeof req.body?.description === 'string' ? req.body.description.trim() : '';
  if (!title || title.length > 80 || description.length > 500) return res.status(400).json({ message: 'Title must be 1–80 characters and description at most 500' });
  try {
    const album = await Album.create({ title, description, spaceId: req.space._id });
    res.status(201).json({ album: albumView(album) });
  } catch (e) { console.error(e); res.status(500).json({ message: 'Could not create album' }); }
});

router.get('/:spaceId/albums/:albumId', async (req, res) => {
  try {
    const album = await getAlbum(req, res); if (!album) return;
    const photos = await Photo.find({ albumId: album._id }).sort({ createdAt: 1 }).populate('uploadedBy', 'username');
    res.json({ album: albumView(album, photos.length), photos: photos.map(photoView) });
  } catch (e) { console.error(e); res.status(500).json({ message: 'Could not load album' }); }
});

router.patch('/:spaceId/albums/:albumId', async (req, res) => {
  const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
  const description = typeof req.body?.description === 'string' ? req.body.description.trim() : '';
  if (!title || title.length > 80 || description.length > 500) return res.status(400).json({ message: 'Invalid title or description' });
  try {
    const album = await Album.findOneAndUpdate({ _id: valid(req.params.albumId) ? req.params.albumId : null, spaceId: req.space._id }, { $set: { title, description } }, { new: true, runValidators: true });
    if (!album) return res.status(404).json({ message: 'Album not found' });
    res.json({ album: albumView(album) });
  } catch (e) { console.error(e); res.status(500).json({ message: 'Could not update album' }); }
});

router.delete('/:spaceId/albums/:albumId', async (req, res) => {
  try {
    const album = await getAlbum(req, res); if (!album) return;
    const photos = await Photo.find({ albumId: album._id });
    // Delete database metadata only after attempting file cleanup.
    for (const photo of photos) {
      const fileId = photo.imageUrl?.match(/\/photos\/([a-f0-9]{24})\/file$/)?.[1];
      if (fileId) {
        try { await bucket().delete(new mongoose.Types.ObjectId(fileId)); }
        catch (e) { if (e.code !== 'ENOENT' && e.code !== 'FileNotFound') throw e; }
      }
    }
    await Photo.deleteMany({ albumId: album._id });
    await ScrapbookPage.deleteMany({ albumId: album._id });
    await Album.deleteOne({ _id: album._id, spaceId: req.space._id });
    res.json({ message: 'Album deleted' });
  } catch (e) { console.error(e); res.status(500).json({ message: 'Could not delete album' }); }
});

// Receive a single multipart image without extra dependencies. Express does not parse multipart.
// The upload route uses multer with an in-memory limit; validation is repeated server-side.
import multer from 'multer';
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_BYTES, files: 1 }, fileFilter: (_req, file, cb) => cb(null, TYPES.has(file.mimetype)) });
const receiveImage = (req, res, next) => upload.single('photo')(req, res, err => {
  if (err) return res.status(400).json({ message: err.code === 'LIMIT_FILE_SIZE' ? 'Image exceeds 8 MB' : 'Invalid upload' });
  next();
});
const detectedType = (b) => {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return 'image/png';
  if (b.length >= 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  if (b.length >= 6 && ['GIF87a', 'GIF89a'].includes(b.toString('ascii', 0, 6))) return 'image/gif';
  return null;
};

router.post('/:spaceId/albums/:albumId/photos', receiveImage, async (req, res) => {
  try {
    const album = await getAlbum(req, res); if (!album) return;
    const type = req.file && detectedType(req.file.buffer);
    if (!type || type !== req.file.mimetype) return res.status(400).json({ message: 'Please upload a valid JPG, PNG, WEBP or GIF' });
    const caption = typeof req.body?.caption === 'string' ? req.body.caption.trim() : '';
    if (caption.length > 300) return res.status(400).json({ message: 'Caption must be at most 300 characters' });
    const stream = bucket().openUploadStream(`photo${TYPES.get(type)}`, { contentType: type, metadata: { spaceId: req.space._id, albumId: album._id, uploadedBy: req.user._id } });
    try {
      await new Promise((resolve, reject) => { Readable.from(req.file.buffer).pipe(stream).on('finish', resolve).on('error', reject); });
    } catch (e) { try { await bucket().delete(stream.id); } catch {} throw e; }
    let photo;
    try {
      photo = await Photo.create({ albumId: album._id, uploadedBy: req.user._id, imageUrl: `/api/spaces/${req.space._id}/albums/${album._id}/photos/${stream.id}/file`, caption });
    } catch (e) { await bucket().delete(stream.id); throw e; }
    if (!album.coverPhoto) await Album.updateOne({ _id: album._id, coverPhoto: null }, { $set: { coverPhoto: photo._id } });
    await photo.populate('uploadedBy', 'username');
    res.status(201).json({ photo: photoView(photo) });
  } catch (e) { console.error(e); res.status(500).json({ message: 'Could not upload photo' }); }
});

router.get('/:spaceId/albums/:albumId/photos/cover', async (req, res) => {
  try {
    const album = await getAlbum(req, res); if (!album) return;
    let photo = album.coverPhoto ? await Photo.findOne({ _id: album.coverPhoto, albumId: album._id }) : null;
    if (!photo) photo = await Photo.findOne({ albumId: album._id }).sort({ createdAt: 1 });
    if (!photo) return res.status(404).json({ message: 'No cover image' });
    const fileId = photo.imageUrl.match(/\/photos\/([a-f0-9]{24})\/file$/)?.[1];
    if (!fileId) return res.status(404).json({ message: 'Image unavailable' });
    const id = new mongoose.Types.ObjectId(fileId);
    const files = await bucket().find({ _id: id }).toArray();
    if (!files.length) return res.status(404).json({ message: 'Image unavailable' });
    res.set('Content-Type', files[0].contentType || 'application/octet-stream');
    res.set('Cache-Control', 'private, no-store');
    bucket().openDownloadStream(id).on('error', e => { console.error(e); if (!res.headersSent) res.status(500).end(); else res.destroy(); }).pipe(res);
  } catch (e) { console.error(e); if (!res.headersSent) res.status(500).json({ message: 'Could not load cover' }); }
});

router.get('/:spaceId/albums/:albumId/photos/:fileId/file', async (req, res) => {
  try {
    const album = await getAlbum(req, res); if (!album) return;
    if (!valid(req.params.fileId)) return res.status(404).json({ message: 'Photo not found' });
    const url = `/api/spaces/${req.space._id}/albums/${album._id}/photos/${req.params.fileId}/file`;
    const photo = await Photo.findOne({ albumId: album._id, imageUrl: url });
    if (!photo) return res.status(404).json({ message: 'Photo not found' });
    const id = new mongoose.Types.ObjectId(req.params.fileId);
    const files = await bucket().find({ _id: id }).toArray();
    if (!files.length) return res.status(404).json({ message: 'Image file not found' });
    res.set('Content-Type', files[0].contentType || 'application/octet-stream');
    res.set('Cache-Control', 'private, no-store');
    bucket().openDownloadStream(id).on('error', (e) => { console.error(e); if (!res.headersSent) res.status(500).end(); else res.destroy(); }).pipe(res);
  } catch (e) { console.error(e); if (!res.headersSent) res.status(500).json({ message: 'Could not load photo' }); }
});

router.delete('/:spaceId/albums/:albumId/photos/:photoId', async (req, res) => {
  try {
    const album = await getAlbum(req, res); if (!album) return;
    if (!valid(req.params.photoId)) return res.status(404).json({ message: 'Photo not found' });
    const photo = await Photo.findOne({ _id: req.params.photoId, albumId: album._id });
    if (!photo) return res.status(404).json({ message: 'Photo not found' });
    const fileId = photo.imageUrl.match(/\/photos\/([a-f0-9]{24})\/file$/)?.[1];
    if (fileId) await bucket().delete(new mongoose.Types.ObjectId(fileId));
    await Photo.deleteOne({ _id: photo._id });
    await ScrapbookPage.deleteMany({ albumId: album._id, photoId: photo._id });
    if (String(album.coverPhoto) === String(photo._id)) {
      const nextPhoto = await Photo.findOne({ albumId: album._id }).sort({ createdAt: 1 });
      await Album.updateOne({ _id: album._id }, { $set: { coverPhoto: nextPhoto?._id || null } });
    }
    res.json({ message: 'Photo deleted' });
  } catch (e) { console.error(e); res.status(500).json({ message: 'Could not delete photo' }); }
});

export default router;
