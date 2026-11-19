import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTheme } from "../themes/ThemeContext";
import GroupAvatars from "../components/GroupAvatars";
import { moveElement, pointerAngle, resizeElement, rotateElement } from "../utils/scrapbookGeometry";
import pinkTape from "../assets/momento/shared/washi-tape-pink.png";
import blueTape from "../assets/momento/shared/washi-tape-blue.png";
import beigeTape from "../assets/momento/shared/washi-tape-beige.png";
import yellowTape from "../assets/momento/shared/washi-tape-yellow.png";
import sageTape from "../assets/momento/shared/washi-tape-sage.png";
import redTape from "../assets/momento/shared/washi-tape-red-orange.png";
import "./ScrapbookEditor.css";

const API = (import.meta.env.VITE_API_URL || "http://localhost:3000").replace(/\/$/, "");
const TAPES = { pink: pinkTape, blue: blueTape, beige: beigeTape, yellow: yellowTape, sage: sageTape, "red-orange": redTape };
const TOOLS = [
  { id: "photos", symbol: "+", label: "Add Photo" },
  { id: "text", symbol: "T", label: "Add Text" },
  { id: "stickers", symbol: "✳", label: "Stickers" },
  { id: "tape", symbol: "#", label: "Washi Tape" },
  { id: "background", symbol: "◌", label: "Background" },
  { id: "layouts", symbol: "▣", label: "Layouts" },
];
const BACKGROUNDS = ["lined", "plain", "dots", "grid"];
const LAYOUTS = ["classic", "collage", "minimal"];
const fontStyles = {
  hand: '"Segoe Print", "Comic Sans MS", cursive',
  serif: 'Georgia, "Times New Roman", serif',
  sans: 'Arial, "Segoe UI", sans-serif',
};
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const createId = () => crypto.randomUUID();

function makeElement(type, content, page, position) {
  const defaults = {
    text: { w: 62, h: 24, content: "Write your memory here...", fontSize: 26 },
    photo: { w: 65, h: 55, photoId: content },
    sticker: { w: 25, h: 24, imageUrl: content },
    decoration: { w: 38, h: 11, content },
  }[type];

  return {
    id: createId(), type, page,
    content: "", imageUrl: "", photoId: null,
    x: 20, y: 27, w: 35, h: 24, rotation: 0,
    fontSize: 24, fontFamily: "hand", color: "#30251d",
    ...defaults, ...position,
  };
}

async function getJSON(url, options = {}) {
  const response = await fetch(url, { credentials: "include", ...options });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.message || "Something went wrong");
    error.status = response.status;
    throw error;
  }
  return data;
}

