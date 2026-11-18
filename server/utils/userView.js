// The API never returns password hashes or raw GridFS identifiers.
export function userView(user) {
  return {
    id: String(user._id),
    username: user.username,
    email: user.email,
    createdAt: user.createdAt || null,
    profilePictureUrl: user.avatarFileId
      ? `/api/account/avatar/${user._id}`
      : null,
  };
}
