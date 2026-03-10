import agentDonnaPic from "./assets/Agent Donna.png";
import agentDonnaVideo from "./assets/Agent Donna.mp4";
import React, { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import StorytellerMockup from "./StorytellerMockup";
import BlueprintVideo from "./BlueprintVideo";
import { DONNA_TOOLS } from "./utils/donnaTools.js";
import { useDonna } from "./hooks/useDonna.js";
import { useDebounce } from "./hooks/useDebounce.js";
import { useRecording } from "./hooks/useRecording.js";
import { useCalendar } from "./hooks/useCalendar.js";
import { useTrello } from "./hooks/useTrello.js";
import { useGmail } from "./hooks/useGmail.js";
import { useGchatSync } from "./hooks/useGchatSync.js";
import { useNotifications } from "./hooks/useNotifications.js";
import { useNotificationHandlers } from "./hooks/useNotificationHandlers.js";
import { useSyncPolling } from "./hooks/useSyncPolling.js";
import { useLiveCallDetection } from "./hooks/useLiveCallDetection.js";
import { useWorkspaceListeners } from "./hooks/useWorkspaceListeners.js";
import {
  formatLongDate, formatGchatTime, formatUKTime, formatUKTimeWithSeconds,
  formatNotificationDate, formatDividerDate, formatEventDateTime, getGchatTimezone,
  pad2, isWeekend, nextBusinessDay, nextTrialDate, formatDueLine
} from "./utils/dateTime.js";
import { GCHAT_ID_MAP, normalizeGChatMessage, getMsgTs, msgKey, dedupeMergeMessages } from "./utils/gchatUtils.js";
import { remapBotName, avatarFor } from "./utils/avatarUtils.js";
import {
  deriveDescriptionFromTitle,
  PRIORITY_OPTIONS, ACTIVE_OPTIONS, STATUS_OPTIONS, getCFColorClass,
  ALL_LABEL_OPTIONS, getLabelStyle, canonicalPriority, priorityTypeFromText,
  statusTypeFromText, activeTypeFromText, getLabelColor, ensureBadgeTypes, getTrelloCoverColor
} from "./utils/trelloUtils.js";
import SmartLink from "./components/SmartLink.jsx";
import PasswordGate from "./components/PasswordGate.jsx";
import { PERSONA, PERSONA_TRELLO_LISTS } from "./utils/config.js";
import RightPanel from "./components/RightPanel.jsx";
import PopupSpring from "./components/PopupSpring.jsx";
import MiddleAppSpring from "./components/MiddleAppSpring.jsx";
import GChatSidebarMenu from "./components/GChatSidebarMenu.jsx";
import ProductivityDashboard from "./components/ProductivityDashboard.jsx";
import LiveTimer from "./components/LiveTimer.jsx";
import ActivityPane from "./components/ActivityPane.jsx";
import ChecklistItemInput from "./components/ChecklistItemInput.jsx";

import { GMAIL_SOUND_DATA, GCHAT_SOUND_DATA, TRELLO_SOUND_DATA, CALENDAR_SOUND_DATA } from "./utils/soundData.js";

const trelloIcon = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Crect width='24' height='24' rx='4' fill='%230079bf'/%3E%3Crect x='5' y='5' width='6' height='14' rx='1.5' fill='%23ffffff'/%3E%3Crect x='13' y='5' width='6' height='9' rx='1.5' fill='%23ffffff'/%3E%3C/svg%3E";
function getCalendarIcon(day) {
  const d = day ?? new Date().getDate();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" rx="3" fill="white" stroke="%23dadce0" stroke-width="1"/><rect x="0" y="0" width="24" height="8" rx="3" fill="%231a73e8"/><rect x="0" y="5" width="24" height="3" fill="%231a73e8"/><text x="12" y="19.5" text-anchor="middle" font-size="10" font-weight="700" fill="%23202124" font-family="Arial,sans-serif">${d}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
import gmailIcon from "./assets/Gmail pic.png";
import gchatIcon from "./assets/Google Chat.png";
import { GChatApp } from "./features/GChatApp.jsx";
import { GmailApp } from "./features/GmailApp.jsx";
import { TrelloApp } from "./features/TrelloApp.jsx";
import { CalendarApp } from "./features/CalendarApp.jsx";
import WelcomeMessage from "./components/WelcomeMessage.jsx";
import ReviewCompareWorkstation from "./components/ReviewCompareWorkstation.jsx";
import CalendarIcon from "./components/CalendarIcon.jsx";
import { LeftPanel } from "./components/LeftPanel.jsx";
import { ChatBar } from "./components/ChatBar.jsx";
import TopBar from "./components/TopBar.jsx";
import AppModals from "./components/AppModals.jsx";
import DonnaBubble from "./components/DonnaBubble.jsx";

const launchWorkstationWindow = (url) => {

  window.dispatchEvent(new CustomEvent("openWorkstationPane", { detail: url }));

  if (url.includes("meet.google.com")) {
    window.dispatchEvent(new CustomEvent("googleMeetLaunched"));
  }
};

export default function App() {
  const [callBtnHovered, setCallBtnHovered] = useState(false);
  const [systemErrors, setSystemErrors] = useState({});
  const [showSystemPopup, setShowSystemPopup] = useState(false);

 const [donnaTranscription, setDonnaTranscription] = useState("");
  const [donnaPendingAction, setDonnaPendingAction] = useState(null);

  const donnaRespondingRef = useRef(false);
  const ignoreNextDonnaRef = useRef(false);
  const [donnaKey, setDonnaKey] = useState(0);

 const { 
    isConnected: isDonnaConnected, 
    connectDonna, 
    disconnectDonna, 
    sendSessionUpdate,
    sendToolResponse,
    pcRef, // 👈 WebRTC Peer Connection Reference
    dcRef  // 👈 WebRTC Data Channel Reference
} = useDonna({
   instructions: "You are Agent Donna, a witty and professional actuarial assistant to Siyabonga (Siya).\n\n*** STRICT WAKE-WORD PROTOCOL ***\nYour audio stream is always open, but you are ASLEEP. You must ONLY wake up and respond if the user's sentence starts exactly with 'Hey Donna'.\n- If the user speaks without saying 'Hey Donna' first, you must output ABSOLUTELY NOTHING. Do not explain the rule. Do not apologize. Remain completely silent.\n- IMPORTANT: If the user says 'Hey Donna approve' or 'Hey Donna reject', this is handled locally by the system. YOU MUST OUTPUT ABSOLUTELY NOTHING. DO NOT ASK WHAT TO APPROVE. JUST REMAIN SILENT.\n- Once you fulfill a 'Hey Donna' request, go immediately back to sleep.\n- Never say 'I can only respond to requests that begin with...'. Just stay silent.\n\nBe concise and use your tools whenever appropriate. IMPORTANT: Always respond in English only.",  tools: DONNA_TOOLS,
onTranscription: (text) => {
      if (!text) return; // 🛡️ CRASH PREVENTION: Stops undefined text from breaking the app
      const lowerText = text.toLowerCase().trim();
      const hasWakeWord = lowerText.startsWith("hey donna");
      
      // 🎙️ VOICE APPROVAL ENGINE: Detects "hey donna approve" or "hey donna reject"
      if (hasWakeWord && donnaPendingAction) {
        if (lowerText.includes("approve")) {
          console.log("[Donna] Voice command: APPROVE detected.");
          ignoreNextDonnaRef.current = true;
          handleApproveDonna();
          return;
        }
        if (lowerText.includes("reject")) {
          console.log("[Donna] Voice command: REJECT detected.");
          ignoreNextDonnaRef.current = true;
          handleRejectDonna();
          return;
        }
      }

      if (!donnaRespondingRef.current) {
        setDonnaTranscription(hasWakeWord ? text : "");
      }

      if (!hasWakeWord && !donnaRespondingRef.current) {
        setDonnaTranscription("");
      }
    },

    onResponseDelta: (delta, isNew) => {
      if (ignoreNextDonnaRef.current) return;
      if (isNew) { setDonnaKey(k => k + 1); setDonnaPendingAction(null); }
      donnaRespondingRef.current = true;
      setIsDonnaSpeaking(true);
      setDonnaTranscription(prev => isNew ? delta : prev + delta);
    },
    onResponseEnd: () => {
      if (ignoreNextDonnaRef.current) {
        ignoreNextDonnaRef.current = false;
        return;
      }
      donnaRespondingRef.current = false;
      setIsDonnaSpeaking(false);
    },
onFunctionCall: ({ name, args, call_id }) => {
      // 🛡️ STERN WAKE-WORD GUARD: Block all tool execution unless "Hey Donna" was used
      const lowerTranscription = donnaTranscription.toLowerCase().trim();
      const isAuthorized = lowerTranscription.startsWith("hey donna");

      if (!isAuthorized) {
        console.log(`[Donna] Protocol Violation: Tool ${name} blocked. Wake-word missing.`);
        return;
      }

      // 1. Auto-execute navigation & inbox searches
      if (name === "navigate_to_app" || name === "gmail_get_inbox") {
        if (name === "navigate_to_app") {
          setCurrentView({ app: args.app, contact: null });
          if (args.app === "trello" && args.trello_card_name) {
            const query = (args.trello_card_name || "").toLowerCase();
            let found = null;
            for (const cards of Object.values(trelloBuckets || {})) {
              const match = (cards || []).find(c => (c.title || c.name || "").toLowerCase().includes(query));
              if (match) { found = match; break; }
            }
            if (found) window.dispatchEvent(new CustomEvent("openTrelloCard", { detail: found }));
          }
        } else if (name === "gmail_get_inbox") {
          setCurrentView({ app: 'gmail', contact: null });
          if (args.q) setSearchQuery(args.q);
          if (args.folder) setGmailFolder(args.folder.toUpperCase());
        }
        return;
      }

      // 2. Auto-execute Contact Lookup (Solves the email accuracy issue)
      if (name === "gmail_get_contacts") {
        console.log("[Donna] Fetching contacts for lookup...");
        fetch("/.netlify/functions/gmail-contacts")
          .then(res => res.json())
          .then(data => {
            // Update session so Donna has the directory in her context
            sendSessionUpdate({
              instructions: `Contact Directory: ${JSON.stringify(data)}. Use these exact emails for drafts.`
            });
            // Feed the data back into the tool call using the new helper
            sendToolResponse(call_id, { success: true, contacts: data });
          });
        return;
      }

      // 3. Auto-execute Trello List Lookup
      if (name === "trello_get_lists") {
        console.log("[Donna] Fetching Trello lists...");
        fetch("/.netlify/functions/trello-lists")
          .then(res => res.json())
          .then(data => {
            // Feed the list IDs back so Donna knows where cards can go
            sendSessionUpdate({
              instructions: `Available Trello Lists: ${JSON.stringify(data)}. Use these IDs for move operations.`
            });
            sendToolResponse(call_id, { success: true, lists: data });
          });
        return;
      }

      // 4. All other "Write" tools require approval
      let finalArgs = { ...args };
// 🔍 Complete Trello Translation Layer
      if (name === "trello_move_card") {
        let realCardId = args.cardId;
        let realTargetListId = args.targetListId;

        // 1. Find the Card ID by name
        for (const cards of Object.values(trelloBuckets || {})) {
          // 🛡️ Safety Guard: Ensure cards is an actual Array and not an index or null
          if (cards && Array.isArray(cards)) {
            const match = cards.find(c => (c.title || c.name || "").toLowerCase().includes(args.cardId.toLowerCase()));
            if (match) { realCardId = match.id; break; }
          }
        }

        // 2. Find the List ID by name
        const listNames = Object.keys(trelloBuckets || {});
        const targetListName = listNames.find(name => name.toLowerCase().includes(args.targetListId.toLowerCase()));
        
        // 🛡️ Safety Guard: Check Array status before accessing index 0
        if (targetListName && Array.isArray(trelloBuckets[targetListName]) && trelloBuckets[targetListName].length > 0) {
            realTargetListId = trelloBuckets[targetListName][0].idList;
        }

        finalArgs.cardId = realCardId;
        finalArgs.targetListId = realTargetListId;

        // 🏁 CRITICAL FIX: Move this logic inside handleApproveDonna switch 
        // to ensure setDonnaPendingAction(null) runs even if the loop above fails.
      }

 // 3. All other "Write" tools require approval
      setDonnaPendingAction({ name, args, call_id });
      
      if (name === "gmail_save_draft") {
        // 🎯 UX Update: Soften the language to "Review"
        setDonnaTranscription(`Donna has prepared a draft for your review.`);
      } else if (name === "gmail_get_message") {
        const sender = args.senderName || "Unknown";
        const subject = args.subject ? ` ("${args.subject}")` : "";
        setDonnaTranscription(`Donna wants to: open email from ${sender}${subject}`);
      } else if (name === "gmail_delete_bulk") {
        const sender = args.senderName || "this sender";
        const subject = args.subject ? ` ("${args.subject}")` : "";
        const action = args.restore ? "restore" : "delete";
        setDonnaTranscription(`Donna wants to: ${action} email from ${sender}${subject}`);
      } else if (name === "gmail_toggle_star") {
        const sender = args.senderName || "this sender";
        const subject = args.subject ? ` ("${args.subject}")` : "";
        const action = args.starred !== false ? "star" : "unstar";
        setDonnaTranscription(`Donna wants to: ${action} email from ${sender}${subject}`);
      } else if (name === "gmail_mark_unread" || name === "gmail_mark_unread_bulk") {
        const sender = args.senderName || "this sender";
        const subject = args.subject ? ` ("${args.subject}")` : "";
        setDonnaTranscription(`Donna wants to: mark as unread email from ${sender}${subject}`);
      } else {
        setDonnaTranscription(`Donna wants to: ${name.replace(/_/g, " ")}`);
      }
    },
    onError: (msg) => setDonnaTranscription(`Error: ${msg}`),
  });

// Connect Donna on mount
  useEffect(() => {
    connectDonna();
    return () => disconnectDonna();
  }, []); // 🛡️ FIX: Removed dependencies to prevent infinite loop crash



  const reportSystemError = (source, message) => setSystemErrors(prev => ({ ...prev, [source]: message }));
  const clearSystemError = (source) => setSystemErrors(prev => { const next = { ...prev }; delete next[source]; return next; });
  useEffect(() => {
    const onReport = (e) => setSystemErrors(prev => ({ ...prev, [e.detail.source]: e.detail.message }));
    const onClear = (e) => setSystemErrors(prev => { const next = { ...prev }; delete next[e.detail]; return next; });
    
    // Ruan Logic: Listen for the simulated console command
    const onSimulate = (e) => {
      console.log("[Donna Test] Mock Action Received:", e.detail);
      setDonnaPendingAction(e.detail);
      setDonnaTranscription(`Donna suggests: ${e.detail.name.replace(/_/g, ' ')}`);
    };

    window.addEventListener("systemReportError", onReport);
    window.addEventListener("systemClearError", onClear);
    window.addEventListener("simulateDonna", onSimulate);

    return () => { 
      window.removeEventListener("systemReportError", onReport); 
      window.removeEventListener("systemClearError", onClear); 
      window.removeEventListener("simulateDonna", onSimulate);
    };
  }, []);

  const [isDonnaActive, setIsDonnaActive] = useState(false);
  const [isDonnaSpeaking, setIsDonnaSpeaking] = useState(false);
  const [isDonnaLoading, setIsDonnaLoading] = useState(false);
  const [isBlueprintActive, setIsBlueprintActive] = useState(false);

  useEffect(() => {
    if (isDonnaLoading) {
      const t = setTimeout(() => setIsDonnaLoading(false), 1500);
      return () => clearTimeout(t);
    }
  }, [isDonnaLoading]);

 const [currentView, setCurrentView] = useState({ app: "none", contact: null });
  const [showWelcome, setShowWelcome] = useState(true);

const handleApproveDonna = () => {
    if (!donnaPendingAction) return;
    const { name, args } = donnaPendingAction;

    // 🛡️ SUPER-SANITIZER: Instantly strips hallucinatory "[ID: ]", "ID: ", quotes, or brackets
    const cleanId = (id) => {
      if (typeof id !== 'string') return String(id);
      return id.replace(/\[?ID:\s*/gi, '').replace(/\]/g, '').replace(/['"]/g, '').trim();
    };

    // 🎯 EXACT ID MATCHER: Uses Donna's messy ID to find the true, perfect Google ID from state
    const getExactId = (messyId) => {
      const cleaned = cleanId(messyId);
      const found = gmailEmails?.find(e => {
        const eId = String(e.id).trim();
        return eId === cleaned || eId.includes(cleaned) || cleaned.includes(eId);
      });
      return found ? found.id : cleaned; // Fallback to cleaned if not found in state
    };

    switch (name) {
      case 'gmail_get_message':
        console.log(`[Donna] Opening specific email...`, args);
        setCurrentView({ app: "email", contact: null });
        if (args.messageId) {
          const exactId = getExactId(args.messageId);
          const foundMsg = gmailEmails?.find(m => m.id === exactId);
          const fallbackName = args.senderName || (foundMsg ? foundMsg.from.split("<")[0].replace(/"/g, '').trim() : "Unknown");
          
          setEmail({
            id: exactId,
            subject: foundMsg?.subject || "Loading message...",
            fromName: fallbackName,
            fromEmail: foundMsg?.from || "",
            date: foundMsg?.date || new Date().toISOString(),
            time: foundMsg?.date ? new Date(foundMsg.date).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "",
            bodyLoading: true,
            attachments: [],
            actions: [{ key: "submit_trello", label: "Submit to Trello" }, { key: "update_tracker", label: "Update AC Tracker" }]
          });

          fetch(`/.netlify/functions/gmail-message?messageId=${exactId}`, {
            credentials: "include"
          })
            .then(r => r.json())
            .then(json => {
              if(json.ok) {
                const isHtml = /<(html|body|div|p|br|b|strong|i|em|a|span|table|style)[^>]*>/i.test(json.body || "");
                let rawBody = json.body || "";
                if (!isHtml && rawBody.split('\n').length < 4) {
                   rawBody = rawBody
                     .replace(/(---------- Forwarded message ---------)/gi, '\n\n$1\n')
                     .replace(/(From:|Date:|Subject:|To:|Cc:)/g, '\n$1')
                     .replace(/(Dear\s+[A-Za-z]+|Hi\s+[A-Za-z]+|Good\s+day)/gi, '\n\n$1\n\n')
                     .replace(/(Kind\s+Regards|Regards|Sincerely|Thank\s+you)/gi, '\n\n$1\n')
                     .replace(/(On\s+(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[^:]+wrote:)/gi, '\n\n$1\n')
                     .replace(/(>\s*>)/g, '>>')
                     .replace(/(>\s+)/g, '\n$1')
                     .replace(/(\s\d+\.)/g, '\n$1')
                     .replace(/\n{3,}/g, '\n\n')
                     .trim();
                }
                const processedAtts = (json.attachments || []).map(a => ({
                   ...a,
                   type: a.mimeType.includes("pdf") ? "pdf" : a.mimeType.includes("image") ? "img" : a.mimeType.includes("spreadsheet") || a.mimeType.includes("excel") ? "xls" : "file",
                   url: `/.netlify/functions/gmail-download?messageId=${exactId}&attachmentId=${a.id}&filename=${encodeURIComponent(a.name)}&mimeType=${encodeURIComponent(a.mimeType)}`
                }));

                setEmail(prev => ({
                   ...prev,
                   body: isHtml ? "" : rawBody,
                   bodyHtml: isHtml ? json.body : "",
                   attachments: processedAtts,
                   bodyLoading: false
                }));
              }
            })
            .catch(err => {
               console.error("Body fetch failed:", err);
               setEmail(prev => ({ ...prev, bodyLoading: false, body: "Error loading message." }));
            });
        }
        break;

      case 'gmail_save_draft':
        console.log("[Donna] Transferring draft to Gmail UI for review...");
        
        // 1. Close the Donna form/pending action state immediately
        setDonnaPendingAction(null); 
        
        // 2. Switch the main view to Gmail
        setCurrentView({ app: 'gmail', contact: null });
        
        // 3. Inject the text into the Compose window state
        setSelectedDraftTemplate({
          id: "donna_live_review",
          label: "Donna's Draft",
          subject: args.subject || "New Message",
          body: args.body || "",
          isForward: false
        });
        setDraftTo(args.to || "");

        // 4. Visual confirmation
        setDonnaTranscription("Opening draft for your review.");
        triggerSnackbar("Draft prepared.");
        return;

case 'gmail_mark_unread':
case 'gmail_mark_unread_bulk':
        console.log(`[Donna] Marking email as unread...`, args);
        setCurrentView({ app: 'gmail', contact: null });
        if (args.messageId || args.messageIds) {
          // Handle both singular and bulk ID formats from Donna
          const messyId = args.messageId || (Array.isArray(args.messageIds) ? args.messageIds[0] : args.messageIds);
          const exactId = getExactId(messyId);
          
          // 🚀 ZERO-LATENCY UI UPDATE: Updates in place without changing the sort order
          setGmailEmails(prev => prev.map(msg => 
            msg.id === exactId ? { ...msg, isUnread: true } : msg
          ));
          
          triggerSnackbar("Marked as unread.");
          
          fetch("/.netlify/functions/gmail-mark-unread", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ messageId: exactId })
          }).catch(err => console.error("Mark unread failed:", err));
        }
        break;

      case 'gmail_delete_bulk':
        console.log(`[Donna] Binning email...`, args);
        setCurrentView({ app: 'gmail', contact: null });
        
        let rawIds = [];
        if (Array.isArray(args.messageIds)) rawIds = args.messageIds;
        else if (typeof args.messageIds === 'string') rawIds = [args.messageIds];
        else if (typeof args.messageId === 'string') rawIds = [args.messageId];

        // 🔥 Map the messy IDs to the EXACT perfect IDs
        const exactIds = rawIds.map(getExactId);

        if (exactIds.length > 0) {
          // 🚀 ZERO-LATENCY UI UPDATE: Exact match filtering
          setGmailEmails(prev => {
            const nextList = prev.filter(e => !exactIds.includes(e.id));
            
            // Adjust pagination totals instantly
            const removedCount = prev.length - nextList.length;
            if (removedCount > 0) setGmailTotal(t => Math.max(0, t - removedCount));
            
            return nextList;
          });

          setEmail(null);
          setEmailPreview(null);
          
          triggerSnackbar(`Conversation(s) moved to Trash.`);
          
          fetch("/.netlify/functions/gmail-delete-bulk", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ messageIds: exactIds, permanent: false }) // 🔥 Exact ID sent to server
          }).catch(err => console.error("Delete failed:", err));
        }
        break;

      case 'gmail_toggle_star':
        console.log(`[Donna] Starring email...`, args);
        
        // 1. Bulletproof ID array handling (matches the delete logic)
        let starIds = [];
        if (Array.isArray(args.messageIds)) starIds = args.messageIds;
        else if (typeof args.messageIds === 'string') starIds = [args.messageIds];
        else if (typeof args.messageId === 'string') starIds = [args.messageId];

        const exactStarIds = starIds.map(getExactId);
        const nextStarredState = args.starred !== undefined ? args.starred : true;

        if (exactStarIds.length > 0) {
          // 🚀 ZERO-LATENCY UI UPDATE: Aggressively match the ID, but keep it in the inbox list
          setGmailEmails(prev => prev.map(msg => {
            const mId = String(msg.id).trim();
            const isMatch = exactStarIds.some(eid => mId === eid || mId.includes(eid) || eid.includes(mId));
            return isMatch ? { ...msg, isStarred: nextStarredState } : msg;
          }));
          
          setEmail(prev => {
            if (!prev) return prev;
            const pId = String(prev.id).trim();
            const isMatch = exactStarIds.some(eid => pId === eid || pId.includes(eid) || eid.includes(pId));
            return isMatch ? { ...prev, isStarred: nextStarredState } : prev;
          });

          triggerSnackbar(nextStarredState ? "Message starred." : "Star removed.");
          
          // Send requests to backend
          exactStarIds.forEach(eid => {
            fetch("/.netlify/functions/gmail-toggle-star", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({ messageId: eid, starred: nextStarredState })
            }).catch(err => console.error("Starring failed:", err));
          });
        }
        break;

      case 'trello_move_card': {
        console.log("[Donna] Preparing Trello move...", args);
        setCurrentView({ app: 'trello', contact: null });

        // 🔍 ARCHITECT'S TRANSLATION LAYER
        let cardIdToMove = args.cardId;
        let listIdToTarget = args.targetListId;

    // 1. Find the Card ID by searching through all trelloBuckets
        for (const [, cards] of Object.entries(trelloBuckets || {})) {
          const match = cards.find(c => 
            (c.title || c.name || "").toLowerCase().includes((args.cardId || "").toLowerCase())
          );
          if (match) {
            cardIdToMove = match.id;
            break;
          }
        }

        // 2. Find the Target List ID by matching the list name in the bucket keys
        const bucketNames = Object.keys(trelloBuckets || {});
        const targetKey = bucketNames.find(n => 
          n.toLowerCase().includes((args.targetListId || "").toLowerCase())
        );

        if (targetKey && trelloBuckets[targetKey].length > 0) {
          // Grab the list ID from the first card in that bucket
          listIdToTarget = trelloBuckets[targetKey][0].idList;
        }

        // 🚀 ZERO-LATENCY UI UPDATE: Move the card in React state before the fetch
        setTrelloBuckets(prev => {
          let movingCard = null;
          const next = { ...prev };
          
          // Remove from source
          for (const key in next) {
            const idx = next[key].findIndex(c => c.id === cardIdToMove);
            if (idx > -1) {
              movingCard = { ...next[key][idx], idList: listIdToTarget };
              next[key].splice(idx, 1);
              break;
            }
          }
          
          // Add to destination
          if (movingCard && targetKey) {
            next[targetKey] = [movingCard, ...next[targetKey]];
          }
          return next;
        });

        triggerSnackbar(`Moving card to ${targetKey || 'new list'}...`);

        // 📡 BACKEND SYNC: Call your existing trello-move.js function
        fetch("/.netlify/functions/trello-move", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ 
            cardId: cardIdToMove, 
            listId: listIdToTarget 
          })
        }).catch(err => {
          console.error("Trello move failed:", err);
          triggerSnackbar("Failed to sync Trello move.");
        });
        break;
      }

      default:
        console.warn("Unmapped tool execution:", name);
    }

    setDonnaPendingAction(null);
    setDonnaTranscription("Action approved.");
    setTimeout(() => setDonnaTranscription(""), 3000);
  };
  const handleRejectDonna = () => {
    setDonnaPendingAction(null);
    setDonnaTranscription("Action rejected.");
    setTimeout(() => setDonnaTranscription(""), 3000);
  };

  const isInitialGmailSyncRef = useRef(true);
  const isInitialGchatSyncRef = useRef(true);

  const sessionStartTime = useRef(new Date());

