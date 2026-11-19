import { useState } from "react";
import { API_BASE_URL as API_URL } from "../utils/apiBaseUrl";
import "./MemberAvatar.css";

const COLORS = new Set(["pink", "blue", "orange", "green", "purple", "yellow", "teal", "coral", "indigo", "sage"]);

function memberInitials(username = "") {
  const parts = username.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return (parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : parts[0].slice(0, 2)).toUpperCase();
}

export default function MemberAvatar({ username = "Member", profilePictureUrl, color = "pink", size = "normal", className = "" }) {
  const [failedImage, setFailedImage] = useState(null);
  const safeColor = COLORS.has(color) ? color : "pink";
  const imageSrc = profilePictureUrl
    ? profilePictureUrl.startsWith("http") ? profilePictureUrl : `${API_URL}${profilePictureUrl}`
    : null;

  return (
    <span
      className={`momento-member-avatar momento-member-avatar--${safeColor} momento-member-avatar--${size} ${className}`}
      title={username}
      aria-label={username}
      role="img"
    >
      {imageSrc && failedImage !== imageSrc ? (
        <img src={imageSrc} alt="" onError={() => setFailedImage(imageSrc)} />
      ) : (
        <span aria-hidden="true">{memberInitials(username)}</span>
      )}
    </span>
  );
}
