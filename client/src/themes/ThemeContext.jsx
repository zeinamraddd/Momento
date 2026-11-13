import {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";

// Create the theme context
const ThemeContext = createContext(null);

// Available themes
const availableThemes = ["original", "blue", "green"];

// Key used to save the theme in the browser
const STORAGE_KEY = "momento-theme";

// Theme Provider
export function ThemeProvider({ children }) {

  // Store the currently selected theme
  const [theme, setTheme] = useState(() => {

    // Check if the user previously selected a theme
    try {
      const savedTheme = localStorage.getItem(STORAGE_KEY);

      // Use the saved theme if it exists and is valid
      if (availableThemes.includes(savedTheme)) {
        return savedTheme;
      }
    } catch (error) {
      console.warn("Could not read saved theme", error);
    }

    // Default theme
    return "original";
  });

  // Save the selected theme whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch (error) {
      console.warn("Could not save theme", error);
    }
  }, [theme]);

  // Function to change the theme
  const changeTheme = (newTheme) => {

    // Make sure the selected theme is valid
    if (availableThemes.includes(newTheme)) {
      setTheme(newTheme);
    }
  };

  return (
    <ThemeContext.Provider
      value={{
        theme,
        changeTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

// Custom hook to access the theme anywhere
export function useTheme() {

  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error(
      "useTheme must be used inside ThemeProvider"
    );
  }

  return context;
}