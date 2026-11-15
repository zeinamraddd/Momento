import { useEffect, useState } from "react";
import "./CalendarPreview.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

// Keep calendar dates in local YYYY-MM-DD format to avoid timezone shifts.
const formatLocalDate = (date) =>
  [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");

const weekdays = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

function CalendarPreview({ space }) {
  const [currentMonth, setCurrentMonth] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  );

  // Events are retrieved from MongoDB for the selected shared space.
  const [events, setEvents] = useState([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [eventsError, setEventsError] = useState("");
  const [eventSaving, setEventSaving] = useState(false);
  const [eventDeleting, setEventDeleting] = useState(false);

  // Add/edit event form state.
  const [showEventForm, setShowEventForm] = useState(false);
  const [editingEventId, setEditingEventId] = useState(null);
  const [eventTitle, setEventTitle] = useState("");
  const [eventDate, setEventDate] = useState(() => formatLocalDate(new Date()));
  const [eventTime, setEventTime] = useState("");

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  // Reload events when the selected scrapbook changes.
  useEffect(() => {
    if (!space?.id) {
      setEvents([]);
      setEventsError("");
      setEventsLoading(false);
      return;
    }
    const controller = new AbortController();

    const loadEvents = async () => {
      setEventsLoading(true);
      setEventsError("");
      setEvents([]);

      try {
        const response = await fetch(
          `${API_URL}/api/spaces/${encodeURIComponent(space.id)}/events`,
          {
            credentials: "include",
            signal: controller.signal,
          }
        );

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data.message || "Could not load events");
        }

        if (!controller.signal.aborted) {
          setEvents(Array.isArray(data.events) ? data.events : []);
        }
      } catch (error) {
        if (error.name !== "AbortError" && !controller.signal.aborted) {
          console.error("Load events error:", error);
          setEventsError(error.message || "Could not load events");
        }
      } finally {
        if (!controller.signal.aborted) {
          setEventsLoading(false);
        }
      }
    };
    loadEvents();
    return () => controller.abort();
  }, [space?.id]);

  // Build the calendar grid, starting weeks on Monday.
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = (new Date(year, month, 1).getDay() + 6) % 7;
  const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7;
  const calendarDays = Array.from({ length: totalCells }, (_, index) => {
    const day = index - firstDay + 1;
    return day >= 1 && day <= daysInMonth ? day : null;
  });

  const changeMonth = (direction) => {
    setCurrentMonth(new Date(year, month + direction, 1));
  };

  const closeEventForm = () => {
    setShowEventForm(false);
    setEditingEventId(null);
    setEventTitle("");
    setEventTime("");
  };

  const startAddingEvent = () => {
    const today = new Date();
    const day =
      today.getFullYear() === year && today.getMonth() === month
        ? today.getDate()
        : 1;

    setEditingEventId(null);
    setEventTitle("");
    setEventDate(formatLocalDate(new Date(year, month, day)));
    setEventTime("");
    setShowEventForm(true);
  };

  const startEditingEvent = (event) => {
    setEditingEventId(event.id);
    setEventTitle(event.title);
    setEventDate(event.date);
    setEventTime(event.time || "");
    setShowEventForm(true);
  };

  // Save an event in MongoDB. The backend assigns the creator's color.
  const saveEvent = async (submitEvent) => {
    submitEvent.preventDefault();
    const title = eventTitle.trim();

    if (!title || !eventDate || !space?.id || eventSaving || eventsLoading) {
      return;
    }

    setEventSaving(true);
    setEventsError("");

    const isEditing = editingEventId !== null;
    const baseURL = `${API_URL}/api/spaces/${encodeURIComponent(space.id)}/events`;
    const url = isEditing
      ? `${baseURL}/${encodeURIComponent(editingEventId)}`
      : baseURL;

    try {
      const response = await fetch(url, {
        method: isEditing ? "PATCH" : "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          date: eventDate,
          time: eventTime,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.message || "Could not save event");
      }
      if (!data.event) {
        throw new Error("Server did not return the saved event");
      }

      if (isEditing) {
        setEvents((previousEvents) =>
          previousEvents.map((event) =>
            event.id === editingEventId ? data.event : event
          )
        );
      } else {
        setEvents((previousEvents) => [...previousEvents, data.event]);
      }
      // Show the saved event's month, even if its date changed.
      const [selectedYear, selectedMonth] = data.event.date
        .split("-")
        .map(Number);
      setCurrentMonth(new Date(selectedYear, selectedMonth - 1, 1));
      closeEventForm();
    } catch (error) {
      console.error("Save event error:", error);
      setEventsError(error.message || "Could not save event");
    } finally {
      setEventSaving(false);
    }
  };

  // Permanently delete the selected event from MongoDB.
  const deleteEvent = async () => {
    if (
      editingEventId === null ||
      !space?.id ||
      eventDeleting ||
      eventSaving
    ) {
      return;
    }

    const eventId = editingEventId;
    setEventDeleting(true);
    setEventsError("");

    try {
      const response = await fetch(
        `${API_URL}/api/spaces/${encodeURIComponent(space.id)}/events/${encodeURIComponent(eventId)}`,
        {
          method: "DELETE",
          credentials: "include",
        }
      );

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.message || "Could not delete event");
      }

      setEvents((previousEvents) =>
        previousEvents.filter((event) => event.id !== eventId)
      );
      closeEventForm();
    } catch (error) {
      console.error("Delete event error:", error);
      setEventsError(error.message || "Could not delete event");
    } finally {
      setEventDeleting(false);
    }
  };
  const monthLabel = currentMonth.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
  const today = new Date();

  return (
    <section className="momento-calendar">
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

      {eventsLoading && <p role="status">Loading calendar events...</p>}
      {eventsError && (
        <p role="alert" style={{ color: "#c0392b" }}>
          {eventsError}
        </p>
      )}

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

      {showEventForm && (
        <form className="momento-calendar__form" onSubmit={saveEvent}>
          <h3>
            {editingEventId === null
              ? "Plan something together ♡"
              : "Edit event"}
          </h3>

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
          </div>

          <div className="momento-calendar__form-actions">
            <button type="submit" disabled={eventSaving || eventsLoading}>
              {eventSaving
                ? "Saving..."
                : editingEventId === null
                  ? "Add event"
                  : "Save changes"}
            </button>

            <button
              type="button"
              onClick={closeEventForm}
              disabled={eventSaving || eventDeleting}
            >
              Cancel
            </button>

            {editingEventId !== null && (
              <button
                type="button"
                onClick={deleteEvent}
                disabled={eventDeleting || eventSaving}
              >
                {eventDeleting ? "Deleting..." : "Delete event"}
              </button>
            )}
          </div>
        </form>
      )}

  <div className="momento-calendar__grid">
        {weekdays.map((day) => (
          <div key={day} className="momento-calendar__weekday">
            {day}
          </div>
        ))}

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

          const dayEvents = events
            .filter((event) => event.date === dateString)
            .sort((a, b) => (a.time || "").localeCompare(b.time || ""));

          const isToday =
            day === today.getDate() &&
            month === today.getMonth() &&
            year === today.getFullYear();

          return (
            <div key={dateString} className="momento-calendar__day">
              <span className={isToday ? "momento-calendar__today" : ""}>
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
                    <span className="momento-calendar__event-time">
                      {event.time}
                    </span>
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