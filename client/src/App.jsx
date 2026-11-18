import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

// Authentication pages
import Login from "./components/Login";
import Register from "./components/Register";

// Shared Spaces page
import SpaceSetup from "./components/SpaceSetup";

// Main dashboard
import ProtectedPage from "./components/ProtectedPage";

function App() {
  return (
    <BrowserRouter>
      <Routes>

        {/* ==================================
            DEFAULT ROUTE
        ================================== */}

        <Route
          path="/"
          element={<Navigate to="/login" replace />}
        />

        {/* ==================================
            AUTHENTICATION
        ================================== */}

        <Route
          path="/login"
          element={<Login />}
        />

        <Route
          path="/register"
          element={<Register />}
        />

        {/* ==================================
            SHARED SPACES
        ================================== */}

        <Route
          path="/spaces"
          element={<SpaceSetup />}
        />

        {/* ==================================
            MAIN DASHBOARD
        ================================== */}

        <Route
          path="/dashboard"
          element={<ProtectedPage />}
        />
        <Route
           path="/lore"
           element={<ProtectedPage />}
        />
        {/* ==================================
            UNKNOWN ROUTES
        ================================== */}

        <Route
          path="*"
          element={<Navigate to="/login" replace />}
        />

      </Routes>
    </BrowserRouter>
  );
}

export default App;

