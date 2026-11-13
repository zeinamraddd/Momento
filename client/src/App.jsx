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


// Previous backend connection test
// Kept for reference

// import { useEffect, useState } from "react";
// import "./App.css";

// function App() {
//   const [message, setMessage] = useState("Connecting to backend...");

//   useEffect(() => {
//     const apiUrl = import.meta.env.VITE_API_URL;

//     fetch(`${apiUrl}/api/health`)
//       .then((response) => {
//         if (!response.ok) {
//           throw new Error("Backend request failed");
//         }
//         return response.json();
//       })
//       .then((data) => setMessage(data.message))
//       .catch(() => setMessage("Could not connect to backend"));
//   }, []);

//   return (
//     <main>
//       <h1>Momento</h1>
//       <p>Your shared memories, all in one place.</p>
//       <h2>{message}</h2>
//     </main>
//   );
// }

// export default App;

