import MemberAvatar from "./MemberAvatar";

// The members are loaded in ProtectedPage from the currently selected space.
// Use the same profile photos and per-space assigned colors on every page.
export default function GroupAvatars({ members = [], className = "" }) {
  return (
    <div className={className} aria-label="Group members">
      {members.map((member) => (
        <MemberAvatar
          key={member.id}
          username={member.username}
          profilePictureUrl={member.profilePictureUrl}
          color={member.color}
        />
      ))}
    </div>
  );
}
