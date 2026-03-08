import React, { useState, useEffect } from "react";
import { avatarFor } from "../utils/avatarUtils.js";

const ProductivityDashboard = React.memo(({ trelloBuckets, trelloMembers }) => {
  const [selectedUser, setSelectedUser] = useState(null);
  const [prodAnimClass, setProdAnimClass] = useState("");
  const transitionTo = (user) => {
    setProdAnimClass("prod-exit");
    setTimeout(() => {
      setSelectedUser(user);
      setProdAnimClass("prod-enter");
      setTimeout(() => setProdAnimClass(""), 250);
    }, 120);
  };
  React.useEffect(() => {
    const handler = (e) => transitionTo(e.detail || null);
    window.addEventListener("prodBackToSummary", handler);
    return () => window.removeEventListener("prodBackToSummary", handler);
  }, []);
  const [prodStats, setProdStats] = useState({ "Siya": 0, "Enock": 0, "Songeziwe": 0, "Bonisa": 0 });
  const [isLoadingStats, setIsLoadingStats] = useState(true);

  // Helper to dynamically pull avatars from live Trello state or local fallback
  const getMemberAvatar = (userName) => {
    // Local slack-profiles photos are always reliable — try them first
    const local = avatarFor(userName);
    if (local) return local;
    // Fall back to Trello S3 only when there is no local photo
    if (trelloMembers && trelloMembers.length > 0) {
      const match = trelloMembers.find(m => m.fullName.toLowerCase().includes(userName.toLowerCase()));
      if (match && match.avatarUrl) {
        return match.avatarUrl.endsWith('.png') ? match.avatarUrl : match.avatarUrl + '/50.png';
      }
    }
    return null;
  };

  // Helper to extract due date from title
  const extractDueDate = (title) => {
    const match = (title || "").match(/\(Due\s+([^)]+)\)/i);
    return match ? match[1].trim() : "-";
  };

  // Helper to convert due date strings into timestamps for sorting
  const getDueTimestamp = (dateStr) => {
    if (!dateStr || dateStr === "-") return Infinity; // Cards without due dates go to the bottom
    
    // Replace "COB" (Close of Business) with 17:00 so the math works
    let cleanStr = dateStr.replace(/COB/i, "17:00");
    
    // Append the current year so JavaScript's Date parser understands it completely
    const currentYear = new Date().getFullYear();
    const parsedDate = new Date(`${cleanStr} ${currentYear}`);
    
    // If it fails to parse, throw it to the bottom of the list
    return isNaN(parsedDate.getTime()) ? Infinity : parsedDate.getTime();
  };

  // Poll the backend for accurate movement durations every 30 seconds
  useEffect(() => {
    let isMounted = true;
    const fetchStats = async () => {
      try {
        const res = await fetch("/.netlify/functions/trello-productivity");
        const json = await res.json();
        if (isMounted && json.ok) {
          setProdStats(json.stats);
        }
      } catch (error) {
        console.error("Failed to fetch productivity stats", error);
      } finally {
        if (isMounted) setIsLoadingStats(false);
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 30000);
    return () => { isMounted = false; clearInterval(interval); };
  }, []);

  // 🟢 NEW: "Siya - Review" is now just a standard user card at the bottom
  const TARGET_USERS = ["Siya", "Enock", "Songeziwe", "Bonisa", "Siya - Review"];
  const reviewList = trelloBuckets.find(b => b.title === "Siya - Review") || { cards: [] };

  // Helper to extract metrics for a specific user based on the rules
  const getUserMetrics = (userName) => {
    // Exact list matches
    const userList = trelloBuckets.find(b => b.title.toLowerCase() === userName.toLowerCase()) || { cards: [] };
    const reviewList = trelloBuckets.find(b => b.title === "Siya - Review") || { cards: [] };

    // Filter out "Away from Cases" / "Out of Office" cards strictly for the Card Count
    const activeCards = userList.cards.filter(c => 
      !c.title.toLowerCase().includes("out of office") && 
      !c.title.toLowerCase().includes("away from cases")
    );

    // 🟢 NEW: Find ALL cards across the entire board where this user is assigned
    const allAssignedCards = trelloBuckets.flatMap(b => b.cards).filter(c => 
      c.people?.some(p => String(p).toLowerCase().includes(userName.toLowerCase())) &&
      !c.title.toLowerCase().includes("out of office") && 
      !c.title.toLowerCase().includes("away from cases")
    );

    let status = "🟢";
    let currentTask = "None";

    // 1. Live Status & Current Task (Based strictly on the top card of the bucket)
    if (userList.cards.length > 0) {
      const topCard = userList.cards[0];
      const topTitle = topCard.title.toLowerCase();

      if (topTitle.includes("out of office") || topTitle.includes("away from cases")) {
        status = "🔴";
        currentTask = topCard.title;
      } else {
        status = "🟢";
        currentTask = topCard.title;
      }
    }

    // 2. Daily Output (Cumulative Pipeline Tracking)
    let completedCards = [];
    const yolandieList = trelloBuckets.find(b => b.title === "Yolandie to Send") || { cards: [] };

    if (userName === "Siya - Review") {
      // Siya's score: Any card sitting in Yolandie to Send
      completedCards = yolandieList.cards.filter(c => 
        !c.title.toLowerCase().includes("out of office") && 
        !c.title.toLowerCase().includes("away from cases")
      );
    } else {
      // Data Capturers score: Cards in Review OR Yolandie to Send
      const reviewAndBeyondCards = [...reviewList.cards, ...yolandieList.cards];
      completedCards = reviewAndBeyondCards.filter(c => 
        c.people?.some(p => String(p).toLowerCase().includes(userName.toLowerCase())) &&
        !c.title.toLowerCase().includes("out of office") && 
        !c.title.toLowerCase().includes("away from cases")
      );
    }
    const reviewCount = completedCards.length;

    // 3. Time Logged (Backend calculated: Top of bucket to Review)
    const calculateTimeLogged = () => {
      const totalMinutes = Math.floor(prodStats[userName] || 0);
      if (totalMinutes === 0) return "0h 0m";

      const hours = Math.floor(totalMinutes / 60);
      const mins = totalMinutes % 60;
      
      return `${hours}h ${mins}m`;
    };

    // 4. 🟢 Active Timer (WorkFlow Timer: Tracks time by Bucket across the whole board)
    const calculateActiveTimer = () => {
      let totalMinutes = 0;
      const now = Date.now();
      
      // ⚡ FIX: Scan ALL cards on the board, not just currently assigned ones.
      // This ensures they keep their accumulated time even after passing the card to someone else.
      const allCardsOnBoard = trelloBuckets.flatMap(b => b.cards);

      allCardsOnBoard.forEach(c => {
        // 1. Add manually saved duration for THIS SPECIFIC BUCKET
        let savedDurations = {};
        const rawDur = c.customFields?.WorkDuration || "{}";
        try {
          if (!rawDur.startsWith("{")) {
            savedDurations = { [c.list]: parseFloat(rawDur) || 0 }; // Legacy fallback
          } else {
            savedDurations = JSON.parse(rawDur);
          }
        } catch (e) {}

        const userSavedDur = parseFloat(savedDurations[userName] || "0");
        if (!isNaN(userSavedDur)) {
          totalMinutes += userSavedDur;
        }

        // 2. Add currently ticking time ONLY if it was started in THIS user's bucket
        const rawStart = c.customFields?.WorkTimerStart || "";
        if (rawStart) {
          const [startTsStr, startList] = rawStart.split("|");
          const startTs = parseFloat(startTsStr);
          // If the timer is running, and the bucket it was started in matches this user's row
          if (startTs > 1000000000000 && startList === userName) {
            const tickingMins = Math.max(0, now - startTs) / 1000 / 60;
            totalMinutes += tickingMins;
          }
        }
      });

      if (totalMinutes === 0) return "0h 0m";

      const hours = Math.floor(totalMinutes / 60);
      const mins = Math.floor(totalMinutes % 60);
      
      return `${hours}h ${mins}m`;
    };

    return { status, currentTask, reviewCount, cardCount: activeCards.length, timeLogged: calculateTimeLogged(), activeTimer: calculateActiveTimer(), allUserCards: allAssignedCards };
  };

  const metrics = selectedUser ? getUserMetrics(selectedUser) : null;
  const allUserCards = metrics?.allUserCards || [];

  return (
    <div className="prod-dashboard">
      <div className={`prod-content ${prodAnimClass}`} style={{ width: "100%" }}>
      {selectedUser ? (
        <div className="prod-detail">
          <button className="prod-back-btn" onClick={() => transitionTo(null)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
            Back to Dashboard
          </button>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
            <h2 style={{ fontSize: "28px", margin: 0, color: "#1f1f1f", display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{ width: "12px", height: "12px", borderRadius: "50%", flexShrink: 0, backgroundColor: metrics.status === "🟢" ? "#34A853" : "#EA4335", boxShadow: metrics.status === "🟢" ? "0 0 6px #34A853" : "0 0 8px #EA4335", transition: "all 0.3s ease" }} />
              {selectedUser}'s Workspace
            </h2>
            <div style={{ display: "flex", gap: "24px" }}>
              <div className="prod-metric">
                <span className="prod-metric-label">Output</span>
                <span className="prod-metric-value highlight" style={{ color: "#1f1f1f" }}>{metrics.reviewCount} Cases</span>
              </div>
              <div className="prod-metric">
                <span className="prod-metric-label">Logged</span>
                <span className="prod-metric-value highlight" style={{ color: "#1f1f1f" }}>{metrics.timeLogged}</span>
              </div>
            </div>
          </div>

          <h3 style={{ fontSize: "16px", color: "#5f6368", borderBottom: "2px solid #f1f3f4", paddingBottom: "8px", margin: "0 0 16px 0" }}>
            Card Activity
          </h3>

          <div style={{ overflowY: "auto", flex: 1 }}>
            <table className="prod-table">
              <thead>
                <tr>
                  <th style={{ width: "40%" }}>Card Name</th>
                  <th>Location</th>
                  <th>Due Date</th>
                  <th>Priority</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {allUserCards.length === 0 ? (
                  <tr>
                    <td colSpan="5" style={{ textAlign: "center", color: "#5f6368", fontStyle: "italic", padding: "32px" }}>No active or reviewed cards found for {selectedUser}.</td>
                  </tr>
                ) : (
                  allUserCards.map(c => (
                    <tr key={c.id} style={{ cursor: "pointer" }} onClick={() => window.dispatchEvent(new CustomEvent("openTrelloCard", { detail: { ...c, fromProductivity: selectedUser } }))}>
                      <td style={{ fontWeight: 500 }}>{c.title}</td>
                      <td>
                        <span style={{ background: c.list === "Siya - Review" ? "#e6f4ea" : "#f1f3f4", color: c.list === "Siya - Review" ? "#137333" : "#3c4043", padding: "4px 8px", borderRadius: "4px", fontSize: "12px", fontWeight: 600 }}>
                          {c.list}
                        </span>
                      </td>
                      <td style={{ color: "#5f6368", fontWeight: 500 }}>{extractDueDate(c.title)}</td>
                      <td>{c.customFields?.Priority || "-"}</td>
                      <td>{c.customFields?.Active || c.customFields?.Status || "-"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <>

      <div className="prod-grid">
        {TARGET_USERS.map(user => {
          const m = getUserMetrics(user);
          return (
            <div key={user} className="prod-card" style={{ flexDirection: "column", alignItems: "stretch", gap: "14px" }} onClick={() => transitionTo(user)}>

              {/* 1. Identity (Top) */}
              <div className="prod-card-header">
                <div style={{ position: "relative", width: "40px", height: "40px", borderRadius: "50%", background: "#e8f0fe", color: "#1a73e8", display: "grid", placeItems: "center", fontWeight: "bold", fontSize: "14px", overflow: "hidden", flexShrink: 0 }}>
                  <span style={{ position: "absolute", userSelect: "none" }}>{user.split(" ").filter(Boolean).map(w => w[0].toUpperCase()).filter((_, i, arr) => i === 0 || i === arr.length - 1).join("")}</span>
                  {(() => { const av = getMemberAvatar(user); return av ? <img key={av} src={av} alt={user} style={{ position: "absolute", width: "100%", height: "100%", objectFit: "cover", display: "block" }} onError={(e) => { e.currentTarget.style.display = "none"; }}/> : null; })()}
                </div>
                <div className="prod-card-title">
                  <div style={{ width: "10px", height: "10px", borderRadius: "50%", flexShrink: 0, backgroundColor: m.status === "🟢" ? "#34A853" : "#EA4335", boxShadow: m.status === "🟢" ? "0 0 6px #34A853" : "0 0 8px #EA4335", transition: "all 0.3s ease" }} />
                  {user}
                </div>
              </div>

              {/* 2. All metrics (Below) */}
              <div style={{ display: "flex", gap: "24px", flexWrap: "wrap", alignItems: "flex-start" }}>
                <div className="prod-metric" style={{ flex: 1, minWidth: "120px", overflow: "hidden" }}>
                  <span className="prod-metric-label">Current Task</span>
                  <span className="prod-metric-value">{m.currentTask}</span>
                </div>
                <div className="prod-metric" style={{ minWidth: "90px" }}>
                  <span className="prod-metric-label">Card Count</span>
                  <span className="prod-metric-value highlight" style={{ color: "#1f1f1f" }}>{m.cardCount}</span>
                </div>
                <div className="prod-metric" style={{ minWidth: "110px" }}>
                  <span className="prod-metric-label">Time Logged</span>
                  <span className="prod-metric-value highlight" style={{ color: "#1f1f1f" }}>{m.timeLogged}</span>
                </div>
                <div className="prod-metric" style={{ minWidth: "110px" }}>
                  <span className="prod-metric-label">Active Timer</span>
                  <span className="prod-metric-value highlight" style={{ color: "#1f1f1f" }}>{m.activeTimer}</span>
                </div>
                <div className="prod-metric" style={{ minWidth: "130px" }}>
                  <span className="prod-metric-label">
                    {user === "Siya - Review" ? "Sent to Yolandie" : "Sent to Review"}
                  </span>
                  <span className="prod-metric-value highlight" style={{ color: "#1f1f1f" }}>{m.reviewCount}</span>
                </div>
              </div>

            </div>
          );
        })}
        </div>
        </>
      )}
      </div>
    </div>
  );
});

export default ProductivityDashboard;
