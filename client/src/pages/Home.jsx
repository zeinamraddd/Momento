import { useEffect, useState } from "react";
import { useTheme } from "../themes/ThemeContext";
import CalendarPreview from "../components/home/CalendarPreview";
import AlbumPreview from "../components/home/AlbumPreview";

import "./Home.css";

// Backend API
const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:3000";

// ==========================================
// TEMPORARY BUCKET LIST
// ==========================================

const sampleWishes = [
  {
    id: 1,
    text: "Watch the sunrise",
    completed: false,
  },
  {
    id: 2,
    text: "Go camping",
    completed: false,
  },
  {
    id: 3,
    text: "Take a road trip",
    completed: false,
  },
];

// ==========================================
// HOME COMPONENT
// ==========================================

function Home({space}) {

  // Get the currently selected theme
  const { theme } = useTheme();

  // Store bucket-list items
  const [wishes, setWishes] = useState(sampleWishes);

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



  const toggleWish = (id) => {
    setWishes((previousWishes) =>
      previousWishes.map((wish) =>
        wish.id === id
          ? { ...wish, completed: !wish.completed }
          : wish
      )
    );
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

  const saveWish = (event) => {
    event.preventDefault();

    const text = wishText.trim();
    if (!text) return;

    if (editingWishId !== null) {
      setWishes((previousWishes) =>
        previousWishes.map((wish) =>
          wish.id === editingWishId ? { ...wish, text } : wish
        )
      );
    } else {
      setWishes((previousWishes) => [
        ...previousWishes,
        { id: crypto.randomUUID(), text, completed: false },
      ]);
    }

    closeWishForm();
  };

  const deleteWish = (id) => {
    setWishes((previousWishes) =>
      previousWishes.filter((wish) => wish.id !== id)
    );

    if (editingWishId === id) closeWishForm();
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
          <h1>{space?.name || "Our scrapbook"}</h1>
        </div>

        {/* Group member avatars */}
        <div className="momento-home__avatars">

          <div className="momento-avatar momento-avatar--pink">
            M
          </div>

          <div className="momento-avatar momento-avatar--blue">
            A
          </div>

          <div className="momento-avatar momento-avatar--orange">
            J
          </div>

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

            {/* Bucket list items */}
            <div className="momento-bucket-list__items">

              {wishes.map((wish) => (
                <div className="momento-bucket-list__row" key={wish.id}>
                  <label className="momento-bucket-list__item">
                    <input
                      type="checkbox"
                      checked={wish.completed}
                      onChange={() => toggleWish(wish.id)}
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
                  <button type="submit">
                    {editingWishId === null ? "Add wish" : "Save changes"}
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
        <CalendarPreview />

        {/* Shared albums preview */}
        <AlbumPreview />

      </div>

    </div>
  );
}

export default Home;
