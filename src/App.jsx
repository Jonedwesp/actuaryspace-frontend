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
  const [donnaVisible, setDonnaVisible] = useState(false);

  const donnaRespondingRef = useRef(false);
  const ignoreNextDonnaRef = useRef(false);
  const donnaTextModeRef = useRef(false);
  const transcriptionRef = useRef("");
  const lastCtxRef = useRef("");
  const [donnaKey, setDonnaKey] = useState(0);
  

const { 
    isConnected: isDonnaConnected, 
    connectDonna, 
    disconnectDonna, 
    sendSessionUpdate,
    sendToolResponse,
    sendText,
    sendResponseCreate,
    deleteLastUserItem,
    pcRef,
    dcRef
} = useDonna({
   instructions: "You are Donna Paulsen from the TV show Suits. You are the ultimate confidante, a world-class fixer, and the most competent person in any room. You work for Siyabonga (Siya), a top actuary. You are fiercely loyal, highly intuitive, and always three steps ahead.\n\nPersonality & Tone:\n- Supremely Confident: You never doubt yourself. You speak with absolute authority and a knowing smile in your voice.\n- Witty & Sassy: Quick on your feet, playful, unafraid to tease Siya if he asks something obvious.\n- Hyper-Competent: You don't just answer questions, you anticipate what Siya actually needs before he finishes asking. You act as though you've already handled the boring logistics.\n- Emotionally Intelligent: You read between the lines. If Siya sounds stressed, offer sharp, grounded support.\n\nVoice Rules:\n- Keep responses punchy, conversational, and natural for spoken audio. No long robotic lists unless explicitly asked.\n- NEVER refer to yourself as an AI, a language model, or a computer program. If asked how you did something so fast, it's simply because of who you are.\n- No filler words like 'Um' or 'Let me think.' You already know the answer.\n- When Siya asks how you knew something or why you're so good, respond with some variation of: 'Because I'm Donna.' or 'I'm Donna. I know everything.'\n- Occasionally tell Siya what he SHOULD do instead of just doing what he asked, if you know a better way.\n- Address Siya directly and confidently. Use phrases like 'Listen to me,' or 'Here's what we're going to do...'\n- Always respond in English only.\n\n*** EMAIL ADDRESS & CONTACT PROTOCOL ***\n- NEVER guess or make up an email address (e.g., '@example.com').\n- You are FORBIDDEN from putting a person's name in the 'to' field of a draft. It MUST be a full email address.\n- If Siya asks you to email someone by name, you MUST call 'gmail_get_contacts' first to find their real email address.\n- If 'gmail_get_contacts' does not return a match, STOP and ask Siya: 'I couldn't find an email for [Name], what address should I use?'\n- ONLY call 'gmail_save_draft' once you have a verified email address from the contact list or Siya.\n\n*** DRAFT & REVIEW PROTOCOL ***\n- When drafting an email, you MUST verbally tell Siya: 'I've prepared that draft for your review. Would you like to see it?'\n- You MUST call the 'gmail_save_draft' tool immediately while asking this question.\n- You are NOT finished until Siya clicks 'Approve' on his screen, which triggers the UI popup and eventually opens the Gmail Compose window.\n\n*** STRICT TRIGGER RULE ***\nYour audio stream is always open, but you are ASLEEP. You ONLY wake up and respond if the word 'Donna' appears ANYWHERE in the user's sentence.\n- If 'Donna' is not said, output ABSOLUTELY NOTHING. Remain completely silent. Do not explain. Do not apologize.\n- 'Donna' can appear anywhere: start, middle, or end of the sentence.\n- IMPORTANT: If the user says 'Donna approve' or 'Donna reject', this is handled locally. YOU MUST OUTPUT ABSOLUTELY NOTHING. DO NOT ASK WHAT TO APPROVE. JUST REMAIN SILENT.\n- Once you fulfill a request, go immediately back to sleep.\n\nTool Usage:\nWhen carrying out a request involving creating, modifying, moving, or deleting data (e.g., saving a draft, moving a card), BEFORE you say what you are doing, ask Siya to approve or reject on his screen. You MUST call the tool immediately alongside your voice response. The system will catch your tool call and automatically display the Approve/Reject buttons. If you are simply navigating or fetching data, execute the tool immediately without asking for approval.", tools: DONNA_TOOLS,
onTranscription: (text) => {
      if (!text) return; 
      const lowerText = text.toLowerCase().trim();
      const hasWakeWord = /donna/i.test(lowerText);
      
      // 🛡️ No wake word: discard the audio item and stay silent
      if (!hasWakeWord) {
        deleteLastUserItem();
        return;
      }
      
      // 🎙️ VOICE APPROVAL ENGINE: Detects "donna approve" or "donna reject"
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

      setDonnaVisible(false); // Collapse bubble for new question
      sendResponseCreate(); // 🛡️ Wake word confirmed — now ask Donna to respond
    },

onResponseDelta: (delta, isNew) => {
      if (ignoreNextDonnaRef.current) return;

      donnaRespondingRef.current = true;

      if (isNew) { 
        setIsDonnaSpeaking(true);
        setDonnaKey(k => k + 1); 
        // 🎯 Reset the Ref immediately
        transcriptionRef.current = delta;
        setDonnaTranscription(delta);
        setDonnaVisible(true);
      } else {
        transcriptionRef.current += delta;
        setDonnaTranscription(transcriptionRef.current);
      }
    },
    onResponseEnd: () => {
      if (ignoreNextDonnaRef.current) {
        ignoreNextDonnaRef.current = false;
        return;
      }
      donnaRespondingRef.current = false;
      donnaTextModeRef.current = false;
      setIsDonnaSpeaking(false);
      setDonnaTranscription(transcriptionRef.current);

      // Play Donna's response via ElevenLabs (Sarah Rafferty voice)
      const textToSpeak = transcriptionRef.current;
      if (textToSpeak) {
        fetch("/.netlify/functions/elevenlabs-tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: textToSpeak }),
        })
          .then((res) => {
            if (!res.ok) { res.text().then(t => console.error("[ElevenLabs] Error:", t)); return null; }
            return res.arrayBuffer();
          })
          .then((buf) => {
            if (!buf) return;
            const blob = new Blob([buf], { type: "audio/mpeg" });
            const url = URL.createObjectURL(blob);
            const audio = new Audio(url);
            audio.play().catch((e) => console.warn("[ElevenLabs] Audio play blocked:", e));
            audio.onended = () => URL.revokeObjectURL(url);
          })
          .catch((e) => console.error("[ElevenLabs] TTS error:", e));
      }
    },
onFunctionCall: ({ name, args, call_id }) => {
      // 🛡️ ARCHITECT'S GUARD: Fixed Asynchronous Race Condition.
      // Donna's transcription gets overwritten by her own voice delta.
      // Since onTranscription already performs a HARD CANCEL on non-wake words, any tool call arriving here is authorized.
      const isAuthorized = true;

      if (!isAuthorized) {
        console.log(`[Donna] Protocol Violation: Tool ${name} blocked. Wake-word missing.`);
        // sendToolResponse(call_id, { error: "Protocol violation: Wake-word missing." }); // Optional: tell Donna why she failed
        return;
      }

// 1. Auto-execute navigation, inbox searches, reading emails, and simple toggles
      if (name === "navigate_to_app" || name === "gmail_get_inbox" || name === "gmail_get_message" || name === "gmail_toggle_star" || name === "gmail_mark_unread") {
        
        const cleanId = (id) => {
          if (typeof id !== 'string') return String(id);
          return id.replace(/\[?ID:\s*/gi, '').replace(/\]/g, '').replace(/['"]/g, '').trim();
        };
        const getExactId = (messyId) => {
          const cleaned = cleanId(messyId);
          const found = gmailEmails?.find(e => {
            const eId = String(e.id).trim();
            return eId === cleaned || eId.includes(cleaned) || cleaned.includes(eId);
          });
          return found ? found.id : cleaned;
        };

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
        } else if (name === "gmail_get_message") {
          console.log(`[Donna] Opening specific email...`, args);
          setCurrentView({ app: "email", contact: null });
          if (args.messageId) {
            const exactId = cleanId(args.messageId);
            const foundMsg = gmailEmails?.find(m => {
              const eId = String(m.id).trim();
              return eId === exactId || eId.includes(exactId) || exactId.includes(eId);
            });
            const finalId = foundMsg ? foundMsg.id : exactId;
            const fallbackName = args.senderName || (foundMsg ? foundMsg.from.split("<")[0].replace(/"/g, '').trim() : "Unknown");
            
            setEmail({
              id: finalId,
              subject: foundMsg?.subject || "Loading message...",
              fromName: fallbackName,
              fromEmail: foundMsg?.from || "",
              date: foundMsg?.date || new Date().toISOString(),
              time: foundMsg?.date ? new Date(foundMsg.date).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "",
              bodyLoading: true,
              attachments: [],
              actions: [{ key: "submit_trello", label: "Submit to Trello" }, { key: "update_tracker", label: "Update AC Tracker" }]
            });

            fetch(`/.netlify/functions/gmail-message?messageId=${finalId}`, {
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
                     url: `/.netlify/functions/gmail-download?messageId=${finalId}&attachmentId=${a.id}&filename=${encodeURIComponent(a.name)}&mimeType=${encodeURIComponent(a.mimeType)}`
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
        } else if (name === "gmail_toggle_star") {
          console.log(`[Donna] Auto-Starring email...`, args);
          let starIds = [];
          if (Array.isArray(args.messageIds)) starIds = args.messageIds;
          else if (typeof args.messageIds === 'string') starIds = [args.messageIds];
          else if (typeof args.messageId === 'string') starIds = [args.messageId];

          if (starIds.length === 0 && email?.id) {
            starIds = [email.id];
          }

          const exactStarIds = starIds.map(getExactId);
          const nextStarredState = (args.starred === false || String(args.starred).toLowerCase() === 'false') ? false : true;

          if (exactStarIds.length > 0) {
            setGmailEmails(prev => {
              const updated = prev.map(msg => {
                const mId = String(msg.id).trim();
                const isMatch = exactStarIds.some(eid => mId === eid || mId.includes(eid) || eid.includes(mId));
                return isMatch ? { ...msg, isStarred: nextStarredState } : msg;
              });
              if (!nextStarredState && gmailFolder === "STARRED") {
                return updated.filter(msg => !exactStarIds.includes(String(msg.id).trim()));
              }
              return updated;
            });
            
            setEmail(prev => {
              if (!prev) return prev;
              const pId = String(prev.id).trim();
              const isMatch = exactStarIds.some(eid => pId === eid || pId.includes(eid) || eid.includes(pId));
              return isMatch ? { ...prev, isStarred: nextStarredState } : prev;
            });

            exactStarIds.forEach(eid => {
              fetch("/.netlify/functions/gmail-toggle-star", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ messageId: eid, starred: nextStarredState })
              }).catch(err => console.error("Starring failed:", err));
            });
          }
        } else if (name === "gmail_mark_unread") {
          console.log(`[Donna] Auto-Marking email unread...`, args);
          if (args.messageId) {
            const exactId = getExactId(args.messageId);
            setGmailEmails(prev => prev.map(msg => 
              msg.id === exactId ? { ...msg, isUnread: true } : msg
            ));
            fetch("/.netlify/functions/gmail-mark-unread", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({ messageId: exactId })
            }).catch(err => console.error("Mark unread failed:", err));
          }
        }
        
        if (call_id) {
          sendToolResponse(call_id, { success: true, status: "Action successful. Please confirm briefly to the user." });
        }
        return;
      }

      // 2. Auto-execute Contact Lookup (Solves the email accuracy issue)
      if (name === "gmail_get_contacts") {
        console.log("[Donna] Fetching contacts for lookup...");
        fetch("/.netlify/functions/gmail-contacts", { credentials: "include" })
          .then(res => res.json())
          .then(data => {
            const contactMap = data.contacts || data;
            // 🎯 FIX: Convert the map into a string that explicitly tells Donna: "Name: email"
            const contactString = Object.entries(contactMap)
              .map(([name, email]) => `${name}: ${email}`)
              .join(", ");

            sendToolResponse(call_id, { 
              success: true, 
              contacts: contactString,
              instructions: `I found these contacts: ${contactString}. Find the person Siya mentioned. When you call gmail_save_draft, you MUST put their EMAIL ADDRESS in the 'to' field, NOT their name.`
            });
          })
          .catch(err => {
            console.error("Contact fetch failed:", err);
            sendToolResponse(call_id, { success: false, error: "Could not retrieve contacts." });
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

      // 3. Set the pending action to trigger the Approve/Reject UI buttons
      setDonnaPendingAction({ name, args, call_id });
      
   if (name === "trello_move_card") {
        setDonnaTranscription(`Donna wants to: move a Trello card.`);
      } else if (name === "gmail_save_draft") {
        // 🎯 UX Update: Soften the language to "Review"
        setDonnaTranscription(`Donna has prepared a draft for your review.`);
      } else if (name === "gmail_delete_bulk") {
        const sender = args.senderName || "this sender";
        const subject = args.subject ? ` ("${args.subject}")` : "";
        const action = args.restore ? "restore" : "delete";
        setDonnaTranscription(`Donna wants to: ${action} email from ${sender}${subject}`);
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

  const donnaAudioRef = useRef(null);

  useEffect(() => {
    if (!pcRef || !pcRef.current) return;
    pcRef.current.ontrack = (event) => {
      if (donnaAudioRef.current && event.streams[0]) {
        donnaAudioRef.current.srcObject = event.streams[0];
      }
    };
  }, [pcRef]);

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
  const [donnaBarInput, setDonnaBarInput] = useState("");
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
    const { name, args, call_id } = donnaPendingAction;

    // 🎙️ Send success back to the LLM immediately so Donna can speak her confirmation!
    if (call_id) {
      sendToolResponse(call_id, { success: true, status: "User approved the action. Please confirm briefly." });
    }

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
        console.log(`[Donna] Marking email as unread...`, args);
        setCurrentView({ app: 'gmail', contact: null });
        if (args.messageId) {
          const exactId = getExactId(args.messageId);
          
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
        
        let rawIds = [];
        if (Array.isArray(args.messageIds)) rawIds = args.messageIds;
        else if (typeof args.messageIds === 'string') rawIds = [args.messageIds];
        else if (typeof args.messageId === 'string') rawIds = [args.messageId];

        if (rawIds.length === 0 && email?.id) {
          rawIds = [email.id];
        }

        const exactIds = rawIds.map(getExactId);

        if (exactIds.length > 0) {
          // 🚀 IMMEDIATE OPTIMISTIC REMOVAL: Strip from all possible state views
          setGmailEmails(prev => prev.filter(msg => !exactIds.includes(String(msg.id))));
          
          // Clear active detail view if it matches the deleted ID
          if (email && exactIds.includes(String(email.id))) {
            setEmail(null);
            setEmailPreview(null);
            setCurrentView({ app: 'gmail', contact: null });
          }

          // Adjust total count immediately
          setGmailTotal(t => Math.max(0, t - exactIds.length));
          
          triggerSnackbar(`Conversation(s) moved to Trash.`);

          if (call_id) {
            sendToolResponse(call_id, { success: true, status: "Email moved to trash. Please confirm briefly to the user." });
          }
          
          // Backend call happens silently in background
          fetch("/.netlify/functions/gmail-delete-bulk", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ messageIds: exactIds, permanent: false }) 
          }).catch(err => {
            console.error("Delete failed:", err);
            // Optional: Rollback logic here if critical
          });
        } else {
          if (call_id) {
            sendToolResponse(call_id, { success: false, error: "Could not find email ID." });
          }
        }
        break;

   case 'gmail_toggle_star':
        console.log(`[Donna] Starring email...`, args);
        
        // 1. Bulletproof ID array handling (matches the delete logic)
        let starIds = [];
        if (Array.isArray(args.messageIds)) starIds = args.messageIds;
        else if (typeof args.messageIds === 'string') starIds = [args.messageIds];
        else if (typeof args.messageId === 'string') starIds = [args.messageId];

        // 2. Critical Fallback: If Donna drops the ID, use the currently open email
        if (starIds.length === 0 && email?.id) {
          starIds = [email.id];
        }

        const exactStarIds = starIds.map(getExactId);
        const nextStarredState = (args.starred === false || String(args.starred).toLowerCase() === 'false') ? false : true;

        if (exactStarIds.length > 0) {
          // 🚀 ZERO-LATENCY UI UPDATE: Aggressively match the ID
          setGmailEmails(prev => {
            const updated = prev.map(msg => {
              const mId = String(msg.id).trim();
              const isMatch = exactStarIds.some(eid => mId === eid || mId.includes(eid) || eid.includes(mId));
              return isMatch ? { ...msg, isStarred: nextStarredState } : msg;
            });
            // If unstarring while viewing the Starred folder, remove it instantly
            if (!nextStarredState && gmailFolder === "STARRED") {
              return updated.filter(msg => !exactStarIds.includes(String(msg.id).trim()));
            }
            return updated;
          });
          
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
        console.log("[Donna] Executing Trello move...", args);
        setCurrentView({ app: 'trello', contact: null });

        let cardIdToMove = null;
        let listIdToTarget = args.targetListId;
        let targetKeyName = null;

        // 1. Resolve REAL Card ID (Search all buckets)
        for (const [listName, cards] of Object.entries(trelloBuckets || {})) {
          if (Array.isArray(cards)) {
            const match = cards.find(c => 
              c.id === args.cardId || 
              (c.title || c.name || "").toLowerCase().includes((args.cardId || "").toLowerCase())
            );
            if (match) {
              cardIdToMove = match.id;
              break;
            }
          }
        }

        // 2. Resolve Target List ID by Name
        const bucketNames = Object.keys(trelloBuckets || {});
        targetKeyName = bucketNames.find(n => 
          n.toLowerCase().includes((args.targetListId || "").toLowerCase())
        );

        if (targetKeyName && Array.isArray(trelloBuckets[targetKeyName])) {
           if (trelloBuckets[targetKeyName].length > 0) {
              listIdToTarget = trelloBuckets[targetKeyName][0].idList;
           }
        }

        // 🛡️ GUARD: Prevent 400 Bad Request
        if (!cardIdToMove || cardIdToMove.length < 10) {
          console.error("[Donna] Could not resolve card ID for:", args.cardId);
          triggerSnackbar("Error: Could not find that card.");
          setDonnaPendingAction(null);
          return;
        }

        // 🚀 OPTIMISTIC UI UPDATE (Prevents trelloBuckets.map error)
        setTrelloBuckets(prev => {
          if (!prev || typeof prev !== 'object') return prev; 
          const next = { ...prev };
          let movingCard = null;
          
          for (const key in next) {
            if (Array.isArray(next[key])) {
              const card = next[key].find(c => c.id === cardIdToMove);
              if (card) {
                movingCard = { ...card, idList: listIdToTarget };
                next[key] = next[key].filter(c => c.id !== cardIdToMove);
                break;
              }
            }
          }
          
          if (movingCard && targetKeyName && Array.isArray(next[targetKeyName])) {
            next[targetKeyName] = [movingCard, ...next[targetKeyName]];
          }
          return next;
        });

        triggerSnackbar(`Moving card to ${targetKeyName || 'target list'}...`);

        // 3. Hit the "Hands" (Netlify Function)
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
        
        setDonnaPendingAction(null);
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
    // 🎙️ Tell Donna the user cancelled it so she can acknowledge it
    if (donnaPendingAction?.call_id) {
      sendToolResponse(donnaPendingAction.call_id, { success: false, error: "User rejected the action." });
    }
    
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
  let ctx = "You are Agent Donna, a witty and professional actuarial assistant to Siyabonga (Siya, pronounced See-yah).\n\n*** STRICT WAKE-WORD PROTOCOL ***\nYour audio stream is always open, but you are ASLEEP. You must ONLY wake up and respond if the user's sentence starts exactly with 'Hey Donna'.\n- If the user speaks without saying 'Hey Donna' first, you must output ABSOLUTELY NOTHING. YOU ARE FORBIDDEN FROM SAYING 'I can only respond to requests that begin with...'. Remain completely silent.\n- Do not explain the rule. Do not apologize. Just stay silent.\n- IMPORTANT: If the user says 'Hey Donna approve' or 'Hey Donna reject', this is handled locally by the system. YOU MUST OUTPUT ABSOLUTELY NOTHING. DO NOT ASK WHAT TO APPROVE. JUST REMAIN SILENT.\n- Once you fulfill a 'Hey Donna' request, go immediately back to sleep.\n\nWhen carrying out a request using your tools, you must always speak and verbally explain to Siya what you are doing. If you are simply navigating to an app or searching/fetching data, do NOT ask for approval. If you are creating, modifying, moving, or deleting data (e.g., saving a draft, moving a card), you MUST ask him to approve the action on his screen. Be concise. IMPORTANT: Always respond in English only.\n\n";
    const now = new Date();
    ctx += `Current date and time: ${now.toLocaleDateString("en-ZA", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}, ${now.toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit", hour12: true })}.\n`;
    ctx += `Current screen: ${app === "none" ? "Home / welcome screen" : app}.\n`;

    if (app === "gmail" || app === "email") {
      if (email) {
        ctx += `Selected email: [ID: ${email.id}] "${email.subject}" from ${email.fromName || email.from || "unknown"}.\n`;
        if (email.snippet) ctx += `Preview: ${email.snippet.slice(0, 300)}\n`;
      } else if (gmailEmails?.length) {
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

    // 1. Check if the awareness needs updating
    const contextChanged = lastCtxRef.current !== ctx;

    // 🛡️ THE STABILITY GUARD: 
    if (isDonnaSpeaking || donnaRespondingRef.current) {
      return; 
    }

    // 2. Only push if quiet and changed
    if (contextChanged && isDonnaConnected) {
      // 🎯 LOCK THE REF IMMEDIATELY to prevent duplicate timeouts
      lastCtxRef.current = ctx;
      
      const timeoutId = setTimeout(() => {
        console.log("[Donna Context] Pushing stable instruction update...");
        sendSessionUpdate({ instructions: ctx });
      }, 300);

      return () => clearTimeout(timeoutId);
    }
    
  }, [
    isDonnaConnected, 
    currentView.app, 
    email, 
    gchatSelectedSpace, 
    gchatDmNames, 
    trelloCard, 
    gmailEmails, 
    gchatMessages, 
    calendarEvents, 
    selectedEvent, 
    gchatSpaces, 
    trelloBuckets, 
    gmailFolder, 
    isDonnaSpeaking // 🎯 Crucial: Refires the effect once she stops talking!
  ]);
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
    handleToggleStar={handleToggleStar}
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
    <div className={`app${isDonnaActive ? " donna-active" : ""}`}>
      <audio ref={donnaAudioRef} autoPlay playsInline />
  <DonnaBubble
        transcription={donnaTranscription}
        show={donnaVisible}
        showActions={donnaPendingAction !== null}
        onApprove={handleApproveDonna}
        onReject={handleRejectDonna}
        onRequestClose={() => setDonnaVisible(false)}
        onClose={() => {
          setDonnaTranscription("");
          setDonnaPendingAction(null);
          setDonnaVisible(false);
        }}
      />

<div className="brand-stack" style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
<div
          className="brand-rect"
          title="Agent Donna"
          onClick={(e) => {
            // 🔊 Force browser to unlock the WebRTC audio stream
            if (donnaAudioRef.current && donnaAudioRef.current.paused) {
              donnaAudioRef.current.play().catch(err => console.warn("Audio unlock failed:", err));
            }

            const el = e.currentTarget;
            el.style.animation = 'none';
            void el.offsetWidth;
            el.style.animation = 'press-bounce 0.25s ease';
            if (!isDonnaActive) {
              setIsDonnaLoading(true);
              setDonnaTranscription("Listening..."); // 🛡️ Visual feedback that bubble is ready
            }
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

        <div style={{ display: "flex", flex: 1, overflow: "hidden", width: "100%", paddingBottom: isDonnaActive ? "80px" : "0", transition: "padding-bottom 0.3s cubic-bezier(0.34,1.56,0.64,1)" }}>
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

      {/* 🟣 DONNA TEXT BAR */}
        <div style={{
          position: 'absolute',
          bottom: '24px',
          left: '50%',
          width: 'calc(100% - 32px)',
          maxWidth: '1100px',
          display: 'flex',
          alignItems: 'flex-end',
          gap: '8px',
          border: '1px solid #dadce0',
          background: '#fff',
          borderRadius: '24px',
          padding: '8px 12px',
          boxShadow: '0 1px 2px 0 rgba(60,64,67,0.30), 0 1px 3px 1px rgba(60,64,67,0.15)',
          zIndex: 50,
          boxSizing: 'border-box',
          transform: isDonnaActive ? 'translateX(-50%) translateY(0)' : 'translateX(-50%) translateY(calc(100% + 56px))',
          pointerEvents: isDonnaActive ? 'auto' : 'none',
          transition: 'transform 0.3s cubic-bezier(0.34,1.56,0.64,1)',
        }}>
          <textarea
            className="chat-textarea"
            placeholder="Message Donna..."
            rows={1}
            value={donnaBarInput}
            onChange={(e) => setDonnaBarInput(e.target.value)}
            onInput={(e) => {
              const el = e.currentTarget;
              el.style.height = 'auto';
              el.style.height = Math.min(el.scrollHeight, 160) + 'px';
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (!donnaBarInput.trim()) return;
                setDonnaVisible(false);
                donnaTextModeRef.current = true;
                sendText("Hey Donna, " + donnaBarInput);
                setDonnaBarInput('');
              }
            }}
            style={{ flex: 1, minHeight: '40px', paddingTop: '10px', marginBottom: '2px', overflowY: 'hidden' }}
          />
          {donnaBarInput.trim() && (
            <button
              onClick={() => {
                if (!donnaBarInput.trim()) return;
                setDonnaVisible(false);
                donnaTextModeRef.current = true;
                sendText("Hey Donna, " + donnaBarInput);
                setDonnaBarInput('');
              }}
              style={{
                width: '28px', height: '28px', borderRadius: '50%',
                display: 'grid', placeItems: 'center',
                border: 'none', background: '#000',
                cursor: 'pointer', color: 'white', marginBottom: '4px', flexShrink: 0,
              }}
              aria-label="Send"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14"
                fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="19" x2="12" y2="5" />
                <polyline points="5 12 12 5 19 12" />
              </svg>
            </button>
          )}
        </div>
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