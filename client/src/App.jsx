
import { useEffect, useState } from "react";
import "./App.css";

function App() {
  const [message, setMessage] = useState("Connecting to backend...");

  useEffect(() => {
    const apiUrl = import.meta.env.VITE_API_URL;

    fetch(`${apiUrl}/api/health`)
      .then((response) => {
        if (!response.ok) {
          throw new Error("Backend request failed");
        }
        return response.json();
      })
      .then((data) => setMessage(data.message))
      .catch(() => setMessage("Could not connect to backend"));
  }, []);

  return (
    <main>
      <h1>Momento</h1>
      <p>Your shared memories, all in one place.</p>
      <h2>{message}</h2>
    </main>
  );
}

export default App;