export default function ScrapbookEditor({ space, members = [] }) {
  const { theme } = useTheme();
  const navigate = useNavigate();
  const { albumId, photoId } = useParams();
  const [album, setAlbum] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [imageUrls, setImageUrls] = useState({});
  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [activePage, setActivePage] = useState(0);
  const [tool, setTool] = useState(null);
  const [stickerCategory, setStickerCategory] = useState("stamps");
  const [search, setSearch] = useState("");
  const [stickers, setStickers] = useState([]);
  const interaction = useRef(null);
  const pointerFrame = useRef(null);
  const pendingPointer = useRef(null);
  const canvasRefs = useRef([null, null]);
  const editSerial = useRef(0);

  useEffect(() => () => {
    if (pointerFrame.current !== null) cancelAnimationFrame(pointerFrame.current);
  }, []);

  const albumPath = "/albums?space=" + encodeURIComponent(space.id) +
    "&album=" + encodeURIComponent(albumId);
  const albumApi = API + "/api/spaces/" + encodeURIComponent(space.id) +
    "/albums/" + encodeURIComponent(albumId);
  const pageApi = albumApi + "/photos/" + encodeURIComponent(photoId) + "/scrapbook";

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setNotice("");
    setSelectedId(null);
    setDoc(null);
    setDirty(false);
    editSerial.current = 0;
    setTool(null);

    Promise.all([
      getJSON(albumApi, { signal: controller.signal }),
      getJSON(pageApi, { signal: controller.signal }),
    ]).then(([albumData, pageData]) => {
      if (controller.signal.aborted) return;
      setAlbum(albumData.album);
      setPhotos(albumData.photos || []);
      setDoc(pageData.page);
    }).catch((e) => {
      if (!controller.signal.aborted && e.name !== "AbortError") setError(e.message);
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [albumApi, pageApi]);

  // Album images are private; obtain short-lived object URLs with the session cookie.
  useEffect(() => {
    const controller = new AbortController();
    const created = [];
    let active = true;
    setImageUrls({});
    Promise.all(photos.map(async (photo) => {
      try {
        const response = await fetch(API + photo.imageUrl, {
          credentials: "include",
          signal: controller.signal,
        });
        if (!response.ok) return null;
        const blob = await response.blob();
        if (!active || controller.signal.aborted) return null;
        const objectUrl = URL.createObjectURL(blob);
        created.push(objectUrl);
        return [photo.id, objectUrl];
      } catch {
        return null;
      }
    })).then((entries) => {
      if (active) setImageUrls(Object.fromEntries(entries.filter(Boolean)));
    });
    return () => {
      active = false;
      controller.abort();
      created.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [photos]);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/stickers/stickers.json", { signal: controller.signal })
      .then((response) => response.ok ? response.json() : [])
      .then((items) => setStickers(Array.isArray(items) ? items : []))
      .catch(() => {});
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const editDoc = useCallback((updater) => {
    editSerial.current += 1;
    setDoc((previous) => previous ? updater(previous) : previous);
    setDirty(true);
    setNotice("");
  }, []);

  const updateElement = (id, changes) => {
    editDoc((previous) => ({
      ...previous,
      elements: previous.elements.map((item) => item.id === id ? { ...item, ...changes } : item),
    }));
  };

  const addElement = (type, value, page = activePage, location = {}) => {
    if ((doc?.elements.length || 0) >= 80) {
      setError("This page has reached the 80-item limit.");
      return null;
    }
    const item = makeElement(type, value, page, location);
    editDoc((previous) => ({ ...previous, elements: [...previous.elements, item] }));
    setSelectedId(item.id);
    setActivePage(page);
    return item.id;
  };

  const handleTool = (toolId) => {
    if (toolId === "text") {
      addElement("text", "", activePage);
      setTool(null);
    } else {
      setTool((previous) => previous === toolId ? null : toolId);
    }
  };

  const startPointer = (event, item, mode) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    event.preventDefault();
    const rect = canvasRefs.current[item.page]?.getBoundingClientRect();
    if (!rect) return;
    if (pointerFrame.current !== null) {
      cancelAnimationFrame(pointerFrame.current);
      pointerFrame.current = null;
    }
    pendingPointer.current = null;
    interaction.current = {
      id: item.id, pointerId: event.pointerId, mode, rect,
      x: event.clientX, y: event.clientY, item,
      startAngle: mode === "rotate" ? pointerAngle(item, rect, event.clientX, event.clientY) : null,
    };
    event.currentTarget.closest(".scrap-item").setPointerCapture(event.pointerId);
    setSelectedId(item.id);
    setActivePage(item.page);
  };

  // Pointer devices can emit far more move events than the screen can paint.
  // Apply only the latest position once per animation frame, while keeping the
  // final pointer-up position so fast drags never lose their last movement.
  const applyPointerUpdate = () => {
    const pending = pendingPointer.current;
    pendingPointer.current = null;
    if (!pending || interaction.current !== pending.drag) return;
    const { drag, clientX, clientY, shiftKey } = pending;
    const dx = clientX - drag.x;
    const dy = clientY - drag.y;
    if (drag.mode === "resize") {
      updateElement(drag.id, resizeElement(drag.item, dx, dy, drag.rect, shiftKey));
    } else if (drag.mode === "rotate") {
      updateElement(drag.id, rotateElement(drag.item, drag.rect, drag.startAngle, clientX, clientY));
    } else {
      updateElement(drag.id, moveElement(drag.item, dx, dy, drag.rect));
    }
  };

  const movePointer = (event) => {
    const drag = interaction.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    pendingPointer.current = {
      drag,
      clientX: event.clientX,
      clientY: event.clientY,
      shiftKey: event.shiftKey,
    };
    if (pointerFrame.current === null) {
      pointerFrame.current = requestAnimationFrame(() => {
        pointerFrame.current = null;
        applyPointerUpdate();
      });
    }
  };

  const stopPointer = (event) => {
    const drag = interaction.current;
    if (drag?.pointerId !== event.pointerId) return;
    if (event.type === "pointerup") {
      pendingPointer.current = {
        drag,
        clientX: event.clientX,
        clientY: event.clientY,
        shiftKey: event.shiftKey,
      };
    }
    if (pointerFrame.current !== null) {
      cancelAnimationFrame(pointerFrame.current);
      pointerFrame.current = null;
    }
    applyPointerUpdate();
    interaction.current = null;
  };

  const startPaletteDrag = (event, type, value) => {
    event.dataTransfer.setData("application/x-momento", JSON.stringify({ type, value }));
    event.dataTransfer.effectAllowed = "copy";
  };

  const dropOnPage = (event, page) => {
    event.preventDefault();
    const data = event.dataTransfer.getData("application/x-momento");
    if (!data) return;
    try {
      const { type, value } = JSON.parse(data);
      if (!["photo", "sticker", "decoration"].includes(type)) return;
      const rect = canvasRefs.current[page]?.getBoundingClientRect();
      if (!rect) return;
      const x = (event.clientX - rect.left) / rect.width * 100;
      const y = (event.clientY - rect.top) / rect.height * 100;
      const item = makeElement(type, value, page, {});
      addElement(type, value, page, {
        x: clamp(x - item.w / 2, 0, 100 - item.w),
        y: clamp(y - item.h / 2, 0, 100 - item.h),
      });
    } catch {
      // Ignore unrelated browser drag data.
    }
  };

  const savePage = async () => {
    if (!doc || saving) return;
    const savingSerial = editSerial.current;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const data = await getJSON(pageApi, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          layout: doc.layout,
          backgroundLeft: doc.backgroundLeft,
          backgroundRight: doc.backgroundRight,
          revision: doc.revision,
          elements: doc.elements,
        }),
      });
      if (editSerial.current === savingSerial) {
        setDoc(data.page);
        setDirty(false);
        setNotice("Saved! Your friends can see this page ♡");
      } else {
        // A new edit happened during the request. Keep it and advance the revision.
        setDoc((previous) => ({ ...previous, revision: data.page.revision }));
        setNotice("Earlier edits saved. You still have unsaved changes.");
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const leaveEditor = (path) => {
    if (dirty && !window.confirm("You have unsaved edits. Leave this page anyway?")) return;
    navigate(path);
  };

  const currentPhotoIndex = photos.findIndex((photo) => photo.id === photoId);
  const goToPhoto = (nextIndex) => {
    if (nextIndex < 0 || nextIndex >= photos.length) return;
    leaveEditor(
      "/albums/" + encodeURIComponent(albumId) + "/photos/" +
      encodeURIComponent(photos[nextIndex].id) + "/edit?space=" + encodeURIComponent(space.id)
    );
  };

  const selected = doc?.elements.find((item) => item.id === selectedId);
  const filteredStickers = stickers.filter((item) =>
    item.category === stickerCategory &&
    item.name.toLowerCase().includes(search.trim().toLowerCase())
  );

  const renderItem = (item) => {
    const photo = photos.find((entry) => entry.id === String(item.photoId));
    const content = item.type === "photo" ? (
      <>
        {imageUrls[String(item.photoId)] ? (
          <img src={imageUrls[String(item.photoId)]} alt={photo?.caption || "Album memory"} draggable="false" />
        ) : <span className="scrap-item__loading">Loading photo...</span>}
        <span className="scrap-item__caption">{photo?.caption || "a little memory"}</span>
      </>
    ) : item.type === "sticker" ? (
      <img src={item.imageUrl} alt="Scrapbook sticker" draggable="false" />
    ) : item.type === "decoration" ? (
      <img src={TAPES[item.content]} alt="Decorative washi tape" draggable="false" />
    ) : (
      <span className="scrap-item__text" style={{
        fontFamily: fontStyles[item.fontFamily] || fontStyles.hand,
        color: item.color,
        fontSize: item.fontSize + "px",
      }}>{item.content}</span>
    );

    return (
      <div key={item.id}
        className={"scrap-item scrap-item--" + item.type + (selectedId === item.id ? " scrap-item--selected" : "")}
        style={{
          left: item.x + "%", top: item.y + "%", width: item.w + "%",
          height: item.h + "%", transform: "rotate(" + item.rotation + "deg)",
        }}
        onPointerDown={(event) => startPointer(event, item, "move")}
        onPointerMove={movePointer}
        onPointerUp={stopPointer}
        onPointerCancel={stopPointer}
        onLostPointerCapture={stopPointer}
        onDoubleClick={() => { setSelectedId(item.id); setTool(null); }}
        role="button" tabIndex={0}
        aria-label={"Move " + item.type}
        onKeyDown={(event) => {
          if (event.key === "Delete" || event.key === "Backspace") {
            event.preventDefault();
            editDoc((previous) => ({
              ...previous,
              elements: previous.elements.filter((entry) => entry.id !== item.id),
            }));
            setSelectedId(null);
          } else if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) {
            event.preventDefault();
            if (event.altKey) {
              updateElement(item.id, { rotation: clamp(item.rotation +
                (event.key === "ArrowRight" || event.key === "ArrowDown" ? 5 : -5), -180, 180) });
              return;
            }
            const step = event.shiftKey ? 5 : 1;
            const movement = {
              ArrowUp: { y: -step }, ArrowDown: { y: step },
              ArrowLeft: { x: -step }, ArrowRight: { x: step },
            }[event.key];
            updateElement(item.id, {
              x: clamp(item.x + (movement.x || 0), 0, 100 - item.w),
              y: clamp(item.y + (movement.y || 0), 0, 100 - item.h),
            });
            setSelectedId(item.id);
          }
        }}
      >
        {content}
        {selectedId === item.id && (
          <>
            <span className="scrap-item__resize" role="presentation"
              title="Drag to resize · Hold Shift to keep proportions"
              onPointerDown={(event) => startPointer(event, item, "resize")} />
            <span className="scrap-item__rotate" role="presentation"
              title="Drag to rotate"
              onPointerDown={(event) => startPointer(event, item, "rotate")} />
          </>
        )}
      </div>
    );
  };

  if (loading) return <div className="scrap-status">Opening your scrapbook...</div>;
  if (!doc || !album || currentPhotoIndex < 0) {
    return <div className="scrap-status">
      <p role="alert">{error || "This scrapbook photo could not be found."}</p>
      <button type="button" onClick={() => navigate(albumPath)}>← Back to Shared Albums</button>
    </div>;
  }

  return (
    <div className={"scrapbook-editor scrapbook-editor--" + theme}>
      <header className="scrapbook-editor__group">
        <div className="scrapbook-editor__group-title">
          {theme === "green" ? (
            <h1 className="scrapbook-editor__cutout" aria-label={space.name}>
              {Array.from(space.name.toUpperCase()).map((letter, index) =>
                letter === " " ? <span key={index} className="scrapbook-editor__gap" aria-hidden="true" /> :
                  <span key={index} aria-hidden="true">{letter}</span>
              )}
            </h1>
          ) : <h1>{space.name}</h1>}
        </div>
        <GroupAvatars members={members} className="scrapbook-editor__avatars" />
      </header>

      <div className="scrapbook-editor__heading">
        <div>
          <button className="scrapbook-editor__back" type="button" onClick={() => leaveEditor(albumPath)}>← Shared Albums</button>
          <h2>Scrapbook Editor</h2>
          <p>{album.title} <span> / </span> Page {currentPhotoIndex + 1} of {photos.length}</p>
          <p className="scrapbook-editor__hint">Click an item, drag to move, use its corner to resize or the top handle to rotate.</p>
        </div>
        <button className="scrapbook-editor__save" type="button" onClick={savePage} disabled={!dirty || saving}>
          {saving ? "Saving..." : dirty ? "Save Page" : "✓ Saved"}
        </button>
      </div>

      {(error || notice) && (
        <p className={"scrapbook-editor__feedback" + (error ? " scrapbook-editor__feedback--error" : "")}
          role={error ? "alert" : "status"}>{error || notice}</p>
      )}

      <div className="scrapbook-editor__workarea">
        <aside className="scrap-tools" aria-label="Scrapbook editing tools">
          <h3>TOOLS</h3>
          {TOOLS.map((item) => (
            <button key={item.id} type="button" aria-pressed={tool === item.id}
              className={tool === item.id ? "scrap-tools__active" : ""}
              onClick={() => handleTool(item.id)}>
              <span aria-hidden="true">{item.symbol}</span>{item.label}
            </button>
          ))}
        </aside>

        <div className="scrap-book-wrap">
          <div className={"scrap-book scrap-book--" + doc.layout}>
            {[0, 1].map((page) => (
              <div key={page}
                className={"scrap-page scrap-page--" + (page === 0 ? doc.backgroundLeft : doc.backgroundRight) +
                  (activePage === page ? " scrap-page--active" : "")}
                ref={(element) => { canvasRefs.current[page] = element; }}
                onPointerDown={() => { setActivePage(page); setSelectedId(null); }}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => dropOnPage(event, page)}
                role="region" aria-label={page === 0 ? "Left scrapbook page" : "Right scrapbook page"}
              >
                {doc.elements.filter((item) => item.page === page).map(renderItem)}
              </div>
            ))}
            <div className="scrap-book__spine" aria-hidden="true">
              {Array.from({ length: 6 }, (_, index) => <span key={index} />)}
            </div>
          </div>

          {tool && (
            <div className="scrap-palette">
              <div className="scrap-palette__heading">
                <h3>{TOOLS.find((item) => item.id === tool)?.label}</h3>
                <button type="button" aria-label="Close tools" onClick={() => setTool(null)}>✕</button>
              </div>
              {tool === "stickers" && <>
                <div className="scrap-palette__tabs">
                  {["stamps", "pixel_art", "letters", "numbers"].map((category) => (
                    <button key={category} type="button" aria-pressed={stickerCategory === category}
                      onClick={() => setStickerCategory(category)}>{category.replace("_", " ")}</button>
                  ))}
                </div>
                <input aria-label="Find a sticker" placeholder="Search stickers..."
                  value={search} onChange={(event) => setSearch(event.target.value)} />
                <div className="scrap-palette__grid">
                  {filteredStickers.map((item) => (
                    <button key={item.path} type="button" title={item.name} draggable="true"
                      onDragStart={(event) => startPaletteDrag(event, "sticker", "/stickers/" + item.path)}
                      onClick={() => addElement("sticker", "/stickers/" + item.path)}>
                      <img src={"/stickers/" + item.path} alt={item.name} loading="lazy" />
                    </button>
                  ))}
                </div>
              </>}
              {tool === "photos" && <>
                <p>Choose or drag a photo from this album.</p>
                <div className="scrap-palette__grid">
                  {photos.map((photo) => (
                    <button key={photo.id} type="button" title={photo.caption || "Album photo"}
                      draggable="true" onDragStart={(event) => startPaletteDrag(event, "photo", photo.id)}
                      onClick={() => addElement("photo", photo.id)}>
                      {imageUrls[photo.id] && <img src={imageUrls[photo.id]} alt={photo.caption || "Album photo"} />}
                    </button>
                  ))}
                </div>
              </>}
              {tool === "tape" && <>
                <p>Choose or drag a strip of tape.</p>
                <div className="scrap-palette__grid">
                  {Object.entries(TAPES).map(([name, image]) => (
                    <button key={name} type="button" title={name} draggable="true"
                      onDragStart={(event) => startPaletteDrag(event, "decoration", name)}
                      onClick={() => addElement("decoration", name)}>
                      <img src={image} alt={name + " tape"} />
                    </button>
                  ))}
                </div>
              </>}
              {tool === "background" && <>
                <p>Background for the {activePage === 0 ? "left" : "right"} page.</p>
                <div className="scrap-palette__choices">
                  {BACKGROUNDS.map((background) => (
                    <button key={background} type="button"
                      aria-pressed={(activePage === 0 ? doc.backgroundLeft : doc.backgroundRight) === background}
                      onClick={() => editDoc((previous) => ({
                        ...previous, [activePage === 0 ? "backgroundLeft" : "backgroundRight"]: background,
                      }))}>{background}</button>
                  ))}
                </div>
              </>}
              {tool === "layouts" && <>
                <p>Try a different scrapbook arrangement.</p>
                <div className="scrap-palette__choices">
                  {LAYOUTS.map((layout) => (
                    <button key={layout} type="button" aria-pressed={doc.layout === layout}
                      onClick={() => editDoc((previous) => ({ ...previous, layout }))}>{layout}</button>
                  ))}
                </div>
              </>}
            </div>
          )}
        </div>
      </div>

      {selected && (
        <section className="scrap-inspector" aria-label="Selected item settings">
          <div className="scrap-inspector__title">
            <h3>Edit {selected.type === "decoration" ? "washi tape" : selected.type}</h3>
            <button type="button" onClick={() => setSelectedId(null)}>Done ✕</button>
          </div>
          {selected.type === "text" && <>
            <label className="scrap-inspector__wide">Text
              <textarea rows="2" maxLength={1000} value={selected.content}
                onChange={(event) => updateElement(selected.id, { content: event.target.value })} />
            </label>
            <label>Font
              <select value={selected.fontFamily} onChange={(event) => updateElement(selected.id, { fontFamily: event.target.value })}>
                <option value="hand">Handwritten</option><option value="serif">Classic</option><option value="sans">Simple</option>
              </select>
            </label>
            <label>Text size
              <input type="number" min="12" max="64" value={selected.fontSize}
                onChange={(event) => updateElement(selected.id, { fontSize: clamp(Number(event.target.value), 12, 64) })} />
            </label>
            <label>Text color
              <input type="color" value={selected.color} onChange={(event) => updateElement(selected.id, { color: event.target.value })} />
            </label>
          </>}
          <p className="scrap-inspector__tip">
            Move by dragging · Resize with the corner handle · Rotate with the top handle.
            Hold Shift while resizing to keep the original proportions.
          </p>
          <button type="button" className="scrap-inspector__delete"
            onClick={() => {
              editDoc((previous) => ({ ...previous, elements: previous.elements.filter((item) => item.id !== selected.id) }));
              setSelectedId(null);
            }}>Delete item</button>
        </section>
      )}

      <nav className="scrapbook-editor__pagination" aria-label="Album scrapbook pages">
        <button type="button" disabled={currentPhotoIndex === 0} onClick={() => goToPhoto(currentPhotoIndex - 1)}>← Previous</button>
        <span>Page {currentPhotoIndex + 1} / {photos.length} · {album.title}</span>
        <button type="button" disabled={currentPhotoIndex === photos.length - 1}
          onClick={() => goToPhoto(currentPhotoIndex + 1)}>Next →</button>
      </nav>
    </div>
  );
}
