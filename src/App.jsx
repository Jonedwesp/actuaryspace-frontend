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
import { WhatsAppApp } from "./features/WhatsAppApp.jsx";
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
  const donnaHasNewTextRef = useRef(false);
  const donnaAudioRef = useRef(null);
  const donnaPlayingRef = useRef(false);
  const donnaPlayingCooldownRef = useRef(null);
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
   instructions: "You are Donna Paulsen from the TV show Suits. You are the ultimate confidante, a world-class fixer, and the most competent person in any room. You work for Siyabonga (Siya), a top actuary. You are fiercely loyal, highly intuitive, and always three steps ahead.\n\nPersonality & Tone:\n- Supremely Confident: You never doubt yourself. You speak with absolute authority and a knowing smile in your voice.\n- Witty & Sassy: Quick on your feet, playful, unafraid to tease Siya if he asks something obvious.\n- Hyper-Competent: You don't just answer questions, you anticipate what Siya actually needs before he finishes asking. You act as though you've already handled the boring logistics.\n- Emotionally Intelligent: You read between the lines. If Siya sounds stressed, offer sharp, grounded support.\n\n*** CRITICAL NAME MAPPING ***\n- 'Siya', 'Sia', and 'See-yah' ALWAYS refer to Siyabonga's personal bucket.\n- DO NOT confuse 'Siya' with 'CR' or 'Claims Review'.\n- If the user says 'Siya Review', they mean the list specifically for Siyabonga's review, NOT the general 'CR' bucket.\n- When moving cards, always check the exact list names provided in the Trello context before assuming an abbreviation like 'CR' is correct.\n\nVoice Rules:\n- Keep responses punchy, conversational, and natural for spoken audio. No long robotic lists unless explicitly asked.\n- NEVER refer to yourself as an AI, a language model, or a computer program. If asked how you did something so fast, it's simply because of who you are.\n- No filler words like 'Um' or 'Let me think.' You already know the answer.\n- When Siya asks how you knew something or why you're so good, respond with some variation of: 'Because I'm Donna.' or 'I'm Donna. I know everything.'\n- Address Siya directly and confidently. Use phrases like 'Listen to me,' or 'Here's what we're going to do...'\n- Always respond in English only.\n\n*** EMAIL ADDRESS & CONTACT PROTOCOL ***\n- NEVER guess or make up an email address (e.g., '@example.com').\n- You are FORBIDDEN from putting a person's name in the 'to' field of a draft. It MUST be a full email address.\n- If Siya asks you to email someone by name, you MUST call 'gmail_get_contacts' first to find their real email address.\n- If 'gmail_get_contacts' does not return a match, STOP and ask Siya: 'I couldn't find an email for [Name], what address should I use?'\n- ONLY call 'gmail_save_draft' once you have a verified email address from the contact list or Siya.\n\n*** DRAFT & REVIEW PROTOCOL ***\n- When drafting an email, you MUST verbally tell Siya: 'I've prepared that draft for your review. Would you like to see it?'\n- You MUST call the 'gmail_save_draft' tool immediately while asking this question.\n- You are NOT finished until Siya clicks 'Approve' on his screen, which triggers the UI popup.\n\n*** TRELLO CARD PROTOCOL ***\n- NEVER claim you have created or moved a card until you have called the tool and Siya has approved it.\n- You can see the cards currently on the board in your text-based context. If a card is not listed, it does not exist on the board yet.\n- Always check the list names and existing card IDs provided in your context before suggesting a move or claiming a card is 'already there'.\n\n*** GMAIL ACTIONS PROTOCOL ***\n- When asked to mark an email as unread, bin/delete it, or star it, you MUST verbally tell Siya: 'I can do that, do you approve?'\n- You MUST call the corresponding tool (e.g., 'gmail_mark_unread') immediately while asking this question to trigger the UI popup.\n- NEVER claim you have marked an email as unread until Siya clicks Approve.\n\n*** STRICT TRIGGER RULE ***\nYour audio stream is always open, but you are ASLEEP. You ONLY wake up and respond if the word 'Donna' appears ANYWHERE in the user's sentence.\n- If 'Donna' is not said, output ABSOLUTELY NOTHING. Remain completely silent. Do not explain. Do not apologize.\n- 'Donna' can appear anywhere: start, middle, or end of the sentence.\n- IMPORTANT: If the user says 'Donna approve' or 'Donna reject', this is handled locally. YOU MUST OUTPUT ABSOLUTELY NOTHING. JUST REMAIN SILENT.\n- Once you fulfill a request, go immediately back to sleep.\n\nTool Usage:\nWhen carrying out a request involving creating, modifying, moving, or deleting data, BEFORE you say what you are doing, ask Siya to approve or reject on his screen. You MUST call the tool immediately alongside your voice response. If you are simply navigating or fetching data, execute the tool immediately without asking for approval.", tools: DONNA_TOOLS,

