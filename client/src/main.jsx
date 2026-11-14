import { StrictMode } from "react";

import { createRoot } from "react-dom/client";

// Global CSS
import "./index.css";

// Theme CSS
import "./themes/themes.css";

// Main Application
import App from "./App.jsx";

// Theme Provider
import { ThemeProvider } from "./themes/ThemeContext.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>
);