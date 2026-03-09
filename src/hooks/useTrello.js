import { useState, useRef, useEffect } from "react";
import { ensureBadgeTypes } from "../utils/trelloUtils.js";
import { LIVE_TRELLO_AVATARS } from "../utils/avatarUtils.js";

export function useTrello({ currentView, setCurrentView }) {

  useEffect(() => {
    fetch("/.netlify/functions/trello-members")
      .then(res => res.json())
      .then(data => {
        if (data.ok && data.members) {
          data.members.forEach(m => {
            if (m.avatarUrl) {
              const full = m.fullName.toLowerCase().trim();
              const first = full.split(' ')[0];
              const finalUrl = m.avatarUrl.endsWith('.png') ? m.avatarUrl : m.avatarUrl + '/50.png';
              LIVE_TRELLO_AVATARS[full] = finalUrl;
              LIVE_TRELLO_AVATARS[first] = finalUrl;
            }
          });
        }
      })
      .catch(err => console.error("Failed to fetch Trello members", err));
  }, []);

  const [showLabelPicker, setShowLabelPicker] = useState(false);
  const [showAddTime, setShowAddTime] = useState(false);
  const [manualHours, setManualHours] = useState("0");
  const [manualMins, setManualMins] = useState("0");

  // Trello buckets (zero-latency engine)
  const [trelloBuckets, _setTrelloBuckets] = useState(() => {
    try {
      const cached = localStorage.getItem("TRELLO_CACHE");
      return cached ? JSON.parse(cached) : [];
    } catch(e) { return []; }
  });
  const setTrelloBuckets = (action) => {
    _setTrelloBuckets(prev => {
      const next = typeof action === 'function' ? action(prev) : action;
      window.dispatchEvent(new CustomEvent("optimisticRightPane", { detail: next }));
      return next;
    });
  };

  // Cached lists for Move Menu
  const [allTrelloLists, setAllTrelloLists] = useState(() => {
    try {
      const cached = localStorage.getItem("TRELLO_LISTS_CACHE");
      return cached ? JSON.parse(cached) : [];
    } catch(e) { return []; }
  });

  useEffect(() => {
    fetch("/.netlify/functions/trello-lists")
      .then(res => res.json())
      .then(data => {
        if (data.lists) {
          const newLists = data.lists.map(l => ({ id: l.id, title: l.name, cardsLength: 0 }));
          setAllTrelloLists(prev => {
            const merged = newLists.map(nl => {
              const existing = prev.find(p => p.id === nl.id);
              return existing ? { ...nl, cardsLength: existing.cardsLength } : nl;
            });
            localStorage.setItem("TRELLO_LISTS_CACHE", JSON.stringify(merged));
            return merged;
          });
        }
      })
      .catch(err => console.error("Failed to fetch lists:", err));

    const handler = e => {
      setAllTrelloLists(prevLists => {
        const activeLists = e.detail;
        const master = [...prevLists];
        activeLists.forEach(active => {
          const found = master.find(m => m.id === active.id);
          if (found) found.cardsLength = active.cardsLength;
          else master.push(active);
        });
        localStorage.setItem("TRELLO_LISTS_CACHE", JSON.stringify(master));
        return master;
      });
    };
    window.addEventListener("updateAllLists", handler);
    return () => window.removeEventListener("updateAllLists", handler);
  }, []);

  // Card modal state
  const [trelloCard, setTrelloCard] = useState(null);
  const [trelloPreview, setTrelloPreview] = useState(null);
  const trelloAttachmentRef = useRef(null);
  const [checklists, setChecklists] = useState([]);
  const [newChecklistTitle, setNewChecklistTitle] = useState("Checklist");
  const [copyFromChecklist, setCopyFromChecklist] = useState("");
  const [attachLink, setAttachLink] = useState("");
  const [attachName, setAttachName] = useState("");
  const [cardAttachments, setCardAttachments] = useState([]);
  const [trelloMenuOpen, setTrelloMenuOpen] = useState(false);
  const [showMoveSubmenu, setShowMoveSubmenu] = useState(false);
  const [moveTab, setMoveTab] = useState("outbox");
  const [moveTargetList, setMoveTargetList] = useState("");
  const [moveTargetPos, setMoveTargetPos] = useState(1);
  const [moveListSearch, setMoveListSearch] = useState("");
  const [descEditing, setDescEditing] = useState(false);
  const [descDraft, setDescDraft] = useState("");
  const [trelloMembers, setTrelloMembers] = useState([]);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [addMenuStep, setAddMenuStep] = useState("main");
  const [showMemberShortcut, setShowMemberShortcut] = useState(false);
  const pendingCFRef = useRef(new Map());

  // Clear card when navigating away
  useEffect(() => {
    if (currentView.app !== "trello") setTrelloCard(null);
  }, [currentView.app]);

  // Fetch checklists & attachments when card opens
  useEffect(() => {
    if (trelloCard?.id) {
      fetch(`/.netlify/functions/trello-checklists?cardId=${trelloCard.id}`)
        .then(res => res.json())
        .then(data => { if(Array.isArray(data)) setChecklists(data); })
        .catch(err => console.error("Checklist fetch failed:", err));

      fetch(`/.netlify/functions/trello-attachments?cardId=${trelloCard.id}`)
        .then(res => res.json())
        .then(data => { if(Array.isArray(data)) setCardAttachments(data); })
        .catch(err => console.error("Attachment fetch failed:", err));
    }
  }, [trelloCard?.id]);

  // Fetch board members
  useEffect(() => {
    fetch("/.netlify/functions/trello-members")
      .then(res => res.json())
      .then(data => { if (data.ok && data.members) setTrelloMembers(data.members); })
      .catch(err => console.error("Failed to fetch members", err));
  }, []);

  // closeTrelloCard event
  useEffect(() => {
    const handler = () => { setTrelloCard(null); setCurrentView({ app: "none", contact: null }); };
    window.addEventListener("closeTrelloCard", handler);
    return () => window.removeEventListener("closeTrelloCard", handler);
  }, []);

  // Click outside closes menus
  useEffect(() => {
    const close = (e) => {
      if (e.target.closest?.(".kebab-wrap")) return;
      setTrelloMenuOpen(false);
      setShowMoveSubmenu(false);
      if (!e.target.closest?.(".add-menu-wrap")) setShowAddMenu(false);
      if (!e.target.closest?.(".member-shortcut-wrap")) setShowMemberShortcut(false);
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);

  // Track pending custom field updates
  useEffect(() => {
    function onPendingCF(e) {
      const { cardId, field, ttlMs = 2000 } = e.detail || {};
      if (!cardId || !field) return;
      const now = Date.now();
      const m = pendingCFRef.current;
      const rec = m.get(cardId) || {};
      rec[field] = now + ttlMs;
      m.set(cardId, rec);
    }
    window.addEventListener("pendingCF", onPendingCF);
    return () => window.removeEventListener("pendingCF", onPendingCF);
  }, []);

  // Receive polled data from Right Panel
  useEffect(() => {
    function handlePoll(e) {
      _setTrelloBuckets(e.detail);
    }
    window.addEventListener("trelloPolled", handlePoll);
    return () => window.removeEventListener("trelloPolled", handlePoll);
  }, []);

  // Instant patch listener (fixes 10s delay)
  useEffect(() => {
    function handlePatch(e) {
      const { cardId, updater } = e.detail;
      _setTrelloBuckets(prevBuckets => {
        return prevBuckets.map(b => ({
          ...b,
          cards: b.cards.map(c => {
            if (c.id !== cardId) return c;
            const updatedCard = updater(c);
            const newBadges = [];
            if (updatedCard.customFields?.Priority) newBadges.push({ text: `Priority: ${updatedCard.customFields.Priority}`, isBottom: true });
            if (updatedCard.customFields?.Status) newBadges.push({ text: `Status: ${updatedCard.customFields.Status}`, isBottom: true });
            if (updatedCard.customFields?.Active) newBadges.push({ text: `Active: ${updatedCard.customFields.Active}`, isBottom: true });
            (updatedCard.labels || []).forEach(l => newBadges.push({ text: l, isBottom: false }));
            updatedCard.badges = ensureBadgeTypes(newBadges);
            return updatedCard;
          })
        }));
      });
    }
    window.addEventListener("patchCardInBuckets", handlePatch);
    return () => window.removeEventListener("patchCardInBuckets", handlePatch);
  }, []);

  // Sync open card with bucket state
  useEffect(() => {
    if (!trelloCard?.id) return;

    let fresh = null;
    for (const b of trelloBuckets) {
      const hit = (b.cards || []).find(x => x.id === trelloCard.id);
      if (hit) { fresh = hit; break; }
    }
    if (!fresh) return;

    const now = Date.now();
    const pend = pendingCFRef.current.get(trelloCard.id) || {};
    const isPending = (field) => pend[field] && pend[field] > now;

    const oldCF = JSON.stringify(trelloCard.customFields || {});
    const newCF = JSON.stringify(fresh.customFields || {});
    const oldLabels = JSON.stringify(trelloCard.labels || []);
    const newLabels = JSON.stringify(fresh.labels || []);
    const oldDesc = trelloCard.description || "";
    const newDesc = fresh.description || "";
    const oldMembers = JSON.stringify(trelloCard.members || []);
    const newMembers = JSON.stringify(fresh.people || []);

    if (oldCF !== newCF || oldLabels !== newLabels || oldDesc !== newDesc || oldMembers !== newMembers) {
      setTrelloCard(prev => {
        const mergedCF = { ...fresh.customFields };
        const mergedMembers = isPending("Members") ? prev.members : (fresh.people || []);
        if (isPending("Priority"))      mergedCF.Priority      = prev.customFields.Priority;
        if (isPending("Status"))        mergedCF.Status        = prev.customFields.Status;
        if (isPending("Active"))        mergedCF.Active        = prev.customFields.Active;
        if (isPending("Duration"))      mergedCF.Duration      = prev.customFields.Duration;
        if (isPending("TimerStart"))    mergedCF.TimerStart    = prev.customFields.TimerStart;
        if (isPending("WorkDuration"))  mergedCF.WorkDuration  = prev.customFields.WorkDuration;
        if (isPending("WorkTimerStart")) mergedCF.WorkTimerStart = prev.customFields.WorkTimerStart;
        if (isPending("WorkLog"))       mergedCF.WorkLog       = prev.customFields.WorkLog;
        return {
          ...prev,
          labels: fresh.labels,
          members: mergedMembers,
          description: descEditing ? prev.description : newDesc,
          customFields: mergedCF,
          badges: ensureBadgeTypes([
            ...(mergedCF.Priority ? [{text: `Priority: ${mergedCF.Priority}`, isBottom: true}] : []),
            ...(mergedCF.Status   ? [{text: `Status: ${mergedCF.Status}`,     isBottom: true}] : []),
            ...(mergedCF.Active   ? [{text: `Active: ${mergedCF.Active}`,     isBottom: true}] : []),
            ...(fresh.labels || []).map(l => ({text: l, isBottom: false}))
          ])
        };
      });
    }
  }, [trelloBuckets]);

  return {
    showLabelPicker, setShowLabelPicker,
    showAddTime, setShowAddTime,
    manualHours, setManualHours,
    manualMins, setManualMins,
    trelloBuckets, setTrelloBuckets, _setTrelloBuckets,
    allTrelloLists, setAllTrelloLists,
    trelloCard, setTrelloCard,
    trelloPreview, setTrelloPreview,
    trelloAttachmentRef,
    checklists, setChecklists,
    newChecklistTitle, setNewChecklistTitle,
    copyFromChecklist, setCopyFromChecklist,
    attachLink, setAttachLink,
    attachName, setAttachName,
    cardAttachments, setCardAttachments,
    trelloMenuOpen, setTrelloMenuOpen,
    showMoveSubmenu, setShowMoveSubmenu,
    moveTab, setMoveTab,
    moveTargetList, setMoveTargetList,
    moveTargetPos, setMoveTargetPos,
    moveListSearch, setMoveListSearch,
    descEditing, setDescEditing,
    descDraft, setDescDraft,
    trelloMembers, setTrelloMembers,
    showAddMenu, setShowAddMenu,
    addMenuStep, setAddMenuStep,
    showMemberShortcut, setShowMemberShortcut,
    pendingCFRef,
  };
}
