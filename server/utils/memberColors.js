import { createHash } from "node:crypto";

// ==========================================
// MOMENTO'S 10 MEMBER COLORS
// ==========================================

export const MEMBER_COLORS = [
  "pink",
  "blue",
  "orange",
  "green",
  "purple",
  "yellow",
  "teal",
  "coral",
  "indigo",
  "sage",
];

// ==========================================
// GENERATE A STABLE SHUFFLED PALETTE
// ==========================================

// Each space gets a different random-looking
// order of the 10 colors.
//
// The order is generated from the space ID,
// so it stays consistent after refreshing,
// restarting the server, or logging out.

const getShuffledPalette = (spaceId) => {
  return MEMBER_COLORS
    .map((color) => ({
      color,
      hash: createHash("sha256")
        .update(`${spaceId}:${color}`)
        .digest("hex"),
    }))
    .sort((a, b) => a.hash.localeCompare(b.hash))
    .map((entry) => entry.color);
};

// ==========================================
// GET A MEMBER'S ASSIGNED COLOR
// ==========================================

export const getMemberColor = (space, userId) => {
  const userIdString = String(userId?._id ?? userId);

  // Find the member's position in the space
  const memberIndex = space.members.findIndex(
    (member) =>
      String(member?._id ?? member) === userIdString
  );

  // User is not a member
  if (memberIndex === -1) {
    return null;
  }

  // Generate this space's color order
  const palette = getShuffledPalette(space._id);

  // The first 10 members receive unique colors.
  // After 10 members, colors begin repeating.
  return palette[memberIndex % MEMBER_COLORS.length];
};