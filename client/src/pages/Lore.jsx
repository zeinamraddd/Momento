
import { useEffect, useState } from "react";
import { useTheme } from "../themes/ThemeContext";
import "./Lore.css";

const dateLabel = (value) => {
  if (!value || Number.isNaN(new Date(value).getTime())) return "";
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

function Lore({ space, user }) {
  const { theme } = useTheme();
  const API_URL =
    import.meta.env.VITE_API_URL || "http://localhost:3000";

  const spaceId = space?.id || space?._id;
  const userId = user?.id || user?._id;

  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState("");
  const [quote, setQuote] = useState("");
  const [context, setContext] = useState("");

  const [versionTexts, setVersionTexts] = useState({});
  const [editingVersions, setEditingVersions] = useState({});
  const [activeIndex, setActiveIndex] = useState(0);
  const [replyIndex, setReplyIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [showVersions, setShowVersions] = useState(false);

  const baseURL = `${API_URL}/api/spaces/${encodeURIComponent(spaceId || "")}/lore`;

  // Load Lore Cards
  useEffect(() => {
    if (!spaceId) {
      setCards([]);
      setLoading(false);
      return;
    }

    const controller = new AbortController();

    const loadCards = async () => {
      setLoading(true);
      setError("");
      setActiveIndex(0);
      setReplyIndex(0);
      setIsFlipped(false);
      setShowVersions(false);

      try {
        const response = await fetch(baseURL, {
          credentials: "include",
          signal: controller.signal,
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || "Could not load Lore Cards");
        }

        if (!controller.signal.aborted) setCards(data.cards || []);
      } catch (err) {
        if (err.name !== "AbortError") setError(err.message);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    loadCards();
    return () => controller.abort();
  }, [spaceId, baseURL]);

  // Reset the card form
  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setTitle("");
    setQuote("");
    setContext("");
  };

  // Create or edit a Lore Card
  const saveCard = async (event) => {
    event.preventDefault();

    if (!title.trim() || !quote.trim() || !context.trim() || saving) return;

    setSaving(true);
    setError("");

    const isEditing = editingId !== null;

    try {
      const response = await fetch(
        isEditing ? `${baseURL}/${editingId}` : baseURL,
        {
          method: isEditing ? "PATCH" : "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: title.trim(),
            quote: quote.trim(),
            context: context.trim(),
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Could not save Lore Card");
      }

      if (isEditing) {
        setCards((previous) =>
          previous.map((card) => card.id === editingId ? data.card : card)
        );
      } else {
        setCards((previous) => [data.card, ...previous]);
        setActiveIndex(0);
        setReplyIndex(0);
        setIsFlipped(false);
        setShowVersions(false);
      }

      closeForm();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  // Start editing a card
  const editCard = (card) => {
    setEditingId(card.id);
    setTitle(card.title);
    setQuote(card.quote);
    setContext(card.context);
    setShowForm(true);
  };

  // Delete a card
  const deleteCard = async (cardId) => {
    if (!window.confirm("Are you sure you want to delete this Lore Card?")) return;

    try {
      const response = await fetch(`${baseURL}/${cardId}`, {
        method: "DELETE",
        credentials: "include",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Could not delete Lore Card");
      }

      setCards((previous) => previous.filter((card) => card.id !== cardId));
      setActiveIndex((previous) => Math.max(0, Math.min(previous, cards.length - 2)));
      setReplyIndex(0);
      setShowVersions(false);
    } catch (err) {
      setError(err.message);
    }
  };

  // Add an alternative story
  const addVersion = async (cardId) => {
    const content = versionTexts[cardId]?.trim();

    if (!content) return;

    try {
      const response = await fetch(`${baseURL}/${cardId}/versions`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Could not add story");
      }

      setCards((previous) =>
        previous.map((card) => card.id === cardId ? data.card : card)
      );

      setVersionTexts((previous) => ({ ...previous, [cardId]: "" }));
      setReplyIndex(Math.max(0, (data.card.versions?.length || 1) - 1));
    } catch (err) {
      setError(err.message);
    }
  };

  // Edit your own alternative story
  const saveVersion = async (cardId, versionId) => {
    const content = editingVersions[versionId]?.trim();

    if (!content) return;

    try {
      const response = await fetch(
        `${baseURL}/${cardId}/versions/${versionId}`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Could not edit story");
      }

      setCards((previous) =>
        previous.map((card) => card.id === cardId ? data.card : card)
      );

      setEditingVersions((previous) => {
        const updated = { ...previous };
        delete updated[versionId];
        return updated;
      });
    } catch (err) {
      setError(err.message);
    }
  };

  // Delete your own alternative story
  const deleteVersion = async (cardId, versionId) => {
    if (!window.confirm("Delete your alternative story?")) return;

    try {
      const response = await fetch(
        `${baseURL}/${cardId}/versions/${versionId}`,
        {
          method: "DELETE",
          credentials: "include",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Could not delete story");
      }

      setCards((previous) =>
        previous.map((card) =>
          card.id === cardId
            ? {
                ...card,
                versions: card.versions.filter((v) => v.id !== versionId),
              }
            : card
        )
      );
      setReplyIndex(0);
    } catch (err) {
      setError(err.message);
    }
  };

  // Toggle reaction
  const toggleReaction = async (cardId) => {
    try {
      const response = await fetch(`${baseURL}/${cardId}/reactions`, {
        method: "POST",
        credentials: "include",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Could not update reaction");
      }

      setCards((previous) =>
        previous.map((card) => card.id === cardId ? data.card : card)
      );
    } catch (err) {
      setError(err.message);
    }
  };

  const currentIndex = Math.min(activeIndex, Math.max(0, cards.length - 1));
  const card = cards[currentIndex];
  const versions = card?.versions || [];
  const activeReplyIndex = Math.min(replyIndex, Math.max(0, versions.length - 1));
  const activeReply = versions[activeReplyIndex];

  const goToCard = (index) => {
    setActiveIndex(index);
    setReplyIndex(0);
    setIsFlipped(false);
    setShowVersions(false);
    closeForm();
  };

  return (
    <div className={"lore-page lore-page--" + theme}>
      <header className="lore-space-header">
        <div className="lore-space-header__paper">
          {theme === "green" ? (
            <h1 className="lore-cutout-title" aria-label={space?.name || "Our scrapbook"}>
              {Array.from((space?.name || "Our scrapbook").toUpperCase()).map((letter, index) =>
                letter === " " ? <span key={index} className="lore-cutout-title__space" aria-hidden="true" /> :
                <span key={index} className="lore-cutout-title__letter" aria-hidden="true">{letter}</span>
              )}
            </h1>
          ) : <h1>{space?.name || "Our scrapbook"}</h1>}
        </div>
        {/* Decorative placeholders match the existing Home screen. */}
        <div className="lore-space-header__avatars" aria-label="Scrapbook friends">
          <span className="lore-avatar lore-avatar--pink">M</span>
          <span className="lore-avatar lore-avatar--blue">A</span>
          <span className="lore-avatar lore-avatar--yellow">J</span>
        </div>
      </header>

      <section className="lore-board" aria-labelledby="lore-heading">
        <div className="lore-board__heading">
          <div>
            <h2 id="lore-heading">Our Lore Cards</h2>
            <p>The stories only we understand.</p>
          </div>
          <button type="button" className="lore-button lore-button--primary"
            aria-expanded={showForm} onClick={() => { closeForm(); setShowForm(true); }}>
            ＋ Add Lore Card
          </button>
        </div>

        {error && <p className="lore-error" role="alert">{error}</p>}

        {showForm && (
          <form className="lore-form" onSubmit={saveCard}>
            <div className="lore-form__heading">
              <h3>{editingId ? "Edit this memory" : "A new piece of lore"}</h3>
              <button type="button" className="lore-text-button" onClick={closeForm}>Close ✕</button>
            </div>
            <label htmlFor="lore-title">Story title</label>
            <input id="lore-title" value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="The legendary charger incident..." maxLength={100} required />
            <label htmlFor="lore-context">What happened?</label>
            <textarea id="lore-context" value={context} onChange={(e) => setContext(e.target.value)}
              placeholder="Tell us the story..." maxLength={5000} rows={3} required />
            <label htmlFor="lore-quote">The iconic quote</label>
            <textarea id="lore-quote" value={quote} onChange={(e) => setQuote(e.target.value)}
              placeholder="What did someone say?" maxLength={240} rows={2} required />
            <div className="lore-form__actions">
              <button type="submit" disabled={saving} className="lore-button lore-button--primary">
                {saving ? "Saving..." : editingId ? "Save Changes" : "Create Card"}
              </button>
              <button type="button" className="lore-button lore-button--quiet" onClick={closeForm}>Cancel</button>
            </div>
          </form>
        )}

        {loading ? (
          <div className="lore-empty" role="status">Opening your memories...</div>
        ) : !card ? (
          <div className="lore-empty">
            <span aria-hidden="true">♡</span>
            <h3>No Lore Cards yet</h3>
            <p>Every legendary friendship has a story. Add your first one!</p>
          </div>
        ) : (
          <>
            <div className={"lore-featured" + (isFlipped ? " lore-featured--flipped" : "")}>
              <article className="lore-face lore-face--front" aria-label="Front of lore card">
                <span className="lore-face__tape" aria-hidden="true" />
                <span className="lore-face__label">FRONT / STORY</span>
                <div className="lore-face__content">
                  <h3>{card.title}</h3>
                  <div className="lore-face__rule" aria-hidden="true" />
                  <p className="lore-face__story">{card.context}</p>
                  <blockquote>“{card.quote}”</blockquote>
                  <p className="lore-face__byline">Added by {card.creatorName} <span>·</span> {dateLabel(card.createdAt)}</p>
                </div>
              </article>
              <article className="lore-face lore-face--back" aria-label="Back of lore card">
                <span className="lore-face__tape" aria-hidden="true" />
                <span className="lore-face__label">BACK / REPLY</span>
                <div className="lore-face__content">
                  <h3>That&apos;s not how<br />it happened!</h3>
                  {activeReply ? (
                    <>
                      <p className="lore-face__reply">“{activeReply.content}”</p>
                      <p className="lore-face__byline">— {activeReply.contributorName}</p>
                      {versions.length > 1 && (
                        <div className="lore-reply-pager" aria-label="Browse alternative replies">
                          <button type="button" aria-label="Previous reply"
                            onClick={() => setReplyIndex((activeReplyIndex - 1 + versions.length) % versions.length)}>‹</button>
                          <span>{activeReplyIndex + 1} / {versions.length} replies</span>
                          <button type="button" aria-label="Next reply"
                            onClick={() => setReplyIndex((activeReplyIndex + 1) % versions.length)}>›</button>
                        </div>
                      )}
                    </>
                  ) : <>
                    <p className="lore-face__reply lore-face__reply--empty">Every story has another side...</p>
                    <p className="lore-face__byline">Be the first to tell yours ♡</p>
                  </>}
                </div>
              </article>
            </div>

            <div className="lore-toolbar">
              <p>Flip the card to see the other side</p>
              <div className="lore-toolbar__buttons">
                <button type="button" className="lore-button lore-button--flip"
                  aria-pressed={isFlipped} onClick={() => setIsFlipped((previous) => !previous)}>
                  ↻ {isFlipped ? "Flip Back" : "Flip Card"}
                </button>
                <button type="button" className="lore-button lore-button--funny"
                  aria-pressed={Boolean(card.hasReacted)} onClick={() => toggleReaction(card.id)}>
                  <span aria-hidden="true">{card.hasReacted ? "♥" : "♡"}</span> Still Funny · {card.reactionCount}
                </button>
                <button type="button" className="lore-button lore-button--version"
                  aria-expanded={showVersions} onClick={() => setShowVersions((previous) => !previous)}>
                  ↩ {showVersions ? "Hide Versions" : "Add Your Version"}
                </button>
              </div>
            </div>

            {card.createdBy === userId && (
              <div className="lore-owner-actions">
                <button type="button" onClick={() => editCard(card)}>✎ Edit this card</button>
                <span aria-hidden="true">·</span>
                <button type="button" onClick={() => deleteCard(card.id)}>Delete card</button>
              </div>
            )}

            {showVersions && (
              <section className="lore-versions" aria-label="Alternative versions of the story">
                <div className="lore-versions__heading">
                  <h3>Everyone has their version...</h3>
                  <span>{versions.length} {versions.length === 1 ? "reply" : "replies"}</span>
                </div>
                {versions.length === 0 && <p className="lore-versions__intro">No replies yet. You can start the debate.</p>}
                {versions.map((version) => (
                  <div className="lore-version" key={version.id}>
                    <div className="lore-version__top">
                      <strong>{version.contributorName}</strong>
                      <span>{dateLabel(version.createdAt)}</span>
                    </div>
                    {editingVersions[version.id] !== undefined ? (
                      <>
                        <textarea aria-label={"Edit version by " + version.contributorName}
                          value={editingVersions[version.id]}
                          onChange={(e) => setEditingVersions((previous) => ({ ...previous, [version.id]: e.target.value }))}
                          maxLength={5000} rows={3} />
                        <div className="lore-version__actions">
                          <button type="button" onClick={() => saveVersion(card.id, version.id)}>Save</button>
                          <button type="button" onClick={() => setEditingVersions((previous) => {
                            const updated = { ...previous };
                            delete updated[version.id];
                            return updated;
                          })}>Cancel</button>
                        </div>
                      </>
                    ) : <>
                      <p>{version.content}</p>
                      {version.userId === userId && (
                        <div className="lore-version__actions">
                          <button type="button" onClick={() => setEditingVersions((previous) => ({ ...previous, [version.id]: version.content }))}>Edit</button>
                          <button type="button" onClick={() => deleteVersion(card.id, version.id)}>Delete</button>
                        </div>
                      )}
                    </>}
                  </div>
                ))}
                <div className="lore-add-version">
                  <label htmlFor="lore-new-version">Your side of the story</label>
                  <textarea id="lore-new-version" value={versionTexts[card.id] || ""}
                    onChange={(e) => setVersionTexts((previous) => ({ ...previous, [card.id]: e.target.value }))}
                    placeholder="Okay, but here's what REALLY happened..." maxLength={5000} rows={3} />
                  <button type="button" className="lore-button lore-button--primary"
                    disabled={!versionTexts[card.id]?.trim()} onClick={() => addVersion(card.id)}>
                    ＋ Add my version
                  </button>
                </div>
              </section>
            )}

            <nav className="lore-pagination" aria-label="Browse lore cards">
              <button type="button" onClick={() => goToCard(currentIndex - 1)}
                disabled={currentIndex === 0} aria-label="Previous lore card">‹</button>
              <span>{currentIndex + 1} / {cards.length}</span>
              <button type="button" onClick={() => goToCard(currentIndex + 1)}
                disabled={currentIndex === cards.length - 1} aria-label="Next lore card">›</button>
              <span className="lore-pagination__dot" aria-hidden="true">•</span>
              <span className="lore-pagination__name">{card.title}</span>
            </nav>
          </>
        )}
      </section>
    </div>
  );
}

export default Lore;
