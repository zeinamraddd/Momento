import { NavLink } from "react-router-dom";

import { useTheme } from "../../themes/ThemeContext";

import "./Sidebar.css";

// Theme-specific logos
import originalLogo from "../../assets/momento/black-cream/momento-logo.png";
import blueLogo from "../../assets/momento/blue-notebook/momento-logo.png";
import greenLogo from "../../assets/momento/green-gingham/momento-logo.png";

// Theme-specific sidebar backgrounds
import originalBackground from "../../assets/momento/black-cream/sidebar-background.png";
import blueBackground from "../../assets/momento/blue-notebook/sidebar-background.png";
import greenBackground from "../../assets/momento/green-gingham/sidebar-background.png";

// Decorations
import silverStar from "../../assets/momento/blue-notebook/decorative-star-silver.png";
import orangeSlice from "../../assets/momento/green-gingham/citrus-slice.png";
import leafSticker from "../../assets/momento/green-gingham/leaf-sticker.png";
import goldStar from "../../assets/momento/shared/decorative-star-gold.png";

// Assets for each theme
const sidebarAssets = {
  original: {
    logo: originalLogo,
    background: originalBackground,
  },

  blue: {
    logo: blueLogo,
    background: blueBackground,
  },

  green: {
    logo: greenLogo,
    background: greenBackground,
  },
};

// Navigation icons
function NavIcon({ type }) {
  if (type === "home") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        aria-hidden="true">
        <path d="M3 10 12 3l9 7" />
        <path d="M5 9v12h14V9" />
        <path d="M9 21v-7h6v7" />
      </svg>
    );
  }

  if (type === "albums") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        aria-hidden="true">
        <rect x="6" y="7" width="15" height="14" rx="2" />
        <path d="M3 17V5a2 2 0 0 1 2-2h12" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true">
      <path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5H4l2-4
        A8.5 8.5 0 1 1 21 11.5Z" />
    </svg>
  );
}

function Sidebar({ onLogout }) {
  // Access the selected theme
  const { theme, changeTheme } = useTheme();

  // Get assets for the selected theme
  const assets = sidebarAssets[theme] || sidebarAssets.original;

  return (
    <aside
      className={`momento-sidebar momento-sidebar--${theme}`}
      style={{
        backgroundImage: `url("${assets.background}")`,
      }}
    >
      {/* Logo */}
      <div className="momento-sidebar__logo">
        <img src={assets.logo} alt="MOMENTO" />
      </div>

      {/* Navigation */}
      <nav className="momento-sidebar__nav" aria-label="Main navigation">

        <NavLink
          to="/dashboard"
          className="momento-sidebar__item momento-sidebar__item--home"
        >
          <NavIcon type="home" />
          <span>HOME</span>
        </NavLink>

        <button
          type="button"
          className="momento-sidebar__item momento-sidebar__item--albums"
          disabled
          title="Albums page coming soon"
        >
          <NavIcon type="albums" />
          <span>ALBUMS</span>
        </button>

        <button
          type="button"
          className="momento-sidebar__item momento-sidebar__item--lore"
          disabled
          title="Lore page coming soon"
        >
          <NavIcon type="lore" />
          <span>LORE </span>
        </button>

      </nav>

      {/* Theme-specific decorations */}
      <div className="momento-sidebar__decorations" aria-hidden="true">

        {theme === "original" && (
          <img
            className="momento-decoration momento-decoration--gold"
            src={goldStar}
            alt=""
          />
        )}

        {theme === "blue" && (
          <>
            <img
              className="momento-decoration momento-decoration--silver-one"
              src={silverStar}
              alt=""
            />

            <img
              className="momento-decoration momento-decoration--silver-two"
              src={silverStar}
              alt=""
            />
          </>
        )}

        {theme === "green" && (
          <>
            <img
              className="momento-decoration momento-decoration--orange"
              src={orangeSlice}
              alt=""
            />

            <img
              className="momento-decoration momento-decoration--leaf"
              src={leafSticker}
              alt=""
            />
          </>
        )}

      </div>

      {/* Bottom controls */}
      <div className="momento-sidebar__bottom">

        <label htmlFor="momento-theme-select">
          CHOOSE YOUR THEME
        </label>

        <select
          id="momento-theme-select"
          value={theme}
          onChange={(event) => changeTheme(event.target.value)}
        >
          <option value="original">Original Scrapbook</option>
          <option value="blue">Blue Notebook</option>
          <option value="green">Green Gingham</option>
        </select>

        <button
          type="button"
          className="momento-sidebar__logout"
          onClick={onLogout}
        >
          Log Out
        </button>

      </div>
    </aside>
  );
}

export default Sidebar;