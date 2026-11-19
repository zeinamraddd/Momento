import { createContext, useContext } from "react";

// Keep the hook and context outside the provider component module so
// React Fast Refresh can safely update the provider during development.
export const ThemeContext = createContext(null);

export function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useTheme must be used inside ThemeProvider");
  }

  return context;
}
