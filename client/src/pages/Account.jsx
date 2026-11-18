import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import MemberAvatar from "../components/MemberAvatar";
import "./Account.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, { credentials: "include", ...options });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Something went wrong. Please try again.");
  return data;
}

export default function Account({ user, onUserChange, spaceId }) {
  const [username, setUsername] = useState(user.username || "");
  const [spaces, setSpaces] = useState([]);
  const [spacesLoading, setSpacesLoading] = useState(true);
  const [spacesError, setSpacesError] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [savingPicture, setSavingPicture] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [copyMessage, setCopyMessage] = useState("");
  const [avatarVersion, setAvatarVersion] = useState(0);
  const fileInput = useRef(null);

  useEffect(() => {
    const controller = new AbortController();
    async function loadSpaces() {
      try {
        const result = await apiRequest("/api/spaces", { signal: controller.signal });
        if (!controller.signal.aborted) setSpaces(result.spaces || []);
      } catch (err) {
        if (err.name !== "AbortError" && !controller.signal.aborted) setSpacesError(err.message);
      } finally {
        if (!controller.signal.aborted) setSpacesLoading(false);
      }
    }
    loadSpaces();
    return () => controller.abort();
  }, []);

  async function saveName(event) {
    event.preventDefault();
    setError(""); setMessage("");
    const value = username.trim();
    if (value.length < 2 || value.length > 60) {
      setError("Your display name must be between 2 and 60 characters.");
      return;
    }
    setSavingName(true);
    try {
      const result = await apiRequest("/api/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: value }),
      });
      onUserChange(result.user);
      setUsername(result.user.username);
      setMessage("Your name has been saved!");
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingName(false);
    }
  }

  async function uploadPicture(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setMessage(""); setError("");
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > MAX_AVATAR_BYTES) {
      setError("Choose a JPG, PNG or WebP image smaller than 5 MB.");
      event.target.value = "";
      return;
    }
    setSavingPicture(true);
    try {
      const form = new FormData();
      form.append("avatar", file);
      const result = await apiRequest("/api/account/avatar", { method: "POST", body: form });
      onUserChange(result.user);
      setAvatarVersion(Date.now());
      setMessage("Profile picture updated!");
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingPicture(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function removePicture() {
    setMessage(""); setError("");
    setSavingPicture(true);
    try {
      const result = await apiRequest("/api/account/avatar", { method: "DELETE" });
      onUserChange(result.user);
      setAvatarVersion(Date.now());
      setMessage("Profile picture removed.");
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingPicture(false);
    }
  }

  async function copyCode(code) {
    setCopyMessage("");
    try {
      await navigator.clipboard.writeText(code);
      setCopyMessage("Invitation code copied!");
    } catch {
      setCopyMessage("Copy the code displayed below to share it with a friend.");
    }
  }

  const picture = user.profilePictureUrl
    ? `${user.profilePictureUrl}?v=${avatarVersion}`
    : null;

  return (
    <div className="momento-account">
      <header className="momento-account__heading">
        <span className="momento-account__eyebrow">A LITTLE ABOUT YOU ✦</span>
        <h1>My Account</h1>
        <p>Your corner of the scrapbook. Make it feel like you!</p>
      </header>

      {(error || message) && (
        <p className={`momento-account__feedback ${error ? "momento-account__feedback--error" : ""}`} role={error ? "alert" : "status"}>
          {error || message}
        </p>
      )}

      <div className="momento-account__layout">
        <section className="momento-account__card momento-account__profile" aria-labelledby="account-profile-title">
          <h2 id="account-profile-title">My Profile</h2>
          <div className="momento-account__photo">
            <MemberAvatar username={user.username} profilePictureUrl={picture} color="pink" size="large" />
            <div className="momento-account__photo-actions">
              <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadPicture} id="account-picture" disabled={savingPicture} className="momento-account__file" />
              <label htmlFor="account-picture" className={`momento-account__button ${savingPicture ? "momento-account__button--disabled" : ""}`}>{savingPicture ? "Saving photo…" : "Change picture"}</label>
              {user.profilePictureUrl && <button type="button" className="momento-account__link-button" disabled={savingPicture} onClick={removePicture}>Remove picture</button>}
              <small>JPG, PNG or WebP · max 5 MB</small>
            </div>
          </div>

          <form onSubmit={saveName} className="momento-account__form">
            <label htmlFor="account-name">Display name</label>
            <input id="account-name" value={username} onChange={(event) => setUsername(event.target.value)} maxLength={60} required />
            <label htmlFor="account-email">Email address</label>
            <input id="account-email" value={user.email || ""} readOnly />
            {user.createdAt && <p className="momento-account__member-since">Member since {new Date(user.createdAt).toLocaleDateString(undefined, { month: "long", year: "numeric" })}</p>}
            <button className="momento-account__button" type="submit" disabled={savingName || username.trim() === user.username}>{savingName ? "Saving…" : "Save changes"}</button>
          </form>
        </section>

        <section className="momento-account__card momento-account__spaces" aria-labelledby="account-spaces-title">
          <h2 id="account-spaces-title">My Spaces</h2>
          <p>Every scrapbook you're part of, all in one place.</p>
          {spacesLoading && <p>Gathering your spaces…</p>}
          {spacesError && <p role="alert">{spacesError}</p>}
          {!spacesLoading && !spacesError && spaces.length === 0 && <p>No shared spaces yet. <Link to="/spaces">Create one with your friends!</Link></p>}
          <div className="momento-account__space-list">
            {spaces.map((space) => (
              <article key={space.id} className="momento-account__space">
                <div className="momento-account__space-heading">
                  <h3>{space.name}</h3>
                  <span>{space.memberCount} {space.memberCount === 1 ? "member" : "members"}</span>
                </div>
                <label htmlFor={`invite-${space.id}`}>Invitation code</label>
                <div className="momento-account__invite">
                  <input id={`invite-${space.id}`} readOnly value={space.inviteCode} onFocus={(event) => event.target.select()} />
                  <button type="button" onClick={() => copyCode(space.inviteCode)}>Copy</button>
                </div>
                <Link className="momento-account__space-link" to={`/dashboard?space=${encodeURIComponent(space.id)}`}>Open scrapbook →</Link>
              </article>
            ))}
          </div>
          {copyMessage && <p className="momento-account__copy-status" role="status">{copyMessage}</p>}
          <Link className="momento-account__all-spaces" to="/spaces">Go to all my spaces →</Link>
        </section>
      </div>
      {spaceId && <Link className="momento-account__back" to={`/dashboard?space=${encodeURIComponent(spaceId)}`}>← Back to our scrapbook</Link>}
    </div>
  );
}
