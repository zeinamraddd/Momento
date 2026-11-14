import { useState } from "react";
import { useTheme } from "../themes/ThemeContext";
import CalendarPreview from "../components/home/CalendarPreview";
import AlbumPreview from "../components/home/AlbumPreview";

import "./Home.css";

// ==========================================
// TEMPORARY SAMPLE NOTES
// ==========================================

const sampleNotes = [
  {
    id: 1,
    text: "Good luck on your exam! ♡",
    author: "Maya",
  },
  {
    id: 2,
    text: "Beach Saturday?",
    author: "Alex",
  },
  {
    id: 3,
    text: "Who has my charger?",
    author: "Jordan",
  },
];

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

function Home() {

  // Get the currently selected theme
  const { theme } = useTheme();

  // Store bucket-list items
  const [wishes, setWishes] = useState(sampleWishes);
// ==========================================
// STICKY NOTES STATE
// ==========================================

// Stores all notes displayed on the board
const [notes, setNotes] = useState(sampleNotes);

// Controls whether the note form is visible
const [showNoteForm, setShowNoteForm] = useState(false);

// Stores the message being written
const [noteText, setNoteText] = useState("");

// Stores the ID of the note being edited
// null means we are creating a new note
const [editingNoteId, setEditingNoteId] = useState(null);
  // Check or uncheck a bucket-list item
  const toggleWish = (id) => {
    setWishes((previousWishes) =>
      previousWishes.map((wish) =>
        wish.id === id
          ? { ...wish, completed: !wish.completed }
          : wish
      )
    );
  };

    // ==========================================
// ADD OR EDIT A STICKY NOTE
// ==========================================

const saveNote = (event) => {

  // Prevent the page from refreshing
  event.preventDefault();

  // Remove unnecessary spaces
  const text = noteText.trim();

  // Do not allow empty notes
  if (!text) return;

  // If editing an existing note
  if (editingNoteId !== null) {

    setNotes((previousNotes) =>
      previousNotes.map((note) =>
        note.id === editingNoteId
          ? { ...note, text }
          : note
      )
    );

  } else {

    // Create a new note
    const newNote = {
      id: crypto.randomUUID(),
      text: text,
      author: "You",
    };

    // Add the new note to the board
    setNotes((previousNotes) => [
      ...previousNotes,
      newNote
    ]);
  }

  // Reset everything
  setNoteText("");
  setEditingNoteId(null);
  setShowNoteForm(false);
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

const deleteNote = (id) => {

  setNotes((previousNotes) =>
    previousNotes.filter((note) => note.id !== id)
  );

};

  return (
    <div className={`momento-home momento-home--${theme}`}>

      {/* ==================================
          GROUP HEADER
      ================================== */}

      <header className="momento-home__header">

        {/* Group name */}
        <div className="momento-home__title">
          <h1>The usual suspects</h1>
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

            <button type="submit">
              {editingNoteId !== null
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

                <label
                  key={wish.id}
                  className="momento-bucket-list__item"
                >

                  <input
                    type="checkbox"
                    checked={wish.completed}
                    onChange={() => toggleWish(wish.id)}
                  />

                  <span
                    className={
                      wish.completed ? "completed" : ""
                    }
                  >
                    {wish.text}
                  </span>

                </label>

              ))}

            </div>

            {/* Add wish button */}
            <button
              type="button"
              className="momento-bucket-list__add"
              disabled
              title="Adding wishes will be implemented next"
            >
              + Add a wish
            </button>

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
