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
  const [dailySentStats, setDailySentStats] = useState({}); // 🌟 NEW: Holds the live movement counts
  const [isLoadingStats, setIsLoadingStats] = useState(true);

  const getMemberAvatar = (userName) => {
    const local = avatarFor(userName);
    if (local) return local;
    if (trelloMembers && trelloMembers.length > 0) {
      const match = trelloMembers.find(m => m.fullName.toLowerCase().includes(userName.toLowerCase()));
      if (match && match.avatarUrl) {
        return match.avatarUrl.endsWith('.png') ? match.avatarUrl : match.avatarUrl + '/50.png';
      }
    }
    return null;
  };

  const extractDueDate = (title) => {
    const match = (title || "").match(/\(Due\s+([^)]+)\)/i);
    return match ? match[1].trim() : "-";
  };

  // 🌟 NEW: Fetches BOTH time logged AND daily card movements simultaneously!
  useEffect(() => {
    let isMounted = true;
    const fetchStats = async () => {
      try {
        const [prodRes, ledgerRes] = await Promise.all([
           fetch("/.netlify/functions/trello-productivity"),
           fetch("/.netlify/functions/daily-ledger?mode=live")
        ]);
        
        const prodJson = await prodRes.json();
        const ledgerJson = await ledgerRes.json();

        if (isMounted) {
          if (prodJson.ok) setProdStats(prodJson.stats);
          if (!ledgerJson.error) setDailySentStats(ledgerJson);
        }
      } catch (error) {
        console.error("Failed to fetch stats", error);
      } finally {
        if (isMounted) setIsLoadingStats(false);
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 30000);
    return () => { isMounted = false; clearInterval(interval); };
  }, []);

  const TARGET_USERS = ["Siya", "Enock", "Songeziwe", "Bonisa", "Siya - Review"];
  const reviewList = trelloBuckets.find(b => b.title === "Siya - Review") || { cards: [] };

  const getUserMetrics = (userName) => {
    const userList = trelloBuckets.find(b => b.title.toLowerCase() === userName.toLowerCase()) || { cards: [] };

    const activeCards = userList.cards.filter(c => 
      !c.title.toLowerCase().includes("out of office") && 
      !c.title.toLowerCase().includes("away from cases")
    );

    // 🌟 NEW: Grab the specific cards this user pushed forward today from the backend
    const completedTodayIds = dailySentStats[`${userName}_cards`] || []; 

    const allAssignedCards = trelloBuckets.flatMap(b => b.cards).filter(c => {
      // Condition 1: Is it assigned to them right now AND not an admin card?
      const isCurrentlyHere = c.people?.some(p => String(p).toLowerCase().includes(userName.toLowerCase())) &&
                              !c.title.toLowerCase().includes("out of office") && 
                              !c.title.toLowerCase().includes("away from cases");
      
      // Condition 2: Did they successfully send this card forward TODAY?
      const wasCompletedToday = completedTodayIds.includes(c.id);

      // Show the card in their daily log if EITHER condition is true
      return isCurrentlyHere || wasCompletedToday;
    });
    let status = "🟢";
    let currentTask = "None";

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

    const reviewCount = dailySentStats[userName] || 0;

    // 3. Time Logged (Now shows the Arrival Timestamp of the #1 card)
    const calculateArrivalTime = () => {
      if (activeCards.length > 0) {
         const topCard = activeCards[0];
         try {
             const durObj = JSON.parse(topCard.customFields?.IdleLog || "{}");
             // If the card is at the top AND the timestamp belongs to this user
             if (durObj._topReachedAt && durObj._topUser === userName) {
                 const date = new Date(durObj._topReachedAt);
                 // Format it as HH:MM (e.g., 17:41)
                 return date.toLocaleTimeString('en-ZA', { timeZone: 'Africa/Johannesburg', hour: '2-digit', minute: '2-digit', hour12: false });
             }
         } catch(e) {}
      }
      return "-"; // Returns a dash if no card is actively at the top
    };

    const calculateActiveTimer = () => {
      let totalMinutes = 0;
      const now = Date.now();
      const allCardsOnBoard = trelloBuckets.flatMap(b => b.cards);

      allCardsOnBoard.forEach(c => {
        let savedDurations = {};
        const rawDur = c.customFields?.WorkLog || "{}";
        try {
          if (!rawDur.startsWith("{")) {
            savedDurations = { [c.list]: parseFloat(rawDur) || 0 };
          } else {
            savedDurations = JSON.parse(rawDur);
          }
        } catch (e) {}

        const userSavedDur = parseFloat(savedDurations[userName] || "0");
        if (!isNaN(userSavedDur)) {
          totalMinutes += userSavedDur;
        }

        const rawStart = c.customFields?.WorkTimerStart || "";
        if (rawStart) {
          const [startTsStr, startList] = rawStart.split("|");
          const startTs = parseFloat(startTsStr);
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

      const isAway = status === "🔴";
      return { 
        status, 
        currentTask, 
        reviewCount: isAway ? "-" : reviewCount, 
        cardCount: isAway ? "-" : activeCards.length, 
        timeLogged: isAway ? "-" : calculateArrivalTime(), 
        activeTimer: isAway ? "-" : calculateActiveTimer(), 
        allUserCards: allAssignedCards 
      };
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
                <span className="prod-metric-value highlight" style={{ color: "#1f1f1f" }}>{metrics.reviewCount === "-" ? "-" : `${metrics.reviewCount} Cases`}</span>
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
                  <th style={{ width: "35%" }}>Card Name</th>
                  <th>Location</th>
                  <th>Due Date</th>
                  <th>Status</th>
                  {/* 🌟 NEW: Replaced Time Logged with Idle Time */}
                  <th>Idle Time</th> 
                </tr>
              </thead>
              <tbody>
                {allUserCards.length === 0 ? (
                  <tr>
                    <td colSpan="5" style={{ textAlign: "center", color: "#5f6368", fontStyle: "italic", padding: "32px" }}>No active or reviewed cards found for {selectedUser}.</td>
                  </tr>
                ) : (
                  allUserCards.map(c => {
                    // 🌟 NEW: Calculate accumulated + currently ticking Idle Time
                    // 🌟 NEW: Calculate accumulated + currently ticking Idle Time
                    let idleMins = 0;
                    try {
                        const durObj = JSON.parse(c.customFields?.IdleLog || "{}");
                        idleMins += parseFloat(durObj[`${selectedUser}_idle`] || 0);
                        
                        // Add live ticking time if it is CURRENTLY at the top
                        if (durObj._topReachedAt && durObj._topUser === selectedUser) {
                            idleMins += (Date.now() - durObj._topReachedAt) / 60000;
                        }
                    } catch(e) {}

                    const formattedIdle = idleMins > 0 
                        ? `${Math.floor(idleMins / 60)}h ${Math.floor(idleMins % 60)}m` 
                        : "0m";

                    return (
                      <tr key={c.id} style={{ cursor: "pointer" }} onClick={() => window.dispatchEvent(new CustomEvent("openTrelloCard", { detail: { ...c, fromProductivity: selectedUser } }))}>
                        <td style={{ fontWeight: 500 }}>{c.title}</td>
                        <td>
                          <span style={{ background: c.list === "Siya - Review" ? "#e6f4ea" : "#f1f3f4", color: c.list === "Siya - Review" ? "#137333" : "#3c4043", padding: "4px 8px", borderRadius: "4px", fontSize: "12px", fontWeight: 600 }}>
                            {c.list}
                          </span>
                        </td>
                        <td style={{ color: "#5f6368", fontWeight: 500 }}>{extractDueDate(c.title)}</td>
                        <td>{c.customFields?.Active || c.customFields?.Status || "-"}</td>
                        {/* 🌟 NEW: Display Idle Time */}
                        <td style={{ fontWeight: "bold", color: idleMins > 0 ? "#ea4335" : "#97a0af" }}>
                            {formattedIdle}
                        </td>
                      </tr>
                    );
                  })
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