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
            disabled
            title="Adding notes will be implemented next"
          >
            + Add a note
          </button>

        </div>


        {/* ==================================
            BOARD CONTENT
        ================================== */}

        <div className="momento-board__content">

          {/* ==================================
              STICKY NOTES
          ================================== */}

          <div className="momento-board__notes">

            {sampleNotes.map((note, index) => (

              <article
                key={note.id}
                className={`momento-sticky-note momento-sticky-note--${index}`}
              >

                {/* Note message */}
                <p>{note.text}</p>

                {/* Note author */}
                <span>- {note.author}</span>

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