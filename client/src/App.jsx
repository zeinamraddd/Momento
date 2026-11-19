
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { lazy, Suspense } from "react";

// Load only the page the user visits, instead of downloading every page at login.
const Login = lazy(() => import("./components/Login"));
const Register = lazy(() => import("./components/Register"));
const ForgotPassword = lazy(() => import("./components/ForgotPassword"));
const ResetPassword = lazy(() => import("./components/ResetPassword"));

const SpaceSetup = lazy(() => import("./components/SpaceSetup"));

const ProtectedPage = lazy(() => import("./components/ProtectedPage"));

function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<p role="status">Opening MOMENTO...</p>}>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />

          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          <Route path="/spaces" element={<SpaceSetup />} />

          <Route path="/dashboard" element={<ProtectedPage />} />
          <Route path="/account" element={<ProtectedPage />} />
          <Route path="/lore" element={<ProtectedPage />} />
          <Route path="/albums" element={<ProtectedPage />} />
          <Route path="/albums/:albumId/photos/:photoId/edit" element={<ProtectedPage />} />

          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
