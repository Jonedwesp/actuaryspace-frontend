import { useState } from "react";

// --- Smart Link Component for Workspace Apps ---
const SmartLink = ({ url, label, setIsLiveCallActive, setSelectedEvent, className, style, children }) => {
  const [isHovered, setIsHovered] = useState(false);

const handleClick = async (e) => {
    e.stopPropagation();
    setIsHovered(false); // 👈 GUARANTEED FIX: Force clears the tooltip when split-screen layout shifts

    // 🚀 INTERCEPT MEET LINKS: Generate a host-owned meeting via the backend
    if (url?.includes('meet.google.com')) {
      e.preventDefault();

      // Dismiss the calendar pop-up instantly
      if (setSelectedEvent) setSelectedEvent(null);

      window.dispatchEvent(new CustomEvent("googleMeetLaunched"));

      // Open in a new tab immediately to bypass iframe restrictions
      const initialSeparator = url.includes('?') ? '&' : '?';
      const initialAuthUrl = `${url}${initialSeparator}authuser=siyabonga@actuaryconsulting.co.za`;
      const meetTab = window.open(initialAuthUrl, '_blank');

      // Trigger the NLM Video playback after a 4-second delay (simulating answer)
      setTimeout(() => {
        if (setIsLiveCallActive) setIsLiveCallActive(true);
      }, 4000);

      try {
        const res = await fetch("/.netlify/functions/calendar-create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ summary: `Meeting: ${label || children}` })
        });
        const json = await res.json();

        if (json.ok && json.event?.hangoutLink) {
          // Upgrade the new tab silently to the host link once the server finishes
          const hostSeparator = json.event.hangoutLink.includes('?') ? '&' : '?';
          const hostAuthUrl = `${json.event.hangoutLink}${hostSeparator}authuser=siyabonga@actuaryconsulting.co.za`;
          if (meetTab) meetTab.location.href = hostAuthUrl;
        }
      } catch (err) {
        console.error("SmartLink host generation failed in background", err);
      }
    }
  };
  const isWorkspaceLink = url?.includes('meet.google.com') || url?.includes('docs.google.com') || url?.includes('sheets.google.com');

  return (
    <div
      className="smart-link-wrapper"
      style={{ display: "inline-flex", position: "relative", alignItems: "center", maxWidth: "100%" }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={handleClick}
        onContextMenu={() => {
          if (setSelectedEvent) {
            setTimeout(() => setSelectedEvent(null), 2000);
          }
          // 🚀 ARM FOR SPLIT VIEW: Prepares the app to watch for the window shrinking
          if (url?.includes('meet.google.com')) {
            window.dispatchEvent(new CustomEvent("armedForSplitView"));
          }
        }}
        className={className}
        style={{ ...style, textDecoration: isHovered ? "underline" : "none", overflow: "hidden", textOverflow: "ellipsis" }}
      >
        {label || children}
      </a>

      {isHovered && isWorkspaceLink && (
        <div style={{
          position: "absolute",
          bottom: "100%",
          left: "50%",
          transform: "translateX(-50%)",
          marginBottom: "8px",
          backgroundColor: "#f1f3f4",
          color: "#202124",
          padding: "10px 14px",
          borderRadius: "8px",
          fontSize: "13px",
          fontWeight: "600",
          whiteSpace: "nowrap",
          zIndex: 999999,
          boxShadow: "0 6px 16px rgba(0,0,0,0.15)",
          pointerEvents: "none",
          fontFamily: "system-ui, -apple-system, sans-serif"
        }}>
          Right-click for more options...
          <div style={{
            content: '""',
            position: "absolute",
            top: "100%",
            left: "50%",
            marginLeft: "-6px",
            borderWidth: "6px",
            borderStyle: "solid",
            borderColor: "#f1f3f4 transparent transparent transparent"
          }} />
        </div>
      )}
    </div>
  );
};

export default SmartLink;