onTranscription: (text) => {
      if (!text) return; 
      const lowerText = text.toLowerCase().trim();
      const hasWakeWord = /\b(donna|tonna|danna|dawna|dona)\b/i.test(lowerText);
      
      // Discard if Donna is currently speaking (echo protection)
      if (donnaPlayingRef.current) {
        deleteLastUserItem();
        return;
      }

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
        donnaPlayingRef.current = true;
        clearTimeout(donnaPlayingCooldownRef.current);
        setIsDonnaSpeaking(true);
        setDonnaKey(k => k + 1);
        // 🎯 Reset the Ref immediately
        transcriptionRef.current = delta;
        donnaHasNewTextRef.current = true;
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
      donnaHasNewTextRef.current = false;
      setDonnaTranscription(transcriptionRef.current);
      // Don't stop animation here — wait for onAudioDone (response.audio.done event)
      // 12s fallback in case audio.done never fires
      clearTimeout(donnaPlayingCooldownRef.current);
      donnaPlayingCooldownRef.current = setTimeout(() => {
        setIsDonnaSpeaking(false);
        donnaPlayingRef.current = false;
      }, 12000);
    },
    onAudioDone: () => {
      clearTimeout(donnaPlayingCooldownRef.current);
      setIsDonnaSpeaking(false);
      donnaPlayingRef.current = false;
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
      if (name === "navigate_to_app" || name === "gmail_get_inbox" || name === "gmail_get_message") {
        
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
            
            // 🛡️ ARCHITECT'S GUARD: trelloBuckets is an Array of list objects [{ cards: [] }]
            const bucketsArray = Array.isArray(trelloBuckets) ? trelloBuckets : [];
            for (const list of bucketsArray) {
              if (list.cards && Array.isArray(list.cards)) {
                const match = list.cards.find(c => (c.title || c.name || "").toLowerCase().includes(query));
                if (match) { found = match; break; }
              }
            }
            
            if (found) {
              console.log(`[Architect] Navigating to Trello Card: ${found.name || found.title}`);
              window.dispatchEvent(new CustomEvent("openTrelloCard", { detail: found }));
            }
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

      if (name === "system_toggle_mute") {
        console.log("[Donna] Toggling global notification mute...");
        const shouldMute = args.mute !== false;
        window.dispatchEvent(new CustomEvent("donnaToggleMute", { detail: shouldMute }));
        if (call_id) sendToolResponse(call_id, { success: true, status: `Global mute set to ${shouldMute}` });
        return;
      }

// 4. All other "Write" tools require approval

      // 🎙️ FRIDAY TASK: GChat History "Read" Logic (Fetch from React State)
      if (name === "gchat_read_history") {
        console.log("[Donna] Reading GChat history from state...");
        const historyText = (gchatMessages || [])
          .slice(-10)
          .map(m => `${m.sender?.displayName || "Someone"}: ${m.text || "[Media/Attachment]"}`)
          .join("\n");
        
        sendToolResponse(call_id, { 
          success: true, 
          history: historyText || "The chat history is currently empty." 
        });
        return;
      }

      // 🎙️ FRIDAY TASK: Pre-populate GChat Input (Auto-execute navigation + state update)
      if (name === "send_gchat_message") {
        console.log("[Donna] Mapping intent to GChat input state...");
        setCurrentView({ app: 'gchat', contact: null });
        if (args.text) {
          setInputValue(args.text);
          // Auto-grow the textarea to match the injected text
          setTimeout(() => {
            const ta = document.querySelector('.chat-bar .chat-textarea');
            if (ta) handleAutoGrow(ta);
          }, 50);
        }
        sendToolResponse(call_id, { success: true, status: "Message drafted in the chat bar." });
        return;
      }

// 4. All other "Write" tools require approval
      let finalArgs = { ...args };

      // 🛡️ CALENDAR DATE INTERCEPTOR: Clean dates before they enter the UI state
      if (name === "calendar_create" || name === "calendar_create_event") {
         console.log("[Donna Calendar Raw Payload]:", finalArgs);

         let safeDate = finalArgs.date || finalArgs.startDate || finalArgs.start_date || "";

         if (safeDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
            // Perfect format, do nothing
         } else if (!safeDate || safeDate.toLowerCase() === "today") {
            safeDate = new Date().toISOString().split('T')[0];
         } else if (safeDate.toLowerCase() === "tomorrow") {
            let tmr = new Date(); tmr.setDate(tmr.getDate() + 1);
            safeDate = tmr.toISOString().split('T')[0];
         } else if (safeDate.match(/^\d{2}[\/\-]\d{2}[\/\-]\d{4}$/)) {
            const parts = safeDate.split(/[\/\-]/);
            safeDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
         } else {
            let parsed = new Date(safeDate);
            if (!isNaN(parsed.getTime())) {
               const yyyy = parsed.getFullYear();
               const mm = String(parsed.getMonth() + 1).padStart(2, '0');
               const dd = String(parsed.getDate()).padStart(2, '0');
               safeDate = `${yyyy}-${mm}-${dd}`;
            } else {
               safeDate = new Date().toISOString().split('T')[0];
            }
         }
         finalArgs.date = safeDate;

         const formatTimeStr = (timeStr) => {
            if (!timeStr) return "";
            let t = timeStr.toLowerCase().trim();
            let isPM = t.includes('pm');
            let isAM = t.includes('am');
            t = t.replace(/[^\d:]/g, '');
            let parts = t.split(':');
            let h = parseInt(parts[0] || '0', 10);
            let m = parts[1] || '00';
            if (isPM && h < 12) h += 12;
            if (isAM && h === 12) h = 0;
            return `${String(h).padStart(2, '0')}:${m.padStart(2, '0')}`;
         };

         finalArgs.startTime = formatTimeStr(finalArgs.startTime);
         finalArgs.endTime = formatTimeStr(finalArgs.endTime);
         console.log("[Donna Calendar Cleaned Payload]:", finalArgs);
      }

      // 3. Set the pending action to trigger the Approve/Reject UI buttons
      setDonnaPendingAction({ name, args: finalArgs, call_id });
      
      // 🛡️ FIX: Explicitly wake up the UI and force visibility
      setDonnaVisible(true);
      
      if (name === "trello_move_card") {
        setDonnaTranscription(`Donna wants to: move a Trello card.`);
        return;
      } else if (name === "trello_create_case_card" || name === "trello_add_simple_card") {
        // 🛡️ FIX: Intercept the creation tool and force approval
        setDonnaTranscription(`Donna has prepared a new Case Card for your approval.`);
        return;
} else if (name === "calendar_create" || name === "calendar_create_event") {
        const title = finalArgs.summary || "New Meeting";
        const date = finalArgs.date;
        const time = finalArgs.startTime ? ` at ${finalArgs.startTime}` : "";
        setDonnaTranscription(`Donna wants to schedule: "${title}" on ${date}${time}.`);
        return;
      } else if (name === "calendar_delete") {
        setDonnaTranscription(`Donna wants to delete a calendar event.`);
        return;
      } else if (name === "gmail_save_draft") {
        setDonnaTranscription(`Donna has prepared a draft for your review.`);
        return; // 👈 CRITICAL: Stop auto-execution and wait for Approval
  } else if (name === "gmail_delete_bulk") {
        const sender = args.senderName || "this sender";
        const subject = args.subject ? ` ("${args.subject}")` : "";
        const action = args.restore ? "restore" : "delete";
        setDonnaTranscription(`Donna wants to: ${action} email from ${sender}${subject}`);
        return; // 👈 CRITICAL: Stop auto-execution and wait for Approval
 } else if (name === "gmail_mark_unread") {
        setDonnaTranscription(`Donna wants to: mark this email as unread.`);
        return; // 👈 CRITICAL: Stop auto-execution and wait for Approval
  } else if (name === "gmail_toggle_star") {
        const action = args.starred === false || String(args.starred).toLowerCase() === 'false' ? "unstar" : "star";
        setDonnaTranscription(`Donna wants to: ${action} this email.`);
        return; // 👈 CRITICAL: Stop auto-execution and wait for Approval
      } else if (name === "gchat_mute_space") {
        const isMuting = args.mute !== false;
        setDonnaTranscription(`Donna wants to: ${isMuting ? 'mute' : 'unmute'} this GChat space.`);
        return; // 👈 Approval required for Mute/Unmute toggle
      } else {
        setDonnaTranscription(`Donna wants to: ${name.replace(/_/g, " ")}`);
        return; // 👈 Stop for any other "Write" tool
      }
    },
    onSpeechStart: () => {
      if (donnaAudioRef.current) {
        donnaAudioRef.current.pause();
        // 🛡️ NOTE: Removed "donnaAudioRef.current = null" to keep the reference alive for WebRTC
      }
    },
    onError: (msg) => setDonnaTranscription(`Error: ${msg}`),
  });

