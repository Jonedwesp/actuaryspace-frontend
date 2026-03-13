import React, { useState, useEffect } from "react";
import { avatarFor } from "../utils/avatarUtils.js";
import { getLabelStyle, getCFColorClass } from "../utils/trelloUtils.js";

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
  
  const [isMonthOpen, setIsMonthOpen] = useState(false); // 🌟 NEW: Monthly State
  const [monthOffset, setMonthOffset] = useState(0);     // 🌟 NEW: Monthly State

  const [isCardsOpen, setIsCardsOpen] = useState(false); // Default to closed
  
  // 🌟 NEW: Force all accordions to close and reset offsets when switching users
  useEffect(() => {
      if (selectedUser) {
          setIsCardsOpen(false);
          setIsDailyModalOpen(false);
          setIsModalOpen(false);
          setIsMonthOpen(false);
          setDayOffset(0);
          setWeekOffset(0);
          setMonthOffset(0);
      }
  }, [selectedUser]);
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

  const getMonthBoundaries = (offset) => {
      const date = new Date();
      date.setMonth(date.getMonth() - offset);
      const start = new Date(date.getFullYear(), date.getMonth(), 1);
      const end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
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
          
          // 🌟 NEW: Safety shield! Only process the data if the backend responded successfully
          if (res.ok && !newData.error) {
              setWeeklyStats(prev => {
                  const merged = { ...prev };
                  Object.keys(newData).forEach(user => {
                      if (!merged[user]) merged[user] = [];
                      // Double check that the data is actually an array before trying to spread it
                      if (Array.isArray(newData[user])) {
                          merged[user] = [...merged[user], ...newData[user]];
                      }
                  });
                  return merged;
              });
              setMaxLoadedWeek(endWeek);
          } else {
              console.error("Backend Ledger Error:", newData);
          }
      } catch (e) {
          console.error("Failed to fetch chunk or parse JSON:", e);
      }
      setLoadingWeekly(false);
  };

  // 🌟 NEW: Auto-fetch the ledger in the background so the ETA is instantly ready
  useEffect(() => {
      let timer;
      if (maxLoadedWeek < 0 && !loadingWeekly) {
          // Delay the heavy 6-week fetch by 2 seconds to avoid an API traffic jam with the live dashboard load
          timer = setTimeout(() => {
              fetchLedgerChunk(0, 5);
          }, 2000);
      }
      return () => clearTimeout(timer);
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

  // --- 🌟 NEW: GLOBAL ETA CALCULATION (Past 30 Days + LIVE Today) ---
  const globalETAs = React.useMemo(() => {
      if (maxLoadedWeek < 0) return { loe: "Calculating...", los: "Calculating..." };

      let loeCases = 0; let loeActive = 0;
      let losCases = 0; let losActive = 0;

      // 1. Establish the 30-Day Window (Including Today)
      const now = new Date();
      const endOfToday = new Date(now);
      endOfToday.setHours(23, 59, 59, 999);

      const thirtyDaysAgo = new Date(now);
      thirtyDaysAgo.setHours(0, 0, 0, 0);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // 2. Parse the Historical Ledger (Past 30 Days up to yesterday)
      Object.values(weeklyStats).forEach(userHistory => {
          userHistory.forEach(record => {
              const rDate = new Date(record.date);
              
              if (rDate >= thirtyDaysAgo && rDate <= endOfToday) {
                  const caseType = (record.caseType || "").toLowerCase();
                  
                  if (caseType.includes("loe")) {
                      loeCases++; 
                      loeActive += record.activeMins; 
                  } else if (caseType.includes("los")) {
                      losCases++; 
                      losActive += record.activeMins; 
                  }
              }
          });
      });

      // 3. Add Today's Live Completed Cases in Real-Time!
      TARGET_USERS.forEach(userName => {
          const completedToday = dailySentStats[`${userName}_completed_objects`] || [];
          const bucketKey = userName === "Siya - Review" ? "SRV" : userName.substring(0, 3).toUpperCase();
          
          completedToday.forEach(c => {
              // Extract Case Type safely
              const validLabels = (c.labels || [])
                  .map(l => typeof l === 'string' ? l : l?.name)
                  .filter(name => name && name.toLowerCase() !== "ryangpt");
              const caseTypeStr = validLabels.join(" ").toLowerCase();
              
              // Extract Active Time using the same safe logic as the table
              let activeMins = 0;
              try {
                  const workField = c.customFields?.WorkLog || c.customFields?.['[SYSTEM]WorkLog'];
                  const rawWork = typeof workField === 'string'
                      ? workField
                      : JSON.stringify(workField || "{}");

                  let savedDurations = JSON.parse(rawWork);
                  const durFromName = parseFloat(savedDurations[userName] || "0");
                  const durFromKey = parseFloat(savedDurations[bucketKey] || "0");
                  activeMins += (durFromName > 0 ? durFromName : durFromKey) || 0;

                  // Add any lingering ticking time
                  const rawStart = c.customFields?.WorkTimerStart || c.customFields?.['[SYSTEM]WorkTimerStart'] || "";
                  if (rawStart) {
                     const [startTsStr, startList] = rawStart.split("|");
                     const startTs = parseFloat(startTsStr);
                     if (startTs > 1000000000000 && (startList === userName || startList.substring(0, 3).toUpperCase() === bucketKey)) {
                         activeMins += Math.max(0, Date.now() - startTs) / 1000 / 60;
                     }
                  }
              } catch(e) {}

              // Add live math to the Global totals
              if (caseTypeStr.includes("loe")) {
                  loeCases++;
                  loeActive += activeMins;
              } else if (caseTypeStr.includes("los")) {
                  losCases++;
                  losActive += activeMins;
              }
          });
      });

      const formatETA = (activeMins, cases) => {
          if (cases === 0) return "0h 0m";
          const avg = activeMins / cases;
          return `${Math.floor(avg / 60)}h ${Math.floor(avg % 60)}m`;
      };

      return {
          loe: formatETA(loeActive, loeCases),
          los: formatETA(losActive, losCases)
      };
  }, [weeklyStats, maxLoadedWeek, dailySentStats]); // <-- Added live stats as a dependency
  // ----------------------------------------------------------------

  // --- 🌟 NEW: SAST BUSINESS HOURS CALCULATOR (8am - 5pm) ---
  const getBusinessMinutes = (startTs, endTs) => {
      if (!startTs || !endTs || startTs >= endTs) return 0;
      let totalMins = 0;
      let current = new Date(startTs);
      let safetyCap = 0;
      
      while (current.getTime() < endTs && safetyCap < 1000) {
          safetyCap++;
          const formatter = new Intl.DateTimeFormat('en-US', { timeZone: 'Africa/Johannesburg', year: 'numeric', month: '2-digit', day: '2-digit' });
          const [month, day, year] = formatter.format(current).split('/');
          
          const dayStart = new Date(`${year}-${month}-${day}T08:00:00+02:00`).getTime();
          const dayEnd = new Date(`${year}-${month}-${day}T17:00:00+02:00`).getTime();

          const overlapStart = Math.max(current.getTime(), dayStart);
          const overlapEnd = Math.min(endTs, dayEnd);

          if (overlapEnd > overlapStart) {
              totalMins += (overlapEnd - overlapStart) / 60000;
          }

          current = new Date(dayStart + 24 * 60 * 60 * 1000);
      }
      return totalMins;
  };
  // ----------------------------------------------------------

  const getUserMetrics = (userName) => {
    const userList = trelloBuckets.find(b => b.title.toLowerCase() === userName.toLowerCase()) || { cards: [] };

    const activeCards = userList.cards.filter(c => 
      !c.title.toLowerCase().includes("out of office") && 
      !c.title.toLowerCase().includes("away from cases")
    );

    // Grab the specific cards this user pushed forward today from the backend
    const completedTodayIds = dailySentStats[`${userName}_cards`] || []; 
    const completedTodayObjects = dailySentStats[`${userName}_completed_objects`] || []; 
    const bucketKey = userName === "Siya - Review" ? "SRV" : userName.substring(0, 3).toUpperCase();

    // Step A: Get all cards currently visible in the active buckets
    const localAssignedCards = trelloBuckets.flatMap(b => b.cards).filter(c => {
      // Safety Check: Never show admin/away cards in the workspace table
      if (c.title.toLowerCase().includes("out of office") || c.title.toLowerCase().includes("away from cases")) return false;

      // Condition 1: Is the card physically in this user's list right now?
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

    // Step B: Stitch the missing backend cards into the list so they render at the bottom!
    const localIds = new Set(localAssignedCards.map(c => c.id));
    const missingCompletedCards = completedTodayObjects.filter(c => !localIds.has(c.id));
    const allAssignedCards = [...localAssignedCards, ...missingCompletedCards];

    // --- SMART SORTING LOGIC (Status + Due Date) ---
    const sortedAssignedCards = [...allAssignedCards].sort((a, b) => {
        const aCompleted = completedTodayIds.includes(a.id);
        const bCompleted = completedTodayIds.includes(b.id);
        
        // 1. Primary Sort: Active cards stay on top, Completed drop to bottom
        if (aCompleted !== bCompleted) {
            return aCompleted ? 1 : -1;
        }
        
        // 2. Secondary Sort: Closest Due Date first (within their respective group)
        const parseDate = (title) => {
            const match = (title || "").match(/\(Due\s+([^)]+)\)/i);
            if (!match) return Infinity; 
            
            const ts = Date.parse(`${match[1].trim()} ${new Date().getFullYear()}`);
            return isNaN(ts) ? Infinity : ts;
        };

        const aTime = parseDate(a.title);
        const bTime = parseDate(b.title);
        
        if (aTime === bTime) return 0;
        return aTime - bTime;
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

    // 3. Time Logged (Used ONLY for the main dashboard grid)
    const calculateArrivalTime = () => {
      if (activeCards.length > 0) {
         const topCard = activeCards[0];
         try {
             const durObj = JSON.parse(topCard.customFields?.IdleLog || "{}");
             if (durObj._topReachedAt && durObj._topUser === userName) {
                 const date = new Date(durObj._topReachedAt);
                 return date.toLocaleTimeString('en-ZA', { timeZone: 'Africa/Johannesburg', hour: '2-digit', minute: '2-digit', hour12: false });
             }
         } catch(e) {}
      }
      return "-"; 
    };

    const calculateActiveTimer = () => {
      let totalMinutes = 0;
      const now = Date.now();

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

      const isAway = status === "🔴";
      return { 
        // ETAs are now Global, so they always show regardless of 'isAway'
        etaLOE: globalETAs.loe, 
        etaLOS: globalETAs.los, 
        status, 
        currentTask, 
        reviewCount, 
        cardCount: activeCards.length, // <-- Always show the count (will naturally show 0 if empty)
        timeLogged: isAway ? "-" : calculateArrivalTime(), 
        activeTimer: isAway ? "-" : calculateActiveTimer(), 
        allUserCards: sortedAssignedCards, 
        completedTodayIds 
      };
  };
  const metrics = selectedUser ? getUserMetrics(selectedUser) : null;
  const allUserCards = metrics?.allUserCards || [];

  return (
    <div className="prod-dashboard">
      <div className={`prod-content ${prodAnimClass}`} style={{ width: "100%" }}>
      {selectedUser ? (
        <div className="prod-detail" style={{ height: "calc(100% - 32px)", marginBottom: "32px", boxSizing: "border-box" }}>
          {/* 🌟 PAGE ILLUSION FIX: Forces the white page to stop 32px before the screen ends, revealing the bottom corners! */}
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
                <span className="prod-metric-label">Output Today</span>
                <span className="prod-metric-value highlight" style={{ color: "#1f1f1f" }}>{metrics.reviewCount} Cases</span>
              </div>
              <div className="prod-metric">
                <span className="prod-metric-label" style={{ display: "flex", alignItems: "center" }}>
                  ETA: LOE
                  <span className="info-tooltip pull-left" data-tip="Estimated time to complete the LOE case.">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9aa0a6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                  </span>
                </span>
                <span className="prod-metric-value highlight" style={{ color: "#1f1f1f" }}>{metrics.etaLOE}</span>
              </div>
              <div className="prod-metric">
                <span className="prod-metric-label" style={{ display: "flex", alignItems: "center" }}>
                  ETA: LOS
                  <span className="info-tooltip pull-left" data-tip="Estimated time to complete the LOS case.">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9aa0a6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                  </span>
                </span>
                <span className="prod-metric-value highlight" style={{ color: "#1f1f1f" }}>{metrics.etaLOS}</span>
              </div>
            </div>
          </div>

         <div style={{ display: "flex", flexDirection: "column", gap: "16px", overflowY: "auto", flex: 1, paddingRight: "8px", paddingBottom: "24px" }}>
            
            {/* ========================================== */}
            {/* 1. CARD ACTIVITY ACCORDION */}
            {/* ========================================== */}
            <div>
              <div 
                onClick={() => setIsCardsOpen(!isCardsOpen)}
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#f8f9fa", padding: "14px 16px", borderRadius: "8px", cursor: "pointer", border: "1px solid #dadce0" }}
              >
                <h3 style={{ margin: 0, fontSize: "16px", color: "#3c4043", display: "flex", alignItems: "center", gap: "8px" }}>
                  Card Activity
                </h3>
                <svg style={{ transform: isCardsOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#5f6368" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
              </div>
              
              {isCardsOpen && (
                <div style={{ marginTop: "8px", border: "1px solid #dadce0", borderRadius: "8px", overflow: "hidden" }}>
                  <table className="prod-table" style={{ margin: 0, borderBottom: "none" }}>
                    <thead>
                      <tr>
                        <th style={{ width: "35%" }}>Card Name</th>
                        <th>Case Type</th>
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
                          let totalActiveMins = 0; let totalIdleMins = 0;
                          const bucketKey = selectedUser === "Siya - Review" ? "SRV" : selectedUser.substring(0, 3).toUpperCase();
                          
                          const rows = allUserCards.map(c => {
                              const isCompleted = metrics.completedTodayIds?.includes(c.id);

                              let rawIdleMins = 0;
                              try {
                                  const idleField = c.customFields?.IdleLog || c.customFields?.['[SYSTEM]IdleLog'];
                                  const rawIdle = typeof idleField === 'string' ? idleField : JSON.stringify(idleField || "{}");
                                  const durObj = JSON.parse(rawIdle);
                                  rawIdleMins += parseFloat(durObj[`${selectedUser}_idle`] || 0);
                                  if (!isCompleted && durObj._topReachedAt && durObj._topUser === selectedUser) {
                                      rawIdleMins += getBusinessMinutes(durObj._topReachedAt, Date.now());
                                  }
                              } catch(e) {}

                              let activeMins = 0;
                              try {
                                  const workField = c.customFields?.WorkLog || c.customFields?.['[SYSTEM]WorkLog'];
                                  const rawWork = typeof workField === 'string' ? workField : JSON.stringify(workField || "{}");
                                  let savedDurations = JSON.parse(rawWork);
                                  const durFromName = parseFloat(savedDurations[selectedUser] || "0");
                                  const durFromKey = parseFloat(savedDurations[bucketKey] || "0");
                                  activeMins += (durFromName > 0 ? durFromName : durFromKey) || 0;

                                  const rawStart = c.customFields?.WorkTimerStart || c.customFields?.['[SYSTEM]WorkTimerStart'] || "";
                                  if (!isCompleted && rawStart) {
                                     const [startTsStr, startList] = rawStart.split("|");
                                     const startTs = parseFloat(startTsStr);
                                     if (startTs > 1000000000000 && (startList === selectedUser || startList.substring(0, 3).toUpperCase() === bucketKey)) {
                                         activeMins += Math.max(0, Date.now() - startTs) / 1000 / 60;
                                     }
                                  }
                              } catch(e) {}
                              
                              let idleMins = Math.max(0, rawIdleMins - activeMins);
                              totalIdleMins += idleMins; totalActiveMins += activeMins;

                              const formattedIdle = idleMins > 0 ? `${Math.floor(idleMins / 60)}h ${Math.floor(idleMins % 60)}m` : "0m";
                              const formattedActive = activeMins > 0 ? `${Math.floor(activeMins / 60)}h ${Math.floor(activeMins % 60)}m` : "0m";

                              return (
                                <tr key={c.id} style={{ cursor: "pointer", borderBottom: "1px solid #f1f3f4", backgroundColor: isCompleted ? "#f8f9fa" : "transparent" }} onClick={() => {
                                    
                                    // 🌟 BULLETPROOF WRAPPER: We pad every single property the Trello modal might try to read
                                    const safeCard = { 
                                        ...c, 
                                        id: c.id || `rescued-${Date.now()}`,
                                        title: c.title || c.name || "Unknown Case",
                                        name: c.name || c.title || "Unknown Case", 
                                        description: c.description || c.desc || "This case was rescued from the backend ledger. Description not available.",
                                        desc: c.desc || c.description || "This case was rescued from the backend ledger. Description not available.", 
                                        url: c.url || `https://trello.com/c/${c.id}`, 
                                        listId: c.listId || c.idList || "",
                                        boardList: c.boardList || c.list || "Completed",
                                        // 🌟 FIX: Force labels and members into pure strings so TrelloApp doesn't crash on objects
                                        labels: Array.isArray(c.labels) ? c.labels.map(l => typeof l === 'string' ? l : l?.name).filter(Boolean) : [], 
                                        idMembers: Array.isArray(c.idMembers) ? c.idMembers : [], 
                                        members: Array.isArray(c.members) ? c.members.map(m => typeof m === 'string' ? m : m?.fullName || m?.name || m?.id).filter(Boolean) : [], 
                                        customFieldItems: Array.isArray(c.customFieldItems) ? c.customFieldItems : [], 
                                        customFields: typeof c.customFields === 'object' && c.customFields !== null ? c.customFields : {},
                                        badges: Array.isArray(c.badges) ? c.badges : [],
                                        checklists: Array.isArray(c.checklists) ? c.checklists : [],
                                        cover: c.cover || { color: null },
                                        isArchived: c.isArchived || false,
                                        fromProductivity: selectedUser 
                                    };
                                    
                                    window.dispatchEvent(new CustomEvent("openTrelloCard", { detail: safeCard }));
                                }}>
                                  <td style={{ fontWeight: 500, color: isCompleted ? "#5f6368" : "inherit" }}>
                                      {isCompleted && (
                                          <span style={{ marginRight: "8px", display: "inline-flex", verticalAlign: "middle" }} title="Completed Today">
                                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#34A853" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                          </span>
                                      )}
                                      <span style={{ textDecoration: isCompleted ? "line-through" : "none", verticalAlign: "middle" }}>{c.title || c.name}</span>
                                  </td>
                                  <td>
                                      {/* 🌟 NEW: Renders colored label pills exactly like Trello */}
                                      <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", maxWidth: "160px" }}>
                                          {(() => {
                                              const validLabels = (c.labels || []).map(l => typeof l === 'string' ? l : l?.name).filter(name => name && name.toLowerCase() !== "ryangpt");
                                              if (validLabels.length === 0) return <span style={{ color: "#9aa0a6" }}>-</span>;
                                              
                                              return validLabels.map((l, idx) => {
                                                  // Hook directly into your TrelloApp's label color logic
                                                  const style = typeof getLabelStyle === 'function' ? getLabelStyle(l) : { backgroundColor: "#091e420f", color: "#172b4d" };
                                                  return (
                                                      <span key={idx} style={{ ...style, padding: "2px 6px", borderRadius: "3px", fontSize: "11px", fontWeight: 700, display: "inline-block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "130px" }}>
                                                          {l}
                                                      </span>
                                                  );
                                              });
                                          })()}
                                      </div>
                                  </td>
                                  
                                  <td style={{ color: "#5f6368", fontWeight: 500 }}>{extractDueDate(c.title || c.name)}</td>
                                  
                                  <td>
                                      {/* 🌟 NEW: Renders ONLY the Status Pill without the prefix */}
                                      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                                          {(() => {
                                              // 🛡️ Ensure we catch the [SYSTEM] properties for completed cases!
                                              const statusVal = c.customFields?.Status || c.customFields?.['[SYSTEM]Status'];
                                              
                                              if (!statusVal) return <span style={{ color: "#9aa0a6" }}>-</span>;

                                              const colorClass = typeof getCFColorClass === 'function' ? getCFColorClass(statusVal) : "";
                                              
                                              // These colors flawlessly mirror your right-hand Trello panel
                                              let bg = "#091e420f"; let color = "#42526e"; 
                                              const valLower = String(statusVal).toLowerCase();
                                              
                                              if (valLower.includes("working")) { bg = "#e3fcef"; color = "#006644"; } // Green
                                              else if (valLower.includes("to do") || valLower.includes("waiting")) { bg = "#fffae6"; color = "#bf7300"; } // Orange/Yellow
                                              else if (valLower.includes("review")) { bg = "#deebff"; color = "#0052cc"; } // Blue
                                              else if (valLower.includes("urgent")) { bg = "#eae6ff"; color = "#403294"; } // Purple
                                              else if (valLower.includes("pause") || valLower.includes("blocked")) { bg = "#ffebe6"; color = "#bf2600"; } // Red

                                              return (
                                                  <span className={colorClass} style={{ background: bg, color: color, padding: "2px 6px", borderRadius: "3px", fontSize: "11px", fontWeight: 700, whiteSpace: "nowrap", display: "inline-block", width: "fit-content" }}>
                                                      {statusVal}
                                                  </span>
                                              );
                                          })()}
                                      </div>
                                  </td>
                                  <td style={{ fontWeight: "bold", color: idleMins > 0 ? "#1f1f1f" : "#97a0af" }}>{formattedIdle}</td>
                                  <td style={{ fontWeight: "bold", color: activeMins > 0 ? "#1f1f1f" : "#97a0af" }}>{formattedActive}</td>
                                </tr>
                              );
                          });

                          return (
                            <>
                              {rows}
                              <tr style={{ background: "#f8f9fa", borderTop: "2px solid #dadce0" }}>
                                <td colSpan="4" style={{ textAlign: "right", fontWeight: "bold", color: "#3c4043", padding: "12px" }}>Totals:</td>
                                <td style={{ fontWeight: "bold", color: "#1f1f1f", padding: "12px" }}>
                                    {totalIdleMins > 0 ? `${Math.floor(totalIdleMins / 60)}h ${Math.floor(totalIdleMins % 60)}m` : "0h 0m"}
                                </td>
                                <td style={{ fontWeight: "bold", color: "#1f1f1f", padding: "12px" }}>
                                    {totalActiveMins > 0 ? `${Math.floor(totalActiveMins / 60)}h ${Math.floor(totalActiveMins % 60)}m` : "0h 0m"}
                                </td>
                              </tr>
                            </>
                          );
                        })()
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

           {/* ========================================== */}
            {/* 2. DAILY ANALYTICS ACCORDION */}
            {/* ========================================== */}
            <div>
              <div 
                onClick={() => { 
                    if (isDailyModalOpen) {
                        setIsDailyModalOpen(false);
                        setDayOffset(0); // Reset to today when closed
                    } else {
                        setIsDailyModalOpen(true);
                        if (maxLoadedWeek < 0 && !loadingWeekly) fetchLedgerChunk(0, 5); 
                    }
                }}
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#f8f9fa", padding: "14px 16px", borderRadius: "8px", cursor: "pointer", border: "1px solid #dadce0" }}
              >
                <h3 style={{ margin: 0, fontSize: "16px", color: "#3c4043", display: "flex", alignItems: "center", gap: "8px" }}>Daily Analytics</h3>
                <svg style={{ transform: isDailyModalOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#5f6368" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
              </div>

              {isDailyModalOpen && (
                <div style={{ marginTop: "8px", border: "1px solid #dadce0", borderRadius: "8px", background: "#fff", overflow: "hidden" }}>
                  <div style={{ padding: "16px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px dashed #dadce0", marginBottom: "24px" }}>
                      <button onClick={() => { const nextOffset = dayOffset + 1; setDayOffset(nextOffset); const requiredWeek = Math.floor(nextOffset / 7); if (requiredWeek > maxLoadedWeek && !loadingWeekly) fetchLedgerChunk(maxLoadedWeek + 1, requiredWeek + 5); }} disabled={loadingWeekly} style={{ background: "none", border: "none", fontSize: "18px", cursor: loadingWeekly ? "wait" : "pointer", color: loadingWeekly ? "#dadce0" : "#5f6368" }}>◀</button>
                      <div style={{ textAlign: "center" }}>
                          <div style={{ fontWeight: "bold", color: "#1f1f1f", fontSize: "16px" }}>
                              {(() => { const { start } = getDayBoundaries(dayOffset); return start.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }); })()}
                          </div>
                      </div>
                      <button onClick={() => setDayOffset(Math.max(0, dayOffset - 1))} disabled={dayOffset === 0 || loadingWeekly} style={{ background: "none", border: "none", fontSize: "18px", cursor: (dayOffset === 0 || loadingWeekly) ? "default" : "pointer", color: (dayOffset === 0 || loadingWeekly) ? "#dadce0" : "#5f6368" }}>▶</button>
                  </div>
                  
                  <div style={{ padding: "0 24px 24px 24px" }}>
                      {loadingWeekly ? (
                           <div style={{ color: "#5f6368", fontSize: "14px", padding: "40px 0", textAlign: "center" }}>Fetching historical ledger data...</div>
                      ) : (
                           (() => {
                               const { start, end } = getDayBoundaries(dayOffset);
                               const userHistory = weeklyStats[selectedUser] || [];
                               const dayCasesData = userHistory.filter(r => { const d = new Date(r.date); return d >= start && d <= end; }).map(r => ({ name: r.caseName || "Unknown", active: r.activeMins, idle: r.idleMins }));

                               // 🌟 NEW: If looking at "Today", merge in the real-time live completed cases!
                               if (dayOffset === 0) {
                                   const completedToday = dailySentStats[`${selectedUser}_completed_objects`] || [];
                                   const bucketKey = selectedUser === "Siya - Review" ? "SRV" : selectedUser.substring(0, 3).toUpperCase();
                                   
                                   completedToday.forEach(c => {
                                       let activeMins = 0; let rawIdleMins = 0;
                                       try {
                                           const workField = c.customFields?.WorkLog || c.customFields?.['[SYSTEM]WorkLog'];
                                           const rawWork = typeof workField === 'string' ? workField : JSON.stringify(workField || "{}");
                                           let savedDurations = JSON.parse(rawWork);
                                           const durFromName = parseFloat(savedDurations[selectedUser] || "0");
                                           const durFromKey = parseFloat(savedDurations[bucketKey] || "0");
                                           activeMins += (durFromName > 0 ? durFromName : durFromKey) || 0;

                                           const rawStart = c.customFields?.WorkTimerStart || c.customFields?.['[SYSTEM]WorkTimerStart'] || "";
                                           if (rawStart) {
                                              const [startTsStr, startList] = rawStart.split("|");
                                              const startTs = parseFloat(startTsStr);
                                              if (startTs > 1000000000000 && (startList === selectedUser || startList.substring(0, 3).toUpperCase() === bucketKey)) {
                                                  activeMins += Math.max(0, Date.now() - startTs) / 1000 / 60;
                                              }
                                           }

                                           const idleField = c.customFields?.IdleLog || c.customFields?.['[SYSTEM]IdleLog'];
                                           const rawIdle = typeof idleField === 'string' ? idleField : JSON.stringify(idleField || "{}");
                                           const durObj = JSON.parse(rawIdle);
                                           rawIdleMins += parseFloat(durObj[`${selectedUser}_idle`] || 0);
                                       } catch(e) {}
                                       
                                       const idleMins = Math.max(0, rawIdleMins - activeMins);
                                       const cName = c.name || c.title || "Unknown";
                                       
                                       // Prevent duplicates just in case the ledger already synced
                                       if (!dayCasesData.some(d => d.name === cName)) {
                                           dayCasesData.push({ name: cName, active: activeMins, idle: idleMins });
                                       }
                                   });
                               }

                               if (dayCasesData.length === 0) return <div style={{ padding: "40px", color: "#5f6368", fontStyle: "italic", textAlign: "center" }}>No cases completed on this day.</div>;

                               const totalActive = dayCasesData.reduce((sum, d) => sum + d.active, 0);
                               const totalIdle = dayCasesData.reduce((sum, d) => sum + d.idle, 0);
                               const avgActive = dayCasesData.length > 0 ? totalActive / dayCasesData.length : 0;
                               const avgIdle = dayCasesData.length > 0 ? totalIdle / dayCasesData.length : 0;

                               let maxVal = Math.max(avgActive, avgIdle);
                               dayCasesData.forEach(d => maxVal = Math.max(maxVal, d.active, d.idle));
                               
                               // 🌟 Dynamic Scale: Switch to 60m increments for extreme values
                               const increment = maxVal > 350 ? 60 : 20;
                               const maxY = Math.max(60, Math.ceil(maxVal / increment) * increment);
                               const yTicks = [];
                               for (let i = maxY; i >= 0; i -= increment) yTicks.push(i);

                               return (
                                  <>
                                      <div style={{ display: 'flex', gap: '24px', justifyContent: 'center', marginBottom: '40px', fontSize: '12px', fontWeight: 'bold', color: '#3c4043' }}>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: '14px', height: '14px', backgroundColor: '#1a73e8', borderRadius: '3px' }}/> Active Time</div>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: '14px', height: '14px', backgroundColor: '#ea4335', borderRadius: '3px' }}/> Idle Time</div>
                                      </div>

                                      <div style={{ display: 'flex', height: '340px', fontFamily: 'sans-serif', marginBottom: '80px', marginLeft: '10px' }}>
                                         <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', paddingRight: '12px', color: '#5f6368', fontWeight: '500', fontSize: '11px', textAlign: 'right', minWidth: '45px', margin: '-6px 0', position: 'relative' }}>
                                             {/* Rotated label and removed 'm' from numbers */}
                                             <div style={{ position: 'absolute', left: '-25px', top: '50%', transform: 'translateY(-50%) rotate(-90deg)', fontSize: '10px', fontWeight: 'bold', color: '#5f6368', textTransform: 'uppercase', letterSpacing: '2px' }}>MINUTES</div>
                                             {yTicks.map(t => <div key={t}>{t}</div>)}
                                         </div>
                                         <div style={{ flex: 1, position: 'relative', borderBottom: '2px solid #dadce0', borderLeft: '2px solid #dadce0', display: 'flex', alignItems: 'flex-end', overflowX: 'visible', gap: '8px', padding: '0 16px' }}>
                                             {yTicks.map(t => <div key={`grid-${t}`} style={{ position: 'absolute', left: 0, right: 0, bottom: `${(t/maxY)*100}%`, borderTop: '1px dashed #f1f3f4', zIndex: 0 }} />)}
                                             
                                             {avgActive > 0 && <div style={{ position: 'absolute', left: 0, right: 0, bottom: `${(avgActive/maxY)*100}%`, borderTop: '2px dashed rgba(26, 115, 232, 0.5)', zIndex: 0, pointerEvents: 'none' }}><div style={{ position: 'absolute', right: 0, bottom: '2px', fontSize: '10px', color: '#1a73e8', fontWeight: 'bold', backgroundColor: 'rgba(255,255,255,0.8)', padding: '0 4px', borderRadius: '4px' }}>Avg Active: {avgActive.toFixed(0)}m</div></div>}
                                             {avgIdle > 0 && <div style={{ position: 'absolute', left: 0, right: 0, bottom: `${(avgIdle/maxY)*100}%`, borderTop: '2px dashed rgba(234, 67, 53, 0.5)', zIndex: 0, pointerEvents: 'none' }}><div style={{ position: 'absolute', right: 0, bottom: '2px', fontSize: '10px', color: '#ea4335', fontWeight: 'bold', backgroundColor: 'rgba(255,255,255,0.8)', padding: '0 4px', borderRadius: '4px' }}>Avg Idle: {avgIdle.toFixed(0)}m</div></div>}
                                             
                                             {dayCasesData.map((d, i) => (
                                                 <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 1, flex: 1, position: 'relative', height: '100%' }}>
                                                     <div style={{ display: 'flex', alignItems: 'flex-end', gap: '2px', height: '100%', width: '100%', justifyContent: 'center' }}>
                                                         <div title={`Active: ${d.active.toFixed(0)}m`} style={{ width: '100%', maxWidth: '16px', height: `${(d.active/maxY)*100}%`, backgroundColor: '#1a73e8', borderRadius: '4px 4px 0 0', minHeight: d.active > 0 ? '2px' : '0' }} />
                                                         <div title={`Idle: ${d.idle.toFixed(0)}m`} style={{ width: '100%', maxWidth: '16px', height: `${(d.idle/maxY)*100}%`, backgroundColor: '#ea4335', borderRadius: '4px 4px 0 0', minHeight: d.idle > 0 ? '2px' : '0' }} />
                                                     </div>
                                                     <div style={{ position: 'absolute', top: '100%', right: '50%', marginTop: '8px', transform: 'rotate(-45deg)', transformOrigin: 'top right', fontSize: '11px', color: '#5f6368', whiteSpace: 'nowrap', fontWeight: '600', width: '120px', textAlign: 'right', textOverflow: 'ellipsis', overflow: 'hidden' }} title={d.name}>{d.name}</div>
                                                 </div>
                                             ))}
                                         </div>
                                      </div>
                                  </>
                               );
                           })()
                      )}
                  </div>
                </div>
              )}
            </div>

            {/* ========================================== */}
            {/* 3. WEEKLY ANALYTICS ACCORDION */}
            {/* ========================================== */}
            <div>
              <div 
                onClick={() => { 
                    if (isModalOpen) {
                        setIsModalOpen(false);
                        setWeekOffset(0); // Reset to current week when closed
                    } else {
                        setIsModalOpen(true);
                        if (maxLoadedWeek < 0 && !loadingWeekly) fetchLedgerChunk(0, 5); 
                    }
                }}
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#f8f9fa", padding: "14px 16px", borderRadius: "8px", cursor: "pointer", border: "1px solid #dadce0" }}
              >
                <h3 style={{ margin: 0, fontSize: "16px", color: "#3c4043", display: "flex", alignItems: "center", gap: "8px" }}>Weekly Analytics</h3>
                <svg style={{ transform: isModalOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#5f6368" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
              </div>

              {isModalOpen && (
                <div style={{ marginTop: "8px", border: "1px solid #dadce0", borderRadius: "8px", background: "#fff", overflow: "hidden" }}>
                  <div style={{ padding: "16px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px dashed #dadce0", marginBottom: "24px" }}>
                      <button onClick={() => { const nextOffset = weekOffset + 1; setWeekOffset(nextOffset); if (nextOffset > maxLoadedWeek && !loadingWeekly) fetchLedgerChunk(maxLoadedWeek + 1, maxLoadedWeek + 6); }} disabled={loadingWeekly} style={{ background: "none", border: "none", fontSize: "18px", cursor: loadingWeekly ? "wait" : "pointer", color: loadingWeekly ? "#dadce0" : "#5f6368" }}>◀</button>
                      <div style={{ textAlign: "center" }}>
                          <div style={{ fontWeight: "bold", color: "#1f1f1f", fontSize: "16px" }}>
                              {(() => { const { start, end } = getWeekBoundaries(weekOffset); const format = (d) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }); return `${format(start)} — ${format(end)}`; })()}
                          </div>
                      </div>
                      <button onClick={() => setWeekOffset(Math.max(0, weekOffset - 1))} disabled={weekOffset === 0 || loadingWeekly} style={{ background: "none", border: "none", fontSize: "18px", cursor: (weekOffset === 0 || loadingWeekly) ? "default" : "pointer", color: (weekOffset === 0 || loadingWeekly) ? "#dadce0" : "#5f6368" }}>▶</button>
                  </div>

                  <div style={{ padding: "0 24px 24px 24px" }}>
                      {loadingWeekly ? (
                           <div style={{ color: "#5f6368", fontSize: "14px", padding: "40px 0", textAlign: "center" }}>Fetching historical ledger data...</div>
                      ) : (
                           (() => {
                               const { start, end } = getWeekBoundaries(weekOffset);
                               const userHistory = weeklyStats[selectedUser] || [];
                               const days = [ { id: 1, name: 'Monday', activeSum: 0, idleSum: 0, count: 0 }, { id: 2, name: 'Tuesday', activeSum: 0, idleSum: 0, count: 0 }, { id: 3, name: 'Wednesday', activeSum: 0, idleSum: 0, count: 0 }, { id: 4, name: 'Thursday', activeSum: 0, idleSum: 0, count: 0 }, { id: 5, name: 'Friday', activeSum: 0, idleSum: 0, count: 0 } ];

                               userHistory.forEach(record => {
                                   const rDate = new Date(record.date);
                                   if (rDate >= start && rDate <= end) {
                                       const dayObj = days.find(d => d.id === rDate.getDay());
                                       if (dayObj) { dayObj.activeSum += record.activeMins; dayObj.idleSum += record.idleMins; dayObj.count += 1; }
                                   }
                               });

                               // 🌟 NEW: If looking at the "Current Week", inject today's live cases into today's weekday bucket!
                               if (weekOffset === 0) {
                                   const todayDayId = new Date().getDay();
                                   const dayObj = days.find(d => d.id === todayDayId);
                                   if (dayObj) {
                                       const completedToday = dailySentStats[`${selectedUser}_completed_objects`] || [];
                                       const bucketKey = selectedUser === "Siya - Review" ? "SRV" : selectedUser.substring(0, 3).toUpperCase();
                                       
                                       completedToday.forEach(c => {
                                           let activeMins = 0; let rawIdleMins = 0;
                                           try {
                                               const workField = c.customFields?.WorkLog || c.customFields?.['[SYSTEM]WorkLog'];
                                               const rawWork = typeof workField === 'string' ? workField : JSON.stringify(workField || "{}");
                                               let savedDurations = JSON.parse(rawWork);
                                               const durFromName = parseFloat(savedDurations[selectedUser] || "0");
                                               const durFromKey = parseFloat(savedDurations[bucketKey] || "0");
                                               activeMins += (durFromName > 0 ? durFromName : durFromKey) || 0;

                                               const rawStart = c.customFields?.WorkTimerStart || c.customFields?.['[SYSTEM]WorkTimerStart'] || "";
                                               if (rawStart) {
                                                  const [startTsStr, startList] = rawStart.split("|");
                                                  const startTs = parseFloat(startTsStr);
                                                  if (startTs > 1000000000000 && (startList === selectedUser || startList.substring(0, 3).toUpperCase() === bucketKey)) {
                                                      activeMins += Math.max(0, Date.now() - startTs) / 1000 / 60;
                                                  }
                                               }

                                               const idleField = c.customFields?.IdleLog || c.customFields?.['[SYSTEM]IdleLog'];
                                               const rawIdle = typeof idleField === 'string' ? idleField : JSON.stringify(idleField || "{}");
                                               const durObj = JSON.parse(rawIdle);
                                               rawIdleMins += parseFloat(durObj[`${selectedUser}_idle`] || 0);
                                           } catch(e) {}
                                           
                                           // Safely push the live math into the weekly day object
                                           dayObj.activeSum += activeMins;
                                           dayObj.idleSum += Math.max(0, rawIdleMins - activeMins);
                                           dayObj.count += 1;
                                       });
                                   }
                               }

                               const weekCasesData = days.map(d => ({ name: d.name, active: d.count > 0 ? d.activeSum / d.count : 0, idle: d.count > 0 ? d.idleSum / d.count : 0 }));
                               let totalWeekActive = 0; let totalWeekIdle = 0; let totalWeekCases = 0;
                               days.forEach(d => { totalWeekActive += d.activeSum; totalWeekIdle += d.idleSum; totalWeekCases += d.count; });
                               const overallAvgActive = totalWeekCases > 0 ? totalWeekActive / totalWeekCases : 0;
                               const overallAvgIdle = totalWeekCases > 0 ? totalWeekIdle / totalWeekCases : 0;

                               let maxVal = Math.max(overallAvgActive, overallAvgIdle);
                               weekCasesData.forEach(d => maxVal = Math.max(maxVal, d.active, d.idle));
                               
                               // 🌟 Dynamic Scale: Switch to 60m increments for extreme values
                               const increment = maxVal > 350 ? 60 : 20;
                               const maxY = Math.max(60, Math.ceil(maxVal / increment) * increment);
                               const yTicks = [];
                               for (let i = maxY; i >= 0; i -= increment) yTicks.push(i);

                               return (
                                  <>
                                      <div style={{ display: 'flex', gap: '24px', justifyContent: 'center', marginBottom: '40px', fontSize: '12px', fontWeight: 'bold', color: '#3c4043' }}>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: '14px', height: '14px', backgroundColor: '#1a73e8', borderRadius: '3px' }}/> Avg Active Time</div>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: '14px', height: '14px', backgroundColor: '#ea4335', borderRadius: '3px' }}/> Avg Idle Time</div>
                                      </div>

                                      <div style={{ display: 'flex', height: '340px', fontFamily: 'sans-serif', marginBottom: '80px', marginLeft: '10px' }}>
                                         <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', paddingRight: '12px', color: '#5f6368', fontWeight: '500', fontSize: '11px', textAlign: 'right', minWidth: '45px', margin: '-6px 0', position: 'relative' }}>
                                             <div style={{ position: 'absolute', left: '-25px', top: '50%', transform: 'translateY(-50%) rotate(-90deg)', fontSize: '10px', fontWeight: 'bold', color: '#5f6368', textTransform: 'uppercase', letterSpacing: '2px' }}>MINUTES</div>
                                             {/* 🌟 RESTORED: This maps the dynamically scaled numbers back onto the screen! */}
                                             {yTicks.map(t => <div key={t}>{t}</div>)}
                                         </div>
                                         <div style={{ flex: 1, position: 'relative', borderBottom: '2px solid #dadce0', borderLeft: '2px solid #dadce0', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around', padding: '0 16px', overflowX: 'visible' }}>
                                             {yTicks.map(t => <div key={`grid-${t}`} style={{ position: 'absolute', left: 0, right: 0, bottom: `${(t/maxY)*100}%`, borderTop: '1px dashed #f1f3f4', zIndex: 0 }} />)}
                                             
                                             {overallAvgActive > 0 && <div style={{ position: 'absolute', left: 0, right: 0, bottom: `${(overallAvgActive/maxY)*100}%`, borderTop: '2px dashed rgba(26, 115, 232, 0.5)', zIndex: 0, pointerEvents: 'none' }}><div style={{ position: 'absolute', right: 0, bottom: '2px', fontSize: '10px', color: '#1a73e8', fontWeight: 'bold', backgroundColor: 'rgba(255,255,255,0.8)', padding: '0 4px', borderRadius: '4px' }}>Wk Avg Active: {overallAvgActive.toFixed(0)}m</div></div>}
                                             {overallAvgIdle > 0 && <div style={{ position: 'absolute', left: 0, right: 0, bottom: `${(overallAvgIdle/maxY)*100}%`, borderTop: '2px dashed rgba(234, 67, 53, 0.5)', zIndex: 0, pointerEvents: 'none' }}><div style={{ position: 'absolute', right: 0, bottom: '2px', fontSize: '10px', color: '#ea4335', fontWeight: 'bold', backgroundColor: 'rgba(255,255,255,0.8)', padding: '0 4px', borderRadius: '4px' }}>Wk Avg Idle: {overallAvgIdle.toFixed(0)}m</div></div>}
                                             
                                             {weekCasesData.map((d, i) => (
                                                 <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 1, flex: 1, position: 'relative', height: '100%' }}>
                                                     <div style={{ display: 'flex', alignItems: 'flex-end', gap: '2px', height: '100%', width: '100%', justifyContent: 'center' }}>
                                                         <div title={`Avg Active: ${d.active.toFixed(0)}m`} style={{ width: '100%', maxWidth: '18px', height: `${(d.active/maxY)*100}%`, backgroundColor: '#1a73e8', borderRadius: '4px 4px 0 0', minHeight: d.active > 0 ? '2px' : '0' }} />
                                                         <div title={`Avg Idle: ${d.idle.toFixed(0)}m`} style={{ width: '100%', maxWidth: '18px', height: `${(d.idle/maxY)*100}%`, backgroundColor: '#ea4335', borderRadius: '4px 4px 0 0', minHeight: d.idle > 0 ? '2px' : '0' }} />
                                                     </div>
                                                     <div style={{ position: 'absolute', top: '100%', right: '50%', marginTop: '8px', transform: 'rotate(-45deg)', transformOrigin: 'top right', fontSize: '11px', color: '#5f6368', whiteSpace: 'nowrap', fontWeight: 'bold', textAlign: 'right' }}>{d.name}</div>
                                                 </div>
                                             ))}
                                         </div>
                                      </div>
                                  </>
                               );
                           })()
                      )}
                  </div>
                </div>
              )}
            </div>

            {/* ========================================== */}
            {/* 4. MONTHLY ANALYTICS ACCORDION */}
            {/* ========================================== */}
            <div>
              <div 
                onClick={() => { 
                    if (isMonthOpen) {
                        setIsMonthOpen(false);
                        setMonthOffset(0);
                    } else {
                        setIsMonthOpen(true);
                        // Fetch roughly 8 weeks back to cover 1-2 months reliably
                        if (maxLoadedWeek < 8 && !loadingWeekly) fetchLedgerChunk(0, 8); 
                    }
                }}
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#f8f9fa", padding: "14px 16px", borderRadius: "8px", cursor: "pointer", border: "1px solid #dadce0" }}
              >
                <h3 style={{ margin: 0, fontSize: "16px", color: "#3c4043", display: "flex", alignItems: "center", gap: "8px" }}>Monthly Analytics</h3>
                <svg style={{ transform: isMonthOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#5f6368" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
              </div>

              {isMonthOpen && (
                <div style={{ marginTop: "8px", border: "1px solid #dadce0", borderRadius: "8px", background: "#fff", overflow: "hidden" }}>
                  <div style={{ padding: "16px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px dashed #dadce0", marginBottom: "24px" }}>
                      <button onClick={() => { const nextOffset = monthOffset + 1; setMonthOffset(nextOffset); if (maxLoadedWeek < nextOffset * 4 + 4 && !loadingWeekly) fetchLedgerChunk(maxLoadedWeek + 1, nextOffset * 4 + 8); }} disabled={loadingWeekly} style={{ background: "none", border: "none", fontSize: "18px", cursor: loadingWeekly ? "wait" : "pointer", color: loadingWeekly ? "#dadce0" : "#5f6368" }}>◀</button>
                      <div style={{ textAlign: "center" }}>
                          <div style={{ fontWeight: "bold", color: "#1f1f1f", fontSize: "16px" }}>
                              {(() => { const { start } = getMonthBoundaries(monthOffset); return start.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }); })()}
                          </div>
                      </div>
                      <button onClick={() => setMonthOffset(Math.max(0, monthOffset - 1))} disabled={monthOffset === 0 || loadingWeekly} style={{ background: "none", border: "none", fontSize: "18px", cursor: (monthOffset === 0 || loadingWeekly) ? "default" : "pointer", color: (monthOffset === 0 || loadingWeekly) ? "#dadce0" : "#5f6368" }}>▶</button>
                  </div>

                  <div style={{ padding: "0 24px 24px 24px" }}>
                      {loadingWeekly ? (
                           <div style={{ color: "#5f6368", fontSize: "14px", padding: "40px 0", textAlign: "center" }}>Fetching historical ledger data...</div>
                      ) : (
                           (() => {
                               const { start, end } = getMonthBoundaries(monthOffset);
                               const userHistory = weeklyStats[selectedUser] || [];
                               
                               const daysInMonth = end.getDate();
                               const days = Array.from({ length: daysInMonth }, (_, i) => ({ id: i + 1, name: String(i + 1), activeSum: 0, idleSum: 0, count: 0 }));

                               userHistory.forEach(record => {
                                   const rDate = new Date(record.date);
                                   if (rDate >= start && rDate <= end) {
                                       const dayObj = days.find(d => d.id === rDate.getDate());
                                       if (dayObj) { dayObj.activeSum += record.activeMins; dayObj.idleSum += record.idleMins; dayObj.count += 1; }
                                   }
                               });

                               if (monthOffset === 0) {
                                   const todayDayId = new Date().getDate();
                                   const currentMonth = new Date().getMonth();
                                   if (start.getMonth() === currentMonth) {
                                       const dayObj = days.find(d => d.id === todayDayId);
                                       if (dayObj) {
                                           const completedToday = dailySentStats[`${selectedUser}_completed_objects`] || [];
                                           const bucketKey = selectedUser === "Siya - Review" ? "SRV" : selectedUser.substring(0, 3).toUpperCase();
                                           
                                           completedToday.forEach(c => {
                                               let activeMins = 0; let rawIdleMins = 0;
                                               try {
                                                   const workField = c.customFields?.WorkLog || c.customFields?.['[SYSTEM]WorkLog'];
                                                   const rawWork = typeof workField === 'string' ? workField : JSON.stringify(workField || "{}");
                                                   let savedDurations = JSON.parse(rawWork);
                                                   const durFromName = parseFloat(savedDurations[selectedUser] || "0");
                                                   const durFromKey = parseFloat(savedDurations[bucketKey] || "0");
                                                   activeMins += (durFromName > 0 ? durFromName : durFromKey) || 0;

                                                   const rawStart = c.customFields?.WorkTimerStart || c.customFields?.['[SYSTEM]WorkTimerStart'] || "";
                                                   if (rawStart) {
                                                      const [startTsStr, startList] = rawStart.split("|");
                                                      const startTs = parseFloat(startTsStr);
                                                      if (startTs > 1000000000000 && (startList === selectedUser || startList.substring(0, 3).toUpperCase() === bucketKey)) {
                                                          activeMins += Math.max(0, Date.now() - startTs) / 1000 / 60;
                                                      }
                                                   }

                                                   const idleField = c.customFields?.IdleLog || c.customFields?.['[SYSTEM]IdleLog'];
                                                   const rawIdle = typeof idleField === 'string' ? idleField : JSON.stringify(idleField || "{}");
                                                   const durObj = JSON.parse(rawIdle);
                                                   rawIdleMins += parseFloat(durObj[`${selectedUser}_idle`] || 0);
                                               } catch(e) {}
                                               
                                               dayObj.activeSum += activeMins;
                                               dayObj.idleSum += Math.max(0, rawIdleMins - activeMins);
                                               dayObj.count += 1;
                                           });
                                       }
                                   }
                               }

                               const monthCasesData = days.map(d => ({ name: d.name, active: d.count > 0 ? d.activeSum / d.count : 0, idle: d.count > 0 ? d.idleSum / d.count : 0 }));
                               let totalMonthActive = 0; let totalMonthIdle = 0; let totalMonthCases = 0;
                               days.forEach(d => { totalMonthActive += d.activeSum; totalMonthIdle += d.idleSum; totalMonthCases += d.count; });
                               const overallAvgActive = totalMonthCases > 0 ? totalMonthActive / totalMonthCases : 0;
                               const overallAvgIdle = totalMonthCases > 0 ? totalMonthIdle / totalMonthCases : 0;

                               let maxVal = Math.max(overallAvgActive, overallAvgIdle);
                               monthCasesData.forEach(d => maxVal = Math.max(maxVal, d.active, d.idle));
                               
                               // 🌟 Dynamic Scale: Switch to 60m increments for extreme values
                               const increment = maxVal > 350 ? 60 : 20;
                               const maxY = Math.max(60, Math.ceil(maxVal / increment) * increment);
                               const yTicks = [];
                               for (let i = maxY; i >= 0; i -= increment) yTicks.push(i);

                               return (
                                  <>
                                      <div style={{ display: 'flex', gap: '24px', justifyContent: 'center', marginBottom: '40px', fontSize: '12px', fontWeight: 'bold', color: '#3c4043' }}>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: '14px', height: '14px', backgroundColor: '#1a73e8', borderRadius: '3px' }}/> Avg Active Time</div>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: '14px', height: '14px', backgroundColor: '#ea4335', borderRadius: '3px' }}/> Avg Idle Time</div>
                                      </div>

                                      <div style={{ display: 'flex', height: '340px', fontFamily: 'sans-serif', marginBottom: '40px', marginLeft: '10px' }}>
                                         <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', paddingRight: '12px', color: '#5f6368', fontWeight: '500', fontSize: '11px', textAlign: 'right', minWidth: '45px', margin: '-6px 0', position: 'relative' }}>
                                             <div style={{ position: 'absolute', left: '-25px', top: '50%', transform: 'translateY(-50%) rotate(-90deg)', fontSize: '10px', fontWeight: 'bold', color: '#5f6368', textTransform: 'uppercase', letterSpacing: '2px' }}>MINUTES</div>
                                             {yTicks.map(t => <div key={t}>{t}</div>)}
                                         </div>
                                         <div style={{ flex: 1, position: 'relative', borderBottom: '2px solid #dadce0', borderLeft: '2px solid #dadce0', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around', padding: '0 8px', overflowX: 'visible' }}>
                                             {yTicks.map(t => <div key={`grid-${t}`} style={{ position: 'absolute', left: 0, right: 0, bottom: `${(t/maxY)*100}%`, borderTop: '1px dashed #f1f3f4', zIndex: 0 }} />)}
                                             
                                             {overallAvgActive > 0 && <div style={{ position: 'absolute', left: 0, right: 0, bottom: `${(overallAvgActive/maxY)*100}%`, borderTop: '2px dashed rgba(26, 115, 232, 0.5)', zIndex: 0, pointerEvents: 'none' }}><div style={{ position: 'absolute', right: 0, bottom: '2px', fontSize: '10px', color: '#1a73e8', fontWeight: 'bold', backgroundColor: 'rgba(255,255,255,0.8)', padding: '0 4px', borderRadius: '4px' }}>Mo Avg Active: {overallAvgActive.toFixed(0)}m</div></div>}
                                             {overallAvgIdle > 0 && <div style={{ position: 'absolute', left: 0, right: 0, bottom: `${(overallAvgIdle/maxY)*100}%`, borderTop: '2px dashed rgba(234, 67, 53, 0.5)', zIndex: 0, pointerEvents: 'none' }}><div style={{ position: 'absolute', right: 0, bottom: '2px', fontSize: '10px', color: '#ea4335', fontWeight: 'bold', backgroundColor: 'rgba(255,255,255,0.8)', padding: '0 4px', borderRadius: '4px' }}>Mo Avg Idle: {overallAvgIdle.toFixed(0)}m</div></div>}
                                             
                                             {monthCasesData.map((d, i) => (
                                                 <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 1, flex: 1, position: 'relative', height: '100%' }}>
                                                     <div style={{ display: 'flex', alignItems: 'flex-end', gap: '1px', height: '100%', width: '100%', justifyContent: 'center' }}>
                                                         <div title={`Day ${d.name}\nAvg Active: ${d.active.toFixed(0)}m`} style={{ width: '100%', maxWidth: '8px', height: `${(d.active/maxY)*100}%`, backgroundColor: '#1a73e8', borderRadius: '2px 2px 0 0', minHeight: d.active > 0 ? '2px' : '0' }} />
                                                         <div title={`Day ${d.name}\nAvg Idle: ${d.idle.toFixed(0)}m`} style={{ width: '100%', maxWidth: '8px', height: `${(d.idle/maxY)*100}%`, backgroundColor: '#ea4335', borderRadius: '2px 2px 0 0', minHeight: d.idle > 0 ? '2px' : '0' }} />
                                                     </div>
                                                     <div style={{ position: 'absolute', top: '100%', marginTop: '6px', fontSize: '9px', color: '#5f6368', whiteSpace: 'nowrap', fontWeight: 'bold', textAlign: 'center' }}>{d.name}</div>
                                                 </div>
                                            ))}
                                         </div>
                                      </div>
                                  </>
                               );
                           })()
                      )}
                  </div>
                </div>
              )}
            </div>

            {/* Standard internal cushion */}
            <div style={{ height: "32px", flexShrink: 0 }}></div>

          </div>
        </div>
      ) : (
        <>
          <div 
            className="prod-grid" 
            style={{ 
              padding: "24px 24px 0 24px", /* 🌟 Zero bottom padding to avoid the browser bug */
              display: "flex", 
              flexDirection: "column", 
              gap: "24px", 
              margin: 0, 
              boxSizing: "border-box", 
              width: "100%" 
            }}
          >
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
                      <span className="prod-metric-value" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "block" }}>{m.currentTask}</span>
                    </div>

                    <div className="prod-metric" style={{ width: "90px", flexShrink: 0 }}>
                      <span className="prod-metric-label" style={{ whiteSpace: "nowrap" }}>Card Count</span>
                      <span className="prod-metric-value highlight" style={{ color: "#1f1f1f" }}>{m.cardCount}</span>
                    </div>
                    
                    <div className="prod-metric" style={{ width: "120px", flexShrink: 0 }}>
                      <span className="prod-metric-label" style={{ display: "flex", alignItems: "center", gap: "6px", whiteSpace: "nowrap" }}>
                        Time Logged
                        <span className="info-tooltip" data-tip="Start time of this case">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9aa0a6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                        </span>
                      </span>
                      <span className="prod-metric-value highlight" style={{ color: "#1f1f1f" }}>{m.timeLogged}</span>
                    </div>

                    <div className="prod-metric" style={{ width: "110px", flexShrink: 0 }}>
                      <span className="prod-metric-label" style={{ whiteSpace: "nowrap" }}>Active Timer</span>
                      <span className="prod-metric-value highlight" style={{ color: "#1f1f1f" }}>{m.activeTimer}</span>
                    </div>

                    {/* Increased width to 180px and forced single-line so 'Yolandie' never wraps */}
                    <div className="prod-metric" style={{ width: "180px", flexShrink: 0 }}>
                      <span className="prod-metric-label" style={{ whiteSpace: "nowrap" }}>
                        {user === "Siya - Review" ? "Sent to Yolandie Today" : "Sent to Review Today"}
                      </span>
                      <span className="prod-metric-value highlight" style={{ color: "#1f1f1f" }}>{m.reviewCount}</span>
                    </div>

                 </div>

                </div>
              );
            })}
            
           

            {/* 🌟 SCROLL BUG FIX: Increased height to double the empty space at the bottom */}
            <div style={{ height: "24px", flexShrink: 0 }}></div>
          </div>
        </>
      )}
      </div>

    </div>
  );
});

export default ProductivityDashboard;