const [inputValue, setInputValue] = useState("");
const [searchQuery, setSearchQuery] = useState("");

  const [snackbar, setSnackbar] = useState({ show: false, text: "" });
  const [lastAction, setLastAction] = useState(null);

  const triggerSnackbar = (text, actionInfo = null) => {
    setSnackbar({ show: true, text });
    setLastAction(actionInfo);
    setTimeout(() => {
      setSnackbar({ show: false, text: "" });
      setLastAction(null);
    }, 5000);
  };
  const {
    notifications, setNotifications,
    notifLoading, setNotifLoading,
    exitingNotifIds, setExitingNotifIds,
    isMuted, setIsMuted,
    seenGmailIdsRef,
    seenGchatIdsRef,
    soundedGmailIdsRef,
    dismissedNotifsRef,
  } = useNotifications({ sessionStartTime });
  const {
    selectedEvent, setSelectedEvent,
    showCreateModal, setShowCreateModal,
    eventToDelete, setEventToDelete,
    newEventDraft, setNewEventDraft,
    calendarEvents, setCalendarEvents,
    calendarLoading, setCalendarLoading,
    calendarError, setCalendarError,
    isMonthView, setIsMonthView,
    calendarViewDate, setCalendarViewDate,
    confirmDeleteEvent,
    notifiedEventsRef,
  } = useCalendar({ currentView, setNotifications, triggerSnackbar, reportSystemError, clearSystemError });
  const { isLiveCallActive, setIsLiveCallActive, statusText, workstationUrl, workstationIframeRef } = useLiveCallDetection({ setSelectedEvent });
  const {
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
  } = useTrello({ currentView, setCurrentView });
  const {
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
  } = useGmail({ currentView, triggerSnackbar, reportSystemError, clearSystemError, searchQuery, lastAction, setLastAction, setSnackbar });
  const {
    showPlusMenu, setShowPlusMenu,
    gchatBodyRef,
    chatBarRef,
    chatBarHeight, setChatBarHeight,
    pendingScrollAnchorRef,
    showNewChatModal, setShowNewChatModal,
    newChatPopupPos, setNewChatPopupPos,
    newChatBtnRef,
    newChatTarget, setNewChatTarget,
    newChatEmailRef,
    lastActiveSpaceRef,
    gchatSpaces, setGchatSpaces,
    gchatLoading, setGchatLoading,
    gchatError, setGchatError,
    gchatSelectedSpace, setGchatSelectedSpace,
    archivedGchatSpaces, setArchivedGchatSpaces,
    trashedGchatSpaces, setTrashedGchatSpaces,
    showArchivedChats, setShowArchivedChats,
    chatToDelete, setChatToDelete,
    mutedGchatSpaces, setMutedGchatSpaces,
    unreadGchatSpaces, setUnreadGchatSpaces,
    gchatSpaceTimes, setGchatSpaceTimes,
    gchatMessages, setGchatMessages,
    gchatNextPageToken, setGchatNextPageToken,
    gchatLoadingOlder, setGchatLoadingOlder,
    gchatMe, setGchatMe,
    gchatMsgLoading, setGchatMsgLoading,
    gchatMsgError, setGchatMsgError,
    gchatComposer, setGchatComposer,
    editingMsgId, setEditingMsgId,
    editValue, setEditValue,
    msgToDelete, setMsgToDelete,
    gchatDmNames, setGchatDmNames,
    gchatAutoScroll, setGchatAutoScroll,
    isProgrammaticScrollRef,
    messagesEndRef,
    pendingInitialScrollSpaceRef,
    gchatSearchQuery, setGchatSearchQuery,
    isChatSearchOpen, setIsChatSearchOpen,
    chatSearchText, setChatSearchText,
    showJumpToBottom, setShowJumpToBottom,
    dmsExpanded, setDmsExpanded,
    spacesExpanded, setSpacesExpanded,
    debouncedChatSearchText,
    debouncedGchatSearchQuery,
    currentViewRef,
    gchatMeRef,
    gchatSelectedSpaceRef,
    gchatDmNamesRef,
    lastNotifiedRef,
    pendingReactionsRef,
    newlyCreatedSpaceIdRef,
    myReactionsRef,
    myDeletionsRef,
    myEditsRef,
    hoveredMsgId, setHoveredMsgId,
    reactions, setReactions,
    reactionCounts, setReactionCounts,
    gchatFilePreview, setGchatFilePreview,
    toggleReaction,
    triggerGChatNotification,
   handleStartChat,
    handleDeleteGChatMessage,
    confirmDeleteGChatMessage,
    confirmDeleteChat,
    handleUpdateGChatMessage,
    handleSend,
    pendingUpload, setPendingUpload,
  } = useGchatSync({
    currentView, setCurrentView,
    triggerSnackbar,
    setNotifications,
    reportSystemError, clearSystemError,
    inputValue, setInputValue,
  });

  const { isRecording, startRecording, stopRecording } = useRecording({ setPendingUpload });

