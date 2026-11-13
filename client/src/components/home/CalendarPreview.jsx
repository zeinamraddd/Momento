import { useState } from "react";

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
  },
  {
    id: 2,
    date: "2026-11-25",
    title: "Maya's birthday",
  },
];

function CalendarPreview() {

  // Currently displayed month
  const [currentMonth, setCurrentMonth] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  );

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
          disabled
          className="momento-calendar__add"
          title="Adding events will be implemented later"
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

          const dayEvents = sampleEvents.filter(
            (event) => event.date === dateString
          );

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
                <span
                  key={event.id}
                  className="momento-calendar__event"
                  title={event.title}
                >
                  {event.title}
                </span>
              ))}

            </div>
          );
        })}

      </div>

    </section>
  );
}

export default CalendarPreview;