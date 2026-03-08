import { useState } from "react";
import PopupSpring from "./PopupSpring.jsx";

const GChatSidebarMenu = ({
  sid, s, showArchivedChats,
  gchatSpaceTimes, setGchatSpaceTimes, setUnreadGchatSpaces,
  setArchivedGchatSpaces,
  mutedGchatSpaces, setMutedGchatSpaces,
  setTrashedGchatSpaces,
  gchatSelectedSpace, setGchatSelectedSpace,
  setChatToDelete, // 👈 ADD THIS
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuItem = (label, color, handler) => (
    <div
      style={{ padding: "8px 16px", color, cursor: "pointer", fontSize: "13px" }}
      onMouseEnter={e => e.currentTarget.style.background = "#f1f3f4"}
      onMouseLeave={e => e.currentTarget.style.background = "transparent"}
      onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); handler(); setIsOpen(false); }}
    >{label}</div>
  );
  return (
    <div className="gchat-menu-wrap" style={{ position: "relative", display: "flex", alignItems: "center" }} onClickCapture={(e) => e.stopPropagation()}>
      <div
        onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setIsOpen(prev => !prev); }}
        onClick={(e) => e.stopPropagation()}
        style={{ width: "24px", height: "24px", display: "grid", placeItems: "center", borderRadius: "50%", color: "#5f6368", cursor: "pointer" }}
        onMouseEnter={e => e.currentTarget.style.background = "rgba(0,0,0,0.05)"}
        onMouseLeave={e => e.currentTarget.style.background = "transparent"}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>
      </div>
      {isOpen && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", zIndex: 999 }}
          onMouseDown={(e) => { e.stopPropagation(); setIsOpen(false); }} />
      )}
      <PopupSpring show={isOpen} style={{ position: "absolute", right: 0, top: "100%", background: "#fff", boxShadow: "0 4px 12px rgba(0,0,0,0.15)", borderRadius: "4px", border: "1px solid #dadce0", zIndex: 1000, minWidth: "140px", padding: "4px 0" }} origin="top right">
        {menuItem("Mark as unread", "#202124", () => {
          const resetTime = new Date(0).toISOString();
          setGchatSpaceTimes(prev => ({ ...prev, [sid]: resetTime }));
          localStorage.setItem("GCHAT_SPACE_TIMES", JSON.stringify({ ...gchatSpaceTimes, [sid]: resetTime }));
          setUnreadGchatSpaces(prev => {
            const next = { ...prev, [sid]: s.lastActiveTime || new Date().toISOString() };
            localStorage.setItem("GCHAT_UNREAD_SPACES", JSON.stringify(next));
            return next;
          });
        })}
        {menuItem(showArchivedChats ? "Unarchive" : "Archive", "#202124", () => {
          setArchivedGchatSpaces(prev => prev.includes(sid) ? prev.filter(id => id !== sid) : [...prev, sid]);
        })}
        {menuItem(mutedGchatSpaces.includes(sid) ? "Unmute" : "Mute", "#202124", () => {
          setMutedGchatSpaces(prev => prev.includes(sid) ? prev.filter(id => id !== sid) : [...prev, sid]);
        })}
     {menuItem("Delete", "#d93025", () => {
          setChatToDelete({ id: sid, title: s.displayName || "this chat" });
        })}
      </PopupSpring>
    </div>
  );
};

export default GChatSidebarMenu;
