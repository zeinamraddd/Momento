import { useEffect, useState } from "react";
import { useTheme } from "../themes/ThemeContext";
import CalendarPreview from "../components/home/CalendarPreview";
import AlbumPreview from "../components/home/AlbumPreview";
import MemberAvatar from "../components/MemberAvatar";

import "./Home.css";

// Backend API
const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:3000";


// ==========================================
// HOME COMPONENT
// ==========================================

function Home({space, onSpaceChange}) {

  // Get the currently selected theme
  const { theme } = useTheme();

  // Members use the SAME backend color assignment as calendar events.
  const [memberResult, setMemberResult] = useState({ spaceId: null, members: [], error: "" });
  const [membersOpenFor, setMembersOpenFor] = useState(null);
  const members = memberResult.spaceId === space?.id ? memberResult.members : [];
  const membersError = memberResult.spaceId === space?.id ? memberResult.error : "";
  const membersOpen = membersOpenFor === space?.id;
  const [editingGroupName, setEditingGroupName] = useState(false);
  const [groupName, setGroupName] = useState(space?.name || "");
  const [groupSaving, setGroupSaving] = useState(false);
  const [groupMessage, setGroupMessage] = useState("");

  useEffect(() => {
    if (!space?.id) return;
    const controller = new AbortController();
    fetch(`${API_URL}/api/spaces/${encodeURIComponent(space.id)}/members`, {
      credentials: "include",
      signal: controller.signal,
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "Could not load members");
        return data;
      })
      .then((data) => {
        if (!controller.signal.aborted) setMemberResult({ spaceId: space.id, members: data.members || [], error: "" });
      })
      .catch((error) => {
        if (error.name !== "AbortError" && !controller.signal.aborted) {
          setMemberResult({ spaceId: space.id, members: [], error: error.message });
        }
      });
    return () => controller.abort();
  }, [space?.id]);

  async function renameGroup(event) {
    event.preventDefault();
    const name = groupName.trim();
    setGroupMessage("");
    if (name.length < 2 || name.length > 60) {
      setGroupMessage("Group name must be 2–60 characters.");
      return;
    }
    setGroupSaving(true);
    try {
      const response = await fetch(`${API_URL}/api/spaces/${encodeURIComponent(space.id)}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Could not rename the group");
      onSpaceChange(data.space);
      setGroupName(data.space.name);
      setEditingGroupName(false);
      setGroupMessage("Group name saved!");
    } catch (error) {
      setGroupMessage(error.message);
    } finally {
      setGroupSaving(false);
    }
  }

  // ==========================================
// BUCKET LIST STATE
// ==========================================

    // Wishes retrieved from MongoDB
    const [wishes, setWishes] = useState([]);

    // Loading state
    const [wishesLoading, setWishesLoading] = useState(true);

    // Track which wish is being checked or unchecked
    const [wishTogglingId, setWishTogglingId] = useState(null);

      // Track which wish is being deleted
    const [wishDeletingId, setWishDeletingId] = useState(null);


    // Error messages
    const [wishesError, setWishesError] = useState("");

  // Prevent multiple submissions while saving
  const [wishSaving, setWishSaving] = useState(false);

  // State for creating and editing bucket-list wishes
  const [showWishForm, setShowWishForm] = useState(false);
  const [wishText, setWishText] = useState("");
  const [editingWishId, setEditingWishId] = useState(null);
// ==========================================
// STICKY NOTES STATE
// ==========================================
    // Notes retrieved from MongoDB
    const [notes, setNotes] = useState([]);

    // Loading state
    const [notesLoading, setNotesLoading] = useState(true);

    // Error messages
    const [notesError, setNotesError] = useState("");

    // Prevent multiple submissions
    const [noteSaving, setNoteSaving] = useState(false);

      // Controls whether the note form is visible
      const [showNoteForm, setShowNoteForm] = useState(false);

      // Stores the message being written
      const [noteText, setNoteText] = useState("");

      // Stores the ID of the note being edited
      // null means we are creating a new note
      const [editingNoteId, setEditingNoteId] = useState(null);
        // Check or uncheck a bucket-list item

  // ==========================================
// LOAD STICKY NOTES FROM MONGODB
// ==========================================

useEffect(() => {
  // If no space is selected, display no notes.
  if (!space?.id) {
    setNotes([]);
    setNotesLoading(false);
    return;
  }

  const controller = new AbortController();

  const loadNotes = async () => {
    setNotesLoading(true);
    setNotesError("");
    setNotes([]);

    try {
      // Request notes belonging to the selected space
      const response = await fetch(
        `${API_URL}/api/spaces/${encodeURIComponent(space.id)}/notes`,
        {
          credentials: "include",
          signal: controller.signal,
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Could not load notes");
      }

      // Display notes retrieved from MongoDB
      if (!controller.signal.aborted) {
        setNotes(data.notes || []);
      }

    } catch (error) {
      if (error.name !== "AbortError" && !controller.signal.aborted) {
        setNotesError(error.message || "Could not load notes");
      }

    } finally {
      if (!controller.signal.aborted) {
            setNotesLoading(false);
          }
        }
      };

      loadNotes();

      // Cancel outdated requests when switching spaces
      return () => controller.abort();

    }, [space?.id]);

    // ==========================================
// LOAD BUCKET LIST FROM MONGODB
// ==========================================

useEffect(() => {

  // If no space is selected, display no wishes
  if (!space?.id) {
    setWishes([]);
    setWishesLoading(false);
    return;
  }

  const controller = new AbortController();

  const loadWishes = async () => {

    // Start loading
    setWishesLoading(true);
    setWishesError("");
    setWishes([]);

    try {

      // Request bucket-list items for this space
      const response = await fetch(
        `${API_URL}/api/spaces/${encodeURIComponent(space.id)}/bucket-items`,
        {
          credentials: "include",
          signal: controller.signal,
        }
      );

      const data = await response.json();

      // Handle server errors
      if (!response.ok) {
        throw new Error(
          data.message || "Could not load bucket list"
        );
      }

      // Display MongoDB wishes
      if (!controller.signal.aborted) {
        setWishes(data.items || []);
      }

    } catch (error) {

      if (
        error.name !== "AbortError" &&
        !controller.signal.aborted
      ) {
        console.error("Load bucket list error:", error);

        setWishesError(
                error.message || "Could not load bucket list"
              );
            }

          } finally {

            if (!controller.signal.aborted) {
              setWishesLoading(false);
            }

          }
        };

        loadWishes();

        // Cancel outdated requests when switching spaces
        return () => controller.abort();

      }, [space?.id]);


      // ==========================================
// CHECK OR UNCHECK A WISH IN MONGODB
// ==========================================

const toggleWish = async (id) => {

  // Find the wish being updated
  const wish = wishes.find((item) => item.id === id);

  // Validate the wish and selected space
  if (
    !wish ||
    !space?.id ||
    wishesLoading ||
    wishTogglingId !== null
  ) {
    return;
  }

  // New completion status
  const newCompleted = !wish.completed;

  setWishTogglingId(id);
  setWishesError("");

  try {

    // Send PATCH request to Express
    const response = await fetch(
      `${API_URL}/api/spaces/${encodeURIComponent(space.id)}/bucket-items/${encodeURIComponent(id)}`,
      {
        method: "PATCH",

        credentials: "include",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          completed: newCompleted,
        }),
      }
    );

    const data = await response.json().catch(() => ({}));

    // Handle backend errors
    if (!response.ok) {
      throw new Error(
        data.message || "Could not update wish"
      );
    }

    if (!data.item) {
      throw new Error(
        "Server did not return the updated wish"
      );
    }

    // Update React after MongoDB confirms the change
        setWishes((previousWishes) =>
          previousWishes.map((item) =>
            item.id === id
              ? data.item
              : item
          )
        );

      } catch (error) {

        console.error("Toggle wish error:", error);

        setWishesError(
          error.message || "Could not update wish"
        );

      } finally {

        setWishTogglingId(null);

      }
      };
        

  // Reset the wish form after saving or cancelling
  const closeWishForm = () => {
    setWishText("");
    setEditingWishId(null);
    setShowWishForm(false);
  };

  const startAddingWish = () => {
    setWishText("");
    setEditingWishId(null);
    setShowWishForm(true);
  };

  const startEditingWish = (wish) => {
    setWishText(wish.text);
    setEditingWishId(wish.id);
    setShowWishForm(true);
  };

    // ==========================================
// ADD OR EDIT A BUCKET LIST ITEM IN MONGODB
// ==========================================

  const saveWish = async (event) => {
    event.preventDefault();

    // Remove unnecessary spaces
    const text = wishText.trim();

    // Validate input and selected space
    if (!text || !space?.id || wishSaving || wishesLoading) {
      return;
    }

    // Start saving
    setWishSaving(true);
    setWishesError("");

    // Check if we're creating or editing a wish
    const isEditing = editingWishId !== null;

    // Base API endpoint
    const baseURL =
      `${API_URL}/api/spaces/${encodeURIComponent(space.id)}/bucket-items`;

    // Editing requires the wish ID
    const url = isEditing
      ? `${baseURL}/${encodeURIComponent(editingWishId)}`
      : baseURL;

    try {

      // Send request to Express
      const response = await fetch(url, {
        method: isEditing ? "PATCH" : "POST",

        credentials: "include",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          text,
        }),
      });

      const data = await response.json().catch(() => ({}));

      // Handle backend errors
      if (!response.ok) {
        throw new Error(
          data.message || "Could not save wish"
        );
      }

      if (!data.item) {
        throw new Error(
          "Server did not return the saved wish"
        );
      }

      // ======================================
      // UPDATE REACT STATE
      // ======================================

      if (isEditing) {

        // Replace the edited wish
        setWishes((previousWishes) =>
          previousWishes.map((wish) =>
            wish.id === editingWishId
              ? data.item
              : wish
          )
        );

      } else {

        // Add the newly created wish
        setWishes((previousWishes) => [
          ...previousWishes,
          data.item,
        ]);

      }

      // Close the form after successful saving
      closeWishForm();

    } catch (error) {

      console.error("Save wish error:", error);

      setWishesError(
        error.message || "Could not save wish"
      );

    } finally {

      setWishSaving(false);

    }
  };

  // ==========================================
// DELETE A BUCKET LIST ITEM FROM MONGODB
// ==========================================

const deleteWish = async (id) => {

  // Validate the selected wish and space
  if (
    !space?.id ||
    !id ||
    wishDeletingId !== null ||
    wishTogglingId === id
  ) {
    return;
  }

  // Start deleting
  setWishDeletingId(id);
  setWishesError("");

  try {

    // Send DELETE request to Express
    const response = await fetch(
      `${API_URL}/api/spaces/${encodeURIComponent(space.id)}/bucket-items/${encodeURIComponent(id)}`,
      {
        method: "DELETE",
        credentials: "include",
      }
    );

    const data = await response.json().catch(() => ({}));

    // Handle backend errors
    if (!response.ok) {
      throw new Error(
        data.message || "Could not delete wish"
      );
    }

    // Remove the wish from React after MongoDB confirms deletion
    setWishes((previousWishes) =>
      previousWishes.filter((wish) => wish.id !== id)
    );

    // Close the editing form if this wish was being edited
    if (editingWishId === id) {
      closeWishForm();
    }

  } catch (error) {

    console.error("Delete wish error:", error);

    setWishesError(
      error.message || "Could not delete wish"
    );

  } finally {

    setWishDeletingId(null);

  }
};

  // ==========================================
// ADD OR EDIT A STICKY NOTE IN MONGODB
// ==========================================

const saveNote = async (event) => {
  event.preventDefault();

  // Remove unnecessary spaces
  const text = noteText.trim();

  // Validate input and selected space
  if (!text || !space?.id || noteSaving || notesLoading) {
    return;
  }

  setNoteSaving(true);
  setNotesError("");

  // Determine whether we're creating or editing
  const isEditing = editingNoteId !== null;

  // Base endpoint for this space's notes
  const baseURL =
    `${API_URL}/api/spaces/${encodeURIComponent(space.id)}/notes`;

  // Editing requires the note ID
  const url = isEditing
    ? `${baseURL}/${encodeURIComponent(editingNoteId)}`
    : baseURL;

  try {
    // Send the request to Express
    const response = await fetch(url, {
      method: isEditing ? "PATCH" : "POST",

      credentials: "include",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        text,
      }),
    });

    const data = await response.json().catch(() => ({}));

    // Handle backend errors
    if (!response.ok) {
      throw new Error(
        data.message || "Could not save note"
      );
    }

    if (!data.note) {
      throw new Error("Server did not return the saved note");
    }

    // ======================================
    // UPDATE REACT STATE
    // ======================================

    if (isEditing) {
      // Replace the edited note
      setNotes((previousNotes) =>
        previousNotes.map((note) =>
          note.id === editingNoteId
            ? data.note
            : note
        )
      );

    } else {
      // Add the newly saved note to the board
      setNotes((previousNotes) => [
        data.note,
        ...previousNotes,
      ]);
    }

    // ======================================
    // RESET FORM AFTER SUCCESS
    // ======================================

    setNoteText("");
    setEditingNoteId(null);
    setShowNoteForm(false);

    } catch (error) {
      console.error("Save note error:", error);

      setNotesError(
        error.message || "Could not save note"
      );

    } finally {
      setNoteSaving(false);
    }
  };

// ==========================================
// START EDITING A NOTE
// ==========================================

const editNote = (note) => {

  // Remember which note we are editing
  setEditingNoteId(note.id);

  // Put the existing message into the form
  setNoteText(note.text);

  // Open the form
  setShowNoteForm(true);
};


// ==========================================
// DELETE A NOTE
// ==========================================

// ==========================================
// DELETE A STICKY NOTE FROM MONGODB
// ==========================================

    const deleteNote = async (id) => {

      // Make sure a space and note are selected
      if (!space?.id || !id) return;

      // Clear previous errors
      setNotesError("");

      try {

        // Send DELETE request to Express
        const response = await fetch(
          `${API_URL}/api/spaces/${encodeURIComponent(space.id)}/notes/${encodeURIComponent(id)}`,
          {
            method: "DELETE",
            credentials: "include",
          }
        );

        const data = await response.json().catch(() => ({}));

        // Handle backend errors
        if (!response.ok) {
          throw new Error(data.message || "Could not delete note");
        }

        // Remove the note from React only after MongoDB deletion succeeds
        setNotes((previousNotes) =>
          previousNotes.filter((note) => note.id !== id)
        );

        // Close the editing form if this note was being edited
        if (editingNoteId === id) {
          setEditingNoteId(null);
          setNoteText("");
          setShowNoteForm(false);
        }

      } catch (error) {

        console.error("Delete note error:", error);

        setNotesError(
          error.message || "Could not delete note"
        );

      }
    };

  return (
    <div className={`momento-home momento-home--${theme}`}>

      {/* ==================================
          GROUP HEADER
      ================================== */}

      <header className="momento-home__header">

        {/* Group name */}
        <div className="momento-home__title">
          <div className="momento-home__title-row">
            <h1>{space?.name || "Our scrapbook"}</h1>
            <button
              type="button"
              className="momento-home__rename-button"
              aria-label="Edit group name"
              title="Edit group name"
              onClick={() => { if (!editingGroupName) setGroupName(space?.name || ""); setEditingGroupName((value) => !value); setGroupMessage(""); }}
            >✎</button>
          </div>
          {editingGroupName && (
            <form className="momento-home__rename-form" onSubmit={renameGroup}>
              <label htmlFor="momento-group-name">New group name</label>
              <input id="momento-group-name" maxLength={60} minLength={2} value={groupName} onChange={(event) => setGroupName(event.target.value)} required autoFocus />
              <button disabled={groupSaving} type="submit">{groupSaving ? "Saving…" : "Save"}</button>
              <button disabled={groupSaving} type="button" onClick={() => { setEditingGroupName(false); setGroupName(space.name); setGroupMessage(""); }}>Cancel</button>
            </form>
          )}
          {groupMessage && <small className="momento-home__group-message" role="status">{groupMessage}</small>}
        </div>

        {/* Group member avatars */}
        <div className="momento-home__avatars">
          {members.length > 0 && (
            <button
              type="button"
              className="momento-home__avatar-trigger"
              onClick={() => setMembersOpenFor((previous) => previous === space?.id ? null : space?.id)}
              aria-label={`View ${members.length} group members`}
              aria-expanded={membersOpen}
            >
              {members.map((member) => (
                <MemberAvatar
                  key={member.id}
                  username={member.username}
                  profilePictureUrl={member.profilePictureUrl}
                  color={member.color}
                />
              ))}
            </button>
          )}
          {membersOpen && members.length > 0 && (
            <div className="momento-home__members-popup">
              <h2>Our people ♡</h2>
              {members.map((member) => (
                <div key={member.id} className="momento-home__member-row">
                  <MemberAvatar username={member.username} profilePictureUrl={member.profilePictureUrl} color={member.color} size="small" />
                  <span>{member.username}{member.isOwner ? " · Creator" : ""}</span>
                </div>
              ))}
            </div>
          )}
          {membersError && <small className="momento-home__members-error" role="alert">{membersError}</small>}
        </div>

      </header>


      {/* ==================================
          THE BOARD
      ================================== */}

      <section className="momento-board">

        {/* Board heading */}
        <div className="momento-board__header">

          <h2>THE BOARD</h2>

           <button
            type="button"
            className="momento-board__add-button"
            onClick={() => {
              setEditingNoteId(null);
              setNoteText("");
              setShowNoteForm(true);
            }}
          >
            + Add a note
          </button>

        </div>


        {/* ==================================
            BOARD CONTENT
        ================================== */}
          {/* ==================================
                  ADD / EDIT NOTE FORM
              ================================== */}

      {showNoteForm && (

        <form
          className="momento-note-form"
          onSubmit={saveNote}
        >

          <h3>
            {editingNoteId !== null
              ? "Edit your note"
              : "Leave a little note ♡"}
          </h3>

          <textarea
            value={noteText}
            onChange={(event) =>
              setNoteText(event.target.value)
            }
            placeholder="Write something for your friends..."
            maxLength={240}
            required
            autoFocus
          />

          <div className="momento-note-form__actions">

            <button
              type="submit"
              disabled={noteSaving || notesLoading}
            >
              {noteSaving
                ? "Saving..."
                : editingNoteId !== null
                  ? "Save changes"
                  : "Post note"}
            </button>

            <button
              type="button"
              onClick={() => {
                setShowNoteForm(false);
                setNoteText("");
                setEditingNoteId(null);
              }}
            >
              Cancel
            </button>

          </div>

        </form>

      )}
       <div className="momento-board__content">

          {/* ==================================
              STICKY NOTES
          ================================== */}
                      {/* Loading indicator */}
            {notesLoading && (
              <p role="status">Loading notes...</p>
            )}

            {/* Error message */}
            {notesError && (
              <p role="alert" style={{ color: "#c0392b" }}>
                {notesError}
              </p>
            )}

          <div className="momento-board__notes">

            {notes.map((note, index) => (

              <article
                  key={note.id}
                  className={`momento-sticky-note momento-sticky-note--${index % 3}`}
                >

                {/* Note message */}
                <p>{note.text}</p>

                {/* Note author */}
                <span>- {note.author}</span>

                {/* Note actions */}

              <div className="momento-sticky-note__actions">

                <button
                  type="button"
                  onClick={() => editNote(note)}
                >
                  Edit
                </button>

                <button
                  type="button"
                  onClick={() => deleteNote(note.id)}
                >
                  Delete
                </button>

              </div>

              </article>

            ))}

          </div>


          {/* ==================================
              BUCKET LIST
          ================================== */}

          <div className="momento-bucket-list">

            <h3>Our bucket list</h3>

            {/* Loading indicator */}
              {wishesLoading && (
                <p role="status">Loading bucket list...</p>
              )}

              {/* Error message */}
              {wishesError && (
                <p role="alert" style={{ color: "#c0392b" }}>
                  {wishesError}
                </p>
              )}

              {/* Empty list message */}
              {!wishesLoading && !wishesError && wishes.length === 0 && (
                <p>No wishes yet. Let's make some memories! ♡</p>
              )}

            {/* Bucket list items */}
            <div className="momento-bucket-list__items">

              {wishes.map((wish) => (
                <div className="momento-bucket-list__row" key={wish.id}>
                  <label className="momento-bucket-list__item">
                   
                    <input
                      type="checkbox"
                      checked={wish.completed}
                      onChange={() => toggleWish(wish.id)}
                      disabled={wishesLoading || wishTogglingId !== null}
                    />

                    <span className={wish.completed ? "completed" : ""}>
                      {wish.text}
                    </span>
                  </label>

                  <div className="momento-bucket-list__actions">
                    <button
                      type="button"
                      onClick={() => startEditingWish(wish)}
                      aria-label={`Edit ${wish.text}`}
                      title="Edit wish"
                    >
                      ✎
                    </button>
                   <button
                      type="button"
                      onClick={() => deleteWish(wish.id)}
                      disabled={
                        wishDeletingId !== null ||
                        wishTogglingId === wish.id
                      }
                      aria-label={`Delete ${wish.text}`}
                      title="Delete wish"
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}

            </div>

            {/* Add/edit form or the Add Wish button */}
            {showWishForm ? (
              <form className="momento-bucket-list__form" onSubmit={saveWish}>
                <label htmlFor="momento-wish-text">
                  {editingWishId === null ? "Add a new wish" : "Edit your wish"}
                </label>
                <input
                  id="momento-wish-text"
                  type="text"
                  value={wishText}
                  onChange={(event) => setWishText(event.target.value)}
                  placeholder="What should we do together?"
                  maxLength={120}
                  required
                  autoFocus
                />
                <div className="momento-bucket-list__form-actions">
                 <button
                        type="submit"
                        disabled={wishSaving || wishesLoading}
                      >
                        {wishSaving
                          ? "Saving..."
                          : editingWishId === null
                            ? "Add wish"
                            : "Save changes"}
              </button>
                  <button type="button" onClick={closeWishForm}>
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <button
                type="button"
                className="momento-bucket-list__add"
                onClick={startAddingWish}
              >
                + Add a wish
              </button>
            )}

          </div>

        </div>

      </section>


      {/* ==================================
          CALENDAR AND SHARED ALBUMS
      ================================== */}

      <div className="momento-home__bottom">

        {/* Calendar preview */}
        <CalendarPreview space={space} />

        {/* Shared albums preview */}
        <AlbumPreview space={space} />

      </div>

    </div>
  );
}

export default Home;
