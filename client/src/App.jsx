import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

import Login from "./components/Login";
import Register from "./components/Register";
import ProtectedPage from "./components/ProtectedPage";
import SpaceSetup from "./components/SpaceSetup";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Redirect home to Login */}
        <Route
          path="/"
          element={<Navigate to="/login" replace />}
        />

        {/* Public pages */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Create or join a shared scrapbook after logging in */}
        <Route path="/spaces" element={<SpaceSetup />} />

        {/* Protected page */}
        <Route
          path="/dashboard"
          element={<ProtectedPage />}
        />

        {/* Redirect unknown routes to Login */}
        <Route
          path="*"
          element={<Navigate to="/login" replace />}
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;


