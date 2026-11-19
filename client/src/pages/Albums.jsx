import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import GroupAvatars from '../components/GroupAvatars';
import './Albums.css';

const API = (import.meta.env.VITE_API_URL || 'http://localhost:3000').replace(/\/$/, '');

const urlFor = (spaceId, albumId = '') =>
  `${API}/api/spaces/${encodeURIComponent(spaceId)}/albums${
    albumId ? `/${encodeURIComponent(albumId)}` : ''
  }`;

export default function Albums({ space, members = [] }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialAlbumId = searchParams.get('album');
  const [albums, setAlbums] = useState([]);
  const [selected, setSelected] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState(null);
  const [caption, setCaption] = useState('');
  const [viewer, setViewer] = useState(-1);
  const [imageCache, setImageCache] = useState({});
  const cachedObjectUrls = useRef(new Map());
  const pendingImages = useRef(new Map());

  const base = urlFor(space.id);

  function openPhotoEditor(photo) {
    navigate('/albums/' + encodeURIComponent(selected.id) + '/photos/' +
      encodeURIComponent(photo.id) + '/edit?space=' + encodeURIComponent(space.id));
  }

  async function request(url, options = {}) {
    const response = await fetch(url, {
      credentials: 'include',
      ...options
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.message || 'Request failed');
    }

    return data;
  }

  async function refresh() {
    const data = await request(base);
    setAlbums(data.albums || []);
  }

  useEffect(() => {
    let active = true;

    setLoading(true);
    setError('');
    setSelected(null);
    setPhotos([]);

    request(base)
      .then(data => {
        if (active) {
          setAlbums(data.albums || []);
          if (initialAlbumId) {
            const chosen = (data.albums || []).find(album => album.id === initialAlbumId);
            if (chosen) setSelected(chosen);
          }
        }
      })
      .catch(e => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [base, initialAlbumId]);

  useEffect(() => {
    if (!selected) return;

    let active = true;

    setError('');
    setPhotos([]);

    request(urlFor(space.id, selected.id))
      .then(data => {
        if (active) {
          setSelected(data.album);
          setPhotos(data.photos || []);
        }
      })
      .catch(e => {
        if (active) setError(e.message);
      });

    return () => {
      active = false;
    };
  }, [space.id, selected?.id]);

  // Each object URL retains image bytes in memory until it is revoked.
  // Release private images when switching spaces or leaving Albums.
  useEffect(() => {
    setImageCache({});
    return () => {
      for (const controller of pendingImages.current.values()) controller.abort();
      pendingImages.current.clear();
      for (const objectUrl of cachedObjectUrls.current.values()) {
        URL.revokeObjectURL(objectUrl);
      }
      cachedObjectUrls.current.clear();
    };
  }, [space.id]);

  // Load private images using the user's session cookie, without issuing a
  // second request for an image that is already loaded or in flight.
  useEffect(() => {
    const sources = selected
      ? photos
      : albums
          .filter(a => a.coverPhoto)
          .map(a => ({
            id: a.coverPhoto,
            imageUrl: `${urlFor(space.id, a.id)}/photos/cover`
          }));

    sources.forEach(item => {
      if (!item.imageUrl || cachedObjectUrls.current.has(item.imageUrl) ||
          pendingImages.current.has(item.imageUrl)) return;

      const controller = new AbortController();
      pendingImages.current.set(item.imageUrl, controller);

      const imageUrl = item.imageUrl.startsWith('http')
        ? item.imageUrl
        : `${API}${item.imageUrl}`;

      fetch(imageUrl, {
        credentials: 'include',
        signal: controller.signal
      })
        .then(response => {
          if (!response.ok) {
            throw new Error('Image unavailable');
          }
          return response.blob();
        })
        .then(blob => {
          if (controller.signal.aborted) return;
          const objectUrl = URL.createObjectURL(blob);
          cachedObjectUrls.current.set(item.imageUrl, objectUrl);
          setImageCache(prev => ({
            ...prev,
            [item.imageUrl]: objectUrl
          }));
        })
        .catch(() => {})
        .finally(() => {
          if (pendingImages.current.get(item.imageUrl) === controller) {
            pendingImages.current.delete(item.imageUrl);
          }
        });
    });
  }, [albums, photos, selected?.id, space.id]);

  async function perform(fn) {
    setBusy(true);
    setError('');

    try {
      await fn();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  function openForm(album = null) {
    setForm(album || 'new');
    setTitle(album?.title || '');
    setDescription(album?.description || '');
  }

  async function saveAlbum(e) {
    e.preventDefault();

    await perform(async () => {
      const editing = form !== 'new';

      const data = await request(
        editing ? urlFor(space.id, form.id) : base,
        {
          method: editing ? 'PATCH' : 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            title,
            description
          })
        }
      );

      setForm(null);
      await refresh();

      if (editing) {
        setSelected(data.album);
      }
    });
  }

  async function removeAlbum() {
    if (
      !selected ||
      !window.confirm(
        `Delete album "${selected.title}" and all its photos?`
      )
    ) {
      return;
    }

    await perform(async () => {
      await request(urlFor(space.id, selected.id), {
        method: 'DELETE'
      });

      setSelected(null);
      setPhotos([]);
      await refresh();
    });
  }

  async function uploadPhoto(e) {
    e.preventDefault();

    if (!file || !selected) return;

    await perform(async () => {
      const body = new FormData();

      body.append('photo', file);
      body.append('caption', caption);

      await request(
        `${urlFor(space.id, selected.id)}/photos`,
        {
          method: 'POST',
          body
        }
      );

      setFile(null);
      setCaption('');
      e.target.reset();

      const data = await request(
        urlFor(space.id, selected.id)
      );

      setSelected(data.album);
      setPhotos(data.photos || []);

      await refresh();
    });
  }

  async function removePhoto(photo) {
    if (!window.confirm('Delete this photo?')) return;

    await perform(async () => {
      await request(
        `${urlFor(space.id, selected.id)}/photos/${photo.id}`,
        {
          method: 'DELETE'
        }
      );

      setViewer(-1);

      const data = await request(
        urlFor(space.id, selected.id)
      );

      setSelected(data.album);
      setPhotos(data.photos || []);

      await refresh();
    });
  }

  const activePhoto = viewer >= 0 ? photos[viewer] : null;

  return (
    <div className="momento-albums">
      <header className="momento-albums__top">
        <h1>{space.name}</h1>

        <GroupAvatars members={members} className="momento-albums__avatars" />
      </header>

      <section className="momento-albums__heading">
        <div>
          <h2>
            {selected ? selected.title : 'Shared Albums'}
          </h2>

          <p>
            {selected
              ? selected.description ||
                'Our favorite moments together'
              : 'A home for every story you want to keep.'}
          </p>
        </div>

        <div className="momento-albums__heading-actions">
          {selected && (
            <button
              className="momento-albums__secondary"
              onClick={() => {
                setSelected(null);
                setViewer(-1);
                navigate('/albums?space=' + encodeURIComponent(space.id));
              }}
            >
              ← All albums
            </button>
          )}

          <button
            onClick={() =>
              selected ? openForm(selected) : openForm()
            }
          >
            {selected ? 'Edit Album' : '+ New Album'}
          </button>

          {selected && (
            <button
              className="momento-albums__danger"
              onClick={removeAlbum}
              disabled={busy}
            >
              Delete Album
            </button>
          )}
        </div>
      </section>

      {error && (
        <p role="alert" className="momento-albums__error">
          {error}
        </p>
      )}

      {loading ? (
        <p>Loading albums...</p>
      ) : !selected ? (
        <div className="momento-albums__grid">
          {albums.map(album => {
            const coverUrl =
              `${urlFor(space.id, album.id)}/photos/cover`;

            return (
              <button
                key={album.id}
                className="momento-albums__card"
                onClick={() => setSelected(album)}
              >
                <div className="momento-albums__art">
                  {imageCache[coverUrl] ? (
                    <img
                      src={imageCache[coverUrl]}
                      alt=""
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    <span>📷</span>
                  )}
                </div>

                <strong>{album.title}</strong>

                <small>
                  {album.photoCount}{' '}
                  {album.photoCount === 1
                    ? 'photo'
                    : 'photos'}
                </small>
              </button>
            );
          })}

          <button
            className="momento-albums__card momento-albums__create"
            onClick={() => openForm()}
          >
            <span>+</span>

            <strong>
              Create a New
              <br />
              Album
            </strong>
          </button>
        </div>
      ) : (
        <>
          <form
            className="momento-albums__upload"
            onSubmit={uploadPhoto}
          >
            <label>
              Add a photo

              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                required
                onChange={e =>
                  setFile(e.target.files?.[0] || null)
                }
              />
            </label>

            <input
              placeholder="Caption (optional)"
              maxLength="300"
              value={caption}
              onChange={e => setCaption(e.target.value)}
            />

            <button disabled={busy || !file}>
              Upload Photo
            </button>
          </form>

          <div className="momento-albums__grid">
            {photos.map((photo, index) => (
              <div className="momento-albums__photo-tile" key={photo.id}>
                <button
                  className="momento-albums__card"
                  onClick={() => openPhotoEditor(photo)}
                >
                  <div className="momento-albums__art">
                    {imageCache[photo.imageUrl] ? (
                      <img
                        src={imageCache[photo.imageUrl]}
                        alt={photo.caption || 'Album photo'}
                        loading="lazy"
                        decoding="async"
                      />
                    ) : (
                      <span>📷</span>
                    )}
                  </div>

                  <strong>{photo.caption || 'A memory'}</strong>
                  <small>{photo.uploader}</small>
                </button>
                <button type="button" className="momento-albums__quick-view"
                  onClick={() => setViewer(index)}>Quick view / delete</button>
              </div>
            ))}

            {photos.length === 0 && (
              <p>
                No photos yet. Add the first memory!
              </p>
            )}
          </div>
        </>
      )}

      {form && (
        <div className="momento-albums__overlay">
          <form
            className="momento-albums__dialog"
            onSubmit={saveAlbum}
          >
            <h2>
              {form === 'new'
                ? 'New Album'
                : 'Edit Album'}
            </h2>

            <label>
              Album name

              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                required
                maxLength="80"
                autoFocus
              />
            </label>

            <label>
              Description

              <textarea
                value={description}
                onChange={e =>
                  setDescription(e.target.value)
                }
                maxLength="500"
              />
            </label>

            <div>
              <button disabled={busy}>
                Save Album
              </button>

              <button
                type="button"
                className="momento-albums__secondary"
                onClick={() => setForm(null)}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {activePhoto && (
        <div className="momento-albums__overlay">
          <div
            className="momento-albums__viewer"
            role="dialog"
            aria-modal="true"
            aria-label="Photo viewer"
          >
            <button
              className="momento-albums__close"
              onClick={() => setViewer(-1)}
            >
              ✕ Close
            </button>

            {imageCache[activePhoto.imageUrl] ? (
              <img
                src={imageCache[activePhoto.imageUrl]}
                alt={activePhoto.caption || 'Shared photo'}
              />
            ) : (
              <p>Loading image...</p>
            )}

            <p>
              {activePhoto.caption || 'A memory'}
              {' · '}
              {activePhoto.uploader}
              {' · '}
              {new Date(
                activePhoto.createdAt
              ).toLocaleDateString()}
            </p>

            <div>
              <button
                onClick={() =>
                  setViewer(
                    (viewer - 1 + photos.length) %
                      photos.length
                  )
                }
              >
                ← Previous
              </button>

              <button
                onClick={() =>
                  setViewer(
                    (viewer + 1) % photos.length
                  )
                }
              >
                Next →
              </button>

              <button onClick={() => openPhotoEditor(activePhoto)}>
                Open Scrapbook Editor
              </button>

              <button
                className="momento-albums__danger"
                onClick={() => removePhoto(activePhoto)}
                disabled={busy}
              >
                Delete Photo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
