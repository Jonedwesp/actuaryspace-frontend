import { useState, useRef, useEffect, useMemo } from "react";
import { AC_EMAIL_MAP } from "../utils/appData.js";

export function useGmail({ currentView, triggerSnackbar, reportSystemError, clearSystemError, searchQuery, lastAction, setLastAction, setSnackbar }) {

  // Draft window position & drag
  const [draftPos, setDraftPos] = useState({ x: 0, y: 0 });
  const isDraggingDraft = useRef(false);
  const draftWindowRef = useRef(null);

  // Email state
  const [emailIdx, setEmailIdx] = useState(0);
  const [email, setEmail] = useState(null);
  const [emailPreview, setEmailPreview] = useState(null);
  const htmlTooltipRef = useRef(null);
  const [showEmailDetails, setShowEmailDetails] = useState(false);
  const [reviewingDoc, setReviewingDoc] = useState(null);

  // Batch extraction status
  const [batchStatus, setBatchStatus] = useState(null);

  // Gmail inbox state
  const [gmailEmails, setGmailEmails] = useState([]);
  const [gmailLoading, setGmailLoading] = useState(false);
  const [gmailError, setGmailError] = useState("");
  useEffect(() => { gmailError ? reportSystemError("Gmail", gmailError) : clearSystemError("Gmail"); }, [gmailError]);

  const [selectedEmailIds, setSelectedEmailIds] = useState(new Set());
  const [gmailFolder, setGmailFolder] = useState("INBOX");
  const [gmailRefreshTrigger, setGmailRefreshTrigger] = useState(0);
  const [gmailPage, setGmailPage] = useState(1);
  const [gmailTotal, setGmailTotal] = useState(0);
  const [gmailPageTokens, setGmailPageTokens] = useState({});
  const [hoveredEmailId, setHoveredEmailId] = useState(null);

  // Draft helper state
  const [showDraftPicker, setShowDraftPicker] = useState(false);
  const [selectedDraftTemplate, setSelectedDraftTemplate] = useState(null);
  const [draftTo, setDraftTo] = useState("");
  const [isDraftEnlarged, setIsDraftEnlarged] = useState(false);
  const [draftAttachments, setDraftAttachments] = useState([]);
  const draftFileInputRef = useRef(null);

  // Contacts
  const [otherContacts, setOtherContacts] = useState({});
  const [historyContacts, setHistoryContacts] = useState({});

  // Track active search/folder/page so background poller doesn't inject stale results
  const activeSearchRef = useRef("");
  const activeFolderRef = useRef("INBOX");
  const gmailPageRef = useRef(1);

  const handleDraftMouseDown = (e) => {
    if (isDraftEnlarged) return;
    e.preventDefault();
    isDraggingDraft.current = true;
    const startX = e.clientX - draftPos.x;
    const startY = e.clientY - draftPos.y;

    let currentX = draftPos.x;
    let currentY = draftPos.y;

    const onMouseMove = (moveEvent) => {
      if (!isDraggingDraft.current) return;
      currentX = moveEvent.clientX - startX;
      currentY = moveEvent.clientY - startY;
      if (draftWindowRef.current) {
        draftWindowRef.current.style.transform = `translate(${currentX}px, ${currentY}px)`;
      }
    };

    const onMouseUp = () => {
      isDraggingDraft.current = false;
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      setDraftPos({ x: currentX, y: currentY });
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };

  const handleApprove = async (fileName) => {
    if (!batchStatus?.batchId || !fileName) {
      console.warn("Approval blocked: Missing batchId or fileName.");
      return;
    }

    setBatchStatus(prev => {
      if (!prev || !prev.fileResults) return prev;
      return {
        ...prev,
        fileResults: prev.fileResults.map(f =>
          f.fileName === fileName ? { ...f, status: "Approved" } : f
        )
      };
    });

    try {
      const res = await fetch("/.netlify/functions/firestore-approve-doc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          batchId: batchStatus.batchId,
          fileName: fileName
        })
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.ok !== true) {
        throw new Error(json.error || "Server failed to approve document");
      }
      triggerSnackbar(`File approved: ${fileName}`);
    } catch (err) {
      console.error("Approval Sync Error:", err);
      triggerSnackbar("Failed to sync approval. Please try again.");
      setGmailRefreshTrigger(p => p + 1);
    }
  };

  const handleToggleStar = async (e, msgId, currentStarred) => {
    if (!msgId) {
      console.error("Starring failed: messageId is missing or undefined.");
      return;
    }
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    const nextStarredState = !currentStarred;
    
    // 🎯 FIX: Cast both IDs to strings for a bulletproof match
    const targetId = String(msgId).trim();

    setGmailEmails(prev => (prev || []).map(msg =>
      (msg && String(msg.id).trim() === targetId) ? { ...msg, isStarred: nextStarredState } : msg
    ));
    
    setEmail(prev => {
      if (prev && String(prev.id).trim() === targetId) return { ...prev, isStarred: nextStarredState };
      return prev;
    });

    try {
      const response = await fetch("/.netlify/functions/gmail-toggle-star", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId: targetId, starred: nextStarredState })
      });
      if (!response.ok) throw new Error("Sync failed");
      if (!nextStarredState && gmailFolder === "STARRED") {
        setGmailEmails(prev => (prev || []).filter(msg => String(msg.id).trim() !== targetId));
      }
    } catch (err) {
      console.error("Starring sync failed:", err);
      setGmailEmails(prev => (prev || []).map(msg =>
        (msg && String(msg.id).trim() === targetId) ? { ...msg, isStarred: currentStarred } : msg
      ));
      setEmail(prev => (prev && String(prev.id).trim() === targetId) ? { ...prev, isStarred: currentStarred } : prev);
      triggerSnackbar("Failed to update star status");
    }
  };

  const handleEmailAction = (actionKey) => {
    if (!email) return;
    const caseCardText = email?.body || email?.subject || "";

    if (actionKey === "submit_trello") {
      const instructionTimeIso = new Date().toISOString();
      fetch("/.netlify/functions/trello-create-card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caseCardText,
          instructionTimeIso,
          fallbackDescription: email.subject || "",
        }),
      })
        .then((res) => res.json())
        .then((json) => {
          if (!json || json.ok === false) {
            console.error("trello-create-card error:", json);
            setEmail((prev) =>
              prev ? { ...prev, systemNote: "Tried to submit to Trello but something went wrong. Please check the console." } : prev
            );
          } else {
            setEmail((prev) =>
              prev ? { ...prev, systemNote: "Submitted to Trello and linked to AC REF." } : prev
            );
            triggerSnackbar("Submitted to Trello");
          }
        })
        .catch((err) => {
          console.error("trello-create-card fetch failed:", err);
          setEmail((prev) =>
            prev ? { ...prev, systemNote: "Tried to submit to Trello but the request failed. Please check the console." } : prev
          );
        });
      return;
    }

    if (actionKey === "update_tracker") {
      fetch("/.netlify/functions/sheet-update-tracker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseCardText }),
      })
        .then((res) => res.json())
        .then((json) => {
          if (json.ok) {
            setEmail((prev) =>
              prev ? { ...prev, systemNote: "AC Reports Tracker updated for this case." } : prev
            );
          } else {
            setEmail((prev) =>
              prev ? { ...prev, systemNote: "Tracker update failed. See console for details." } : prev
            );
            console.error("sheet-update-tracker error:", json);
          }
        })
        .catch((err) => {
          console.error("sheet-update-tracker fetch failed:", err);
          setEmail((prev) =>
            prev ? { ...prev, systemNote: "Tracker update failed (network error)." } : prev
          );
        });
      return;
    }

    if (actionKey === "create_draft") {
      setShowDraftPicker((v) => !v);
      setSelectedDraftTemplate(null);
      setEmail((prev) =>
        prev ? { ...prev, systemNote: "Choose a draft template below." } : prev
      );
      return;
    }

    setEmail((prev) => prev ? { ...prev, systemNote: "Action cancelled." } : prev);
  };

  // Batch extraction status poller
  useEffect(() => {
    if (currentView.app !== "email" || !email?.messageId) {
      setBatchStatus(null);
      return;
    }
    let isMounted = true;
    const fetchStatus = async () => {
      try {
        const res = await fetch(`/.netlify/functions/firestore-batch-status?messageId=${encodeURIComponent(email.messageId)}`);
        const json = await res.json();
        if (isMounted && json.found) setBatchStatus(json);
      } catch (e) {
        console.error("Batch status poll failed", e);
      }
    };
    fetchStatus();
    const interval = setInterval(fetchStatus, 3000);
    return () => { isMounted = false; clearInterval(interval); };
  }, [currentView.app, email?.messageId]);

  // Contacts: fetch from API
  useEffect(() => {
    fetch("/.netlify/functions/gmail-contacts", { credentials: "include" })
      .then(res => res.json())
      .then(data => {
        if (data.ok && data.contacts) setOtherContacts(data.contacts);
      })
      .catch(err => console.error("Failed to fetch contacts", err));
  }, []);

  // Contacts: build history from email headers
  useEffect(() => {
    if (!gmailEmails || !Array.isArray(gmailEmails) || gmailEmails.length === 0) return;
    const newHits = {};
    const parse = (input) => {
      if (!input) return;
      const items = Array.isArray(input) ? input : String(input).split(/,(?=[^>]*?(?:<|$))/);
      items.forEach(raw => {
        if (!raw) return;
        let str = String(raw).trim();
        if (!str) return;
        let emailAddress = "";
        let displayName = "";
        if (str.includes("<") && str.includes(">")) {
          const parts = str.split("<");
          displayName = parts[0].replace(/"/g, '').trim();
          emailAddress = parts[1].replace(">", "").trim().toLowerCase();
        } else if (str.includes("@")) {
          emailAddress = str.toLowerCase();
          const prefix = emailAddress.split("@")[0];
          displayName = prefix.split(/[._]/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
        }
        if (emailAddress && emailAddress.includes("@")) {
          newHits[displayName || emailAddress] = emailAddress;
        }
      });
    };
    gmailEmails.forEach(m => {
      if (m) { parse(m.from); parse(m.to); parse(m.cc); }
    });
    if (Object.keys(newHits).length > 0) {
      setHistoryContacts(prev => {
        const hasNew = Object.values(newHits).some(e => !Object.values(prev).includes(e));
        if (!hasNew) return prev;
        return { ...prev, ...newHits };
      });
    }
  }, [gmailEmails]);

  const combinedContacts = useMemo(() => {
    const merged = {};
    const allEntries = [
      ...(Object.entries(historyContacts || {})),
      ...(Object.entries(otherContacts || {})),
      ...(Object.entries(AC_EMAIL_MAP || {}))
    ];
    allEntries.forEach(([name, emailAddr]) => {
      if (!emailAddr) return;
      const cleanEmail = emailAddr.toLowerCase().trim();
      const existingName = Object.keys(merged).find(k => merged[k] === cleanEmail);
      if (existingName) {
        const newHasSpace = name.includes(' ');
        const oldHasSpace = existingName.includes(' ');
        if ((newHasSpace && !oldHasSpace) || (newHasSpace && oldHasSpace && name.length > existingName.length)) {
          delete merged[existingName];
          merged[name] = cleanEmail;
        }
      } else {
        merged[name] = cleanEmail;
      }
    });
    return merged;
  }, [otherContacts, historyContacts]);

  // Sync refs for background poller
  useEffect(() => { activeSearchRef.current = searchQuery; }, [searchQuery]);
  useEffect(() => { activeFolderRef.current = gmailFolder; }, [gmailFolder]);
  useEffect(() => { gmailPageRef.current = gmailPage; }, [gmailPage]);

  // Gmail inbox loader
  useEffect(() => {
    if (currentView.app !== "gmail") return;
    let cancelled = false;
    const loadInbox = async () => {
      setGmailLoading(true);
      setGmailError("");
      try {
        let currentToken = "";
        if (gmailPage > 1) currentToken = gmailPageTokens[gmailPage] || "";
        const baseQ = searchQuery.trim();
        let finalQ = baseQ;
        if (baseQ.toUpperCase().includes("AC REF") && !baseQ.includes('"')) {
          finalQ = `"${baseQ}"`;
        }
        const qParam = finalQ || "";
        const folderParam = finalQ && gmailFolder !== "DRAFTS" ? "ALL" : gmailFolder;
        const res = await fetch(`/.netlify/functions/gmail-inbox?folder=${folderParam}&limit=50&pageToken=${currentToken}&q=${encodeURIComponent(qParam)}`);
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json.ok) throw new Error(json.error || `HTTP ${res.status}`);
        if (!cancelled) {
          setGmailEmails(json.emails || []);
          if (json.total !== undefined) setGmailTotal(json.total);
          if (json.nextPageToken) {
            setGmailPageTokens(prev => ({ ...prev, [gmailPage + 1]: json.nextPageToken }));
          }
        }
      } catch (err) {
        if (!cancelled) setGmailError(String(err.message || err));
      } finally {
        if (!cancelled) setGmailLoading(false);
      }
    };
    if (gmailPage === 1) setGmailPageTokens({});
    const delay = searchQuery ? 600 : 0;
    const timeOutId = setTimeout(loadInbox, delay);
    return () => { cancelled = true; clearTimeout(timeOutId); };
  }, [currentView.app, gmailFolder, gmailRefreshTrigger, gmailPage, searchQuery]);

  return {
    draftPos, setDraftPos,
    isDraggingDraft,
    draftWindowRef,
    handleDraftMouseDown,
    emailIdx, setEmailIdx,
    email, setEmail,
    emailPreview, setEmailPreview,
    htmlTooltipRef,
    showEmailDetails, setShowEmailDetails,
    reviewingDoc, setReviewingDoc,
    batchStatus, setBatchStatus,
    handleApprove,
    gmailEmails, setGmailEmails,
    gmailLoading, setGmailLoading,
    gmailError, setGmailError,
    selectedEmailIds, setSelectedEmailIds,
    gmailFolder, setGmailFolder,
    gmailRefreshTrigger, setGmailRefreshTrigger,
    gmailPage, setGmailPage,
    gmailTotal, setGmailTotal,
    gmailPageTokens, setGmailPageTokens,
    hoveredEmailId, setHoveredEmailId,
    showDraftPicker, setShowDraftPicker,
    selectedDraftTemplate, setSelectedDraftTemplate,
    draftTo, setDraftTo,
    isDraftEnlarged, setIsDraftEnlarged,
    draftAttachments, setDraftAttachments,
    draftFileInputRef,
    otherContacts, setOtherContacts,
    historyContacts, setHistoryContacts,
    combinedContacts,
    activeSearchRef,
    activeFolderRef,
    gmailPageRef,
    handleToggleStar,
    handleEmailAction,
    handleUndo,
  };

  async function handleUndo() {
    if (!lastAction) return;
    const { type, ids } = lastAction;
    setSnackbar({ show: false, text: "" });
    setGmailLoading(true);
    try {
      const isUndoRestore = type === "delete";
      await fetch("/.netlify/functions/gmail-delete-bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageIds: ids, restore: isUndoRestore, permanent: false })
      });
      setLastAction(null);
      setGmailEmails([]);
      setGmailRefreshTrigger(p => p + 1);
    } catch (e) {
      console.error("Undo failed", e);
    }
    setGmailLoading(false);
  }
}
