import React, { useState, useRef, useEffect } from "react";
import { useDebounce } from "../hooks/useDebounce.js";
import { avatarFor } from "../utils/avatarUtils.js";
import { PERSONA } from "../utils/config.js";
import {
  ensureBadgeTypes, getTrelloCoverColor, getLabelColor, getCFColorClass, priorityTypeFromText
} from "../utils/trelloUtils.js";
import PopupSpring from "./PopupSpring.jsx";
import SmartLink from "./SmartLink.jsx";

const trelloIcon = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Crect width='24' height='24' rx='4' fill='%230079bf'/%3E%3Crect x='5' y='5' width='6' height='14' rx='1.5' fill='%23ffffff'/%3E%3Crect x='13' y='5' width='6' height='9' rx='1.5' fill='%23ffffff'/%3E%3C/svg%3E";

const RightPanel = React.memo(function RightPanel({ 
  gchatSpaces, gchatLoading, gchatError, gchatDmNames, 
  gchatSelectedSpace, setGchatSelectedSpace, 
  unreadGchatSpaces, setUnreadGchatSpaces, 
  gchatSpaceTimes, setGchatSpaceTimes,
  archivedGchatSpaces, setArchivedGchatSpaces, 
  mutedGchatSpaces, setMutedGchatSpaces,
  trashedGchatSpaces, setTrashedGchatSpaces,
  chatToDelete, setChatToDelete,
  activeTrelloCardId,
  triggerSnackbar,
}) {
  // 👇 HYDRATE FROM CACHE: Gives notifications permanent memory across page refreshes!
  const knownTrelloCardsRef = useRef(null);
  const immuneCardsRef = useRef(new Map()); // 🛡️ NEW: Memory shield to stop echoes
  useEffect(() => {
    if (!knownTrelloCardsRef.current) {
        try {
            const cache = JSON.parse(localStorage.getItem("TRELLO_CACHE") || "[]");
            if (cache.length > 0) {
                const map = new Map();
                cache.forEach(list => list.cards.forEach(c => map.set(c.id, list.title)));
                knownTrelloCardsRef.current = map;
            }
        } catch(e) {}
    }
  }, []);

  const [preview, setPreview] = React.useState(null);
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [archivedCards, setArchivedCards] = useState([]);
  const [archivedLoading, setArchivedLoading] = useState(false);
  const [archiveSearch, setArchiveSearch] = useState(""); // 👈 NEW: Archive Search
  const debouncedArchiveSearch = useDebounce(archiveSearch, 300);
  const [cardToDelete, setCardToDelete] = useState(null); // 🚀 NEW: State for custom delete modal

// 👇 NEW: Inline Card Creation State
  const [addingToList, setAddingToList] = useState(null);
  const [newCardTitle, setNewCardTitle] = useState("");

  const handleCreateCard = async (listId, bucketTitle) => {
      if (!newCardTitle.trim()) return;
      
      const titleToCreate = newCardTitle.trim();
      const tempId = "temp-" + Date.now(); // Temporary ID for instant UI rendering

      // ⚡ FIX THE FAKE ID BUG: Grab real ID from cache if this list is empty
      let realTargetListId = listId;
      if (realTargetListId.startsWith("list-")) {
          try {
              const cachedLists = JSON.parse(localStorage.getItem("TRELLO_LISTS_CACHE") || "[]");
              const realListMatch = cachedLists.find(l => l.title.toLowerCase() === bucketTitle.toLowerCase());
              if (realListMatch && realListMatch.id) {
                  realTargetListId = realListMatch.id;
              }
          } catch(e) {}
      }

      // 1. Reset input UI immediately
      setAddingToList(null);
      setNewCardTitle("");

      // 2. Optimistic Update: Draw the card instantly on screen
      setTrelloBuckets(prev => prev.map(b => {
          if (b.id === listId) {
              return {
                  ...b,
                  cards: [...b.cards, {
                      id: tempId,
                      title: titleToCreate,
                      labels: [],
                      badges: [],
                      people: [],
                      customFields: {},
                      listId: realTargetListId,
                      list: b.title
                  }]
              };
          }
          return b;
      }));

      // 3. Send to Trello Backend
      try {
          const res = await fetch("/.netlify/functions/trello-add-card", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ name: titleToCreate, idList: realTargetListId })
          });
          const json = await res.json();
          
          if (json.ok && json.card) {
              // Swap the temporary ID for the real Trello ID once the server replies
              setTrelloBuckets(prev => prev.map(b => {
                  if (b.id === listId) {
                      return {
                          ...b,
                          cards: b.cards.map(c => c.id === tempId ? { ...c, id: json.card.id } : c)
                      };
                  }
                  return b;
              }));
          }
      } catch (err) {
          console.error("Failed to create card:", err);
      }
  };
  
  // 👇 NEW: Track Pinned Lists
  const [pinnedLists, setPinnedLists] = useState(() => {
    try { return JSON.parse(localStorage.getItem("PINNED_LISTS") || "[]"); }
    catch { return []; }
  });

  const togglePin = (listId, e) => {
      e.stopPropagation(); // Prevents dragging the list when clicking the pin
      setPinnedLists(prev => {
          let next;
          if (prev.includes(listId)) {
              next = prev.filter(id => id !== listId); // unpin
          } else {
              next = [...prev, listId]; // pin (adds to bottom of pinned group)
          }
          localStorage.setItem("PINNED_LISTS", JSON.stringify(next));
          
          // Instantly re-sort the UI without waiting for the background poller
          setTrelloBuckets(oldBuckets => {
              const newBuckets = [...oldBuckets].sort((a, b) => {
                  const aPin = next.indexOf(a.id);
                  const bPin = next.indexOf(b.id);
                  if (aPin !== -1 && bPin !== -1) return aPin - bPin;
                  if (aPin !== -1) return -1;
                  if (bPin !== -1) return 1;
                  
                  let idxA = listOrderRef.current.indexOf(a.title);
                  let idxB = listOrderRef.current.indexOf(b.title);
                  return (idxA !== -1 ? idxA : 999) - (idxB !== -1 ? idxB : 999);
              });
              // Update master ref so dragging doesn't break
              listOrderRef.current = newBuckets.map(b => b.title);
              return newBuckets;
          });
          return next;
      });
  };

  const openArchiveBin = async () => {
    setShowArchiveModal(true);
    setArchivedLoading(true);
    try {
      // 🔗 SYNCED: This specifically matches your filename "trello-archived"
      const res = await fetch("/.netlify/functions/trello-archived");
      const json = await res.json();
      if (json.cards) {
        // 🛠️ DATA MAPPER: Formats raw Trello data to match your UI perfectly
        const mapped = json.cards.map(c => {
           const labelNames = (c.labels || []).map(l => l.name).filter(Boolean);
           
           // Extract the translated custom fields from the new backend
           let badgeArr = labelNames.map(l => ({ text: l, isBottom: false }));
           if (c.parsedCustomFields) {
               if (c.parsedCustomFields.Priority) badgeArr.push({ text: `Priority: ${c.parsedCustomFields.Priority}`, isBottom: true });
               if (c.parsedCustomFields.Status) badgeArr.push({ text: `Status: ${c.parsedCustomFields.Status}`, isBottom: true });
               if (c.parsedCustomFields.Active) badgeArr.push({ text: `Active: ${c.parsedCustomFields.Active}`, isBottom: true });
           }

           return {
              id: c.id,
              title: c.name,
              due: c.due || "",
              labels: labelNames,
              badges: ensureBadgeTypes(badgeArr),
              people: c.idMembers || [],
              listId: c.idList,
              list: "Archived",
              customFields: c.parsedCustomFields || {},
              description: c.desc || "",
              cover: c.cover || null,
              isArchived: true
           };
        });
        setArchivedCards(mapped);
      }
    } catch(err) { console.error("Failed to load archive", err); }
    setArchivedLoading(false);
  };



  // 👇 SWR CACHE: Load instantly from memory so the screen is never empty
  const [trelloBuckets, setTrelloBuckets] = useState(() => {
    try {
      const cached = localStorage.getItem("TRELLO_CACHE");
      return cached ? JSON.parse(cached) : [];
    } catch(e) { return []; }
  });
  const [clientFiles, setClientFiles] = useState([]);
  const [freshCardIds, setFreshCardIds] = useState(new Set());
  const [leavingCards, setLeavingCards] = useState([]); // [{card, listTitle}]
  const prevBucketsRef = useRef([]);

  // ⚡ INSTANT REACTION: Listens to the main app and updates Right Pane in 0ms
  useEffect(() => { prevBucketsRef.current = trelloBuckets; }, [trelloBuckets]);

  useEffect(() => {
    const handler = (e) => setTrelloBuckets(e.detail);
    window.addEventListener("optimisticRightPane", handler);
    return () => window.removeEventListener("optimisticRightPane", handler);
  }, []);

 // --- DRAG AND DROP STATE ---
  
  
  useEffect(() => {
    const handleMemoryUpdate = (e) => {
      if (knownTrelloCardsRef.current) {
        knownTrelloCardsRef.current.set(e.detail.cardId, e.detail.listName);
      }
      // 🛡️ Grant 60-second immunity from fake duplicate notifications
      if (immuneCardsRef.current) immuneCardsRef.current.set(e.detail.cardId, Date.now()); 
    };
    window.addEventListener("updateTrelloMemory", handleMemoryUpdate);
    return () => window.removeEventListener("updateTrelloMemory", handleMemoryUpdate);
  }, []);

  const [dragging, setDragging] = useState(false);
  const dragItem = useRef(); // Tracks { grpI, itemI } (Group Index, Item Index)
  const dragNode = useRef(); // Tracks the actual HTML element
  const lastMoveTime = useRef(0); // 👈 ADD THIS
  const hasSnapshotRef = useRef(false);

  // 👇 ADD THIS: Initialize with your default order
  const listOrderRef = useRef(
    PERSONA.toUpperCase() === "SIYA"
      ? ["Siya", "Siya - Review", "Bonisa", "Songeziwe", "Enock"]
      : ["Yolandie to Data Capture", "Yolandie to Analyst", "Yolandie to Data Analyst", "Yolandie to Reviewer", "Yolandie to Send"]
  );

  // --- LIST REORDERING LOGIC ---

  const handleListDragStart = (e, index) => {
    e.stopPropagation(); // Don't trigger card drags
    dragItem.current = { listIdx: index };
    dragNode.current = e.currentTarget;
    e.dataTransfer.effectAllowed = 'move';

    if (e.currentTarget.parentElement) {
        e.dataTransfer.setDragImage(e.currentTarget.parentElement, 20, 20);
    }

    setDragging(true);
  };

  const handleListDragEnter = (e, index) => {
    if (!dragItem.current || dragItem.current.listIdx === undefined) return;
    if (dragItem.current.listIdx === index) return;

    // 🛡️ Capture the exact from-index BEFORE the state update
    const fromIdx = dragItem.current.listIdx;
    
    // Move the ref instantly so rapidly firing events don't trip over each other
    dragItem.current.listIdx = index; 

    setTrelloBuckets(prev => {
      const newList = [...prev];
      
      // 🛡️ CRITICAL SAFETY GUARD: Stop if the queue gets out of sync
      if (fromIdx < 0 || fromIdx >= newList.length || !newList[fromIdx]) {
          return prev; 
      }

      const item = newList.splice(fromIdx, 1)[0];
      newList.splice(index, 0, item);
      
      // 🛡️ Clean out any potential ghost undefined items before reading titles
      const safeList = newList.filter(Boolean);
      listOrderRef.current = safeList.map(b => b.title);
      
      // Safely sync pins in the background
      setTimeout(() => {
          setPinnedLists(oldPins => {
              const newPins = safeList.map(b => b.id).filter(id => oldPins.includes(id));
              localStorage.setItem("PINNED_LISTS", JSON.stringify(newPins));
              return newPins;
          });
      }, 0);

      return safeList;
    });
  };

  // 1. Start Dragging (Overlay Strategy)
  const handleDragStart = (e, params) => {
    dragItem.current = params;
    dragNode.current = e.currentTarget;

    const rect = dragNode.current.getBoundingClientRect();
    const ghost = dragNode.current.cloneNode(true);
    
    Object.assign(ghost.style, {
        position: "fixed", top: `${rect.top}px`, left: `${rect.left}px`,
        width: `${rect.width}px`, height: `${rect.height}px`,
        zIndex: "9999", pointerEvents: "none", transition: "none",
        transform: "rotate(5deg)", opacity: "1", background: "#fff",
        boxShadow: "0 15px 30px rgba(0,0,0,0.3)" 
    });

    document.body.appendChild(ghost);
    void ghost.offsetWidth; // Force Reflow
    e.dataTransfer.setDragImage(ghost, 20, 20);

    setTimeout(() => {
        if (document.body.contains(ghost)) document.body.removeChild(ghost);
        setDragging(true); 
    }, 0);
  };

  const handleColumnDragEnter = (grpI) => {
    if (dragItem.current?.listIdx !== undefined) return;
    if (!dragItem.current || dragItem.current.grpI === undefined || dragItem.current.grpI === grpI) return;

    const dragGrpIdx = dragItem.current.grpI;
    const dragItemIdx = dragItem.current.itemI;

    setTrelloBuckets((oldBuckets) => {
      let newBuckets = JSON.parse(JSON.stringify(oldBuckets));

      // 🛡️ SAFETY GUARDS
      if (!newBuckets[dragGrpIdx] || !newBuckets[dragGrpIdx].cards) return oldBuckets;
      const cardToMove = newBuckets[dragGrpIdx].cards[dragItemIdx];
      if (!cardToMove) return oldBuckets;

      newBuckets[dragGrpIdx].cards.splice(dragItemIdx, 1);
      
      if (!newBuckets[grpI]) return oldBuckets;
      if (!newBuckets[grpI].cards) newBuckets[grpI].cards = [];
      
      newBuckets[grpI].cards.push(cardToMove);
      dragItem.current = { grpI, itemI: newBuckets[grpI].cards.length - 1 };

      return newBuckets;
    });
  };

  // 2. Drag Enter (The "Make Space" Logic)
  const handleDragEnter = (e, params) => {
    if (
        !dragItem.current || 
        (dragItem.current.grpI === params.grpI && dragItem.current.itemI === params.itemI)
    ) return;

    const dragGrpIdx = dragItem.current.grpI;
    const dragItemIdx = dragItem.current.itemI;
    
    // Update instantly to prevent race conditions
    dragItem.current = params;

    setTrelloBuckets(oldBuckets => {
        let newBuckets = JSON.parse(JSON.stringify(oldBuckets));
        
        // 🛡️ SAFETY GUARDS
        if (!newBuckets[dragGrpIdx] || !newBuckets[dragGrpIdx].cards) return oldBuckets;
        const cardToMove = newBuckets[dragGrpIdx].cards[dragItemIdx];
        if (!cardToMove) return oldBuckets;

        newBuckets[dragGrpIdx].cards.splice(dragItemIdx, 1);
        
        const targetGrpIdx = params.grpI;
        const targetItemIdx = params.itemI;
        
        if (!newBuckets[targetGrpIdx]) return oldBuckets;
        if (!newBuckets[targetGrpIdx].cards) newBuckets[targetGrpIdx].cards = [];
        
        newBuckets[targetGrpIdx].cards.splice(targetItemIdx, 0, cardToMove);
        
        return newBuckets;
    });
  };

  // 3. End Dragging (Safe Version)
  const handleDragEnd = async () => {
    if (!dragItem.current) return;

    setDragging(false);
    
    if (dragNode.current) {
        dragNode.current.style.transform = "";
        dragNode.current.style.opacity = "";
    }

    lastMoveTime.current = Date.now(); 

    const { grpI, itemI } = dragItem.current;
    
    // 🛡️ Instantly clear refs to prevent post-drop ghost triggers
    dragItem.current = null;
    dragNode.current = null;

    // If it was a list drag, grpI will be undefined, so we stop here securely
    if (grpI === undefined || itemI === undefined) return;

    const destList = trelloBuckets[grpI];
    if (!destList || !destList.cards) return;
    
    const card = destList.cards[itemI];
    if (!card) return;
    
    // ⚡ FIX THE FAKE ID BUG FOR MOVES
    let realTargetListId = destList.id;
    if (realTargetListId.startsWith("list-")) {
        try {
            const cachedLists = JSON.parse(localStorage.getItem("TRELLO_LISTS_CACHE") || "[]");
            const realListMatch = cachedLists.find(l => l.title.toLowerCase() === destList.title.toLowerCase());
            if (realListMatch && realListMatch.id) {
                realTargetListId = realListMatch.id;
            }
        } catch(e) {}
    }

    console.log(`Moving card to List: ${destList.title}, Target ID: ${realTargetListId}, Index: ${itemI}`);
    
    const oldListTitle = knownTrelloCardsRef.current ? knownTrelloCardsRef.current.get(card.id) : null;
    if (oldListTitle && oldListTitle !== destList.title) {
        window.dispatchEvent(new CustomEvent("notify", {
            detail: {
                text: `Card moved to ${destList.title}: ${card.title}`,
                alt: "Trello",
                icon: trelloIcon,
                cardData: card,
                timestamp: new Date().toISOString()
            }
        }));
    }

    if (knownTrelloCardsRef.current) knownTrelloCardsRef.current.set(card.id, destList.title);
    // 🛡️ NEW: Grant 60-second immunity right as the drag-and-drop finishes
    if (immuneCardsRef.current) immuneCardsRef.current.set(card.id, Date.now()); 
    
    fetch("/.netlify/functions/trello-move", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardId: card.id, targetListId: realTargetListId, newIndex: itemI }),
    }).catch(e => console.error("Move failed", e));
  };
  // 4. Style Helper
  const getStyles = (grpI, itemI, cardId) => {
      // Only show placeholder if we are ACTIVELY dragging
      if (dragging && dragItem.current?.grpI === grpI && dragItem.current?.itemI === itemI) {
          return "tl-card dnd-placeholder"; 
      }
      if (cardId && freshCardIds.has(cardId)) return "tl-card tl-card-fresh";
      return "tl-card";
  };

  /* ... (Keep your existing Helpers: patchCardInBuckets, refs, useEffects) ... */
  // NOTE: For brevity, I am hiding the helper functions I didn't change (like onSetClientFiles). 
  // ensure you KEEP them in your file. 
  
  // (Paste your existing useEffects here: setClientFiles, openEmailAttachmentPreview, fetchTrello, bucketsUpdated)
  // ... [PASTE YOUR EXISTING USE EFFECTS HERE] ...

  // To save space, I will jump to the return statement where the DRAG EVENTS are attached.

  // --- BULLETPROOF TRELLO POLLING (Anti-429) ---
  const fetchGenRef = useRef(0); // 👈 Tracks active fetches to kill glitches

  useEffect(() => {
    let isMounted = true;
    let pollTimer = null;

    // Listen for moves/archives from the Middle Panel
    const handlePause = () => { 
      lastMoveTime.current = Date.now(); 
      fetchGenRef.current += 1; // 👈 KILLS THE GLITCH: Invalidates any currently running fetches!
    };
    window.addEventListener("pauseTrelloPolling", handlePause);

    async function fetchTrello(force = false) {
      if (!isMounted) return;

      // 1. SAFETY CHECKS (Removed the UI pause here so notifications still run fast!)
      if (document.hidden && !force) return; 

      // 2. RATE LIMITING (The "Mutex")
      const now = Date.now();
      const lastFetch = parseInt(localStorage.getItem("lastTrelloFetch") || "0");
      
      // SPEED UP: Lowered lock from 8s to 5s
      if (!force && (now - lastFetch < 5000)) return;

      // 3. LOCK & FETCH
      localStorage.setItem("lastTrelloFetch", now.toString());
      
      // Lock this specific request to a generation ID
      const myGen = fetchGenRef.current;

      try {
        window.dispatchEvent(new CustomEvent("systemClearError", { detail: "Trello" }));
        const res = await fetch(`/.netlify/functions/trello?t=${now}`);
        
        // Handle 429 specifically
        if (!res.ok) {
           if (res.status === 429) { window.dispatchEvent(new CustomEvent("systemReportError", { detail: { source: "Trello", message: "Rate limit hit" } })); console.warn("Trello Rate Limit Hit - Cooling down..."); } else { window.dispatchEvent(new CustomEvent("systemReportError", { detail: { source: "Trello", message: `API error ${res.status}` } })); }
           return;
        }

        let json = await res.json();
        if (!isMounted) return;

        // --- YOUR ORIGINAL DATA PROCESSING LOGIC ---
        let rawBuckets = Array.isArray(json?.buckets) ? json.buckets : (Array.isArray(json) ? json : []);

        // 1. DEFINE TEAM DATA
        const TEAM_DATA = [
          { id: "list-siya", title: "Siya", cards: [] },
          { id: "list-siya-review", title: "Siya - Review", cards: [] },
          { id: "list-bonisa", title: "Bonisa", cards: [] },
          { id: "list-songeziwe", title: "Songeziwe", cards: [] },
          { id: "list-enock", title: "Enock", cards: [] }
        ];

        // 2. ROBUST MERGE
        TEAM_DATA.forEach(teamList => {
          const existingIndex = rawBuckets.findIndex(b => {
             const apiTitle = (b.title || b.name || b.list || "").trim().toLowerCase();
             const myTitle  = teamList.title.trim().toLowerCase();
             return apiTitle === myTitle;
          });

          if (existingIndex === -1) {
            rawBuckets.push(teamList);
          } else {
            const existingBucket = rawBuckets[existingIndex];
            // Clean cards
            const realCards = existingBucket.cards || [];
            rawBuckets[existingIndex] = { ...existingBucket, cards: realCards };
          }
        });

       // 3. MAP FIELDS
        let mapped = rawBuckets.map((b) => {
          const title = b.title || b.name || b.list || "";
          return {
            id: b.id,
            title,
            cards: (b.cards || []).map((c) => ({
              id: c.id,
              title: c.name || c.title,
              due: c.due || "",
              badges: ensureBadgeTypes(Array.isArray(c.badges) ? c.badges : []),
              labels: c.labels || [], 
              people: c.idMembers || c.people || [],
              listId: b.id,
              list: title,
              customFields: (() => {
                 let safeCF = {};
                 for (let k in (c.customFields || {})) {
                    // ⚡ THE FIX: Catch the "[SYSTEM]" tags coming from Trello and map them to the React UI
                    if (k.includes("WorkStartTime") || k.includes("WorkTimerStart")) {
                        safeCF.WorkTimerStart = c.customFields[k];
                    } else if (k.includes("WorkDuration")) {
                        safeCF.WorkDuration = c.customFields[k];
                    } else if (k === "TimerStart") {
                        safeCF.TimerStart = c.customFields[k];
                    } else if (k === "Duration") {
                        safeCF.Duration = c.customFields[k];
                    } else {
                        safeCF[k] = c.customFields[k];
                    }
                 }
                 return safeCF;
              })(),
              description: c.desc || c.description || "",
              cover: c.cover || null,
              powerUpData: c.powerUpData || null,
              commentCount: c.commentCount ?? c.badges?.comments ?? 0,
              attachmentCount: c.attachmentCount ?? c.badges?.attachments ?? 0,
              checkItemsTotal: c.checkItemsTotal ?? c.badges?.checkItems ?? 0,
              checkItemsChecked: c.checkItemsChecked ?? c.badges?.checkItemsChecked ?? 0,
            })),
          };
        }); 

        // 4. PERSONA FILTER
        let persona = (import.meta.env.VITE_PERSONA || "").toLowerCase().trim();
        if (!persona || persona === "unknown") persona = "siya"; 

        const PERSONA_TITLES = persona === "siya"
            ? ["Siya", "Siya - Review", "Bonisa", "Songeziwe", "Enock"]
            : ["Yolandie to Data Capture", "Yolandie to Analyst", "Yolandie to Data Analyst", "Yolandie to Reviewer", "Yolandie to Send"];

        // Broadcast ALL lists (unfiltered) so the Move dropdown has every option
        const allListsRaw = mapped.map(b => ({ id: b.id, title: b.title, cardsLength: b.cards.length }));
        window.dispatchEvent(new CustomEvent("updateAllLists", { detail: allListsRaw }));

        let filtered = mapped.filter((b) => PERSONA_TITLES.includes(b.title));
        
        // 5. SORT LOGIC
        filtered.sort((a, b) => {
          // Check pins first
          const pins = JSON.parse(localStorage.getItem("PINNED_LISTS") || "[]");
          const aPin = pins.indexOf(a.id);
          const bPin = pins.indexOf(b.id);
          
          if (aPin !== -1 && bPin !== -1) return aPin - bPin;
          if (aPin !== -1) return -1;
          if (bPin !== -1) return 1;

          // Fallback to manual drag order
          let idxA = listOrderRef.current.indexOf(a.title);
          let idxB = listOrderRef.current.indexOf(b.title);
          if (idxA === -1) idxA = 999;
          if (idxB === -1) idxB = 999;
          return idxA - idxB;
        });
        
        if (filtered.length > 0) mapped = filtered;

        // 👇 THE GLITCH FIX MOVED UP: Block stale data BEFORE it triggers false notifications!
        if (myGen !== fetchGenRef.current) return;
        if (dragging && !force) return;
        if (Date.now() - lastMoveTime.current < 10000 && !force) return;

        // --- NOTIFICATION LOGIC ---
        // 1. If we have NO memory yet, we are just booting up. Memorize silently.
        const newlyFreshIds = new Set();
        if (!hasSnapshotRef.current && (!knownTrelloCardsRef.current || knownTrelloCardsRef.current.size === 0)) {
            const map = new Map();
            mapped.forEach(list => list.cards.forEach(c => map.set(c.id, list.title)));
            knownTrelloCardsRef.current = map;
            hasSnapshotRef.current = true; 
            console.log("🛡️ [Notifications] First boot. Memorized board silently.");
        } 
        // 2. If we DO have memory, it means we are actively polling. Compare and Notify.
        else {
            hasSnapshotRef.current = true; // Ensure shield is permanently off
            const newMap = new Map();
            
            mapped.forEach(list => {
                list.cards.forEach(c => {
                    newMap.set(c.id, list.title);
                    
                    // Look up where the card was 6 seconds ago
                    const oldListTitle = knownTrelloCardsRef.current ? knownTrelloCardsRef.current.get(c.id) : null;

                    // 👇 THE SIYA FILTER: Enforce the exact rules
                    const targetListTitle = list.title.toLowerCase();
                    const isSiyaList = targetListTitle.includes("siya");
                    const hasSiyaMember = (c.people || []).some(m => String(m).toLowerCase().includes("siya"));
                    
                    // If it lands in a Siya list OR Siya is assigned to it
                    if (isSiyaList || hasSiyaMember) {
                        
                        // Scenario A: Brand new card
                        if (!oldListTitle && knownTrelloCardsRef.current) {
                            console.log(`🔔 [Trello Notify] New Card Detected: "${c.title}" in ${list.title}`);
                            newlyFreshIds.add(c.id);
                            window.dispatchEvent(new CustomEvent("notify", {
                                detail: {
                                    text: `New card in ${list.title}: ${c.title}`,
                                    alt: "Trello",
                                    icon: trelloIcon,
                                    cardData: c,
                                    timestamp: new Date().toISOString()
                                }
                            }));
                        } 
                        // Scenario B: Card moved from a different list into this one
                        else if (oldListTitle && oldListTitle !== list.title) {
                            // 🛡️ ECHO SHIELD: Block false notifications if we just moved this card
                            const immunityTime = immuneCardsRef.current?.get(c.id) || 0;
                            if (Date.now() - immunityTime < 60000) return;

                            console.log(`🔔 [Trello Notify] Move Detected! "${c.title}" moved from [${oldListTitle}] to [${list.title}]`);
                            newlyFreshIds.add(c.id);
                            window.dispatchEvent(new CustomEvent("notify", {
                                detail: {
                                    text: `Card moved to ${list.title}: ${c.title}`,
                                    alt: "Trello",
                                    icon: trelloIcon,
                                    cardData: c,
                                    timestamp: new Date().toISOString()
                                }
                            }));
                        }
                    }
                });
            });
            // Overwrite the memory map with the new positions for the next 6-second check
            knownTrelloCardsRef.current = newMap;
        }
        // --- END USER LOGIC ---

        // Only update if data changed (Simple check)
        // Detect cards that are leaving the board before updating state
        const removedCards = [];
        prevBucketsRef.current.forEach(bucket => {
            bucket.cards?.forEach(card => {
                const newBucket = mapped.find(b => b.title === bucket.title);
                if (!newBucket?.cards?.find(c => c.id === card.id)) {
                    removedCards.push({ card, listTitle: bucket.title });
                }
            });
        });
        if (removedCards.length > 0) {
            setLeavingCards(prev => [...prev, ...removedCards]);
            const ids = new Set(removedCards.map(r => r.card.id));
            setTimeout(() => setLeavingCards(prev => prev.filter(r => !ids.has(r.card.id))), 500);
        }
        setTrelloBuckets(prev => {
            if (JSON.stringify(prev) === JSON.stringify(mapped)) return prev;
            return mapped;
        });
        if (newlyFreshIds && newlyFreshIds.size > 0) {
            setFreshCardIds(new Set(newlyFreshIds));
            setTimeout(() => setFreshCardIds(new Set()), 1200);
        }

        // Broadcast + cache OUTSIDE the setter (React 19 disallows side-effects inside setters)
        window.dispatchEvent(new CustomEvent("trelloPolled", { detail: mapped }));
        localStorage.setItem("TRELLO_CACHE", JSON.stringify(mapped));

      } catch (err) {
        console.error("Trello Poll Error:", err);
        window.dispatchEvent(new CustomEvent("systemReportError", { detail: { source: "Trello", message: err.message } }));
      }
    }

    // Initial Fetch (Bypass the cooldown block on first load)
    fetchTrello(true);

    // SPEED UP: Poll every 6 seconds to make notifications snappy
    pollTimer = setInterval(() => fetchTrello(), 6000);

    return () => {
        isMounted = false; 
        clearInterval(pollTimer);
        window.removeEventListener("pauseTrelloPolling", handlePause);
    };
  }, [dragging]); // fetchGenRef and lastMoveTime are refs, safe to omit

  // ... (keep allow patch buckets logic) ...
  // --- LISTEN FOR INSTANT UPDATES (Fixes Right Pane Delay) ---
  useEffect(() => {
    function handlePatch(e) {
      const { cardId, updater } = e.detail;
      setTrelloBuckets(prevBuckets => {
        // Deep clone to avoid mutation reference issues
        const newBuckets = prevBuckets.map(b => ({
          ...b,
          cards: b.cards.map(c => {
            if (c.id !== cardId) return c;
            
            // Apply the update (e.g., change Priority)
            const updatedCard = updater(c);
            
            // Re-calculate badges for the Right Panel view immediately
            const newBadges = [];
            
            // 1. Priority
            if (updatedCard.customFields?.Priority) {
               newBadges.push({ text: `Priority: ${updatedCard.customFields.Priority}`, isBottom: true });
            }
            // 2. Status
            if (updatedCard.customFields?.Status) {
               newBadges.push({ text: `Status: ${updatedCard.customFields.Status}`, isBottom: true });
            }
            // 3. Active
            if (updatedCard.customFields?.Active) {
               newBadges.push({ text: `Active: ${updatedCard.customFields.Active}`, isBottom: true });
            }
            
            // Preserve labels
            updatedCard.labels.forEach(l => newBadges.push({ text: l, isBottom: false }));
            
            updatedCard.badges = ensureBadgeTypes(newBadges);
            return updatedCard;
          })
        }));
        return newBuckets;
      });
    }

    window.addEventListener("patchCardInBuckets", handlePatch);
    return () => window.removeEventListener("patchCardInBuckets", handlePatch);
  }, []);

  // Map clientFiles -> UI files (unchanged)
  const files = (clientFiles || []).map((f, i) => {
    let type = f.type || "other";
    if (!f.type && f.mimeType) {
      if (f.mimeType === "application/pdf") type = "pdf";
      else if (f.mimeType.startsWith("image/")) type = "img";
      else if (f.mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" || f.mimeType === "application/vnd.ms-excel") type = "xls";
    }
    const url = f.url || (f.id ? `/.netlify/functions/drive-download?id=${encodeURIComponent(f.id)}` : "#");
    const thumbUrl = f.thumbUrl || url;
    return { id: f.id || `att-${i}`, name: f.name || `Attachment ${i + 1}`, type, url, thumbUrl };
  });

  const isImage = (t) => t === "img";
  const isPdf = (t) => t === "pdf";
  const isExcel = (t) => t === "xls";

  return (
    <div className="right-panel">
      <div className="panel-title" style={{ textAlign: 'center', paddingTop: '10px' }}>Trello Cards</div>

      {/* ARCHIVE MODAL OVERLAY */}
      {showArchiveModal && (
        <div style={{ position: 'fixed', top:0, left:0, width:'100vw', height:'100vh', background:'rgba(0,0,0,0.6)', zIndex: 9999, display:'grid', placeItems:'center' }} onClick={() => setShowArchiveModal(false)}>
          <div className="popup-anim-in" style={{ background: '#f4f5f7', width: '400px', maxHeight: '80vh', borderRadius: '3px', display: 'flex', flexDirection: 'column', boxShadow: '0 8px 16px rgba(0,0,0,0.4)', transformOrigin: 'center', overflowX: 'hidden' }} onClick={e => e.stopPropagation()}>
             
             {/* HEADER */}
             <div style={{ padding: '16px 16px 8px 16px', display: 'flex', justifyContent: 'space-between', color: '#172b4d', fontWeight: 600 }}>
                <span>Archived items</span>
                <button onClick={() => setShowArchiveModal(false)} style={{ background:'none', border:'none', color:'#42526e', cursor:'pointer', fontSize:'16px' }}>✕</button>
             </div>
             
             {/* 🔍 ARCHIVE SEARCH BAR */}
             <div style={{ padding: '0 16px 12px 16px', borderBottom: '1px solid rgba(9,30,66,0.13)' }}>
                <input 
                  type="text" 
                  placeholder="Search archives..." 
                  value={archiveSearch}
                  onChange={(e) => setArchiveSearch(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '3px', border: '2px solid #dfe1e6', outline: 'none', fontSize: '13px', color: '#172b4d' }}
                />
             </div>

             <div style={{ padding: '16px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {archivedLoading ? <div style={{ fontStyle: "italic", color: "#9aa0a6", fontSize: "15px", fontFamily: "'Inter', sans-serif", textAlign: "center", padding: "16px" }}>Loading archive...</div> :
                  (() => {
                    const q = debouncedArchiveSearch.toLowerCase();
                    const filtered = q ? archivedCards.filter(c => c.title.toLowerCase().includes(q)) : archivedCards;
                    if (filtered.length === 0) return <div style={{ color: '#5e6c84', textAlign:'center', padding: '20px' }}>No archived cards found.</div>;
                    return filtered.map(c => (
                    <div 
                      key={c.id} 
                      style={{ background: '#ffffff', borderRadius: '3px', padding: '12px', marginBottom: '8px', cursor: 'pointer', position: 'relative', boxShadow: '0 1px 1px rgba(9,30,66,0.25)', display: 'flex', flexDirection: 'column', gap: '8px', border: '1px solid transparent' }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = '#0079bf'}
                      onMouseLeave={e => e.currentTarget.style.borderColor = 'transparent'}
                      onClick={() => {
                        window.dispatchEvent(new CustomEvent("openTrelloCard", { detail: c }));
                        setShowArchiveModal(false);
                      }}
                    >
                       <div style={{ color: '#172b4d', fontWeight: 500, fontSize: '14px', paddingRight: '30px', lineHeight: '1.4', wordBreak: 'break-word' }}>
                          {c.title}
                       </div>
                       
                       <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                          <span style={{ background: '#ebecf0', padding: '4px 8px', borderRadius: '3px', fontSize: '12px', color: '#42526e', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 500 }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M20.54 5.23l-1.39-1.68C18.88 3.21 18.47 3 18 3H6c-.47 0-.88.21-1.16.55L3.46 5.23C3.17 5.57 3 6.02 3 6.5V19c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6.5c0-.48-.17-.93-.46-1.27zM6.24 5h11.52l.83 1H5.41l.83-1zM5 19V8h14v11H5zm11-5.5l-4 4-4-4 1.41-1.41L11 13.67V10h2v3.67l1.59-1.58L16 13.5z"/></svg>
                            Archived
                          </span>
                          
                          {(c.badges || []).map((b, k) => (
                            <span key={k} className={`tl-badge ${b.type || "label-default"}`} style={{ padding: '4px 8px', fontSize: '12px' }}>
                              {b.text}
                            </span>
                          ))}
                       </div>

                       <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
                          <div className="tl-people" style={{ margin: 0 }}>
                            {c.people?.map((p, idx) => {
                              const img = avatarFor(p);
                              return img ? <img key={idx} className="av-img" src={img} alt={p} style={{ width: 24, height: 24 }} onError={(e) => { e.currentTarget.style.display = "none"; }} /> : <div key={idx} className="av" style={{ width: 24, height: 24 }}>{p.slice(0,1)}</div>;
                            })}
                          </div>
                       </div>

                       <div style={{ position: 'absolute', top: '12px', right: '8px', display: 'flex', gap: '4px' }}>
  {/* RECOVER BUTTON */}
  <button
    title="Recover"
    onClick={async (e) => {
      e.stopPropagation();
      window.dispatchEvent(new Event("pauseTrelloPolling"));
      setArchivedCards(prev => prev.filter(x => x.id !== c.id));
      fetch("/.netlify/functions/trello-restore", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cardId: c.id }) });
      triggerSnackbar("Card restored to board");
    }}
    style={{ background: 'transparent', border: 'none', color: '#6b778c', cursor: 'pointer', padding: '4px', display: 'grid', placeItems: 'center', transition: 'color 0.2s' }}
    onMouseEnter={e => e.currentTarget.style.color = '#0052cc'}
    onMouseLeave={e => e.currentTarget.style.color = '#6b778c'}
  >
    <svg width="18" height="18" viewBox="0 0 24 24"><path fill="currentColor" d="M13 3a9 9 0 0 0-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42A8.954 8.954 0 0 0 13 21a9 9 0 0 0 0-18zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z"/></svg>
  </button>

  {/* 🗑️ DELETE PERMANENTLY BUTTON */}
  <button
    title="Delete permanently"
    onClick={async (e) => {
      e.stopPropagation();
      if (!window.confirm(`Permanently delete "${c.title}"? This cannot be undone.`)) return;
      
      const cid = c.id;

      // 🚀 NEW: Pause background polling to give Trello time to process the deletion
      window.dispatchEvent(new Event("pauseTrelloPolling"));
      
      // Optimistic UI update: remove from the modal view immediately
      setArchivedCards(prev => prev.filter(x => x.id !== cid));
      
      // 🚀 NEW: Ensure the ID is removed from the global card memory so it doesn't "ghost" back
      if (knownTrelloCardsRef.current) {
        knownTrelloCardsRef.current.delete(cid);
      }

      triggerSnackbar("Card deleted permanently");

      try {
        const res = await fetch("/.netlify/functions/trello-delete-card", { 
          method: "POST", 
          headers: { "Content-Type": "application/json" }, 
          body: JSON.stringify({ cardId: cid }) 
        });

        if (!res.ok) throw new Error("Delete failed on server");

      } catch (err) {
        console.error("Permanent delete failed:", err);
        alert("Failed to delete card on Trello. It may reappear.");
        // Optional: Re-fetch the archive to show the card again if deletion failed
        openArchiveBin();
      }
    }}
    style={{ background: 'transparent', border: 'none', color: '#6b778c', cursor: 'pointer', padding: '4px', display: 'grid', placeItems: 'center', transition: 'color 0.2s' }}
    onMouseEnter={e => e.currentTarget.style.color = '#d93025'}
    onMouseLeave={e => e.currentTarget.style.color = '#6b778c'}
  >
    <svg width="18" height="18" viewBox="0 0 24 24"><path fill="currentColor" d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
  </button>
</div>
                    </div>
                  ));
                  })()}
             </div>
          </div>
        </div>
      )}
      <div className="right-scroll left-scroll">
        <div className="trello-col-wrap">
          {trelloBuckets.map((bucket, i) => (
            <div 
                className="tl-col" 
                key={bucket.id || i}
                // 1. Mandatory for dropping
                onDragOver={(e) => e.preventDefault()} 
                // 2. INTELLIGENT ROUTING: List Swap vs Card Move
                onDragEnter={(e) => {
                    e.preventDefault();
                    if (dragging) {
                        // If dragging a LIST -> Reorder Lists
                        if (dragItem.current?.listIdx !== undefined) handleListDragEnter(e, i);
                        // If dragging a CARD -> Move Card to this List
                        else handleColumnDragEnter(i);
                    }
                }}
                // 3. Drop Handler
                onDrop={(e) => {
                    e.preventDefault();
                    // Save Card Move
                    if (dragItem.current?.grpI !== undefined) handleDragEnd();
                    // Finish List Move
                    if (dragItem.current?.listIdx !== undefined) setDragging(false);
                }}
            >
              {/* HEADER (Draggable) */}
              <div 
                className="tl-head"
                draggable
                onDragStart={(e) => handleListDragStart(e, i)}
                onDragEnd={() => {
                    setDragging(false);
                    dragItem.current = null;
                    dragNode.current = null;
                }}
                style={{ cursor: "grab", display: 'flex', justifyContent: 'space-between', alignItems: 'center' }} 
              >
                <span className="tl-title">{bucket.title}</span>
              
              </div>
              
              {/* CARDS */}
              <div className="tl-cards">
                {bucket.cards.map((card, j) => (
                  <div
                    key={card.id || j}
                    draggable
                    onDragStart={(e) => handleDragStart(e, { grpI: i, itemI: j })}
                    onDragEnter={dragging ? (e) => handleDragEnter(e, { grpI: i, itemI: j }) : null}
                    onDragOver={(e) => e.preventDefault()}
                    onDragEnd={handleDragEnd}
                    className={getStyles(i, j, card.id)}
                    style={activeTrelloCardId === card.id ? { backgroundColor: "#f1f3f4" } : undefined}
                    onClick={() => {
                      if (activeTrelloCardId === card.id) {
                        window.dispatchEvent(new CustomEvent("closeTrelloCard"));
                      } else {
                        window.dispatchEvent(new CustomEvent("openTrelloCard", { detail: card }));
                      }
                    }}
                  >
                     {/* ... (Your Card Content - Colors, Badges, Title, Footer) ... */}
                     {/* Copy your existing card inner content here if needed, or leave it as is */}
                     
                     {/* RE-INSERTING YOUR CARD CONTENT FOR CLARITY: */}
                     {(() => {
                      const coverColor = card.cover?.color;
                      const titleColor = getTrelloCoverColor(card.title);
                      const colorMap = { sky: "#6CC3E0", orange: "#FAA53D", blue: "#579DFF", green: "#4BCE97", yellow: "#F5CD47", red: "#F87168", purple: "#9F8FEF" };
                      const finalColor = titleColor || colorMap[coverColor];
                      if (finalColor) return ( <div className="tl-card-cover" style={{ backgroundColor: finalColor }} /> );
                      return null;
                    })()}

                    {(() => {
                      const labelBadges = (card.labels || []).map(l => ({ text: l, type: getLabelColor(l), isTop: true }));
                      const labelTexts = new Set(labelBadges.map(b => (b.text || "").toLowerCase().trim()));
                      const uniqueCardBadges = (card.badges || []).filter(b => !labelTexts.has((b.text || "").toLowerCase().trim()));
                      const allBadges = [...labelBadges, ...uniqueCardBadges];
                      const topBadges = allBadges.filter(b => b.isTop);
                      const bottomBadges = allBadges.filter(b => b.isBottom);
                      const actRanges = card.powerUpData?.["act-timer-ranges"] || [];
                      const actTimerMins = actRanges.reduce((sum, r) => sum + ((r[2] - r[1]) / 60), 0);
                      const v1Users = card.powerUpData?.users || {};
                      const v1TimerMins = Object.values(v1Users).reduce((sum, u) => sum + ((u.time || 0) / 60000), 0);
                      const cfDurationMins = parseFloat(card.customFields?.Duration || "0") || 0;
                      const fmtMins = (m) => { const t = Math.floor(m); if (t >= 60) { const h = Math.floor(t/60); return t%60 > 0 ? `${h}h ${t%60}m` : `${h}h`; } return `${t}m`; };
                      const hasFooter = actTimerMins > 0 || v1TimerMins > 0 || cfDurationMins > 0 || (card.people && card.people.length > 0);

                      return (
                        <>
                          {topBadges.length > 0 && <div className="tl-badges">{topBadges.map((b, k) => <span key={k} className={`tl-badge ${b.type || "label-default"}`}>{b.text}</span>)}</div>}
                          <div className="tl-card-title">{card.title}</div>

                          {(card.description || card.due || card.attachmentCount > 0 || card.commentCount > 0 || card.checkItemsTotal > 0) && (
                            <div className="tl-counters">
                              {card.description && <span className="tl-cnt"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg></span>}
                              {card.due && <span className="tl-cnt">&#128336;</span>}
                              {card.attachmentCount > 0 && <span className="tl-cnt"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>{card.attachmentCount}</span>}
                              {card.commentCount > 0 && <span className="tl-cnt"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>{card.commentCount}</span>}
                              {card.checkItemsTotal > 0 && <span className="tl-cnt"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>{card.checkItemsChecked}/{card.checkItemsTotal}</span>}
                            </div>
                          )}

                          {bottomBadges.length > 0 && <div className="tl-badges" style={{marginTop:"6px", flexDirection:"column", alignItems:"flex-start", gap:"4px"}}>{bottomBadges.map((b, k) => <span key={k} className={`tl-badge ${b.type || "label-default"}`}>{b.text}</span>)}</div>}

                          {hasFooter && (
                            <div className="tl-footer">
                              <div className="tl-timers">
                                {actTimerMins > 0 && <span className="tl-cnt"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>{fmtMins(actTimerMins)}</span>}
                                {v1TimerMins > 0 && <span className="tl-cnt"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>{fmtMins(v1TimerMins)}</span>}
                                {cfDurationMins > 0 && <span className="tl-cnt"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>{fmtMins(cfDurationMins)}</span>}
                              </div>
                              <div className="tl-people">
                                {card.people?.map((p, idx) => {
                                  const img = avatarFor(p);
                                  return img ? <img key={idx} className="av-img" src={img} alt={p} onError={(e) => { e.currentTarget.style.display = "none"; }} /> : <div key={idx} className="av">{p.slice(0,1)}</div>;
                                })}
                              </div>
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                ))}
                {/* Leaving cards — play exit animation before DOM removal */}
                {leavingCards.filter(lc => lc.listTitle === bucket.title).map(lc => (
                  <div key={`leaving-${lc.card.id}`} className="tl-card-leaving-wrap">
                    <div className="tl-card tl-card-leaving">
                      <div className="tl-card-title">{lc.card.title}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* 🟢 DYNAMIC ADD CARD INPUT */}
              {addingToList === bucket.id ? (
                <div style={{ padding: '8px', background: '#fff', borderRadius: '8px', boxShadow: '0 1px 2px rgba(0,0,0,0.1)', marginTop: '8px' }}>
                  <textarea
                    autoFocus
                    placeholder="Enter a title for this card..."
                    value={newCardTitle}
                    onChange={(e) => setNewCardTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleCreateCard(bucket.id, bucket.title); // 👈 Added bucket.title
                      }
                      if (e.key === 'Escape') {
                        setAddingToList(null);
                        setNewCardTitle("");
                      }
                    }}
                    style={{ width: '100%', border: 'none', resize: 'none', outline: 'none', fontSize: '14px', fontFamily: 'inherit', color: '#172b4d', minHeight: '54px' }}
                  />
                   <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                    <button 
                      onClick={() => handleCreateCard(bucket.id, bucket.title)} // 👈 Added bucket.title
                      style={{ padding: '6px 12px', borderRadius: '3px', border: 'none', background: '#0b57d0', color: 'white', fontWeight: 500, cursor: 'pointer', fontSize: '13px' }}
                    >
                      Add card
                    </button>
                    <button 
                      onClick={() => { setAddingToList(null); setNewCardTitle(""); }} 
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#42526e', fontSize: '20px', display: 'grid', placeItems: 'center', width: '32px', height: '32px', borderRadius: '3px' }} 
                      onMouseEnter={e => e.currentTarget.style.background = '#091e420f'} 
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ) : (
                <button 
                  className="tl-add" 
                  onClick={() => {
                    setAddingToList(bucket.id);
                    setNewCardTitle("");
                  }}
                >
                  <span>+</span> Add a card
                </button>
              )}
            </div>
          ))}
        </div>

        <div style={{ marginTop: "0.75rem", marginBottom: "1.5rem", display: 'flex', justifyContent: 'center' }}>
        <button
          onClick={openArchiveBin}
          style={{ background: 'transparent', border: 'none', color: '#9fadbc', cursor: 'pointer', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 500, transition: 'color 0.2s' }}
          onMouseEnter={e => e.currentTarget.style.color = '#8993a4'}
          onMouseLeave={e => e.currentTarget.style.color = '#9fadbc'}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M20.54 5.23l-1.39-1.68C18.88 3.21 18.47 3 18 3H6c-.47 0-.88.21-1.16.55L3.46 5.23C3.17 5.57 3 6.02 3 6.5V19c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6.5c0-.48-.17-.93-.46-1.27zM6.24 5h11.52l.83 1H5.41l.83-1zM5 19V8h14v11H5zm11-5.5l-4 4-4-4 1.41-1.41L11 13.67V10h2v3.67l1.59-1.58L16 13.5z"/></svg>
          Archive Bin
        </button>
      </div>
        <div className="doc-grid">
           {files.map((f) => (
            <button key={f.id} className={`doc-card ${f.type}`} onClick={() => window.dispatchEvent(new CustomEvent("openEmailAttachmentPreview", { detail: { file: f } }))} title={f.name}>
              <div className="doc-preview">
                {isImage(f.type) ? <img src={f.thumbUrl || f.url} alt={f.name} /> : isPdf(f.type) ? <iframe title={f.name} src={f.url} className="pdf-frame" /> : isExcel(f.type) ? <div className="doc-icon">XLS</div> : <div className="doc-icon">FILE</div>}
              </div>
              <div className="doc-info">
                <span className={`doc-badge ${f.type}`}>{f.type === "xls" ? "XLSX" : f.type.toUpperCase()}</span>
                <span className="doc-name">{f.name}</span>
              </div>
              <span className="doc-corner" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
});

// 👇 NEW: Text Formatter for GChat (Bolding + Links + Newlines + Highlights)
export function formatChatText(text, highlightQuery = "") {
  if (!text) return "";
 
  // Helper to safely highlight matched text
  const renderHighlight = (str) => {
    if (!highlightQuery.trim()) return str;
    // Escape regex special characters from the query
    const regex = new RegExp(`(${highlightQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const chunks = str.split(regex);
    return chunks.map((chunk, j) => 
      chunk.toLowerCase() === highlightQuery.toLowerCase() ? (
        <mark key={j} style={{ backgroundColor: "#fff000", color: "#000", borderRadius: "2px", padding: "0 2px" }}>{chunk}</mark>
      ) : chunk
    );
  };

  // 1. Split by newlines, URLs, and *bold* markers
  // Regex captures: (\n) OR (http...) OR (*bold*)
  const parts = text.split(/(\n|https?:\/\/[^\s]+|\*[^*]+\*)/g);

  return parts.map((part, i) => {
    if (!part) return null;
    // A. Handle Newlines
    if (part === "\n") return <br key={i} />;
    
    // B. Handle URLs
    if (part.match(/^https?:\/\//)) {
      if (part.includes("docs.google.com") || part.includes("sheets.google.com") || part.includes("meet.google.com")) {
        return (
          <SmartLink
            key={i}
            url={part}
            style={{ color: "#1a73e8", textDecoration: "underline", wordBreak: "break-all" }}
          >
            {part}
          </SmartLink>
        );
      }
      return (
        <a
          key={i}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "#1a73e8", textDecoration: "underline", wordBreak: "break-all" }}
          onClick={e => e.stopPropagation()}
        >
          {part}
        </a>
      );
    }
    
    // C. Handle *Bold*
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
      return <strong key={i}>{renderHighlight(part.slice(1, -1))}</strong>;
    }

    // D. Plain Text (now wrapped in highlight function)
    return <span key={i}>{renderHighlight(part)}</span>;
  });
}

export const EmailSignature = () => (
  <div style={{ padding: "0 16px 24px 16px", fontFamily: "Verdana, Arial, sans-serif", fontSize: "13px", color: "#3c4043", lineHeight: "1.6", cursor: "default" }}>
    <div style={{ marginBottom: "16px" }}>Kind regards</div>
    <div style={{ color: "#b38f6a", fontWeight: "bold", fontSize: "15px", marginBottom: "16px" }}>Siyabonga Nono</div>
    <div style={{ color: "#b38f6a", marginBottom: "16px" }}>Bsc in Math Science in Actuarial Science</div>
    
    <div style={{ marginBottom: "12px", color: "#5f6368" }}>
      <b style={{ color: "#5f6368" }}>T</b> 011 463 0313 <span style={{ display: "inline-block", width: "8px" }}></span> <b style={{ color: "#5f6368" }}>M</b> 072 689 0562
    </div>
    <div style={{ marginBottom: "12px", color: "#5f6368" }}>
      <b style={{ color: "#5f6368" }}>E</b> <a href="mailto:siyabonga@actuaryconsulting.co.za" style={{ color: "#1a73e8", textDecoration: "none" }}>siyabonga@actuaryconsulting.co.za</a> <span style={{ display: "inline-block", width: "8px" }}></span> <b style={{ color: "#5f6368" }}>W</b> <a href="http://actuaryconsulting.co.za" style={{ color: "#1a73e8", textDecoration: "none" }}>actuaryconsulting.co.za</a>
    </div>
    <div style={{ marginBottom: "20px", color: "#5f6368" }}>
      <b style={{ color: "#5f6368" }}>A</b> Corner 5th &amp; Maude Street, Sandown, Sandton, 2031
    </div>
    
    <div style={{ marginBottom: "16px" }}>
      <div style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: "32px", color: "#b38f6a", letterSpacing: "1px", lineHeight: "1" }}>ACTUARY</div>
      <div style={{ fontFamily: "Verdana, sans-serif", fontSize: "12px", color: "#5f6368", letterSpacing: "6.5px", marginTop: "6px", marginLeft: "2px" }}>CONSULTING</div>
    </div>
    
    <div style={{ fontSize: "10px", color: "#9aa0a6", lineHeight: "1.5", textAlign: "justify", borderTop: "1px solid #f1f3f4", paddingTop: "12px" }}>
      The information contained in this email is confidential and may be subject to legal privilege. The content of this email, which may include one or more attachments, is strictly confidential, and is intended solely for the use of the named recipient/s. If you are not the intended recipient, you cannot use, copy, distribute, disclose or retain the email or any part of its contents or take any action in reliance on it. If you have received this email in error, please email the sender by replying to this message and to permanently delete it and all attachments from your computer. All reasonable precautions have been taken to ensure that no viruses are present in this email and the company cannot accept responsibility for any loss or damage arising from the use of this email or attachments.
    </div>
 </div>
);

export const EmailMetadata = ({ email }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div style={{ position: "relative", marginTop: "2px" }}>
      <div 
        style={{ 
          fontSize: "12px", 
          color: "#5f6368", 
          display: "inline-flex", 
          alignItems: "center", 
          gap: "4px", 
          cursor: "pointer", 
          padding: "2px 4px", 
          marginLeft: "-4px", 
          borderRadius: "4px",
          position: "relative", 
          zIndex: isOpen ? 95 : "auto" 
        }}
        onClick={(e) => {
          // ⚡ STOP BUBBLING: Prevents the parent email container from refreshing or closing
          e.preventDefault();
          e.stopPropagation();
          setIsOpen(prev => !prev);
        }}
        onMouseEnter={e => e.currentTarget.style.background = "#f1f3f4"}
        onMouseLeave={e => e.currentTarget.style.background = "transparent"}
      >
        to me <span style={{ fontSize: "10px" }}>{isOpen ? "▲" : "▼"}</span>
      </div>

      {isOpen && (
        <div
          style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 90 }}
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsOpen(false); }}
        />
      )}
      <PopupSpring
        show={isOpen}
        style={{
          position: "absolute", top: "100%", left: "0", marginTop: "4px",
          background: "white", border: "1px solid #dadce0", borderRadius: "8px",
          boxShadow: "0 4px 12px rgba(0,0,0,0.15)", padding: "16px",
          zIndex: 100, minWidth: "480px", fontSize: "13px", color: "#202124",
          display: "flex", flexDirection: "column", cursor: "default"
        }}
        origin="top left"
        onClick={e => e.stopPropagation()}
      >
            <div style={{ display: "grid", gridTemplateColumns: "75px 1fr", gap: "8px 12px", alignItems: "baseline" }}>
              <span style={{ color: "#5f6368", textAlign: "right" }}>from:</span>
              <span><strong>{email.fromName}</strong> {email.fromEmail}</span>
              
              <span style={{ color: "#5f6368", textAlign: "right" }}>to:</span>
              <span>{Array.isArray(email.to) ? email.to.join(", ") : email.to || "Siyabonga Nono <siya@actuaryspace.co.za>"}</span>
              
              <span style={{ color: "#5f6368", textAlign: "right" }}>date:</span>
              <span>{email.date ? new Date(email.date).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : email.time}</span>
              
              <span style={{ color: "#5f6368", textAlign: "right" }}>subject:</span>
              <span>{email.subject}</span>

              <span style={{ color: "#5f6368", textAlign: "right" }}>security:</span>
              <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <svg width="14" height="14" viewBox="0 0 24 24"><path fill="#5f6368" d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zM9 6c0-1.66 1.34-3 3-3s3 1.34 3 3v2H9V6zm9 14H6V10h12v10zm-6-3c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2z"/></svg>
                Standard encryption (TLS)
              </span>
            </div>
      </PopupSpring>
    </div>
  );
};

export default RightPanel;
