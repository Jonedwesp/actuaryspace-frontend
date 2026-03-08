import React from "react";

export function LeftPanel({
  isMuted, setIsMuted,
  notifLoading,
  notifications,
  exitingNotifIds,
  onNotificationClick,
  dismissNotification,
}) {
  return (
    <div className="left-panel">
      <div className="panel-title" style={{ marginBottom: "4px", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
        <span>Notifications</span>
        <button
          onClick={() => {
            const nextMuted = !isMuted;
            setIsMuted(nextMuted);
            localStorage.setItem("NOTIF_MUTED", nextMuted);
          }}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "#5f6368",
            display: "grid",
            placeItems: "center",
            padding: "2px",
            borderRadius: "4px"
          }}
          title={isMuted ? "Unmute all" : "Mute all"}
          onMouseEnter={e => e.currentTarget.style.background = "#f1f3f4"}
          onMouseLeave={e => e.currentTarget.style.background = "transparent"}
        >
          {isMuted ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5L6 9H2v6h4l5 4V5z"></path><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line></svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
          )}
        </button>
      </div>
      <div className="notifications" style={{ marginTop: "10px" }}>
        {notifLoading && notifications.length === 0 && (
          <div style={{ padding: "28px 12px 8px", fontStyle: "italic", color: "#9aa0a6", fontSize: "15px", fontFamily: "'Inter', sans-serif", textAlign: "center" }}>
            Loading notifications...
          </div>
        )}
        {notifications.map((n) => (
          <div
            className={`notification ${n.alt.toLowerCase().replace(/\s/g, '-')}${exitingNotifIds.has(n.id) ? ' exiting' : ''}`}
            key={n.id}
            onClick={() => onNotificationClick(n)}
            style={{ position: "relative" }}
          >
            <img src={n.icon} alt={n.alt} className="icon" />
            <span style={{ flex: 1, paddingRight: "8px", lineHeight: "1.4" }}>
              [{n.time}]{" "}
              {(() => {
                const colonIdx = n.text.indexOf(":");
                if (colonIdx === -1) return n.text;
                return <><strong>{n.text.slice(0, colonIdx)}</strong>{n.text.slice(colonIdx)}</>;
              })()}
            </span>
            <button
              className="notif-close"
              title="Dismiss"
              onClick={(e) => {
                e.stopPropagation();
                dismissNotification(n);
              }}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default LeftPanel;
