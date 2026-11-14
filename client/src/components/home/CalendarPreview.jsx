import { useState } from "react";
import "./CalendarPreview.css";

// Use local calendar dates, avoiding UTC timezone shifts.
const formatLocalDate = (date) => [
  date.getFullYear(),
  String(date.getMonth() + 1).padStart(2, "0"),
  String(date.getDate()).padStart(2, "0"),
].join("-");

// Week starts on Monday
const weekdays = [
  "MON", "TUE", "WED", "THU",
  "FRI", "SAT", "SUN"
];

// Temporary sample events from the wireframe
const sampleEvents = [
  {
    id: 1,
    date: "2026-11-14",
    title: "Movie night",
    time: "19:00",
    color: "pink",
  },
  {
    id: 2,
    date: "2026-11-25",
    title: "Maya's birthday",
    time: "",
    color: "blue",
  },
];

function CalendarPreview() {

  // Currently displayed month
  const [currentMonth, setCurrentMonth] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  );

  // Temporary local state; database persistence comes later.
  const [events, setEvents] = useState(sampleEvents);
  const [showEventForm, setShowEventForm] = useState(false);
  const [editingEventId, setEditingEventId] = useState(null);
  const [eventTitle, setEventTitle] = useState("");
  const [eventDate, setEventDate] = useState(() => formatLocalDate(new Date()));
  const [eventTime, setEventTime] = useState("");
  const [eventColor, setEventColor] = useState("pink");

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  // Number of days in this month
  const daysInMonth = new Date(
    year,
    month + 1,
    0
  ).getDate();

  // Monday = 0, Sunday = 6
  const firstDay = (
    new Date(year, month, 1).getDay() + 6
  ) % 7;

  // Total calendar cells
  const totalCells =
    Math.ceil((firstDay + daysInMonth) / 7) * 7;

  // Build calendar cells
  const calendarDays = Array.from(
    { length: totalCells },
    (_, index) => {
      const day = index - firstDay + 1;

      return day >= 1 && day <= daysInMonth
        ? day
        : null;
    }
  );

  // Move between months
  const changeMonth = (direction) => {
    setCurrentMonth(
      new Date(year, month + direction, 1)
    );
  };

  const closeEventForm = () => {
    setShowEventForm(false);
    setEditingEventId(null);
    setEventTitle("");
    setEventTime("");
    setEventColor("pink");
  };

  const startAddingEvent = () => {
    const today = new Date();
    const day = today.getFullYear() === year && today.getMonth() === month
      ? today.getDate()
      : 1;

    setEditingEventId(null);
    setEventTitle("");
    setEventDate(formatLocalDate(new Date(year, month, day)));
    setEventTime("");
    setEventColor("pink");
    setShowEventForm(true);
  };

  const startEditingEvent = (event) => {
    setEditingEventId(event.id);
    setEventTitle(event.title);
    setEventDate(event.date);
    setEventTime(event.time || "");
    setEventColor(event.color || "pink");
    setShowEventForm(true);
  };

  const saveEvent = (submitEvent) => {
    submitEvent.preventDefault();
    const title = eventTitle.trim();
    if (!title || !eventDate) return;

    const updated = {
      title,
      date: eventDate,
      time: eventTime,
      color: eventColor,
    };

    if (editingEventId !== null) {
      setEvents((previousEvents) =>
        previousEvents.map((event) =>
          event.id === editingEventId ? { ...event, ...updated } : event
        )
      );
    } else {
      setEvents((previousEvents) => [
        ...previousEvents,
        { id: crypto.randomUUID(), ...updated },
      ]);
    }

    // Reveal an event even if its date is in another month.
    const [selectedYear, selectedMonth] = eventDate.split("-").map(Number);
    setCurrentMonth(new Date(selectedYear, selectedMonth - 1, 1));
    closeEventForm();
  };

  const deleteEvent = () => {
    if (editingEventId === null) return;
    setEvents((previousEvents) =>
      previousEvents.filter((event) => event.id !== editingEventId)
    );
    closeEventForm();
  };

  // Display month and year
  const monthLabel = currentMonth.toLocaleDateString(
    "en-US",
    {
      month: "long",
      year: "numeric",
    }
  );

  const today = new Date();

  return (
    <section className="momento-calendar">

      {/* Calendar header */}
      <div className="momento-calendar__header">

        <h2>Our calendar</h2>

        <button
          type="button"
          className="momento-calendar__add"
          onClick={startAddingEvent}
        >
          + Add event
        </button>

      </div>

      {/* Month navigation */}
      <div className="momento-calendar__navigation">

        <button
          type="button"
          onClick={() => changeMonth(-1)}
          aria-label="Previous month"
        >
          ‹
        </button>

        <span>{monthLabel}</span>

        <button
          type="button"
          onClick={() => changeMonth(1)}
          aria-label="Next month"
        >
          ›
        </button>

      </div>

      {/* Add/edit event form. Click an event in the grid to edit it. */}
      {showEventForm && (
        <form className="momento-calendar__form" onSubmit={saveEvent}>
          <h3>{editingEventId === null ? "Plan something together ♡" : "Edit event"}</h3>

          <div className="momento-calendar__form-fields">
            <label>
              Event title
              <input
                type="text"
                value={eventTitle}
                onChange={(event) => setEventTitle(event.target.value)}
                placeholder="Movie night, picnic, birthday..."
                maxLength={80}
                required
                autoFocus
              />
            </label>
            <label>
              Date
              <input
                type="date"
                value={eventDate}
                onChange={(event) => setEventDate(event.target.value)}
                required
              />
            </label>
            <label>
              Time (optional)
              <input
                type="time"
                value={eventTime}
                onChange={(event) => setEventTime(event.target.value)}
              />
            </label>
            <label>
              Event color
              <select
                value={eventColor}
                onChange={(event) => setEventColor(event.target.value)}
              >
                <option value="pink">Pink</option>
                <option value="blue">Blue</option>
                <option value="orange">Orange</option>
              </select>
            </label>
          </div>

          <div className="momento-calendar__form-actions">
            <button type="submit">
              {editingEventId === null ? "Add event" : "Save changes"}
            </button>
            <button type="button" onClick={closeEventForm}>Cancel</button>
            {editingEventId !== null && (
              <button type="button" onClick={deleteEvent}>
                Delete event
              </button>
            )}
          </div>
        </form>
      )}

      {/* Calendar grid */}
      <div className="momento-calendar__grid">

        {/* Weekday headings */}
        {weekdays.map((day) => (
          <div
            key={day}
            className="momento-calendar__weekday"
          >
            {day}
          </div>
        ))}

        {/* Calendar days */}
        {calendarDays.map((day, index) => {

          if (day === null) {
            return (
              <div
                key={`empty-${index}`}
                className="momento-calendar__day momento-calendar__day--empty"
              />
            );
          }

          const dateString = [
            year,
            String(month + 1).padStart(2, "0"),
            String(day).padStart(2, "0"),
          ].join("-");

          const dayEvents = events.filter(
            (event) => event.date === dateString
          ).sort((a, b) => (a.time || "").localeCompare(b.time || ""));

          const isToday =
            day === today.getDate() &&
            month === today.getMonth() &&
            year === today.getFullYear();

          return (
            <div
              key={dateString}
              className="momento-calendar__day"
            >

              <span
                className={
                  isToday
                    ? "momento-calendar__today"
                    : ""
                }
              >
                {day}
              </span>

              {dayEvents.map((event) => (
                <button
                  key={event.id}
                  type="button"
                  className={`momento-calendar__event momento-calendar__event--${event.color || "pink"}`}
                  title={`Click to edit ${event.title}`}
                  onClick={() => startEditingEvent(event)}
                >
                  {event.time && (
                    <span className="momento-calendar__event-time">{event.time}</span>
                  )}
                  {event.title}
                </button>
              ))}

            </div>
          );
        })}

      </div>

    </section>
  );
}

export default CalendarPreview;