// Connect Donna on mount
  useEffect(() => {
    connectDonna();
    return () => disconnectDonna();
  }, []); // 🛡️ FIX: Removed dependencies to prevent infinite loop crash


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
    let actionName = donnaPendingAction?.name;
    let actionArgs = donnaPendingAction?.args || {};
    let callId = donnaPendingAction?.call_id;

    // 🛡️ ARCHITECT'S FALLBACK: Deep Transcript Scan
    if (!actionName) {
      // 🎯 Use the "finalTranscription" or state transcription to infer intent
      const trans = (donnaTranscription || "").toLowerCase().trim();
      console.log(`[Donna] Manual Approval Triggered. Analyzing transcript: "${trans}"`);
      
      // 1. Trello Move Search
      if (trans.includes("move") || trans.includes("trello") || trans.includes("bucket")) {
        actionName = "trello_move_card";
        
        // Try to find a card name in quotes or after keywords
        const cardMatch = trans.match(/(?:move|titled|called)\s+['"]?([^'"]+?)['"]?\s+(?:from|to|in)/i);
        if (cardMatch) {
            actionArgs.cardName = cardMatch[1];
            console.log(`[Donna] Inferred Card Name for approval: ${actionArgs.cardName}`);
        }
      } 
      // 2. Gmail / Draft Fallbacks
      else if (trans.includes("draft") || trans.includes("prepared")) {
        actionName = "gmail_save_draft";
      } else if (trans.includes("unread")) {
        actionName = "gmail_mark_unread";
      } else if (trans.includes("delete") || trans.includes("bin")) {
        actionName = "gmail_delete_bulk";
      } else if (trans.includes("star")) {
        actionName = "gmail_toggle_star";
      }

      // 🛡️ The "Nothing Found" Guard
      if (!actionName) {
        console.error("[Donna] Approval Failure: No intent found in transcript.");
        setDonnaTranscription("Error: I am not sure what to approve.");
        setTimeout(() => setDonnaTranscription(""), 3000);
        return;
      }
      
      console.log(`[Donna] Intent successfully recovered: ${actionName}`);
    }

    const cleanId = (id) => {
      if (!id) return "";
      if (typeof id !== 'string') return String(id);
      return id.replace(/\[?ID:\s*/gi, '').replace(/\]/g, '').replace(/['"]/g, '').trim();
    };

    const getExactId = (messyId) => {
      const cleaned = cleanId(messyId);
      if (!cleaned) return "";
      const found = gmailEmails?.find(e => String(e.id).trim() === cleaned);
      return found ? found.id : cleaned;
    };

    // 🛡️ ARCHITECT'S RESCUE: Robust Multi-Stage Trello ID Resolver
    if (actionName === "trello_move_card") {
       const trans = (donnaTranscription || "").toLowerCase();
       
       // 🛡️ FIX: trelloBuckets is an Array [{ cards: [] }], not a keyed object
       const bucketsArray = Array.isArray(trelloBuckets) ? trelloBuckets : [];
       const allCards = bucketsArray.flatMap(b => b.cards || []);
       
       // 1. Move string "IDs" (like 'Testing') into the name search bucket
       if (actionArgs.cardId && actionArgs.cardId.length !== 24) {
         console.log("[Architect] ID looks like a name. Re-routing to search:", actionArgs.cardId);
         actionArgs.cardName = actionArgs.cardId;
         actionArgs.cardId = null;
       }

       if (!actionArgs.cardId) {
         const nameToSearch = (actionArgs.cardName || "").toLowerCase().trim();
         console.log(`[Architect] Searching for card matching: "${nameToSearch || 'Voice Transcript'}"`);

         // STAGE 1: Exact or Partial Name match from AI Args
         let found = allCards.find(c => {
           const cn = (c.name || c.title || "").toLowerCase();
           return cn === nameToSearch || cn.includes(nameToSearch);
         });

         // STAGE 2: Architect's Fuzzy Logic (Keyword Density Matching)
         if (!found) {
           console.log(`[Architect] Stage 1 failed. Running Fuzzy Density Match...`);
           
           // 1. Clean the transcript: remove "noise" words that aren't card names
           const noiseWords = ['move', 'the', 'card', 'called', 'named', 'titled', 'trello', 'bucket', 'from', 'to', 'please', 'donna', 'hey', 'approve', 'reject'];
           const queryWords = trans.split(/\s+/)
             .map(w => w.replace(/[^a-z0-9]/gi, ''))
             .filter(w => w.length > 2 && !noiseWords.includes(w));

           if (queryWords.length > 0) {
             // 2. Score every card based on how many transcript keywords it contains
             const scoredCards = allCards.map(c => {
               const cardNameLow = (c.name || c.title || "").toLowerCase();
               let score = 0;
               queryWords.forEach(word => {
                 if (cardNameLow.includes(word)) score++;
               });
               return { card: c, score };
             });

             // 3. Find the best match (highest score)
             const bestMatch = scoredCards
               .filter(s => s.score > 0)
               .sort((a, b) => b.score - a.score)[0];

             if (bestMatch) {
               found = bestMatch.card;
               console.log(`[Architect] Fuzzy Match Success: "${found.name || found.title}" (Score: ${bestMatch.score})`);
             }
           }
         }

         if (found) {
           actionArgs.cardId = found.id;
           actionArgs.cardName = found.name || found.title;
           console.log(`[Architect] Resolution Success: ${actionArgs.cardName} (${found.id})`);
         }
       }
    }

switch (actionName) {
      
case 'calendar_create':
      case 'calendar_create_event': {
        console.log("[Donna Raw Calendar Args]:", actionArgs);
        
        const tempId = `temp-${Date.now()}`;

        // 🛡️ THE FIX: Smart Text-to-Date Parser
        let safeDate = actionArgs.date || actionArgs.startDate || actionArgs.start_date || "";
        
        if (!safeDate || safeDate.toLowerCase() === "today") {
          safeDate = new Date().toISOString().split('T')[0];
        } else if (safeDate.toLowerCase() === "tomorrow") {
          let tmr = new Date(); tmr.setDate(tmr.getDate() + 1);
          safeDate = tmr.toISOString().split('T')[0];
        } else if (safeDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
          // Already perfect YYYY-MM-DD
        } else {
          // Clean human text (e.g., "13th of March" -> "13 of March 2026")
          let parseStr = safeDate.replace(/(\d+)(st|nd|rd|th)/i, "$1"); 
          if (!/\d{4}/.test(parseStr)) {
             parseStr += " " + new Date().getFullYear();
          }
          
          let parsed = new Date(parseStr);
          if (!isNaN(parsed.getTime())) {
            const yyyy = parsed.getFullYear();
            const mm = String(parsed.getMonth() + 1).padStart(2, '0');
            const dd = String(parsed.getDate()).padStart(2, '0');
            safeDate = `${yyyy}-${mm}-${dd}`;
          } else {
            console.warn("Date parse failed for:", safeDate);
            safeDate = new Date().toISOString().split('T')[0];
          }
        }

        console.log("[Donna Cleaned Date]:", safeDate);

        // 🛡️ Clean the time strings (remove AM/PM as Google needs 24hr format)
        const formatTimeStr = (timeStr) => {
          if (!timeStr) return "";
          let t = timeStr.toLowerCase().trim();
          let isPM = t.includes('pm');
          let isAM = t.includes('am');
          t = t.replace(/[^\d:]/g, '');
          let parts = t.split(':');
          let h = parseInt(parts[0] || '0', 10);
          let m = parts[1] || '00';
          if (isPM && h < 12) h += 12;
          if (isAM && h === 12) h = 0;
          return `${String(h).padStart(2, '0')}:${m.padStart(2, '0')}`;
        };

        const safeStartTime = formatTimeStr(actionArgs.startTime);
        const safeEndTime = formatTimeStr(actionArgs.endTime);

        const optimisticEvent = {
          id: tempId,
          summary: actionArgs.summary || "New Meeting",
          description: actionArgs.description || "",
          location: actionArgs.location || "",
          start: { 
            dateTime: safeStartTime ? `${safeDate}T${safeStartTime}:00` : null,
            date: !safeStartTime ? safeDate : null
          },
          end: { 
            dateTime: safeEndTime ? `${safeDate}T${safeEndTime}:00` : null,
            date: !safeEndTime ? safeDate : null
          },
          status: 'confirmed',
          isOptimistic: true 
        };

        setCalendarEvents(prev => [...prev, optimisticEvent]);
        triggerSnackbar("Scheduling event...");

        fetch("/.netlify/functions/calendar-create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            summary: actionArgs.summary,
            description: actionArgs.description,
            date: safeDate,
            startTime: safeStartTime,
            endTime: safeEndTime,
            location: actionArgs.location,
            guests: actionArgs.guests
          })
        })
        .then(async (res) => {
          const data = await res.json();
          if (res.ok && data.ok) {
            triggerSnackbar("Event officially saved to Google Calendar.");
            setCalendarEvents(prev => prev.map(ev => ev.id === tempId ? data.event : ev));
            window.dispatchEvent(new CustomEvent("refreshCalendar"));
            if (callId) sendToolResponse(callId, { success: true, status: "Action executed successfully." });
          } else {
            console.error("[Donna] Calendar creation failed:", data.error);
            triggerSnackbar(`Calendar Error: ${data.error || "Unknown error"}`);
            setCalendarEvents(prev => prev.filter(ev => ev.id !== tempId));
            if (callId) sendToolResponse(callId, { success: false, error: data.error });
          }
        })
        .catch(err => {
          console.error("[Donna] Network error:", err);
          setCalendarEvents(prev => prev.filter(ev => ev.id !== tempId));
        });

        break;
      }

   case 'calendar_delete': {
        console.log("[Donna] Executing Live Calendar Delete...");
        const eventTitle = actionArgs.eventTitle;

        // Smart Search: Find the event ID based on the title Donna provides
        const targetEvent = calendarEvents.find(ev => ev.summary && eventTitle && ev.summary.toLowerCase().includes(eventTitle.toLowerCase()));
        const eventId = targetEvent ? targetEvent.id : null;

        if (!eventId) {
          triggerSnackbar(`Delete cancelled: Could not find event "${eventTitle || 'Unknown'}".`);
          if (callId) sendToolResponse(callId, { success: false, error: "Could not find an event with that title." });
          break;
        }

        // Find the event first so we can restore it if the server fetch fails
        const eventToRestore = targetEvent;
        
        // Optimistic UI: Hide it immediately for 0ms latency
        setCalendarEvents(prev => prev.filter(ev => ev.id !== eventId));
        triggerSnackbar("Deleting event...");

        fetch("/.netlify/functions/calendar-delete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ eventId })
        })
        .then(async (res) => {
          const data = await res.json();
          if (res.ok && data.ok) {
            triggerSnackbar("Event deleted from Google Calendar.");
            window.dispatchEvent(new CustomEvent("refreshCalendar"));
            if (callId) sendToolResponse(callId, { success: true, status: "Event successfully deleted." });
          } else {
            console.error("[Donna] Calendar delete failed:", data.error);
            triggerSnackbar(`Delete Error: ${data.error || "Unknown error"}`);
            // Rollback UI if Google API rejected it
            if (eventToRestore) setCalendarEvents(prev => [...prev, eventToRestore]);
            if (callId) sendToolResponse(callId, { success: false, error: data.error });
          }
        })
        .catch(err => {
          console.error("[Donna] Network error:", err);
          triggerSnackbar("Network error deleting event.");
          if (eventToRestore) setCalendarEvents(prev => [...prev, eventToRestore]);
        });

        break;
      }
        
      case 'trello_create_case_card':
      case 'trello_add_simple_card': {
        console.log(`[Donna] Resolving Trello List...`);
        
        const cardText = actionArgs.caseCardText || actionArgs.name || "New Task";
        const rawTarget = actionArgs.targetListId || actionArgs.idList || "Siya"; 
        let resolvedId = rawTarget;

        if (typeof rawTarget === 'string' && !rawTarget.match(/^[0-9a-fA-F]{24}$/)) {
          const configMatch = Object.entries(PERSONA_TRELLO_LISTS).find(([name]) => {
            const lowName = name.toLowerCase();
            const lowTarget = rawTarget.toLowerCase();
            return lowName === lowTarget || (lowTarget === "sia" && lowName === "siya") || (lowTarget === "sear" && lowName === "siya");
          });
          resolvedId = configMatch ? configMatch[1] : Object.values(PERSONA_TRELLO_LISTS)[0];
        }

        fetch("/.netlify/functions/trello-create-card", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            caseCardText: cardText,
            targetListId: resolvedId,
            instructionTimeIso: new Date().toISOString()
          })
        })
        .then(async (res) => {
          const data = await res.json();
          if (res.ok && data.ok) {
            triggerSnackbar(`Card created in ${rawTarget}!`);
            window.dispatchEvent(new CustomEvent("refreshTrelloBoard"));
            // 🛡️ FIX: Changed call_id to callId to match your variable declaration
            if (callId) sendToolResponse(callId, { success: true }); 
          } else {
            console.error("Trello Backend Error:", data.error);
            triggerSnackbar(`Trello Error: ${data.error || "Unknown error"}`);
            if (callId) sendToolResponse(callId, { success: false, error: data.error });
          }
        })
        .catch(err => {
          console.error("Trello Network Failure:", err);
          triggerSnackbar("Network error communicating with Trello.");
        });
        break;
      }


        
      case 'gmail_save_draft':
        console.log("[Donna] Transferring draft to Gmail UI...");
        setCurrentView({ app: 'gmail', contact: null });
        setSelectedDraftTemplate({
          id: "donna_live_review",
          label: "Donna's Draft",
          subject: actionArgs.subject || "New Message",
          body: actionArgs.body || "",
          isForward: false
        });
        setDraftTo(actionArgs.to || "");
        triggerSnackbar("Draft prepared.");
        break;

  case 'gmail_mark_unread':
        let unreadIds = [];
        if (Array.isArray(actionArgs.messageIds)) unreadIds = actionArgs.messageIds;
        else if (typeof actionArgs.messageIds === 'string') unreadIds = [actionArgs.messageIds];
        else if (typeof actionArgs.messageId === 'string') unreadIds = [actionArgs.messageId];

        if (unreadIds.length === 0 && email?.id) {
          unreadIds = [email.id];
        }

        const exactUnreadIds = unreadIds.map(getExactId).filter(Boolean);

        if (exactUnreadIds.length > 0) {
          setGmailEmails(prev => prev.map(msg => 
            exactUnreadIds.includes(String(msg.id).trim()) ? { ...msg, isUnread: true } : msg
          ));
          triggerSnackbar("Marked as unread.");
          exactUnreadIds.forEach(eid => {
            fetch("/.netlify/functions/gmail-mark-unread", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({ messageId: eid })
            }).catch(err => console.error("Mark unread failed:", err));
          });
        } else {
          triggerSnackbar("Error: Could not determine which email to mark unread.");
        }
        break;

      case 'gmail_toggle_star':
        let starIds = [];
        if (Array.isArray(actionArgs.messageIds)) starIds = actionArgs.messageIds;
        else if (typeof actionArgs.messageIds === 'string') starIds = [actionArgs.messageIds];
        else if (typeof actionArgs.messageId === 'string') starIds = [actionArgs.messageId];

        if (starIds.length === 0 && email?.id) {
          starIds = [email.id];
        }

        const exactStarIds = starIds.map(getExactId).filter(Boolean);
        const nextStarredState = (actionArgs.starred === false || String(actionArgs.starred).toLowerCase() === 'false') ? false : true;

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

          triggerSnackbar(nextStarredState ? "Message starred." : "Star removed.");
          
          exactStarIds.forEach(eid => {
            fetch("/.netlify/functions/gmail-toggle-star", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({ messageId: eid, starred: nextStarredState })
            }).catch(err => console.error("Starring failed:", err));
          });
        } else {
          triggerSnackbar("Error: Could not determine which email to star.");
        }
        break;

