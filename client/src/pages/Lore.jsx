
import { useEffect, useState } from "react";
import "./Lore.css";

function Lore({ space, user }) {
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
  const [expandedCards, setExpandedCards] = useState({});

  const baseURL = `${API_URL}/api/spaces/${encodeURIComponent(spaceId || "")}/lore`;

  // Load Lore Cards
  useEffect(() => {
    if (!spaceId) return;

    const controller = new AbortController();

    const loadCards = async () => {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(baseURL, {
          credentials: "include",
          signal: controller.signal,
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || "Could not load Lore Cards");
        }

        setCards(data.cards || []);
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

  return (
    <div className="lore-page">
      <header className="lore-header">
        <div>
          <p className="lore-eyebrow">OUR SHARED MEMORIES</p>
          <h1>Our Lore ♡</h1>
          <p>Little stories that became legendary.</p>
        </div>

        <button
          className="lore-primary-button"
          onClick={() => {
            closeForm();
            setShowForm(true);
          }}
        >
          + Create Lore Card
        </button>
      </header>

      {error && <p className="lore-error" role="alert">{error}</p>}

      {showForm && (
        <form className="lore-form" onSubmit={saveCard}>
          <h2>{editingId ? "Edit Lore Card" : "Create a Lore Card"}</h2>

          <label>Title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="The legendary day..."
            maxLength={100}
            required
          />

          <label>Famous quote</label>
          <textarea
            value={quote}
            onChange={(e) => setQuote(e.target.value)}
            placeholder="What was said?"
            maxLength={240}
            required
          />

          <label>What happened?</label>
          <textarea
            value={context}
            onChange={(e) => setContext(e.target.value)}
            placeholder="Tell the whole story..."
            maxLength={5000}
            required
          />

          <div className="lore-form-actions">
            <button type="submit" disabled={saving}>
              {saving ? "Saving..." : editingId ? "Save Changes" : "Create Card"}
            </button>
            <button type="button" onClick={closeForm}>Cancel</button>
          </div>
        </form>
      )}

      {loading ? (
        <p>Loading your memories...</p>
      ) : cards.length === 0 ? (
        <div className="lore-empty">
          <h2>No Lore Cards yet ♡</h2>
          <p>Every legendary memory starts somewhere.</p>
        </div>
      ) : (
        <div className="lore-grid">
          {cards.map((card) => (
            <article className="lore-card" key={card.id}>
              <div className="lore-card-header">
                <span>✦ OUR LORE</span>
                <span>{card.creatorName}</span>
              </div>

              <h2>{card.title}</h2>
              <blockquote>"{card.quote}"</blockquote>
              <p className="lore-context">{card.context}</p>

              <div className="lore-card-actions">
                <button onClick={() => toggleReaction(card.id)}>
                  {card.hasReacted ? "♥" : "♡"} Still funny ({card.reactionCount})
                </button>

                <button
                  onClick={() =>
                    setExpandedCards((previous) => ({
                      ...previous,
                      [card.id]: !previous[card.id],
                    }))
                  }
                >
                  {expandedCards[card.id] ? "Hide stories" : `Alternative stories (${card.versions.length})`}
                </button>

                {card.createdBy === userId && (
                  <>
                    <button onClick={() => editCard(card)}>Edit</button>
                    <button onClick={() => deleteCard(card.id)}>Delete</button>
                  </>
                )}
              </div>

              {expandedCards[card.id] && (
                <div className="lore-versions">
                  <h3>Alternative stories</h3>

                  {card.versions.map((version) => (
                    <div className="lore-version" key={version.id}>
                      <p>{version.contributorName}</p>

                      {editingVersions[version.id] !== undefined ? (
                        <>
                          <textarea
                            value={editingVersions[version.id]}
                            onChange={(e) =>
                              setEditingVersions((previous) => ({
                                ...previous,
                                [version.id]: e.target.value,
                              }))
                            }
                          />
                          <button onClick={() => saveVersion(card.id, version.id)}>
                            Save
                          </button>
                          <button
                            onClick={() =>
                              setEditingVersions((previous) => {
                                const updated = { ...previous };
                                delete updated[version.id];
                                return updated;
                              })
                            }
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <p>{version.content}</p>

                          {version.userId === userId && (
                            <>
                              <button
                                onClick={() =>
                                  setEditingVersions((previous) => ({
                                    ...previous,
                                    [version.id]: version.content,
                                  }))
                                }
                              >
                                Edit
                              </button>
                              <button onClick={() => deleteVersion(card.id, version.id)}>
                                Delete
                              </button>
                            </>
                          )}
                        </>
                      )}
                    </div>
                  ))}

                  <div className="lore-add-version">
                    <textarea
                      value={versionTexts[card.id] || ""}
                      onChange={(e) =>
                        setVersionTexts((previous) => ({
                          ...previous,
                          [card.id]: e.target.value,
                        }))
                      }
                      placeholder="Add your version of the story..."
                      maxLength={5000}
                    />

                    <button onClick={() => addVersion(card.id)}>
                      + Add alternative
                    </button>
                  </div>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

export default Lore;