// Update Donna's session instructions with current screen context
  useEffect(() => {
    if (!isDonnaConnected) return;
    const app = currentView.app;
  let ctx = "You are Agent Donna, a witty and professional actuarial assistant to Siyabonga (Siya, pronounced See-yah).\n\n*** STRICT WAKE-WORD PROTOCOL ***\nYour audio stream is always open, but you are ASLEEP. You must ONLY wake up and respond if the user's sentence starts exactly with 'Hey Donna'.\n- If the user speaks without saying 'Hey Donna' first, you must output ABSOLUTELY NOTHING. Do not explain the rule. Do not apologize. Remain completely silent.\n- Once you fulfill a 'Hey Donna' request, go immediately back to sleep.\n- Never say 'I can only respond to requests that begin with...'. Just stay silent.\n\nBe concise and use your tools whenever appropriate. IMPORTANT: Always respond in English only.\n\n";
    const now = new Date();
    ctx += `Current date and time: ${now.toLocaleDateString("en-ZA", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}, ${now.toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit", hour12: true })}.\n`;
    ctx += `Current screen: ${app === "none" ? "Home / welcome screen" : app}.\n`;

    if (app === "gmail" || app === "email") {
      if (email) {
        ctx += `Selected email: [ID: ${email.id}] "${email.subject}" from ${email.fromName || email.from || "unknown"}.\n`;
        if (email.snippet) ctx += `Preview: ${email.snippet.slice(0, 300)}\n`;
      } else if (gmailEmails?.length) {
        // Increased from slice(0,8) to slice(0,25) so Donna can see further down the inbox
        ctx += `Inbox (${gmailFolder}): ${gmailEmails.slice(0, 25).map(e => `[ID: ${e.id}] "${e.subject}" from ${(e.from || "").split("<")[0].trim() || "unknown"} — ${e.snippet ? e.snippet.slice(0, 60) : ""}`).join("; ")}.\n`;
      }
    } else if (app === "gchat") {
      const spaceName = gchatSelectedSpace?.displayName || gchatDmNames?.[gchatSelectedSpace?.id] || "Unknown";
      ctx += `Open conversation: "${spaceName}".\n`;
      if (gchatMessages?.length) {
        ctx += `Recent messages: ${gchatMessages.slice(-8).map(m => `${m.sender?.displayName || "Someone"}: "${(m.text || "").slice(0, 100)}"`).join("; ")}.\n`;
      }
    } else if (app === "trello") {
      if (trelloCard) {
        ctx += `Open Trello card: "${trelloCard.title || trelloCard.name}".\n`;
        if (trelloCard.description) ctx += `Card description: ${trelloCard.description.slice(0, 300)}\n`;
        if (trelloCard.labels?.length) ctx += `Labels: ${trelloCard.labels.join(", ")}.\n`;
        if (trelloCard.customFields) {
          const cf = trelloCard.customFields;
          if (cf.Priority) ctx += `Priority: ${cf.Priority}.\n`;
          if (cf.Status) ctx += `Status: ${cf.Status}.\n`;
        }
      } else if (trelloBuckets) {
        ctx += `Trello board lists: ${Object.keys(trelloBuckets).join(", ")}.\n`;
      }
    } else if (app === "calendar") {
      if (selectedEvent) {
        ctx += `Selected event: "${selectedEvent.summary}" on ${(selectedEvent.start?.dateTime || selectedEvent.start?.date || "").split("T")[0]}.\n`;
      }
      if (calendarEvents?.length) {
        const today = new Date().toISOString().split("T")[0];
        const todayEvts = calendarEvents.filter(e => (e.start?.dateTime || e.start?.date || "").startsWith(today));
        ctx += `Today's events: ${todayEvts.map(e => e.summary).join(", ") || "none"}.\n`;
        ctx += `Upcoming: ${calendarEvents.slice(0, 8).map(e => `"${e.summary}" on ${(e.start?.dateTime || e.start?.date || "").split("T")[0]}`).join("; ")}.\n`;
      }
    } else if (app === "productivity") {
      if (trelloBuckets) {
        const lists = Object.entries(trelloBuckets);
        ctx += `Productivity board overview:\n`;
        lists.forEach(([listName, cards]) => {
          if (cards?.length) ctx += `  ${listName} (${cards.length} cards): ${cards.slice(0, 3).map(c => c.title || c.name).join(", ")}.\n`;
        });
      }
    }

   console.log("[Donna Context]", ctx);
    sendSessionUpdate({ instructions: ctx });
  }, [isDonnaConnected, currentView.app, email, gchatSelectedSpace, gchatDmNames, trelloCard, gmailEmails, gchatMessages, calendarEvents, selectedEvent, gchatSpaces, trelloBuckets, gmailFolder]); // 🛡️ FIX: Removed sendSessionUpdate to prevent infinite loop

const chatTextareaRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => { if (Object.keys(systemErrors).length === 0) setShowSystemPopup(false); }, [systemErrors]);

  useEffect(() => {
  const nice =
    PERSONA.toUpperCase() === "YOLANDIE"
      ? "Yolandie"
      : PERSONA.toUpperCase() === "SIYA"
      ? "Siya"
      : "Unknown";

  document.title = `ActuarySpace — ${nice}`;
  }, []);

  useWorkspaceListeners({
    currentView, setCurrentView,
    setEmailPreview,
    setTrelloCard, setTrelloMenuOpen, setDescEditing, setDescDraft,
  });

  useSyncPolling({
    isMuted,
    sessionStartTime,
    isInitialGmailSyncRef, isInitialGchatSyncRef,
    reportSystemError, clearSystemError,
    notifications, setNotifications, setNotifLoading,
    dismissedNotifsRef, seenGmailIdsRef, seenGchatIdsRef, soundedGmailIdsRef,
    setGmailEmails, activeFolderRef, activeSearchRef, gmailPageRef,
    gchatSpaces, setGchatSpaces, gchatSelectedSpaceRef, currentViewRef,
    setGchatMessages, setGchatSpaceTimes, setTrashedGchatSpaces,
    setUnreadGchatSpaces, mutedGchatSpaces,
  });

  useEffect(() => {
    if (currentView.app !== "none") setShowWelcome(false);
  }, [currentView.app]);

  const { onNotificationClick, dismissNotification } = useNotificationHandlers({
    setCurrentView,
    setNotifications, dismissedNotifsRef, setExitingNotifIds,
    setUnreadGchatSpaces, setTrashedGchatSpaces, gchatSpaces, setGchatMessages, setGchatSelectedSpace,
    setGmailEmails, gmailFolder, setSelectedDraftTemplate, setDraftTo, setDraftAttachments, setEmail, setEmailPreview,
    setCalendarViewDate, setSelectedEvent,
  });

  const handleAutoGrow = (ta) => {
    if (!ta) return;
    const maxLines = 10;
    const lh = parseFloat(getComputedStyle(ta).lineHeight || "22");
    const max = lh * maxLines;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, max) + "px";
    ta.style.overflowY = ta.scrollHeight > max ? "auto" : "hidden";
    const chatBar = ta.closest(".chat-bar");
    const isExpanded = ta.scrollHeight > lh * 1.6;
    if (chatBar) chatBar.classList.toggle("expanded", isExpanded);
  };

  const middleContent = useMemo(() => {

    let rawQ = (searchQuery || "").toLowerCase().trim();
    let searchTerms = [];

    if (rawQ.includes(':')) {
      searchTerms = [];
    } else if (rawQ.startsWith('"') && rawQ.endsWith('"') && rawQ.length > 1) {
      searchTerms = [rawQ.slice(1, -1)];
    } else if (rawQ) {
      searchTerms = [rawQ];
    }

    const filteredEmails = (searchQuery.trim() !== "")
      ? (gmailEmails || [])
      : (gmailEmails || []).filter((msg) => {
          if (searchTerms.length === 0) return true;
          const subject = (msg.subject || "").toLowerCase();
          const from = (msg.fromName || msg.fromEmail || msg.from || "").toLowerCase();
          const snippet = (msg.snippet || "").toLowerCase();
          const bodyText = (msg.body || msg.bodyHtml || "").toLowerCase();
          const searchable = `${subject} ${from} ${snippet} ${bodyText}`;
          return searchTerms.every(term => searchable.includes(term));
        });

    const gchatSearchTerm = debouncedGchatSearchQuery.toLowerCase().trim();
    const filteredGchatSpaces = (gchatSpaces || []).filter(s => {
      const spaceKey = s.id || s.name;
      const isArchived = archivedGchatSpaces.includes(spaceKey);
      const isTrashed = trashedGchatSpaces.includes(spaceKey);

      if (isTrashed) return false;
      if (s._provisional && spaceKey !== (gchatSelectedSpace?.id || gchatSelectedSpace?.name)) return false;
      if (showArchivedChats && !isArchived) return false;
      if (!showArchivedChats && isArchived) return false;

      if (!gchatSearchTerm) return true;
      const learnedName = gchatDmNames[spaceKey] || "";
      let title = GCHAT_ID_MAP[s.displayName] || GCHAT_ID_MAP[spaceKey] || s.displayName || "Unnamed Space";

      if (s.type === "DIRECT_MESSAGE") {
        if (GCHAT_ID_MAP[s.displayName]) title = GCHAT_ID_MAP[s.displayName];
        else if (GCHAT_ID_MAP[spaceKey]) title = GCHAT_ID_MAP[spaceKey];
        else if (learnedName && learnedName !== "Direct Message" && !learnedName.includes("users/")) title = learnedName;
      }
      return title.toLowerCase().includes(gchatSearchTerm);
    });

if (currentView.app === "gchat") {
  return <GChatApp
    filteredGchatSpaces={filteredGchatSpaces}
    combinedContacts={combinedContacts}
    debouncedChatSearchText={debouncedChatSearchText}
    gchatMessages={gchatMessages} setGchatMessages={setGchatMessages}
    gchatSelectedSpace={gchatSelectedSpace} setGchatSelectedSpace={setGchatSelectedSpace}
    gchatSpaces={gchatSpaces} setGchatSpaces={setGchatSpaces}
    gchatLoading={gchatLoading} setGchatLoading={setGchatLoading}
    gchatError={gchatError} setGchatError={setGchatError}
    gchatMe={gchatMe}
    gchatMsgLoading={gchatMsgLoading} setGchatMsgLoading={setGchatMsgLoading}
    gchatMsgError={gchatMsgError} setGchatMsgError={setGchatMsgError}
    gchatFilePreview={gchatFilePreview} setGchatFilePreview={setGchatFilePreview}
    gchatDmNames={gchatDmNames} setGchatDmNames={setGchatDmNames}
    gchatNextPageToken={gchatNextPageToken} setGchatNextPageToken={setGchatNextPageToken}
    gchatLoadingOlder={gchatLoadingOlder} setGchatLoadingOlder={setGchatLoadingOlder}
    gchatAutoScroll={gchatAutoScroll} setGchatAutoScroll={setGchatAutoScroll}
    gchatSpaceTimes={gchatSpaceTimes} setGchatSpaceTimes={setGchatSpaceTimes}
    archivedGchatSpaces={archivedGchatSpaces} setArchivedGchatSpaces={setArchivedGchatSpaces}
    trashedGchatSpaces={trashedGchatSpaces} setTrashedGchatSpaces={setTrashedGchatSpaces}
    mutedGchatSpaces={mutedGchatSpaces} setMutedGchatSpaces={setMutedGchatSpaces}
    unreadGchatSpaces={unreadGchatSpaces} setUnreadGchatSpaces={setUnreadGchatSpaces}
    showArchivedChats={showArchivedChats} setShowArchivedChats={setShowArchivedChats}
    showNewChatModal={showNewChatModal} setShowNewChatModal={setShowNewChatModal}
    newChatPopupPos={newChatPopupPos} setNewChatPopupPos={setNewChatPopupPos}
    newChatTarget={newChatTarget} setNewChatTarget={setNewChatTarget}
    gchatSearchQuery={gchatSearchQuery} setGchatSearchQuery={setGchatSearchQuery}
    chatSearchText={chatSearchText} setChatSearchText={setChatSearchText}
    isChatSearchOpen={isChatSearchOpen} setIsChatSearchOpen={setIsChatSearchOpen}
    hoveredMsgId={hoveredMsgId} setHoveredMsgId={setHoveredMsgId}
    editingMsgId={editingMsgId} setEditingMsgId={setEditingMsgId}
    editValue={editValue} setEditValue={setEditValue}
    callBtnHovered={callBtnHovered} setCallBtnHovered={setCallBtnHovered}
    reactions={reactions}
    reactionCounts={reactionCounts}
    chatBarHeight={chatBarHeight} setChatBarHeight={setChatBarHeight}
    showJumpToBottom={showJumpToBottom} setShowJumpToBottom={setShowJumpToBottom}
    dmsExpanded={dmsExpanded} setDmsExpanded={setDmsExpanded}
    spacesExpanded={spacesExpanded} setSpacesExpanded={setSpacesExpanded}
    setNotifications={setNotifications}
    setIsLiveCallActive={setIsLiveCallActive}
    setMsgToDelete={setMsgToDelete}
    setChatToDelete={setChatToDelete}
    gchatBodyRef={gchatBodyRef}
    newChatBtnRef={newChatBtnRef}
    newChatEmailRef={newChatEmailRef}
    messagesEndRef={messagesEndRef}
    pendingScrollAnchorRef={pendingScrollAnchorRef}
    isProgrammaticScrollRef={isProgrammaticScrollRef}
    dismissedNotifsRef={dismissedNotifsRef}
    gchatMeRef={gchatMeRef}
    gchatSelectedSpaceRef={gchatSelectedSpaceRef}
    gchatDmNamesRef={gchatDmNamesRef}
    pendingReactionsRef={pendingReactionsRef}
    myReactionsRef={myReactionsRef}
    myEditsRef={myEditsRef}
    handleStartChat={handleStartChat}
    handleDeleteGChatMessage={handleDeleteGChatMessage}
    handleUpdateGChatMessage={handleUpdateGChatMessage}
    toggleReaction={toggleReaction}
  />;
}

if (currentView.app === "gmail" || currentView.app === "email") {
  return <GmailApp
    isDonnaDrafting={donnaPendingAction !== null}
    filteredEmails={filteredEmails}
    combinedContacts={combinedContacts}
    gmailEmails={gmailEmails} setGmailEmails={setGmailEmails}
    gmailLoading={gmailLoading} setGmailLoading={setGmailLoading}
    gmailError={gmailError} setGmailError={setGmailError}
    gmailFolder={gmailFolder} setGmailFolder={setGmailFolder}
    gmailRefreshTrigger={gmailRefreshTrigger} setGmailRefreshTrigger={setGmailRefreshTrigger}
    gmailPage={gmailPage} setGmailPage={setGmailPage}
    gmailTotal={gmailTotal} setGmailTotal={setGmailTotal}
    gmailPageTokens={gmailPageTokens} setGmailPageTokens={setGmailPageTokens}
    selectedEmailIds={selectedEmailIds} setSelectedEmailIds={setSelectedEmailIds}
    hoveredEmailId={hoveredEmailId} setHoveredEmailId={setHoveredEmailId}
    email={email} setEmail={setEmail}
    emailPreview={emailPreview} setEmailPreview={setEmailPreview}
    showEmailDetails={showEmailDetails} setShowEmailDetails={setShowEmailDetails}
    selectedDraftTemplate={selectedDraftTemplate} setSelectedDraftTemplate={setSelectedDraftTemplate}
    draftTo={draftTo} setDraftTo={setDraftTo}
    draftAttachments={draftAttachments} setDraftAttachments={setDraftAttachments}
    isDraftEnlarged={isDraftEnlarged} setIsDraftEnlarged={setIsDraftEnlarged}
    showDraftPicker={showDraftPicker} setShowDraftPicker={setShowDraftPicker}
    searchQuery={searchQuery} setSearchQuery={setSearchQuery}
    otherContacts={otherContacts} setOtherContacts={setOtherContacts}
    historyContacts={historyContacts} setHistoryContacts={setHistoryContacts}
    draftPos={draftPos} setDraftPos={setDraftPos}
    currentView={currentView} setCurrentView={setCurrentView}
    batchStatus={batchStatus}
    setReviewingDoc={setReviewingDoc}
    setIsLiveCallActive={setIsLiveCallActive}
    setSnackbar={setSnackbar}
    draftFileInputRef={draftFileInputRef}
    draftWindowRef={draftWindowRef}
    isDraggingDraft={isDraggingDraft}
    handleDraftMouseDown={handleDraftMouseDown} // 👈 ADDED THIS LINE
    htmlTooltipRef={htmlTooltipRef}
    triggerSnackbar={triggerSnackbar}
  />;
}

  if (currentView.app === "trello" && trelloCard) {
    return <TrelloApp
      trelloCard={trelloCard} setTrelloCard={setTrelloCard}
      trelloPreview={trelloPreview} setTrelloPreview={setTrelloPreview}
      trelloBuckets={trelloBuckets} setTrelloBuckets={setTrelloBuckets}
      trelloMembers={trelloMembers} setTrelloMembers={setTrelloMembers}
      trelloMenuOpen={trelloMenuOpen} setTrelloMenuOpen={setTrelloMenuOpen}
      showMoveSubmenu={showMoveSubmenu} setShowMoveSubmenu={setShowMoveSubmenu}
      moveTab={moveTab} setMoveTab={setMoveTab}
      moveTargetList={moveTargetList} setMoveTargetList={setMoveTargetList}
      moveTargetPos={moveTargetPos} setMoveTargetPos={setMoveTargetPos}
      moveListSearch={moveListSearch} setMoveListSearch={setMoveListSearch}
      descEditing={descEditing} setDescEditing={setDescEditing}
      descDraft={descDraft} setDescDraft={setDescDraft}
      showAddMenu={showAddMenu} setShowAddMenu={setShowAddMenu}
      addMenuStep={addMenuStep} setAddMenuStep={setAddMenuStep}
      checklists={checklists} setChecklists={setChecklists}
      newChecklistTitle={newChecklistTitle} setNewChecklistTitle={setNewChecklistTitle}
      copyFromChecklist={copyFromChecklist} setCopyFromChecklist={setCopyFromChecklist}
      cardAttachments={cardAttachments} setCardAttachments={setCardAttachments}
      attachLink={attachLink} setAttachLink={setAttachLink}
      attachName={attachName} setAttachName={setAttachName}
      showMemberShortcut={showMemberShortcut} setShowMemberShortcut={setShowMemberShortcut}
      showLabelPicker={showLabelPicker} setShowLabelPicker={setShowLabelPicker}
      currentView={currentView} setCurrentView={setCurrentView}
      allTrelloLists={allTrelloLists}
      showAddTime={showAddTime} setShowAddTime={setShowAddTime}
      manualHours={manualHours} setManualHours={setManualHours}
      manualMins={manualMins} setManualMins={setManualMins}
      trelloAttachmentRef={trelloAttachmentRef}
      pendingCFRef={pendingCFRef}
      triggerSnackbar={triggerSnackbar}
    />;
  }

  if (currentView.app === "calendar") {
    return <CalendarApp
      calendarEvents={calendarEvents} setCalendarEvents={setCalendarEvents}
      calendarLoading={calendarLoading} setCalendarLoading={setCalendarLoading}
      calendarError={calendarError} setCalendarError={setCalendarError}
      calendarViewDate={calendarViewDate} setCalendarViewDate={setCalendarViewDate}
      isMonthView={isMonthView} setIsMonthView={setIsMonthView}
      selectedEvent={selectedEvent} setSelectedEvent={setSelectedEvent}
      newEventDraft={newEventDraft} setNewEventDraft={setNewEventDraft}
      eventToDelete={eventToDelete} setEventToDelete={setEventToDelete}
      showCreateModal={showCreateModal} setShowCreateModal={setShowCreateModal}
      isLiveCallActive={isLiveCallActive} setIsLiveCallActive={setIsLiveCallActive}
      currentView={currentView} setCurrentView={setCurrentView}
      gchatMe={gchatMe}
      notifiedEventsRef={notifiedEventsRef}
      triggerSnackbar={triggerSnackbar}
    />;
  }

  if (currentView.app === "productivity") {
    return <ProductivityDashboard trelloBuckets={trelloBuckets} trelloMembers={trelloMembers} />;
  }

  if (reviewingDoc && email) {
    return <ReviewCompareWorkstation reviewingDoc={reviewingDoc} email={email} batchStatus={batchStatus} setReviewingDoc={setReviewingDoc} handleApprove={handleApprove} />;
  }

  return (
    <div className="chat-output" style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
      {showWelcome && <WelcomeMessage />}
    </div>
  );
}, [
  currentView,

  calendarEvents,
  calendarLoading,
  calendarError,
  isMonthView,
  calendarViewDate,

      email,
      emailPreview,
        showDraftPicker,
        selectedDraftTemplate,
        draftTo,
        isDraftEnlarged,
        draftPos,
        draftAttachments,

      gmailEmails,
      gmailLoading,
      gmailError,
      gmailFolder,
      gmailPage,
      gmailTotal,
      gmailRefreshTrigger,
      otherContacts,
      historyContacts,

        trelloCard,
        trelloMenuOpen,
        trelloPreview,
        descEditing,
        descDraft,
        checklists,
        cardAttachments,
        newChecklistTitle,
        copyFromChecklist,
        showLabelPicker,
        showMemberShortcut,
        showAddMenu,
        addMenuStep,
        attachLink,
        attachName,
        showMoveSubmenu,
        moveTab,
        moveTargetList,
        moveTargetPos,
        trelloBuckets,
        selectedEmailIds,
        searchQuery,
        allTrelloLists,
        moveListSearch,
        showNewChatModal,
        newChatTarget,

        gchatMessages,
        gchatLoadingOlder,
        gchatNextPageToken,
        gchatMsgLoading,
        gchatMsgError,
        gchatSelectedSpace,
        gchatDmNames,
        gchatFilePreview,
        debouncedChatSearchText,
        gchatSearchQuery,
        debouncedGchatSearchQuery,
        chatSearchText,
        isChatSearchOpen,
        gchatSpaces,
        unreadGchatSpaces,
        gchatSpaceTimes,
        hoveredMsgId,
        reactions,
        reactionCounts,
        editingMsgId,
        msgToDelete,
        batchStatus,
        reviewingDoc,
        showWelcome,
        callBtnHovered,
      ]);

