import React from "react";
import gchatIcon from "../assets/Google Chat.png";
import gmailIcon from "../assets/Gmail pic.png";
import logo from "../assets/Actuary Consulting.png";
import CalendarIcon from "./CalendarIcon.jsx";

export function TopBar({
  currentView, setCurrentView,
  setGchatSelectedSpace, setInputValue,
  systemErrors, showSystemPopup, setShowSystemPopup,
}) {
  return (
        <div className="panel-title" style={{
          display: "flex",
          alignItems: "center",
          paddingRight: "24px",
          paddingLeft: "12px",
        }}>

          {/* LEFT SIDE: App Buttons — flex:1 + justify start */}
          <div style={{ flex: 1, display: "flex", alignItems: "center", gap: "12px" }}>
            <button className={`connect-google-btn${currentView.app === "gchat" ? " nav-active" : ""}`} onClick={() => { if (currentView.app === "gchat") { setCurrentView({ app: "none", contact: null }); } else { setGchatSelectedSpace(null); setInputValue(""); setCurrentView({ app: "gchat", contact: null }); } }}>
              <img src={gchatIcon} alt="Google Chat" />
              Google Chat
            </button>

            <button className={`connect-google-btn${currentView.app === "gmail" ? " nav-active" : ""}`} onClick={() => { if (currentView.app === "gmail") { setCurrentView({ app: "none", contact: null }); } else { setInputValue(""); setCurrentView({ app: "gmail", contact: null }); } }}>
              <img src={gmailIcon} alt="Gmail" />
              Gmail
            </button>

            <button className={`connect-google-btn${currentView.app === "calendar" ? " nav-active" : ""}`} onClick={() => { if (currentView.app === "calendar") { setCurrentView({ app: "none", contact: null }); } else { setInputValue(""); setCurrentView({ app: "calendar", contact: null }); } }}>
              <CalendarIcon />
              Calendar
            </button>
          </div>

          <img src={logo} alt="Actuary Consulting" style={{ height: "42px", width: "auto", objectFit: "contain" }} />

   {/* RIGHT SIDE: Productivity -> Status -> Reconnect -> Close — flex:1 + justify end */}
          <div style={{ flex: 1, display: "flex", alignItems: "center", gap: "8px", justifyContent: "flex-end" }}>

            <button
              className={`connect-google-btn${currentView.app === "productivity" ? " nav-active" : ""}`}
              onClick={() => {
                if (currentView.app === "productivity") { setCurrentView({ app: "none", contact: null }); } else { setInputValue(""); setCurrentView({ app: "productivity", contact: null }); }
              }}
              type="button"
            >
              <span style={{ fontSize: '16px' }}>📊</span>
              Productivity
            </button>

            <div style={{ position: "relative" }}>
              {(() => {
                const systemOk = Object.keys(systemErrors).length === 0;
                return (
                  <>
                    <button
                      className="connect-google-btn"
                      onClick={() => { if (!systemOk) setShowSystemPopup(p => !p); }}
                      style={{ display: "flex", alignItems: "center", gap: "8px", cursor: systemOk ? "default" : "pointer" }}
                      title={systemOk ? "All systems operational" : "Click to see alerts"}
                    >
                      <div style={{
                        width: "10px", height: "10px", borderRadius: "50%",
                        backgroundColor: systemOk ? "#34A853" : "#EA4335",
                        boxShadow: systemOk ? "0 0 6px #34A853" : "0 0 8px #EA4335",
                        transition: "all 0.3s ease"
                      }} />
                      <span style={{ fontSize: "12px", fontWeight: 500 }}>
                        {systemOk ? "System: Good" : "System: Alert"}
                      </span>
                    </button>
                    {!systemOk && showSystemPopup && (
                      <div className="popup-anim-in" style={{
                        position: "absolute", top: "calc(100% + 8px)", right: 0,
                        background: "#1e1e1e", border: "1px solid #EA4335",
                        borderRadius: "8px", padding: "12px 16px", minWidth: "260px",
                        zIndex: 9999, boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
                        transformOrigin: "top right"
                      }}>
                        <div style={{ fontWeight: 600, color: "#EA4335", marginBottom: "8px", fontSize: "13px" }}>
                          System Alerts
                        </div>
                        {Object.entries(systemErrors).map(([source, msg]) => (
                          <div key={source} style={{ marginBottom: "6px", fontSize: "12px", color: "#ccc" }}>
                            <span style={{ color: "#fff", fontWeight: 500 }}>{source}:</span> {msg}
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                );
              })()}
            </div>

            <a href="/.netlify/functions/google-auth-start" className="connect-google-btn">
              Reconnect
            </a>

          </div>
        </div>
  );
}

export default TopBar;