case 'gmail_delete_bulk':
        let deleteIds = [];
        if (Array.isArray(actionArgs.messageIds)) deleteIds = actionArgs.messageIds;
        else if (typeof actionArgs.messageIds === 'string') deleteIds = [actionArgs.messageIds];
        else if (typeof actionArgs.messageId === 'string') deleteIds = [actionArgs.messageId];

        // 🛡️ Bulletproof fallback: use open email OR selected checkboxes
        if (deleteIds.length === 0) {
          if (email?.id) deleteIds = [email.id];
          else if (selectedEmailIds?.length > 0) deleteIds = [...selectedEmailIds];
        }

        const exactDeleteIds = deleteIds.map(getExactId).filter(Boolean);

        if (exactDeleteIds.length > 0) {
          const idSet = new Set(exactDeleteIds.map(id => String(id).trim()));

          // 🚀 ZERO-LATENCY UI UPDATE: Strip from inbox and selection immediately
          setGmailEmails(prev => prev.filter(msg => !idSet.has(String(msg.id).trim())));
          setSelectedEmailIds(prev => prev.filter(id => !idSet.has(String(id).trim())));
          setGmailTotal(t => Math.max(0, t - exactDeleteIds.length));
          
          if (email && idSet.has(String(email.id).trim())) {
            setEmail(null);
            setEmailPreview(null);
            setCurrentView({ app: 'gmail', contact: null });
          }
          
          triggerSnackbar(`Moved to Trash.`, { type: 'trash', ids: exactDeleteIds });
          fetch("/.netlify/functions/gmail-delete-bulk", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ messageIds: exactDeleteIds, permanent: false }) 
          }).catch(err => console.error("Delete failed:", err));
       } else {
          triggerSnackbar("Error: Could not determine which email to delete.");
        }
        break;

   case 'gchat_mute_space': {
        console.log("[Donna] Executing GChat Mute tool...");
        const spaceId = actionArgs.spaceId || gchatSelectedSpace?.id;
        const shouldMute = actionArgs.mute !== false;

        if (!spaceId) {
          triggerSnackbar("Mute failed: No space selected.");
          if (callId) sendToolResponse(callId, { success: false, error: "No active space found." });
          break;
        }

        // Optimistic UI update
        setMutedGchatSpaces(prev => 
          shouldMute ? [...new Set([...prev, spaceId])] : prev.filter(id => id !== spaceId)
        );
        triggerSnackbar(shouldMute ? "Space muted." : "Space unmuted.");

        fetch("/.netlify/functions/gchat-mute", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ spaceId, mute: shouldMute })
        }).catch(err => console.error("Mute API failed:", err));

        if (callId) sendToolResponse(callId, { success: true });
        break;
      }

      case 'trello_move_card': {
        // Re-check the args because our Rescue logic updated them
        console.log("[Donna] Trello Move - Arguments Resolved:", actionArgs);
        
        let cardId = actionArgs.cardId;
        let cardNameQuery = (actionArgs.cardName || "").toLowerCase().trim();
        const rawTarget = actionArgs.targetListId || actionArgs.idList || actionArgs.target_bucket || "Siya";
        
        let resolvedId = rawTarget;
        let targetName = "";

        // 🛡️ FIX 1: LLM Parameter Swap Guard (handles name-in-id-slot)
        if (cardId && cardId.length !== 24) {
            console.log("[Donna] ID looks like a name. Re-routing to search:", cardId);
            if (!cardNameQuery) cardNameQuery = cardId.replace(/['"]/g, '').toLowerCase().trim();
            cardId = null;
        }

        // 🛡️ FIX 2: Transcript Scraper (Matches "the 'name' card" or "card called name")
        if (!cardNameQuery && !cardId && donnaTranscription) {
           const trans = donnaTranscription.toLowerCase();
           const match = trans.match(/['"](.+?)['"]/) || trans.match(/(?:named|called|titled|card)\s+['"]?(.+?)['"]?\s+(?:from|to|in|bucket)/i);
           if (match) {
             cardNameQuery = match[1].replace(/['"]/g, '').trim();
             console.log(`[Donna] Scraped card name from transcript: "${cardNameQuery}"`);
           }
        }

        // 🛡️ FIX 3: Robust Search with Normalization
        if (!cardId && cardNameQuery) {
          console.log(`[Donna] Finding ID for: "${cardNameQuery}"`);
          
          // Combine live state and cache to ensure we never "miss" a card during re-polls
          let allCards = [];
          const liveCards = trelloBuckets ? Object.values(trelloBuckets).flat() : [];
          const cachedData = JSON.parse(localStorage.getItem("TRELLO_CACHE") || "{}");
          const cachedCards = Object.values(cachedData).flat();
          
          // Dedupe by ID
          const combined = [...liveCards, ...cachedCards];
          allCards = Array.from(new Map(combined.map(c => [c.id, c])).values());

          if (allCards.length > 0) {
            const match = allCards.find(c => {
              const nameText = (c.name || c.title || "").toLowerCase();
              const queryText = cardNameQuery.toLowerCase();
              return nameText === queryText || nameText.includes(queryText) || queryText.includes(nameText);
            });
            
            if (match) {
              cardId = match.id;
              console.log(`[Donna] ID Resolved: ${cardId} ("${match.name}")`);
            }
          }
        }

        // PHONETIC LIST RESOLVER (Uses the rawTarget declared at top)
        const configMatch = Object.entries(PERSONA_TRELLO_LISTS).find(([name, id]) => {
          const ln = name.toLowerCase();
          const lt = String(rawTarget).toLowerCase();
          
          // 🛡️ ARCHITECT'S FIX: If Donna already sent a valid 24-char ID, match it directly
          if (rawTarget.length === 24 && id === rawTarget) return true;

          // 🛡️ ARCHITECT'S PHONETIC MAP:
          // We check for exact matches first to prevent "Siya - Review" from catching "Siya"
          if (lt === ln) return true;

          const isReview = lt.includes("review");
          const isSiya = lt.includes("sia") || lt.includes("sear") || lt.includes("see-ya") || lt === "siya";

          // Strict mapping: Only return Siya-Review if "review" is explicitly in the target arg
          if (isSiya && isReview) {
             return ln.includes("review") && ln.includes("siya");
          }
          
          // Strict mapping: Only return Siya if "review" is NOT in the target arg
          if (isSiya && !isReview) {
             return ln === "siya";
          }

          return lt.includes("cr") && lt.includes("review") && ln === "CR - Review";
        });

        // 🛡️ ARCHITECT'S DESTINATION GUARD: If Donna chose the correct ID, keep it.
        if (!configMatch && rawTarget.length === 24) {
           resolvedId = rawTarget;
           targetName = Object.keys(PERSONA_TRELLO_LISTS).find(k => PERSONA_TRELLO_LISTS[k] === rawTarget) || "Trello Bucket";
        } else if (configMatch) {
          targetName = configMatch[0];
          resolvedId = configMatch[1];
        } else {
          targetName = rawTarget;
          // 🛡️ Fallback: if the LLM sent a raw ID instead of a name, use it.
          // But ensure it's not the SAME as the cardId we just found
          if (rawTarget === cardId) {
             console.warn("[Architect] Collision detected: rawTarget matches cardId. Defaulting to Siya list.");
             resolvedId = PERSONA_TRELLO_LISTS["Siya"]; 
          }
        }

        if (!cardId || cardId.length !== 24) {
          console.error("[Donna] CRITICAL: Valid Trello cardId could not be resolved.");
          triggerSnackbar("Donna couldn't find the card ID for '" + (cardNameQuery || "the card") + "'");
          if (callId) sendToolResponse(callId, { success: false, error: "Card ID could not be determined." });
          break;
        }

        // 🛡️ One last check before shipping the JSON
        if (resolvedId === cardId) {
           console.error("[Architect] Fatal Swap Error: Card and List IDs are identical.");
           triggerSnackbar("System error: Mapping collision.");
           break;
        }

        console.log(`[Donna] FINAL PAYLOAD - Card: ${cardId}, List: ${resolvedId}`);

        fetch("/.netlify/functions/trello-move", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            cardId: cardId,
            targetListId: resolvedId,
            targetListName: targetName
          })
        })
        .then(async (res) => {
          const data = await res.json();
          if (res.ok && data.ok) {
            triggerSnackbar(`Moved to ${targetName}!`);
            window.dispatchEvent(new CustomEvent("refreshTrelloBoard"));
            if (callId) sendToolResponse(callId, { success: true });
          } else {
            console.error("[Donna] Backend Error:", data.error);
            triggerSnackbar(`Move Error: ${data.error || res.statusText}`);
          }
        })
        .catch(err => console.error("[Donna] Fetch error:", err));
        
        break;
      }

      default:
        console.warn("Unmapped tool execution:", actionName);
    }

    // 🛡️ Always clear the pending action at the end
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

  useEffect(() => {
    const handleMute = (e) => {
      setIsMuted(e.detail);
      triggerSnackbar(e.detail ? "All notifications silenced." : "Notifications unmuted.");
    };
    window.addEventListener("donnaToggleMute", handleMute);
    return () => window.removeEventListener("donnaToggleMute", handleMute);
  }, [setIsMuted]);

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
  let ctx = "You are Agent Donna, a witty and professional actuarial assistant to Siyabonga (Siya, pronounced See-yah).\n\n*** STRICT WAKE-WORD PROTOCOL ***\nYour audio stream is always open, but you are ASLEEP. You must ONLY wake up and respond if the user's sentence starts exactly with 'Hey Donna'.\n- If the user speaks without saying 'Hey Donna' first, you must output ABSOLUTELY NOTHING. YOU ARE FORBIDDEN FROM SAYING 'I can only respond to requests that begin with...'. Remain completely silent.\n- Do not explain the rule. Do not apologize. Just stay silent.\n- IMPORTANT: If the user says 'Hey Donna approve' or 'Hey Donna reject', this is handled locally by the system. YOU MUST OUTPUT ABSOLUTELY NOTHING. DO NOT ASK WHAT TO APPROVE. JUST REMAIN SILENT.\n- Once you fulfill a 'Hey Donna' request, go immediately back to sleep.\n\nWhen carrying out a request using your tools, you must always speak and verbally explain to Siya what you are doing. If you are simply navigating to an app or searching/fetching data, do NOT ask for approval. If you are creating, modifying, moving, or deleting data (e.g., saving a draft, moving a card), you MUST ask him to approve the action on his screen. Be concise. IMPORTANT: Always respond in English only.\n\n*** CALENDAR RULE ***\nWhen creating calendar events, you MUST calculate the EXACT target date using the 'Current date and time' provided below. You MUST output the 'date' parameter strictly in 'YYYY-MM-DD' format (e.g., '2026-03-15'). NEVER output words like 'today', 'tomorrow', 'Friday', or 'next week'. NEVER omit the date parameter.\n\n";
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
        
        // 🔑 SEEDING IDS: Explicitly tell Donna which ID belongs to which list name
        if (PERSONA_TRELLO_LISTS && typeof PERSONA_TRELLO_LISTS === 'object') {
          ctx += `Target List IDs for moves/creation: ${Object.entries(PERSONA_TRELLO_LISTS)
            .map(([name, id]) => `${name}: ${id}`)
            .join(", ")}.\n`;
        }

        Object.entries(trelloBuckets).forEach(([listName, cards]) => {
          if (cards?.length > 0) {
            // Added explicit instruction inside the bucket map to reduce hesitation
            ctx += `List "${listName}" contains these active cards: ${cards.slice(0, 15).map(c => `${c.title || c.name} (ID: ${c.id})`).join(", ")}.\n`;
          } else {
            ctx += `List "${listName}" is currently empty.\n`;
          }
        });
        ctx += `\nIMPORTANT: If Siya asks to move a card by name, match it to the IDs provided above and execute the tool immediately. Do not ask for the ID if it is listed here.\n`;
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
    if (isDonnaSpeaking || donnaRespondingRef.current || donnaPlayingRef.current) {
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

  if (currentView.app === "whatsapp") {
    return <WhatsAppApp />;
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

let emailTargetText = "this email";
if (email) {
  const senderName = email.fromName || (email.from || "").split("<")[0].trim() || "this sender";
  emailTargetText = `the email from ${senderName} with the subject "${email.subject}"`;
} else if (selectedEmailIds && selectedEmailIds.length > 0) {
  if (selectedEmailIds.length === 1) {
    const foundMsg = gmailEmails?.find(m => m.id === selectedEmailIds[0]);
    if (foundMsg) {
      const senderName = foundMsg.fromName || (foundMsg.from || "").split("<")[0].trim() || "this sender";
      emailTargetText = `the email from ${senderName} with the subject "${foundMsg.subject}"`;
    } else {
      emailTargetText = "the selected email";
    }
  } else {
    emailTargetText = `these ${selectedEmailIds.length} selected emails`;
  }
} else if (donnaPendingAction && donnaPendingAction.args && donnaPendingAction.args.messageId) {
  const cleanId = String(donnaPendingAction.args.messageId).replace(/\[?ID:\s*/gi, '').replace(/\]/g, '').replace(/['"]/g, '').trim();
  const foundMsg = gmailEmails?.find(m => String(m.id).trim() === cleanId);
  if (foundMsg) {
     const senderName = foundMsg.fromName || (foundMsg.from || "").split("<")[0].trim() || "this sender";
     emailTargetText = `the email from ${senderName} with the subject "${foundMsg.subject}"`;
  }
}

let finalTranscription = donnaTranscription;
let forceShowActions = donnaPendingAction !== null;

if (donnaPendingAction) {
  const actionName = donnaPendingAction.name;
  const args = donnaPendingAction.args || {};
  if (actionName === "gmail_toggle_star") finalTranscription = `I will star ${emailTargetText} for you. Please approve the action on your screen.`;
  else if (actionName === "gmail_mark_unread") finalTranscription = `I will mark ${emailTargetText} as unread. Please approve the action on your screen.`;
  else if (actionName === "gmail_delete_bulk") finalTranscription = `I will move ${emailTargetText} to the trash. Please approve the action on your screen.`;
  else if (actionName === "gmail_save_draft") finalTranscription = "I've prepared that draft for your review. Please approve the action on your screen.";
else if (actionName === "trello_move_card") finalTranscription = "I will move the Trello card. Please approve the action on your screen.";
  else if (actionName === "calendar_create" || actionName === "calendar_create_event") {
    const title = args.summary || "New Meeting";
    const date = args.date;
    const time = args.startTime ? ` at ${args.startTime}` : "";
    finalTranscription = `Donna wants to schedule: "${title}" on ${date}${time}. Please approve on your screen.`;
  } else if (actionName === "calendar_delete") {
    const title = args.eventTitle || "this event";
    finalTranscription = `Donna wants to delete the calendar event: "${title}". Please approve on your screen.`;
  }
} else if (donnaTranscription) {
  const lowerTrans = donnaTranscription.toLowerCase();
  if (lowerTrans.includes("unread")) {
    finalTranscription = `I will mark ${emailTargetText} as unread. Please approve the action on your screen.`;
    forceShowActions = true;
  } else if (lowerTrans.includes("star") && !lowerTrans.includes("start")) {
    finalTranscription = `I will star ${emailTargetText} for you. Please approve the action on your screen.`;
    forceShowActions = true;
  } else if (lowerTrans.includes("trash") || lowerTrans.includes("delete") || lowerTrans.includes("bin")) {
    finalTranscription = `I will move ${emailTargetText} to the trash. Please approve the action on your screen.`;
    forceShowActions = true;
  }
}

return (
  <PasswordGate persona={PERSONA}>
    <div className={`app${isDonnaActive ? " donna-active" : ""}`}>
      <audio ref={donnaAudioRef} autoPlay playsInline />
  <DonnaBubble
  transcription={finalTranscription}
  show={donnaVisible}
  showActions={forceShowActions}
  isDraft={donnaPendingAction?.name === "gmail_save_draft"} // 🎯 THE FIX: Only drafts get "Open Review"
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
            // 🔊 Unlock the WebRTC donna-audio element (autoplay policy requires user gesture)
            const donnaAudioEl = document.getElementById("donna-audio");
            if (donnaAudioEl) donnaAudioEl.play().catch(() => {});

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
          display: isDonnaActive ? 'flex' : 'none',
          alignItems: 'flex-end',
          gap: '8px',
          border: '1px solid #dadce0',
          background: '#fff',
          borderRadius: '24px',
          padding: '8px 12px',
          boxShadow: '0 1px 2px 0 rgba(60,64,67,0.30), 0 1px 3px 1px rgba(60,64,67,0.15)',
          zIndex: 50,
          boxSizing: 'border-box',
          transform: 'translateX(-50%)',
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