return (
  <PasswordGate persona={PERSONA}>
    <div className="app">
      <DonnaBubble
        key={donnaKey}
        transcription={donnaTranscription}
        isListening={isDonnaActive}
        showActions={donnaPendingAction !== null}
        onApprove={handleApproveDonna}
        onReject={handleRejectDonna}
        onClose={() => {
          setDonnaTranscription("");
          setIsDonnaActive(false);
        }}
      />

<div className="brand-stack" style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
      <div
          className="brand-rect"
          title="Agent Donna"
          onClick={(e) => {
            const el = e.currentTarget;
            el.style.animation = 'none';
            void el.offsetWidth;
            el.style.animation = 'press-bounce 0.25s ease';
            if (!isDonnaActive) setIsDonnaLoading(true);
            setIsDonnaActive(!isDonnaActive);
          }}
          style={{ width: '100%', height: '140px', overflow: 'hidden', borderRadius: '12px', cursor: 'pointer', background: '#f1f3f4', position: 'relative' }}
        >
          {isDonnaSpeaking ? (
            <video
              src={agentDonnaVideo}
              autoPlay
              muted
              loop
              playsInline
              ref={(el) => {
                if (el) {
                  el.defaultMuted = true;
                  el.muted = true;
                  const playPromise = el.play();
                  if (playPromise !== undefined) {
                    playPromise.catch(() => {});
                  }
                }
              }}
              onError={(e) => console.error('[Donna Video Error] code:', e.target.error?.code, e.target.error?.message)}
              onLoadedData={() => console.log('[Donna Video] loaded OK')}
              style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          ) : (
            <img src={agentDonnaPic} alt="Agent Donna" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          )}
        </div>
<div
          className="brand-rect"
          title={isLiveCallActive ? "Click to stop NotebookLM" : "NotebookLM / Storyteller"}
          onClick={() => { if (isLiveCallActive) setIsLiveCallActive(false); }}
          style={{ width: '100%', height: '140px', overflow: 'hidden', borderRadius: '12px', background: '#f1f3f4', position: 'relative', cursor: isLiveCallActive ? 'pointer' : 'default' }}
        >
          <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: isLiveCallActive ? 1 : 0, transition: 'opacity 0.3s ease', pointerEvents: isLiveCallActive ? 'auto' : 'none' }}>
            <BlueprintVideo isPlaying={isLiveCallActive} />
          </div>
          <div style={{ position: 'absolute', bottom: '12px', right: '14px', display: 'flex', alignItems: 'center', gap: '6px', color: '#bdc1c6', opacity: isLiveCallActive ? 0 : 1, transition: 'opacity 0.3s ease', pointerEvents: isLiveCallActive ? 'none' : 'auto' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 4C7.58 4 4 7.58 4 12v8h4v-8c0-2.21 1.79-4 4-4s4 1.79 4 4v8h4v-8c0-4.42-3.58-8-8-8z"/>
              <path d="M12 10c-1.1 0-2 .9-2 2v8h4v-8c0-1.1-.9-2-2-2z"/>
            </svg>
            <span style={{ fontSize: '15px', fontWeight: '600', fontFamily: "'Google Sans', Roboto, sans-serif", letterSpacing: '-0.3px' }}>
              NotebookLM
            </span>
          </div>
        </div>

        <div style={{ width: '100%', display: 'flex', justifyContent: 'flex-start', paddingLeft: '4px' }}>
          <StorytellerMockup isLiveCallActive={isLiveCallActive} />
        </div>
      </div>

<LeftPanel
  isMuted={isMuted} setIsMuted={setIsMuted}
  notifLoading={notifLoading}
  notifications={notifications}
  exitingNotifIds={exitingNotifIds}
  onNotificationClick={onNotificationClick}
  dismissNotification={dismissNotification}
/>

      <div
        className={`middle-panel ${
          currentView.app === "email" && emailPreview ? "has-email-preview" : ""
        }`}
        style={{}}
      >
        <TopBar
          currentView={currentView}
          setCurrentView={setCurrentView}
          setGchatSelectedSpace={setGchatSelectedSpace}
          setInputValue={setInputValue}
          systemErrors={systemErrors}
          showSystemPopup={showSystemPopup}
          setShowSystemPopup={setShowSystemPopup}
        />

        <div style={{ display: "flex", flex: 1, overflow: "hidden", width: "100%" }}>
          <div className="middle-content" style={{ flex: 1, paddingRight: "2px", paddingBottom: "2px" }}>
            {showWelcome && currentView.app === "none" ? (
              <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <WelcomeMessage />
              </div>
            ) : (
              <MiddleAppSpring appKey={currentView.app}>
                {middleContent}
              </MiddleAppSpring>
            )}
          </div>

  {workstationUrl && (
            <div className="workstation-pane" style={{ flex: 1, borderLeft: "1px solid #dadce0", display: "flex", flexDirection: "column", background: "#fff", zIndex: 10 }}>
              <div style={{ padding: "8px 16px", background: "#f8f9fa", borderBottom: "1px solid #dadce0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "14px", fontWeight: 600, color: "#3c4043" }}>Workspace</span>
                <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                  <button onClick={() => window.open(workstationUrl, "_blank")} style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: "18px", color: "#5f6368" }} title="Open in new tab">↗</button>
                  <button onClick={() => { setWorkstationUrl(null); setIsLiveCallActive(false); }} style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: "18px", color: "#5f6368" }} title="Close split pane">✕</button>
                </div>
              </div>
              <iframe src={workstationUrl} style={{ width: "100%", height: "100%", border: "none" }} />
            </div>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"

          accept="application/pdf, image/png, image/jpeg, .xlsx, .xls, .docx, .doc, audio/*, video/*"
          style={{ display: "none" }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (!f) return;

            if (f.size > 4.5 * 1024 * 1024) {
              alert("Netlify Limit: File must be under 4.5MB.");
              return;
            }

            setPendingUpload({ file: f, kind: "file" });
            setShowPlusMenu(false);
            e.target.value = "";
          }}
        />

<ChatBar
  currentView={currentView}
  gchatSelectedSpace={gchatSelectedSpace}
  pendingUpload={pendingUpload} setPendingUpload={setPendingUpload}
  chatBarRef={chatBarRef}
  inputValue={inputValue} setInputValue={setInputValue}
  isRecording={isRecording}
  handleSend={handleSend}
  handleAutoGrow={handleAutoGrow}
  startRecording={startRecording}
  stopRecording={stopRecording}
  showPlusMenu={showPlusMenu} setShowPlusMenu={setShowPlusMenu}
  fileInputRef={fileInputRef}
  chatTextareaRef={chatTextareaRef}
/>
      </div>

      <RightPanel
        activeTrelloCardId={trelloCard?.id}
        gchatSpaces={gchatSpaces}
        gchatLoading={gchatLoading}
        gchatError={gchatError}
        gchatDmNames={gchatDmNames}
        gchatSelectedSpace={gchatSelectedSpace}
        setGchatSelectedSpace={setGchatSelectedSpace}
        unreadGchatSpaces={unreadGchatSpaces}
        setUnreadGchatSpaces={setUnreadGchatSpaces}
        gchatSpaceTimes={gchatSpaceTimes}
        setGchatSpaceTimes={setGchatSpaceTimes}
        archivedGchatSpaces={archivedGchatSpaces}
        setArchivedGchatSpaces={setArchivedGchatSpaces}
        mutedGchatSpaces={mutedGchatSpaces}
        setMutedGchatSpaces={setMutedGchatSpaces}
        trashedGchatSpaces={trashedGchatSpaces}
        setTrashedGchatSpaces={setTrashedGchatSpaces}
        chatToDelete={chatToDelete}
        setChatToDelete={setChatToDelete}
        triggerSnackbar={triggerSnackbar}
      />

      <AppModals
        selectedEvent={selectedEvent}
        setSelectedEvent={setSelectedEvent}
        setEventToDelete={setEventToDelete}
        setIsLiveCallActive={setIsLiveCallActive}
        eventToDelete={eventToDelete}
        confirmDeleteEvent={confirmDeleteEvent}
        chatToDelete={chatToDelete}
        setChatToDelete={setChatToDelete}
        confirmDeleteChat={confirmDeleteChat}
        showCreateModal={showCreateModal}
        setShowCreateModal={setShowCreateModal}
        newEventDraft={newEventDraft}
        setNewEventDraft={setNewEventDraft}
        setCalendarEvents={setCalendarEvents}
        triggerSnackbar={triggerSnackbar}
        snackbar={snackbar}
        setSnackbar={setSnackbar}
        lastAction={lastAction}
        handleUndo={handleUndo}
        msgToDelete={msgToDelete}
        setMsgToDelete={setMsgToDelete}
        confirmDeleteGChatMessage={confirmDeleteGChatMessage}
      />

    </div>
  </PasswordGate>
  );
}