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
  
  // --- THE NEW 6-WEEK CHUNKED STATE & HELPERS ---
  const [weeklyStats, setWeeklyStats] = useState({});
  const [loadingWeekly, setLoadingWeekly] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [weekOffset, setWeekOffset] = useState(0); 
  
  // --- NEW DAILY STATS STATE ---
  const [isDailyModalOpen, setIsDailyModalOpen] = useState(false);
  const [dayOffset, setDayOffset] = useState(0); // 0 = today, 1 = yesterday
  // -----------------------------
  
  const [maxLoadedWeek, setMaxLoadedWeek] = useState(-1);

  const getDayBoundaries = (offset) => {
      const date = new Date();
      date.setDate(date.getDate() - offset);
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(date);
      end.setHours(23, 59, 59, 999);
      return { start, end };
  };

  const getWeekBoundaries = (offset) => {
      const now = new Date();
      const dayOfWeek = now.getDay() || 7; 
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      start.setDate(now.getDate() - dayOfWeek + 1 - (offset * 7));
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
      return { start, end };
  };

  const fmtStr = (d) => {
      const pad = n => n < 10 ? '0' + n : n;
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };

  const fetchLedgerChunk = async (startWeek, endWeek) => {
      setLoadingWeekly(true);
      const { end } = getWeekBoundaries(startWeek);
      const { start } = getWeekBoundaries(endWeek);
      try {
          const res = await fetch(`/.netlify/functions/daily-ledger?mode=weekly&start=${fmtStr(start)}&end=${fmtStr(end)}`);
          const newData = await res.json();
          setWeeklyStats(prev => {
              const merged = { ...prev };
              Object.keys(newData).forEach(user => {
                  if (!merged[user]) merged[user] = [];
                  merged[user] = [...merged[user], ...newData[user]];
              });
              return merged;
          });
          setMaxLoadedWeek(endWeek);
      } catch (e) {
          console.error("Failed to fetch chunk");
      }
      setLoadingWeekly(false);
  };

  // 🌟 NEW: Auto-fetch the ledger in the background so the ETA is instantly ready
  useEffect(() => {
      if (maxLoadedWeek < 0 && !loadingWeekly) {
          fetchLedgerChunk(0, 5);
      }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // ----------------------------------------------

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

    // 🌟 FIXED: Grab the specific cards this user pushed forward today from the backend
    const completedTodayIds = dailySentStats[`${userName}_cards`] || []; 
    const bucketKey = userName === "Siya - Review" ? "SRV" : userName.substring(0, 3).toUpperCase();

    const allAssignedCards = trelloBuckets.flatMap(b => b.cards).filter(c => {
      // Safety Check: Never show admin/away cards in the workspace table
      if (c.title.toLowerCase().includes("out of office") || c.title.toLowerCase().includes("away from cases")) return false;

      // Condition 1: Is the card physically in this user's list right now?
      // We use c.list here instead of 'b' to avoid the white screen crash
      const isInUserList = (c.list || "").toLowerCase() === userName.toLowerCase();

      // Condition 2: Is it in a shared list (like Review or Yolandie) but they are the assigned member?
      const isAssignedInSharedList = ((c.list || "").includes("Review") || (c.list || "").includes("Yolandie")) && 
                                     c.people?.some(p => String(p).toLowerCase().includes(userName.toLowerCase()));
      
      const isCurrentlyHere = isInUserList || isAssignedInSharedList;
      
      // Condition 3: Did they successfully send this card forward TODAY?
      const wasCompletedToday = completedTodayIds.includes(c.id);

      // Condition 4: Have they accumulated any idle or active time on this card?
      let hasLoggedTime = false;
      try {
          const idleObj = JSON.parse(c.customFields?.IdleLog || "{}");
          if (idleObj[`${userName}_idle`] > 0 || idleObj._topUser === userName) hasLoggedTime = true;

          const workObj = JSON.parse(c.customFields?.WorkLog || "{}");
          if (parseFloat(workObj[userName]) > 0 || parseFloat(workObj[bucketKey]) > 0) hasLoggedTime = true;

          const rawStart = c.customFields?.WorkTimerStart || "";
          if (rawStart) {
              const [startTsStr, startList] = rawStart.split("|");
              if (startList === userName || (startList && startList.substring(0, 3).toUpperCase() === bucketKey)) {
                  hasLoggedTime = true;
              }
          }
      } catch(e) {}

      // Show the card if ANY of the above are true
      return isCurrentlyHere || wasCompletedToday || hasLoggedTime;
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
      const bucketKey = userName === "Siya - Review" ? "SRV" : userName.substring(0, 3).toUpperCase();

      // Only check the #1 active card in their list
      if (activeCards.length > 0) {
        const topCard = activeCards[0];
        let savedDurations = {};
        const rawDur = topCard.customFields?.WorkLog || "{}";
        try {
          if (!rawDur.startsWith("{")) {
            savedDurations = { [topCard.list]: parseFloat(rawDur) || 0 };
          } else {
            savedDurations = JSON.parse(rawDur);
          }
        } catch (e) {}

        const durFromName = parseFloat(savedDurations[userName] || "0");
        const durFromKey = parseFloat(savedDurations[bucketKey] || "0");
        const userSavedDur = durFromName > 0 ? durFromName : durFromKey;

        if (!isNaN(userSavedDur)) {
          totalMinutes += userSavedDur;
        }

        const rawStart = topCard.customFields?.WorkTimerStart || "";
        if (rawStart) {
          const [startTsStr, startList] = rawStart.split("|");
          const startTs = parseFloat(startTsStr);
          if (startTs > 1000000000000 && (startList === userName || startList.substring(0, 3).toUpperCase() === bucketKey)) {
            const tickingMins = Math.max(0, now - startTs) / 1000 / 60;
            totalMinutes += tickingMins;
          }
        }
      }

      if (totalMinutes === 0) return "0h 0m";
      const hours = Math.floor(totalMinutes / 60);
      const mins = Math.floor(totalMinutes % 60);
      return `${hours}h ${mins}m`;
    };

    // 4. Calculate ETA (7-Day Historical Average Idle Time from Ledger)
    const calculateETA = () => {
        const history = weeklyStats[userName] || [];
        
        // Show a calculating status briefly while the background fetch finishes
        if (history.length === 0) return "Calculating..."; 

        // Get a true 7-day rolling window to avoid "0 ETA" on Monday mornings
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        sevenDaysAgo.setHours(0, 0, 0, 0);

        let recentCases = 0;
        let recentIdle = 0;

        history.forEach(record => {
            const rDate = new Date(record.date);
            if (rDate >= sevenDaysAgo) {
                recentCases += record.cases;
                recentIdle += record.idleMins;
            }
        });

        const avgIdle = recentCases > 0 ? recentIdle / recentCases : 0;
        return avgIdle > 0 ? `${Math.floor(avgIdle / 60)}h ${Math.floor(avgIdle % 60)}m` : "0h 0m";
    };

      const isAway = status === "🔴";
      return { 
        eta: isAway ? "-" : calculateETA(),
        status, 
        currentTask, 
        reviewCount, 
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
                <span className="prod-metric-value highlight" style={{ color: "#1f1f1f" }}>{metrics.reviewCount} Cases</span>
              </div>
              <div className="prod-metric">
                <span className="prod-metric-label">Logged</span>
                <span className="prod-metric-value highlight" style={{ color: "#1f1f1f" }}>{metrics.timeLogged}</span>
              </div>
              <div className="prod-metric">
                <span className="prod-metric-label">ETA</span>
                <span className="prod-metric-value highlight" style={{ color: "#ea4335" }}>{metrics.eta}</span>
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
                  <th>Idle Time</th> 
                  <th>Active Time</th> 
                </tr>
              </thead>
              <tbody>
                {allUserCards.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: "center", color: "#5f6368", fontStyle: "italic", padding: "32px" }}>No active or reviewed cards found for {selectedUser}.</td>
                  </tr>
                ) : (
                  (() => {
                    let totalActiveMins = 0;
                    let totalIdleMins = 0;
                    const bucketKey = selectedUser === "Siya - Review" ? "SRV" : selectedUser.substring(0, 3).toUpperCase();
                    
                    const rows = allUserCards.map(c => {
                        // 1. Idle Time Calculation
                        let idleMins = 0;
                        try {
                            const durObj = JSON.parse(c.customFields?.IdleLog || "{}");
                            idleMins += parseFloat(durObj[`${selectedUser}_idle`] || 0);
                            
                            if (durObj._topReachedAt && durObj._topUser === selectedUser) {
                                idleMins += (Date.now() - durObj._topReachedAt) / 60000;
                            }
                        } catch(e) {}
                        
                        totalIdleMins += idleMins;
                        
                        const formattedIdle = idleMins > 0 
                            ? `${Math.floor(idleMins / 60)}h ${Math.floor(idleMins % 60)}m` 
                            : "0m";

                        // 2. Active Time Calculation
                        let activeMins = 0;
                        try {
                            let savedDurations = {};
                            const rawDur = c.customFields?.WorkLog || "{}";
                            if (!rawDur.startsWith("{")) {
                               savedDurations = { [c.list]: parseFloat(rawDur) || 0 };
                            } else {
                               savedDurations = JSON.parse(rawDur);
                            }
                            const durFromName = parseFloat(savedDurations[selectedUser] || "0");
                            const durFromKey = parseFloat(savedDurations[bucketKey] || "0");
                            activeMins += (durFromName > 0 ? durFromName : durFromKey) || 0;

                            const rawStart = c.customFields?.WorkTimerStart || "";
                            if (rawStart) {
                               const [startTsStr, startList] = rawStart.split("|");
                               const startTs = parseFloat(startTsStr);
                               if (startTs > 1000000000000 && (startList === selectedUser || startList.substring(0, 3).toUpperCase() === bucketKey)) {
                                  activeMins += Math.max(0, Date.now() - startTs) / 1000 / 60;
                               }
                            }
                        } catch(e) {}
                        
                        totalActiveMins += activeMins;

                        const formattedActive = activeMins > 0 
                            ? `${Math.floor(activeMins / 60)}h ${Math.floor(activeMins % 60)}m` 
                            : "0m";

                        return (
                          <tr key={c.id} style={{ cursor: "pointer", borderBottom: "1px solid #f1f3f4" }} onClick={() => window.dispatchEvent(new CustomEvent("openTrelloCard", { detail: { ...c, fromProductivity: selectedUser } }))}>
                            <td style={{ fontWeight: 500 }}>{c.title}</td>
                            <td>
                              <span style={{ background: c.list === "Siya - Review" ? "#e6f4ea" : "#f1f3f4", color: c.list === "Siya - Review" ? "#137333" : "#3c4043", padding: "4px 8px", borderRadius: "4px", fontSize: "12px", fontWeight: 600 }}>
                                {c.list}
                              </span>
                            </td>
                            <td style={{ color: "#5f6368", fontWeight: 500 }}>{extractDueDate(c.title)}</td>
                            <td>{c.customFields?.Active || c.customFields?.Status || "-"}</td>
                            <td style={{ fontWeight: "bold", color: idleMins > 0 ? "#ea4335" : "#97a0af" }}>
                                {formattedIdle}
                            </td>
                            <td style={{ fontWeight: "bold", color: activeMins > 0 ? "#0b57d0" : "#97a0af" }}>
                                {formattedActive}
                            </td>
                          </tr>
                        );
                    });

                   return (
                      <>
                        {rows}
                        {/* 1. THE STANDARD TOTALS ROW */}
                        <tr style={{ background: "#f8f9fa", borderTop: "2px solid #dadce0" }}>
                          <td colSpan="4" style={{ textAlign: "right", fontWeight: "bold", color: "#3c4043", padding: "12px" }}>Totals:</td>
                          <td style={{ fontWeight: "bold", color: "#ea4335", padding: "12px" }}>
                              {totalIdleMins > 0 ? `${Math.floor(totalIdleMins / 60)}h ${Math.floor(totalIdleMins % 60)}m` : "0h 0m"}
                          </td>
                          <td style={{ fontWeight: "bold", color: "#0b57d0", padding: "12px" }}>
                              {totalActiveMins > 0 ? `${Math.floor(totalActiveMins / 60)}h ${Math.floor(totalActiveMins % 60)}m` : "0h 0m"}
                          </td>
                        </tr>

                        {/* --- THE DUAL ANALYTICS BUTTONS --- */}
                        <tr>
                          <td colSpan="6" style={{ textAlign: "center", padding: "16px", borderTop: "1px solid #dadce0" }}>
                             <div style={{ display: "flex", justifyContent: "center", gap: "16px" }}>
                                 <button 
                                    onClick={() => {
                                        setIsDailyModalOpen(true);
                                        if (maxLoadedWeek < 0 && !loadingWeekly) fetchLedgerChunk(0, 5);
                                    }}
                                    style={{ padding: "8px 16px", background: "#fff", border: "1px solid #dadce0", borderRadius: "16px", cursor: "pointer", fontSize: "12px", fontWeight: "600", color: "#5f6368", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}
                                 >
                                   📅 Open Daily Analytics
                                 </button>
                                 <button 
                                    onClick={() => {
                                        setIsModalOpen(true);
                                        if (maxLoadedWeek < 0 && !loadingWeekly) fetchLedgerChunk(0, 5);
                                    }}
                                    style={{ padding: "8px 16px", background: "#fff", border: "1px solid #dadce0", borderRadius: "16px", cursor: "pointer", fontSize: "12px", fontWeight: "600", color: "#5f6368", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}
                                 >
                                   📊 Open Weekly Analytics
                                 </button>
                             </div>
                          </td>
                        </tr>
                      </>
                    );
                  })()
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

{/* --- THE FLOATING DAILY MODAL --- */}
          {isDailyModalOpen && (
              <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.2)", zIndex: 999, display: "flex", justifyContent: "center", alignItems: "center" }}>
                  <div style={{ width: "90%", maxWidth: "650px", background: "#fff", borderRadius: "12px", boxShadow: "0 8px 32px rgba(0,0,0,0.15)", border: "1px solid #dadce0", overflow: "hidden", display: "flex", flexDirection: "column", maxHeight: "90vh" }}>
                      
                      <div style={{ background: "#f8f9fa", padding: "16px 24px", borderBottom: "1px solid #dadce0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <button onClick={() => {
                              const nextOffset = dayOffset + 1;
                              setDayOffset(nextOffset);
                              const requiredWeek = Math.floor(nextOffset / 7);
                              if (requiredWeek > maxLoadedWeek && !loadingWeekly) {
                                  fetchLedgerChunk(maxLoadedWeek + 1, requiredWeek + 5);
                              }
                          }} disabled={loadingWeekly} style={{ background: "none", border: "none", fontSize: "18px", cursor: loadingWeekly ? "wait" : "pointer", color: loadingWeekly ? "#dadce0" : "#5f6368" }}>◀</button>
                          
                          <div style={{ textAlign: "center" }}>
                              <div style={{ fontWeight: "bold", color: "#1f1f1f", fontSize: "16px" }}>
                                  {dayOffset === 0 ? "Today" : dayOffset === 1 ? "Yesterday" : `${dayOffset} Days Ago`}
                              </div>
                              <div style={{ fontSize: "12px", color: "#5f6368", marginTop: "4px" }}>
                                  {(() => {
                                      const { start } = getDayBoundaries(dayOffset);
                                      return start.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
                                  })()}
                              </div>
                          </div>

                          <button onClick={() => setDayOffset(Math.max(0, dayOffset - 1))} disabled={dayOffset === 0 || loadingWeekly} style={{ background: "none", border: "none", fontSize: "18px", cursor: (dayOffset === 0 || loadingWeekly) ? "default" : "pointer", color: (dayOffset === 0 || loadingWeekly) ? "#dadce0" : "#5f6368" }}>▶</button>
                      </div>

                      <div style={{ padding: "36px 24px", textAlign: "center", overflowY: "auto" }}>
                          {loadingWeekly ? (
                               <div style={{ color: "#5f6368", fontSize: "14px", padding: "40px 0" }}>Fetching historical ledger data...</div>
                          ) : (
                               (() => {
                                   const { start, end } = getDayBoundaries(dayOffset);
                                   const userHistory = weeklyStats[selectedUser] || [];
                                   
                                   let dayCases = 0; let dayActive = 0; let dayIdle = 0;
                                   userHistory.forEach(record => {
                                       const rDate = new Date(record.date);
                                       if (rDate >= start && rDate <= end) {
                                           dayCases += record.cases;
                                           dayActive += record.activeMins;
                                           dayIdle += record.idleMins;
                                       }
                                   });

                                   const avgActive = dayCases > 0 ? dayActive / dayCases : 0;
                                   const avgIdle = dayCases > 0 ? dayIdle / dayCases : 0;

                                   const centralPercentRaw = dayIdle > 0 ? (dayActive / dayIdle) * 100 : (dayActive > 0 ? 100 : 0);
                                   const centralPercentText = `${centralPercentRaw.toFixed(0)}%`;

                                   const circumf = 477.5; 
                                   const visualFillPercent = Math.min(centralPercentRaw, 100); 
                                   const visibleLenRaw = (visualFillPercent / 100) * circumf;
                                   const dasharray = `${Number(visibleLenRaw.toFixed(1))} ${circumf}`;

                                   return (
                                      <>
                                          <div style={{ fontSize: "15px", color: "#3c4043", marginBottom: "0" }}>
                                              Cases Completed: <strong>{dayCases}</strong>
                                          </div>

                                          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', margin: '40px 0', position: 'relative' }}>
                                              <svg width="180" height="180" viewBox="0 0 180 180" style={{ transform: 'rotate(-90deg)' }}>
                                                  <circle cx="90" cy="90" r="76" fill="none" stroke="#34A853" strokeWidth="14" strokeOpacity="1" />
                                                  <circle cx="90" cy="90" r="76" fill="none" stroke="#ea4335" strokeWidth="14" strokeDasharray={dasharray} strokeLinecap="round" />
                                              </svg>
                                              
                                              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', pointerEvents: 'none', width: '120px' }}>
                                                  <div style={{ fontSize: '10px', color: '#5f6368', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 'bold', marginBottom: '4px', lineHeight: '1.4' }}>
                                                      Active to<br/>Idle Ratio
                                                  </div>
                                                  <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#1f1f1f', marginTop: '0' }}>
                                                     {centralPercentText}
                                                  </div>
                                              </div>
                                          </div>

                                          <div style={{ display: "flex", justifyContent: "space-around" }}>
                                             <div>
                                                <div style={{ fontSize: "11px", color: "#5f6368", textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: "bold" }}>Daily Avg Active / Case</div>
                                                <div style={{ fontSize: "18px", fontWeight: "bold", color: "#0b57d0", marginTop: "6px" }}>
                                                   {avgActive > 0 ? `${Math.floor(avgActive / 60)}h ${Math.floor(avgActive % 60)}m` : "0h 0m"}
                                                </div>
                                             </div>
                                             <div>
                                                <div style={{ fontSize: "11px", color: "#5f6368", textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: "bold" }}>Daily Avg Idle / Case</div>
                                                <div style={{ fontSize: "18px", fontWeight: "bold", color: "#ea4335", marginTop: "6px" }}>
                                                   {avgIdle > 0 ? `${Math.floor(avgIdle / 60)}h ${Math.floor(avgIdle % 60)}m` : "0h 0m"}
                                                </div>
                                             </div>
                                          </div>
                                      </>
                                   );
                               })()
                          )}
                      </div>

                      <div style={{ padding: "16px 24px", background: "#f8f9fa", borderTop: "1px solid #dadce0", textAlign: "right" }}>
                          <button onClick={() => { setIsDailyModalOpen(false); setDayOffset(0); }} style={{ padding: "8px 20px", background: "#1a73e8", color: "#fff", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold", fontSize: "13px" }}>
                              Close Analytics
                          </button>
                      </div>
                  </div>
              </div>
          )}
          {/* --- END DAILY MODAL --- */}

      {/* --- THE FLOATING WEEKLY MODAL --- */}
          {isModalOpen && (
              <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.2)", zIndex: 999, display: "flex", justifyContent: "center", alignItems: "center" }}>
                  <div style={{ width: "90%", maxWidth: "650px", background: "#fff", borderRadius: "12px", boxShadow: "0 8px 32px rgba(0,0,0,0.15)", border: "1px solid #dadce0", overflow: "hidden", display: "flex", flexDirection: "column", maxHeight: "90vh" }}>
                      
                      {/* Modal Header & Navigation */}
                      <div style={{ background: "#f8f9fa", padding: "16px 24px", borderBottom: "1px solid #dadce0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <button onClick={() => {
                              const nextOffset = weekOffset + 1;
                              setWeekOffset(nextOffset);
                              if (nextOffset > maxLoadedWeek && !loadingWeekly) {
                                  fetchLedgerChunk(maxLoadedWeek + 1, maxLoadedWeek + 6);
                              }
                          }} disabled={loadingWeekly} style={{ background: "none", border: "none", fontSize: "18px", cursor: loadingWeekly ? "wait" : "pointer", color: loadingWeekly ? "#dadce0" : "#5f6368" }}>◀</button>
                          
                          <div style={{ textAlign: "center" }}>
                              <div style={{ fontWeight: "bold", color: "#1f1f1f", fontSize: "16px" }}>
                                  {weekOffset === 0 ? "Current Week" : `${weekOffset} Week${weekOffset > 1 ? 's' : ''} Ago`}
                              </div>
                              <div style={{ fontSize: "12px", color: "#5f6368", marginTop: "4px" }}>
                                  {(() => {
                                      const { start, end } = getWeekBoundaries(weekOffset);
                                      const format = (d) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
                                      return `${format(start)} — ${format(end)}`;
                                  })()}
                              </div>
                          </div>

                          <button onClick={() => setWeekOffset(Math.max(0, weekOffset - 1))} disabled={weekOffset === 0 || loadingWeekly} style={{ background: "none", border: "none", fontSize: "18px", cursor: (weekOffset === 0 || loadingWeekly) ? "default" : "pointer", color: (weekOffset === 0 || loadingWeekly) ? "#dadce0" : "#5f6368" }}>▶</button>
                      </div>

                      {/* Modal Content / Calculations */}
                      <div style={{ padding: "36px 24px", textAlign: "center", overflowY: "auto" }}>
                          {loadingWeekly ? (
                               <div style={{ color: "#5f6368", fontSize: "14px", padding: "40px 0" }}>Fetching historical ledger data...</div>
                          ) : (
                               (() => {
                                   const { start, end } = getWeekBoundaries(weekOffset);
                                   const userHistory = weeklyStats[selectedUser] || [];
                                   
                                   let weekCases = 0; let weekActive = 0; let weekIdle = 0;
                                   userHistory.forEach(record => {
                                       const rDate = new Date(record.date);
                                       if (rDate >= start && rDate <= end) {
                                           weekCases += record.cases;
                                           weekActive += record.activeMins;
                                           weekIdle += record.idleMins;
                                       }
                                   });

                                   const avgActive = weekCases > 0 ? weekActive / weekCases : 0;
                                   const avgIdle = weekCases > 0 ? weekIdle / weekCases : 0;

                                   // --- CIRCULAR GRAPHIC CALCULATIONS ---
                                   const centralPercentRaw = weekIdle > 0 ? (weekActive / weekIdle) * 100 : (weekActive > 0 ? 100 : 0);
                                   const centralPercentText = `${centralPercentRaw.toFixed(0)}%`;

                                   // Ring Math: Increased to 180x180 (radius=76), circumf ~477.5
                                   const circumf = 477.5; 
                                   const visualFillPercent = Math.min(centralPercentRaw, 100); // Caps visual ring at 100% full
                                   const visibleLenRaw = (visualFillPercent / 100) * circumf;
                                   const dasharray = `${Number(visibleLenRaw.toFixed(1))} ${circumf}`;

                                   return (
                                      <>
                                          <div style={{ fontSize: "15px", color: "#3c4043", marginBottom: "0" }}>
                                              Cases Completed: <strong>{weekCases}</strong>
                                          </div>

                                          {/* --- LARGER CIRCULAR GRAPHIC SECTION --- */}
                                          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', margin: '40px 0', position: 'relative' }}>
                                              
                                              {/* Scaled Up SVG Element */}
                                              <svg width="180" height="180" viewBox="0 0 180 180" style={{ transform: 'rotate(-90deg)' }}>
                                                  <circle cx="90" cy="90" r="76" fill="none" stroke="#34A853" strokeWidth="14" strokeOpacity="1" />
                                                  <circle cx="90" cy="90" r="76" fill="none" stroke="#ea4335" strokeWidth="14" strokeDasharray={dasharray} strokeLinecap="round" />
                                              </svg>
                                              
                                              {/* Centered Text - Stacked to fit beautifully */}
                                              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', pointerEvents: 'none', width: '120px' }}>
                                                  <div style={{ fontSize: '10px', color: '#5f6368', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 'bold', marginBottom: '4px', lineHeight: '1.4' }}>
                                                      Active to<br/>Idle Ratio
                                                  </div>
                                                  <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#1f1f1f', marginTop: '0' }}>
                                                     {centralPercentText}
                                                  </div>
                                              </div>
                                          </div>

                                          <div style={{ display: "flex", justifyContent: "space-around" }}>
                                             <div>
                                                <div style={{ fontSize: "11px", color: "#5f6368", textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: "bold" }}>Standard Avg Active / Case</div>
                                                <div style={{ fontSize: "18px", fontWeight: "bold", color: "#0b57d0", marginTop: "6px" }}>
                                                   {avgActive > 0 ? `${Math.floor(avgActive / 60)}h ${Math.floor(avgActive % 60)}m` : "0h 0m"}
                                                </div>
                                             </div>
                                             <div>
                                                <div style={{ fontSize: "11px", color: "#5f6368", textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: "bold" }}>Standard Avg Idle / Case</div>
                                                <div style={{ fontSize: "18px", fontWeight: "bold", color: "#ea4335", marginTop: "6px" }}>
                                                   {avgIdle > 0 ? `${Math.floor(avgIdle / 60)}h ${Math.floor(avgIdle % 60)}m` : "0h 0m"}
                                                </div>
                                             </div>
                                          </div>
                                      </>
                                   );
                               })()
                          )}
                      </div>

                      {/* Modal Footer / Close */}
                      <div style={{ padding: "16px 24px", background: "#f8f9fa", borderTop: "1px solid #dadce0", textAlign: "right" }}>
                          <button onClick={() => { setIsModalOpen(false); setWeekOffset(0); }} style={{ padding: "8px 20px", background: "#1a73e8", color: "#fff", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold", fontSize: "13px" }}>
                              Close Analytics
                          </button>
                      </div>
                  </div>
              </div>
          )}
          {/* --- END MODAL --- */}
    </div>
  );
});

export default ProductivityDashboard;