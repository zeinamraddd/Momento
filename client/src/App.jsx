import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

import Login from "./components/Login";
import Register from "./components/Register";
import ProtectedPage from "./components/ProtectedPage";

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


