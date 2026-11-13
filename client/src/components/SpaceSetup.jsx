import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import logo from "../assets/space-logo.png";
import "./SpaceSetup.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    credentials: "include",
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.message || "Something went wrong. Please try again.");
    error.status = response.status;
    throw error;
  }
  return data;
}

function Sticker({ name, className = "" }) {
  return <span aria-hidden="true" className={`space-sticker space-sticker--${name} ${className}`} />;
}

function SpaceSetup() {
  const navigate = useNavigate();
  const [pageLoading, setPageLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [spaces, setSpaces] = useState([]);
  const [mode, setMode] = useState(null);
  const [spaceName, setSpaceName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [createdOrJoined, setCreatedOrJoined] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [copyStatus, setCopyStatus] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      try {
        const auth = await fetch(`${API_URL}/api/auth/me`, {
          credentials: "include",
          signal: controller.signal,
        });
        if (auth.status === 401) {
          navigate("/login", { replace: true });
          return;
        }
        if (!auth.ok) throw new Error("Could not verify your login");

        const result = await fetch(`${API_URL}/api/spaces`, {
          credentials: "include",
          signal: controller.signal,
        });
        if (result.status === 401) {
          navigate("/login", { replace: true });
          return;
        }
        if (!result.ok) throw new Error("Could not load your spaces");
        const data = await result.json();
        if (!controller.signal.aborted) setSpaces(data.spaces || []);
      } catch (err) {
        if (err.name !== "AbortError" && !controller.signal.aborted) {
          setPageError(err.message || "Could not connect to the server");
        }
      } finally {
        if (!controller.signal.aborted) setPageLoading(false);
      }
    };
    load();
    return () => controller.abort();
  }, [navigate]);

  useEffect(() => {
    if (!mode) return undefined;
    const dismissOnEscape = (event) => {
      if (event.key === "Escape" && !busy) {
        setMode(null);
        setCreatedOrJoined(null);
        setError("");
      }
    };
    document.addEventListener("keydown", dismissOnEscape);
    return () => document.removeEventListener("keydown", dismissOnEscape);
  }, [mode, busy]);

  function openDialog(nextMode) {
    setMode(nextMode);
    setSpaceName("");
    setInviteCode("");
    setError("");
    setCopyStatus("");
    setCreatedOrJoined(null);
  }

  function closeDialog() {
    if (busy) return;
    setMode(null);
    setCreatedOrJoined(null);
    setError("");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setBusy(true);

    try {
      const creating = mode === "create";
      const result = await apiRequest(creating ? "/api/spaces" : "/api/spaces/join", {
        method: "POST",
        body: JSON.stringify(creating ? { name: spaceName.trim() } : { inviteCode }),
      });
      setCreatedOrJoined(result.space);
      setSpaces((previous) => [result.space, ...previous.filter((s) => s.id !== result.space.id)]);
    } catch (err) {
      if (err.status === 401) {
        navigate("/login", { replace: true });
      } else {
        setError(err.message);
      }
    } finally {
      setBusy(false);
    }
  }

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(createdOrJoined.inviteCode);
      setCopyStatus("Copied!");
    } catch {
      setCopyStatus("Select and copy the code above to share it.");
    }
  }

  function enterSpace(space) {
    navigate(`/dashboard?space=${encodeURIComponent(space.id)}`);
  }

  if (pageLoading) {
    return <main className="space-setup space-setup--loading"><p>Opening your scrapbook...</p></main>;
  }

  return (
    <main className="space-setup">
      <div className="space-setup__inner">
        <Sticker name="blue-tape" className="space-deco space-deco--top-left" />
        <Sticker name="pink-tape" className="space-deco space-deco--top-right" />
        <Sticker name="star" className="space-deco space-deco--left-star" />
        <Sticker name="star" className="space-deco space-deco--right-star" />

        <header className="space-setup__heading">
          <img className="space-setup__logo" src={logo} alt="Momento" />
          <h1>A shared space, a shared story.</h1>
          <p>Start a new scrapbook or join your friends.</p>
        </header>

        {pageError && <p className="space-page-error" role="alert">{pageError} — please refresh to try again.</p>}

        <div className="space-options">
          <section className="space-choice space-choice--create">
            <Sticker name="pink-tape" className="space-choice__tape space-choice__tape--create" />
            <Sticker name="star" className="space-choice__star space-choice__star--create" />
            <div className="space-choice__icon" aria-hidden="true">+</div>
            <h2>Create a New Space</h2>
            <p>Name your scrapbook and invite friends.</p>
            <button type="button" onClick={() => openDialog("create")}>Create Space</button>
          </section>

          <section className="space-choice space-choice--join">
            <Sticker name="blue-tape" className="space-choice__tape space-choice__tape--join" />
            <Sticker name="star" className="space-choice__star space-choice__star--join" />
            <div className="space-choice__icon" aria-hidden="true">↗</div>
            <h2>Join a Space</h2>
            <p>Enter the code your friend shared.</p>
            <button type="button" onClick={() => openDialog("join")}>Join with Code</button>
          </section>
        </div>

        <p className="space-setup__footnote">Pick your scrapbook theme after you enter your space!</p>

        {spaces.length > 0 && (
          <section className="space-existing" aria-label="Your existing spaces">
            <h2>Already part of a scrapbook?</h2>
            <div className="space-existing__list">
              {spaces.map((space) => (
                <button key={space.id} type="button" onClick={() => enterSpace(space)}>
                  <span>{space.name}</span><small>Open space ↗</small>
                </button>
              ))}
            </div>
          </section>
        )}
      </div>

      {mode && (
        <div className="space-modal__backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget) closeDialog();
        }}>
          <section
            className={`space-modal space-modal--${mode}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="space-modal-title"
          >
            <button className="space-modal__close" type="button" onClick={closeDialog} disabled={busy} aria-label="Close dialog">×</button>

            {createdOrJoined ? (
              <div className="space-modal__success">
                <span className="space-modal__success-icon" aria-hidden="true">✦</span>
                <h2 id="space-modal-title">{mode === "create" ? "Your space is ready!" : "You're in!"}</h2>
                <p>Welcome to <strong>{createdOrJoined.name}</strong>.</p>
                {mode === "create" && (
                  <div className="space-modal__invite">
                    <label htmlFor="new-invite-code">Share this code with your friends</label>
                    <input id="new-invite-code" readOnly value={createdOrJoined.inviteCode} onFocus={(e) => e.target.select()} />
                    <button type="button" className="space-modal__copy" onClick={copyCode}>Copy Invitation Code</button>
                    {copyStatus && <small role="status">{copyStatus}</small>}
                  </div>
                )}
                <button type="button" className="space-modal__submit" onClick={() => enterSpace(createdOrJoined)}>
                  Enter My Space →
                </button>
              </div>
            ) : (
              <>
                <h2 id="space-modal-title">{mode === "create" ? "Name your scrapbook" : "Join your friends"}</h2>
                <p>{mode === "create" ? "Every great memory starts somewhere." : "Your friends saved you a spot!"}</p>
                <form onSubmit={handleSubmit}>
                  {mode === "create" ? (
                    <>
                      <label htmlFor="space-name">Space name</label>
                      <input
                        id="space-name"
                        autoFocus
                        required
                        minLength={2}
                        maxLength={60}
                        placeholder="The Usual Suspects"
                        value={spaceName}
                        onChange={(event) => setSpaceName(event.target.value)}
                      />
                    </>
                  ) : (
                    <>
                      <label htmlFor="space-code">Invitation code</label>
                      <input
                        id="space-code"
                        autoFocus
                        required
                        maxLength={20}
                        autoCapitalize="characters"
                        autoComplete="off"
                        spellCheck="false"
                        placeholder="12-character code"
                        value={inviteCode}
                        onChange={(event) => setInviteCode(event.target.value.toUpperCase())}
                      />
                    </>
                  )}
                  {error && <p className="space-modal__error" role="alert">{error}</p>}
                  <button className="space-modal__submit" type="submit" disabled={busy}>
                    {busy ? "One moment..." : mode === "create" ? "Create My Space" : "Join This Space"}
                  </button>
                </form>
              </>
            )}
          </section>
        </div>
      )}
    </main>
  );
}

export default SpaceSetup;
