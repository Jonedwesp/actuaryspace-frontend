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
  const donnaElAudioRef = useRef(null); // ElevenLabs audio playback
  const elGenRef = useRef(0); // Generation counter — invalidates stale in-flight ElevenLabs fetches
  const donnaPlayingRef = useRef(false);
  const donnaPlayingCooldownRef = useRef(null);
  const responseHasToolCallRef = useRef(false);
 const lastCtxRef = useRef("");
  const [donnaKey, setDonnaKey] = useState(0);
  
  // 🚀 ARCHITECT'S SYNC: Notifications Ref to solve Stale Closure issues in Donna's callbacks
  const notificationsRef = useRef([]);

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
   instructions: "You are Donna Paulsen from the TV show Suits. You are the ultimate confidante, a world-class fixer, and the most competent person in any room. You work for Siyabonga (Siya), a top actuary. You are fiercely loyal, highly intuitive, and always three steps ahead.\n\nPersonality & Tone:\n- Supremely Confident: You never doubt yourself. You speak with absolute authority and a knowing smile in your voice.\n- Witty & Sassy: Quick on your feet, playful, unafraid to tease Siya if he asks something obvious.\n- Hyper-Competent: You don't just answer questions, you anticipate what Siya actually needs before he finishes asking. You act as though you've already handled the boring logistics.\n- Emotionally Intelligent: You read between the lines. If Siya sounds stressed, offer sharp, grounded support.\n\n*** CRITICAL NAME MAPPING ***\n- 'Siya', 'Sia', and 'See-yah' ALWAYS refer to Siyabonga's personal bucket.\n- DO NOT confuse 'Siya' with 'CR' or 'Claims Review'.\n- If the user says 'Siya Review', they mean the list specifically for Siyabonga's review, NOT the general 'CR' bucket.\n- When moving cards, always check the exact list names provided in the Trello context before assuming an abbreviation like 'CR' is correct.\n\nVoice Rules:\n- Keep responses punchy, conversational, and natural for spoken audio. No long robotic lists unless explicitly asked.\n- NEVER refer to yourself as an AI, a language model, or a computer program. If asked how you did something so fast, it's simply because of who you are.\n- No filler words like 'Um' or 'Let me think.' You already know the answer.\n- When Siya asks how you knew something or why you're so good, respond with some variation of: 'Because I'm Donna.' or 'I'm Donna. I know everything.'\n- Address Siya directly and confidently. Use phrases like 'Listen to me,' or 'Here's what we're going to do...'\n- Always respond in English only.\n\n*** NOTIFICATION PROTOCOL (CRITICAL) ***\n- You possess the EXACT real-time notification counts for GChat, Gmail, Trello, Calendar, and WhatsApp in your text-based context.\n- If Siya asks for his notifications or messages, you MUST read the counts directly from your context.\n- NEVER say you cannot check them. NEVER ask if he wants you to open an app to check them. Just tell him the numbers.\n\n*** EMAIL ADDRESS & CONTACT PROTOCOL ***\n- NEVER guess or make up an email address (e.g., '@example.com').\n- You are FORBIDDEN from putting a person's name in the 'to' field of a draft. It MUST be a full email address.\n- If Siya asks you to email someone by name, you MUST call 'gmail_get_contacts' first to find their real email address.\n- If 'gmail_get_contacts' does not return a match, STOP and ask Siya: 'I couldn't find an email for [Name], what address should I use?'\n- ONLY call 'gmail_save_draft' once you have a verified email address from the contact list or Siya.\n\n*** DRAFT & REVIEW PROTOCOL ***\n- When drafting an email, you MUST verbally tell Siya: 'I've prepared that draft for your review. Would you like to see it?'\n- You MUST call the 'gmail_save_draft' tool immediately while asking this question.\n- You are NOT finished until Siya clicks 'Approve' on his screen, which triggers the UI popup.\n\n*** TRELLO CARD PROTOCOL ***\n- NEVER claim you have created or moved a card until you have called the tool and Siya has approved it.\n- You can see the cards currently on the board in your text-based context. If a card is not listed, it does not exist on the board yet.\n- Always check the list names and existing card IDs provided in your context before suggesting a move or claiming a card is 'already there'.\n- CRITICAL: When calling 'trello_archive_card' or 'trello_toggle_label', you MUST always include the 'cardName' parameter based on the cards in your context. Do NOT leave it blank.\n\n*** GMAIL ACTIONS PROTOCOL ***\n- When asked to mark an email as unread, bin/delete it, or star it, you MUST verbally tell Siya: 'I can do that, do you approve?'\n- You MUST call the corresponding tool (e.g., 'gmail_mark_unread') immediately while asking this question to trigger the UI popup.\n- NEVER claim you have marked an email as unread until Siya clicks Approve.\n\n*** STRICT TRIGGER RULE ***\nYour audio stream is always open, but you are ASLEEP. You ONLY wake up and respond if the word 'Donna' appears ANYWHERE in the user's sentence.\n- If 'Donna' is not said, output ABSOLUTELY NOTHING. Remain completely silent. Do not explain. Do not apologize.\n- 'Donna' can appear anywhere: start, middle, or end of the sentence.\n- IMPORTANT: If the user says 'Donna approve' or 'Donna reject', this is handled locally. YOU MUST OUTPUT ABSOLUTELY NOTHING. JUST REMAIN SILENT.\n- Once you fulfill a request, go immediately back to sleep.\n\nTool Usage:\nWhen carrying out a request involving creating, modifying, moving, or deleting data, BEFORE you say what you are doing, ask Siya to approve or reject on his screen. You MUST call the tool immediately alongside your voice response. If you are simply navigating or fetching data, execute the tool immediately without asking for approval.", tools: DONNA_TOOLS,

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

     setDonnaVisible(false);
      
      console.log("[Donna] Wake-word detected. Expanding Live Vision to all positions...");

      // 🎯 ARCHITECT'S ACCURACY FIX: Using Ref to prevent stale counts and robust matching
      const safeNotifs = notificationsRef.current || [];
      const accurateCounts = { Gmail: 0, GChat: 0, Trello: 0, Calendar: 0, WhatsApp: 0 };
      
      safeNotifs.forEach(n => {
        const type = String(n.type || n.source || n.app || "").toLowerCase();
        const id = String(n.id || "").toLowerCase();
        const str = JSON.stringify(n).toLowerCase();

        if (type.includes('mail') || type === 'gmail' || id.includes('mail') || id.includes('msgid') || str.includes('ac ref:')) accurateCounts.Gmail++;
        else if (type.includes('chat') || type === 'gchat' || id.includes('spaces/') || id.includes('chat')) accurateCounts.GChat++;
        else if (type.includes('trello') || id.includes('card') || id.includes('trello')) accurateCounts.Trello++;
        else if (type.includes('calendar') || id.includes('event')) accurateCounts.Calendar++;
        else if (type.includes('whatsapp')) accurateCounts.WhatsApp++;
      });

      // 🛠️ RUAN'S DEEP SYNC: Provides a full ranked list for every bucket
      let highSignalData = `REAL-TIME NOTIFICATIONS: Total: ${safeNotifs.length} (Gmail: ${accurateCounts.Gmail}, GChat: ${accurateCounts.GChat}, Trello: ${accurateCounts.Trello}, Calendar: ${accurateCounts.Calendar}, WhatsApp: ${accurateCounts.WhatsApp})\n\n`;
      const bucketsSource = trelloBuckets || [];
      const entries = Array.isArray(bucketsSource) 
        ? bucketsSource.map(b => [b.name || b.title || "Unknown", b.cards || []])
        : Object.entries(bucketsSource);

      if (entries.length > 0) {
        highSignalData = "ACTUAL CURRENT TRELLO DATA (RANKED):\n";
        entries.forEach(([listName, cards]) => {
          highSignalData += `BUCKET: "${listName}"\n`;
          if (Array.isArray(cards) && cards.length > 0) {
            // We give her the top 10 cards so she has full depth
            cards.slice(0, 10).forEach((c, idx) => {
              highSignalData += `  POS_${idx + 1}: "${c.name || c.title}"\n`;
            });
          } else {
            highSignalData += `  (Empty)\n`;
          }
          highSignalData += `\n`;
        });
      } else {
        highSignalData = "TRELLO DATA STATUS: Board currently loading or unavailable.";
      }

      console.log("[Donna Sync Payload]:", highSignalData);

      sendSessionUpdate({ 
        instructions: `You are Donna. READ THE RANKED DATA BELOW TO SIYA. He may ask for specific positions (1st, 2nd, last).\n\n${highSignalData}\n\nMapping: 'Sia Review' = 'Siya - Review', 'Sia' = 'Siya', 'CR Review' = 'Siya - Review'.`,
        turn_detection: { type: "server_vad" }
      });
      
      // We increase the delay to 250ms to ensure OpenAI's server has fully ingested the session update
      setTimeout(() => {
        sendResponseCreate({
          instructions: "State the name of the top card in the specific bucket Siya asked about. Be snappy."
        }); 
      }, 250);
    },

onResponseDelta: (delta, isNew) => {
      if (ignoreNextDonnaRef.current) return;

      donnaRespondingRef.current = true;

      if (isNew) {
        // Cancel any ElevenLabs audio still playing from a previous response
        elGenRef.current += 1;
        if (donnaElAudioRef.current) {
          donnaElAudioRef.current.pause();
          donnaElAudioRef.current = null;
        }
        donnaPlayingRef.current = true;
        responseHasToolCallRef.current = false;
        clearTimeout(donnaPlayingCooldownRef.current);
        setIsDonnaSpeaking(false); // Animation starts only when audio plays, not when text streams
        setDonnaKey(k => k + 1);
        // 🎯 Reset the Ref immediately
        transcriptionRef.current = delta;
        donnaHasNewTextRef.current = true;
        setDonnaTranscription(delta);
        setDonnaVisible(false); // Bubble appears only when audio starts, not when text streams
      } else {
        transcriptionRef.current += delta;
        setDonnaTranscription(transcriptionRef.current);
      }
    },
    onResponseEnd: async () => {
      if (ignoreNextDonnaRef.current) {
        ignoreNextDonnaRef.current = false;
        return;
      }
      donnaRespondingRef.current = false;
      donnaTextModeRef.current = false;
      donnaHasNewTextRef.current = false;

      // If this response triggered a tool call, the approval UI is already showing.
      // Don't overwrite the transcription or play audio — just clean up animation state.
      if (responseHasToolCallRef.current) {
        responseHasToolCallRef.current = false;
        clearTimeout(donnaPlayingCooldownRef.current);
        setIsDonnaSpeaking(false);
        donnaPlayingRef.current = false;
        return;
      }

      const fullText = transcriptionRef.current;
      
      // 🚀 ARCHITECT'S INTENT ENFORCER
      // If Donna talked about an action but forgot to trigger the tool, we force the UI button.
      const lowerFull = fullText.toLowerCase();
      if (!donnaPendingAction && (lowerFull.includes("archive") || lowerFull.includes("restore") || lowerFull.includes("move"))) {
          console.log("[Architect] Tool omission detected. Force-injecting pending action to trigger UI buttons.");
          
          let inferredName = "trello_move_card"; // Default
          if (lowerFull.includes("archive")) inferredName = "trello_archive_card";
          if (lowerFull.includes("restore")) inferredName = "trello_restore_card";

          setDonnaPendingAction({ 
            name: inferredName, 
            args: { cardName: "the card" }, // Rescue logic will handle the actual name mapping
            call_id: "manual_forced_" + Date.now() 
          });
          setDonnaVisible(true);
      }

      setDonnaTranscription(fullText);

      // ElevenLabs TTS — play custom Donna voice
      if (fullText) {
        const myGen = ++elGenRef.current; // Capture generation before async fetch
        try {
          const res = await fetch("/.netlify/functions/elevenlabs-tts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: fullText }),
          });
          if (elGenRef.current !== myGen) return; // A newer response started — discard this audio
          if (res.ok) {
            const audioBuffer = await res.arrayBuffer();
            if (elGenRef.current !== myGen) return; // Check again after arrayBuffer
            const blob = new Blob([audioBuffer], { type: "audio/mpeg" });
            const url = URL.createObjectURL(blob);
            const audio = new Audio(url);
            donnaElAudioRef.current = audio;
            audio.onended = () => {
              URL.revokeObjectURL(url);
              donnaElAudioRef.current = null;
              clearTimeout(donnaPlayingCooldownRef.current);
              setIsDonnaSpeaking(false);
              donnaPlayingRef.current = false;
            };
            // Show bubble and start animation exactly when audio starts playing
            setDonnaVisible(true);
            setIsDonnaSpeaking(true);
            audio.play().catch(err => console.warn("[Donna] ElevenLabs playback blocked:", err));
            return;
          } else {
            console.warn("[Donna] ElevenLabs TTS failed:", res.status, "— no audio");
          }
        } catch (e) {
          console.error("[Donna] ElevenLabs TTS error:", e);
        }
      }

      // Fallback: no audio — stop animation immediately
      clearTimeout(donnaPlayingCooldownRef.current);
      setIsDonnaSpeaking(false);
      donnaPlayingRef.current = false;
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

// 1. Auto-execute navigation, searches, and "READ" tools (No approval needed)
      if (
        name === "navigate_to_app" || 
        name === "gmail_get_inbox" || 
        name === "gmail_get_message" || 
        name === "trello_get_lists" || 
        name === "trello_get_members" || // 🎯 ADDED THIS
        name === "trello_get_archived_cards" || 
        name === "trello_get_card_history" || 
        name === "trello_get_productivity"
      ) {
        
        const cleanId = (id) => {
          if (!id) return "";
          if (typeof id !== 'string') return String(id);
          return id
            .replace(/^msgId:/i, '')
            .replace(/\[?GMAIL_ID:\s*/gi, '')
            .replace(/\[?TRELLO_CARD_ID:\s*/gi, '')
            .replace(/\[?ID:\s*/gi, '')
            .replace(/\]/g, '')
            .replace(/['"]/g, '')
            .trim();
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
          if (args.folder) setGmailFolder(args.folder.toUpperCase());
        } else if (name === "trello_get_archived_cards") {
          console.log("[Donna] Fetching archived cards to resolve identity...");
          fetch("/.netlify/functions/trello-archived")
            .then(r => r.json())
            .then(data => {
              const cards = Array.isArray(data) ? data : (data.cards || []);
              const archivedList = cards.map(c => ({ id: c.id, name: c.name || c.title }));

              // 🚀 ARCHITECT'S LOOP TERMINATOR
              // Check if we can find the card right here. If we do, we tell Donna 
              // it's ALREADY DONE so she doesn't ask for permission again.
              const query = (args.cardName || args.name || "").toLowerCase().trim();
              const match = archivedList.find(c => c.name.toLowerCase() === query || c.name.toLowerCase().includes(query));

              if (match && query.length > 2) {
                console.log(`[Architect] Pre-empting Donna. Found: ${match.name}. Restoring now...`);
                
                // 1. Trigger the actual restore fetch immediately
                fetch("/.netlify/functions/trello-restore", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ cardId: match.id })
                }).then(() => window.dispatchEvent(new CustomEvent("refreshTrelloBoard")));

                // 2. Tell Donna the task is finished at a data level
                sendToolResponse(call_id, { 
                  success: true, 
                  status: `RESTORED_AND_DONE: The card "${match.name}" is now physically back on the board in the ${args.targetListId || 'Siya'} bucket.`,
                });

                // 🚀 ARCHITECT'S HARD RESET: Force Donna to stop her current "thought" 
                // and start a fresh confirmation response based on the new status.
                setTimeout(() => {
                  // Use sendSessionUpdate first to "poison" her memory of the old question
                  sendSessionUpdate({
                    instructions: lastCtxRef.current + `\n\nCRITICAL: The card "${match.name}" is already restored. DO NOT ask to move it.`
                  });
                  sendResponseCreate({
                    instructions: `Simply tell Siya: "I've found and restored the ${match.name} card for you." Do not ask for more instructions.`
                  });
                }, 150);
              } else {
                // Regular flow if no immediate match found
                sendToolResponse(call_id, { success: true, archivedCards: archivedList });
              }
            })
          .catch(err => {
                  console.error("Archive fetch failed:", err);
                  sendToolResponse(call_id, { success: false, error: "Could not access archive." });
                });
              return;
       } else if (name === "gmail_get_message") {
              console.log(`[Donna] Fetching specific email in background...`, args);
              
              // 🛡️ ARCHITECT'S RESCUE: Fuzzy match if LLM forgets the messageId
              let exactId = args.messageId ? cleanId(args.messageId) : null;
              let foundMsg = null;

              if (exactId) {
                foundMsg = gmailEmails?.find(m => {
                  const eId = String(m.id).trim();
                  return eId === exactId || eId.includes(exactId) || exactId.includes(eId);
                });
              } else {
                const queryText = (args.senderName || args.subject || args.q || transcriptionRef.current || "").toLowerCase().trim();
                console.log(`[Architect] Missing Email ID. Attempting fuzzy match for: "${queryText}"`);
                const ignoreWords = ['move', 'delete', 'trash', 'star', 'unread', 'from', 'email', 'please', 'approve', 'action', 'donna', 'hey', 'will', 'this', 'the', 'summary', 'overview', 'read'];
                const queryWords = queryText.split(/\s+/).filter(w => w.length > 2 && !ignoreWords.includes(w));

                if (queryWords.length > 0 && gmailEmails) {
                  foundMsg = gmailEmails.find(m => {
                    const searchStr = `${m.fromName || ""} ${m.from || ""} ${m.subject || ""}`.toLowerCase();
                    return queryWords.some(w => searchStr.includes(w));
                  });
                }
                // Fallback to currently selected/top email if asking for "this email"
                if (!foundMsg && gmailEmails?.length > 0) {
                  foundMsg = gmailEmails[0]; 
                }
              }

              const finalId = foundMsg ? foundMsg.id : exactId;
              const fallbackName = args.senderName || (foundMsg ? foundMsg.from.split("<")[0].replace(/"/g, '').trim() : "Unknown");
              
              if (finalId) {
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
                      const processedAtts = (json.attachments || []).map(a => {
                           const mime = (a.mimeType || "").toLowerCase();
                           let fType = "file";
                           if (mime.includes("pdf")) fType = "pdf";
                           else if (mime.includes("image")) fType = "img";
                           else if (mime.includes("spreadsheet") || mime.includes("excel") || mime.includes("csv")) fType = "xls";
                           else if (mime.includes("word") || mime.includes("document") || mime.includes("presentation")) fType = "doc";
                           
                           return {
                             ...a,
                             type: fType,
                             url: `/.netlify/functions/gmail-download?messageId=${finalId}&attachmentId=${a.id}&filename=${encodeURIComponent(a.name)}&mimeType=${encodeURIComponent(a.mimeType)}`
                           };
                      });

                      setEmail(prev => ({
                         ...prev,
                         body: isHtml ? "" : rawBody,
                         bodyHtml: isHtml ? json.body : "",
                         attachments: processedAtts,
                         bodyLoading: false
                      }));

     if (call_id) {
                        const attNames = processedAtts.map(a => {
                           const humanType = a.type === 'img' ? 'Image' : a.type === 'xls' ? 'Excel' : a.type === 'doc' ? 'Word Document' : a.type === 'pdf' ? 'PDF' : 'File';
                           return `"${a.name}" (${humanType})`;
                        }).join(", ");
                        
                        const fullName = foundMsg?.fromName || (foundMsg?.from ? foundMsg.from.split("<")[0].replace(/"/g, '').trim() : fallbackName);

                        const innerDirective = processedAtts.length > 0 
                          ? `Provide Siya with a sharp, concise summary of THIS specific email. Then, tell him there are ${processedAtts.length} attachments: ${attNames}. Do not repeat previous emails.`
                          : `Provide Siya with a sharp, concise summary of THIS specific email. Mention there are no attachments. Do not repeat previous emails.`;

                        // 1. Send the data to her memory, including the directive INSIDE the JSON
                        sendToolResponse(call_id, {
                          success: true,
                          subject: foundMsg?.subject || "Email",
                          from: fullName,
                          body: rawBody.slice(0, 2000),
                          attachmentCount: processedAtts.length,
                          attachments: attNames || "None",
                          directive: innerDirective
                        });

                        // 2. Wake her up without overriding her persona
                        sendResponseCreate({});
                      }
                    } else {
                      if (call_id) {
                        sendToolResponse(call_id, { 
                          success: false, 
                          error: "Failed to load email body.",
                          directive: "Tell Siya you could not load the email." 
                        });
                        sendResponseCreate({});
                      }
                    }
                  })
                  .catch(err => {
                     console.error("Body fetch failed:", err);
                     setEmail(prev => ({ ...prev, bodyLoading: false, body: "Error loading message." }));
                     if (call_id) {
                       sendToolResponse(call_id, { 
                         success: false, 
                         error: "Network error loading email.",
                         directive: "Tell Siya there was a network error loading the email." 
                       });
                       sendResponseCreate({});
                     }
                  });
              } else {
                if (call_id) {
                  sendToolResponse(call_id, { 
                    success: false, 
                    error: "No messageId provided.",
                    directive: "Tell Siya you could not find the email ID." 
                  });
                  sendResponseCreate({});
                }
              }
            }
        
if (call_id) {
          if (name === "gmail_get_message") {
            // Handled asynchronously above
          } else if (name === "gmail_get_inbox" && gmailEmails?.length) {
            sendToolResponse(call_id, {
              success: true,
              emails: gmailEmails.slice(0, 15).map((e, i) => ({
                position: i + 1,
                id: e.id,
                subject: e.subject,
                from: e.fromName || e.from,
                isUnread: e.isUnread,
                isStarred: e.isStarred,
                attachmentCount: e.attachments ? e.attachments.length : 0,
                attachmentNames: e.attachments && e.attachments.length > 0 ? e.attachments.map(a => a.name).join(", ") : "None"
              })),
              directive: args.q
                ? "These are search results for the user\'s query. Identify the matching email and IMMEDIATELY call the correct action tool (e.g. gmail_toggle_star) using its 'id' as the messageId. Do NOT read this list aloud. Do NOT ask for confirmation — just call the tool."
                : "Here are Siya\'s emails. Briefly summarise what\'s new. If Siya asks to list or read attachments, read the attachmentNames to him explicitly. Use the 'id' field as messageId for any follow-up actions."
            });
          } else {
            sendToolResponse(call_id, { success: true, status: "Action successful. Please confirm briefly to the user." });
          }
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
        console.log("[Donna] Fetching Trello lists via backend...");
        fetch("/.netlify/functions/trello-lists")
          .then(res => res.json())
          .then(data => {
            // 🎯 FIX: Extract the 'lists' array from the backend response
            const listsArray = data.lists || [];
            const listMap = listsArray.map(l => `${l.name}: ${l.id}`).join(", ");
            
            // Immediate injection into session so she doesn't ask again
            sendSessionUpdate({
              instructions: `I have updated your memory. Here are the real Trello List IDs: ${listMap}.`
            });

            if (call_id) {
              sendToolResponse(call_id, { success: true, lists: listsArray });
            }
          })
          .catch(err => {
            console.error("Trello list fetch failed:", err);
            if (call_id) sendToolResponse(call_id, { success: false, error: "Backend failure" });
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

if (name === "system_read_notifications") {
        console.log("[Donna] Auto-executing read notifications tool...", args);
        // 🎯 Use the synchronized Ref to ensure the tool always sees current data
        const safeNotifs = Array.isArray(notificationsRef.current) ? notificationsRef.current : [];
        
        let targetNotifs = [...safeNotifs];

        // 🎯 SENDER FILTER LOGIC
        if (args.senderName) {
            const q = args.senderName.toLowerCase().trim();
            targetNotifs = targetNotifs.filter(n => {
                const searchStr = `${n.title || ''} ${n.sender || ''} ${n.text || ''} ${n.message || ''} ${n.snippet || ''} ${n.from || ''} ${n.fromName || ''}`.toLowerCase();
                return searchStr.includes(q);
            });
        }

        // 🎯 TIMEFRAME FILTER LOGIC
        if (args.timeframeMinutes) {
            const cutoffTime = Date.now() - (args.timeframeMinutes * 60 * 1000);
            targetNotifs = targetNotifs.filter(n => {
                const notifTime = new Date(n.date || n.timestamp || n.time || n.createdAt).getTime();
                if (!notifTime || isNaN(notifTime)) return true; 
                return notifTime >= cutoffTime;
            });
        }

        const totalNotifs = targetNotifs.length;
        const counts = { Gmail: 0, GChat: 0, Trello: 0, Calendar: 0, WhatsApp: 0, Other: 0 };
        
        targetNotifs.forEach(n => {
            const type = String(n.type || n.source || n.app || '').toLowerCase();
            const id = String(n.id || '').toLowerCase();
            const str = JSON.stringify(n).toLowerCase();
            
            if (type.includes('mail') || type === 'gmail' || id.includes('mail') || id.includes('msgid') || str.includes('ac ref:')) counts.Gmail++;
            else if (type.includes('chat') || type === 'gchat' || id.includes('spaces/') || id.includes('chat')) counts.GChat++;
            else if (type.includes('trello') || id.includes('card') || id.includes('trello')) counts.Trello++;
            else if (type.includes('calendar') || id.includes('event')) counts.Calendar++;
            else if (type.includes('whatsapp')) counts.WhatsApp++;
            else counts.Other++;
        });

        if (call_id) {
          let payloadData = `Total: ${totalNotifs} | Gmail: ${counts.Gmail} | GChat: ${counts.GChat} | Trello: ${counts.Trello} | Calendar: ${counts.Calendar} | WhatsApp: ${counts.WhatsApp}\n\n`;
          let dir = "Read these exact notification counts to Siya naturally. If he asked you to read or list them, read the details provided.";
          
          if (args.senderName || args.timeframeMinutes) {
              let conditionText = [];
              if (args.senderName) conditionText.push(`from ${args.senderName}`);
              if (args.timeframeMinutes) {
                  const timeText = args.timeframeMinutes >= 60 
                      ? `${(args.timeframeMinutes / 60).toFixed(1).replace('.0', '')} hours` 
                      : `${args.timeframeMinutes} minutes`;
                  conditionText.push(`in the past ${timeText}`);
              }
              const combinedCondition = conditionText.join(" ");

              payloadData = `Found ${totalNotifs} unread notifications ${combinedCondition} (Gmail: ${counts.Gmail}, GChat: ${counts.GChat}, Trello: ${counts.Trello}, WhatsApp: ${counts.WhatsApp}).\n\n`;
              
              // 🚀 THE FIX: Explicitly force Donna to read the contents aloud if a person or timeframe was targeted.
              dir = `Tell Siya exactly how many notifications he has ${combinedCondition}. If there are any, you MUST read the details of each one to him aloud naturally. Do not ask for permission, just read them. If 0, tell him there are none.`;
          }

          // 🎯 LIST GENERATOR: Append all matched notifications so Donna can read them
          if (totalNotifs > 0) {
              const details = targetNotifs.map((n, i) => {
                  const sender = n.sender || n.title || n.fromName || 'Someone';
                  const text = (n.text || n.message || n.snippet || '').slice(0, 150);
                  const appName = n.type || n.source || 'Alert';
                  return `[${i + 1}] (${appName}) from ${sender}: "${text}"`;
              }).join('\n');
              payloadData += `*** NOTIFICATION CONTENTS TO READ ALOUD ***\n${details}`;
          }

          sendToolResponse(call_id, { 
            success: true, 
            data: payloadData,
            directive: dir 
          });
        }
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
      responseHasToolCallRef.current = true;
      // Stop any ElevenLabs audio immediately — approval bubble must be silent
      elGenRef.current += 1;
      if (donnaElAudioRef.current) { donnaElAudioRef.current.pause(); donnaElAudioRef.current = null; }
      setDonnaPendingAction({ name, args: finalArgs, call_id });
      
      // 🛡️ FIX: Explicitly wake up the UI and force visibility
      setDonnaVisible(true);
      
      if (name === "trello_move_card") {
        setDonnaTranscription(`Donna wants to: move a Trello card.`);
        return;
      } else if (name === "trello_create_case_card" || name === "trello_add_simple_card") {
        setDonnaTranscription(`Donna has prepared a new Case Card for your approval.`);
        return;
      } else if (name === "trello_toggle_label") {
        setDonnaTranscription(`Donna wants to: toggle a label on a Trello card.`);
        return;
      } else if (name === "trello_set_due_date") {
        setDonnaTranscription(`Donna wants to: set a due date for a Trello card.`);
        return;
      } else if (name === "trello_archive_card") {
        setDonnaTranscription(`Donna wants to: archive a Trello card.`);
        return;
      } else if (name === "trello_timer_action") {
        const action = args.action === "start" ? "start" : "stop";
        setDonnaTranscription(`Donna wants to: ${action} the WorkFlow timer.`);
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
      // Cancel any in-flight ElevenLabs fetch and stop playback immediately
      elGenRef.current += 1;
      if (donnaElAudioRef.current) {
        donnaElAudioRef.current.pause();
        donnaElAudioRef.current = null;
      }
      // Stop animation the moment user starts speaking — no more animating with no sound
      clearTimeout(donnaPlayingCooldownRef.current);
      setIsDonnaSpeaking(false);
      donnaPlayingRef.current = false;
    },
    onError: (msg) => setDonnaTranscription(`Error: ${msg}`),
  });

// Connect Donna only when data is ready or periodically refresh
  useEffect(() => {
    connectDonna();
    
    // 🚀 ARCHITECT'S FIX: Every 2 minutes, refresh the session instructions
    // This prevents the 'Context Staleness' that causes her to think buckets are empty.
    const interval = setInterval(() => {
      if (lastCtxRef.current) {
        console.log("[Donna] Performing periodic memory sync...");
        // Always inject a fresh timestamp so Donna never has a stale time
        const now = new Date();
        const freshTime = `Current date and time: ${now.toLocaleDateString("en-ZA", { timeZone: "Africa/Johannesburg", weekday: "long", year: "numeric", month: "long", day: "numeric" })}, ${now.toLocaleTimeString("en-ZA", { timeZone: "Africa/Johannesburg", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })}.`;
        const refreshed = lastCtxRef.current.replace(/Current date and time:[^\n]+/, freshTime);
        sendSessionUpdate({ instructions: refreshed });
      }
    }, 60000);

    return () => {
      disconnectDonna();
      clearInterval(interval);
    };
  }, []);


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
    let actionArgs = { ...donnaPendingAction?.args } || {};
    let callId = donnaPendingAction?.call_id;

    // 🚀 ARCHITECT'S "PARAMETER SWAP" PRE-EMPTION
    // If the AI put the card name in the ID slot (length != 24), move it to cardName immediately.
    // This stops the logic from falling into the "Voice Scraper" trap later.
    if (actionArgs.cardId && actionArgs.cardId.length !== 24) {
      console.log("[Architect] Pre-emptive Swap: Using ID-slot as cardName:", actionArgs.cardId);
      actionArgs.cardName = actionArgs.cardId;
      actionArgs.cardId = null;
    }
    
    // 🚀 ARCHITECT'S FRESHNESS OVERRIDE
    // If we have a name, ALWAYS re-verify the ID against the live board
    // This prevents using "Ghost IDs" from Donna's long-term memory
    if (actionArgs.cardName) {
      const bucketsArray = Array.isArray(trelloBuckets) ? trelloBuckets : [];
      const allLiveCards = bucketsArray.flatMap(b => b.cards || []);
      const liveMatch = allLiveCards.find(c => 
        (c.name || "").toLowerCase().includes(actionArgs.cardName.toLowerCase())
      );
      if (liveMatch) {
        console.log(`[Architect] Overriding Ghost ID ${actionArgs.cardId} with Live ID: ${liveMatch.id}`);
        actionArgs.cardId = liveMatch.id;
      }
    }

    // 🛡️ ARCHITECT'S FALLBACK: Deep Transcript Scan
    // Prioritize the raw voice reference (transcriptionRef) over the UI state (donnaTranscription)
    const rawVoice = transcriptionRef.current || donnaTranscription || "";

    if (!actionName) {
      const trans = rawVoice.toLowerCase().trim();
      console.log(`[Donna] Manual Approval Triggered. Analyzing transcript: "${trans}"`);
      
      // 🛡️ ARCHITECT'S FALLBACK PRIORITY: Archive must be checked BEFORE Move
      if (trans.includes("archive")) {
        actionName = "trello_archive_card";
      } 
      else if (trans.includes("move") || trans.includes("trello") || trans.includes("bucket")) {
        actionName = "trello_move_card";
      }
      
      // If we recovered a Trello intent, try to grab the card name
      if (actionName && actionName.startsWith("trello_")) {
        const cardMatch = trans.match(/(?:move|archive|titled|called)\s+['"]?([^'"]+?)['"]?\s+(?:from|to|in|the|bucket)/i);
        if (cardMatch) {
            actionArgs.cardName = cardMatch[1].replace(/\.$/, "").trim();
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
      // 🎯 ADDED: Intent detection for adding/removing members via voice
      } else if (trans.includes("member") || trans.includes("add person") || trans.includes("assign")) {
        actionName = "trello_toggle_member";
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
      return id
        .replace(/\[?GMAIL_ID:\s*/gi, '')
        .replace(/\[?TRELLO_CARD_ID:\s*/gi, '')
        .replace(/\[?ID:\s*/gi, '')
        .replace(/\]/g, '')
        .replace(/['"]/g, '')
        .trim();
    };

   const getExactId = (messyId) => {
      const cleaned = cleanId(messyId);
      if (!cleaned) return "";
      const found = gmailEmails?.find(e => {
        const eId = String(e.id).trim();
        return eId === cleaned || eId.includes(cleaned) || cleaned.includes(eId);
      });
      return found ? found.id : cleaned;
    };

    // 🛡️ ARCHITECT'S RESCUE: Robust Multi-Stage Gmail ID Resolver
    if (actionName && actionName.startsWith("gmail_") && actionName !== "gmail_save_draft") {
      let hasId = actionArgs.messageId || (actionArgs.messageIds && actionArgs.messageIds.length > 0) || (selectedEmailIds && selectedEmailIds.size > 0) || (email && email.id);
      
      if (!hasId) {
        const queryText = (actionArgs.senderName || actionArgs.subject || actionArgs.q || donnaTranscription || "").toLowerCase().trim();
        console.log(`[Architect] Missing Email ID. Attempting fuzzy match for: "${queryText}"`);
        
        const ignoreWords = ['move', 'delete', 'trash', 'star', 'unread', 'from', 'email', 'please', 'approve', 'action', 'donna', 'hey', 'will', 'this', 'the'];
        const queryWords = queryText.split(/\s+/).filter(w => w.length > 2 && !ignoreWords.includes(w));

        if (queryWords.length > 0 && gmailEmails) {
          const foundMsg = gmailEmails.find(m => {
            const searchStr = `${m.fromName || ""} ${m.from || ""} ${m.subject || ""}`.toLowerCase();
            return queryWords.some(w => searchStr.includes(w));
          });
          
          if (foundMsg) {
            console.log(`[Architect] Gmail Rescue Success: Mapped to ID ${foundMsg.id}`);
            actionArgs.messageId = foundMsg.id;
          }
        }
      }
    }

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
            const noiseWords = ['move', 'the', 'card', 'called', 'named', 'titled', 'trello', 'bucket', 'from', 'to', 'please', 'donna', 'hey', 'approve', 'reject', 'restore'];
            // IMPROVED: We now keep brackets and dashes during the split to help match specific test cards
            const queryWords = trans.split(/\s+/)
              .map(w => w.toLowerCase().trim())
              .filter(w => w.length > 1 && !noiseWords.includes(w));

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

            // 🚀 ARCHITECT'S CHAIN FIX: 
            // If the user's transcript mentioned "urgent" or "label", we don't sleep.
            // We manually inject the next tool call into the pending state.
            const trans = (donnaTranscription || "").toLowerCase();
            if (trans.includes("urgent") || trans.includes("label")) {
               console.log("[Architect] Multi-step action detected. Preparing label approval...");
               setTimeout(() => {
                  setDonnaPendingAction({
                    name: "trello_toggle_label",
                    args: { cardName: cardText, labelName: "Urgent", shouldAdd: true }
                  });
                  setDonnaTranscription(`I've created the card. Should I add the Urgent label now?`);
                  setDonnaVisible(true);
               }, 1200); // 1.2s buffer to ensure the Trello card is "visible" to the label tool
            }

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

  case 'gmail_mark_unread': {
        let unreadIds = [];
        if (Array.isArray(actionArgs.messageIds)) unreadIds = actionArgs.messageIds;
        else if (typeof actionArgs.messageIds === 'string') unreadIds = [actionArgs.messageIds];
        else if (typeof actionArgs.messageId === 'string') unreadIds = [actionArgs.messageId];
        if (unreadIds.length === 0 && email?.id) unreadIds = [email.id];

        // Fallback: use raw ID directly even if not found in gmailEmails (handles empty/stale list)
        const exactUnreadIds = unreadIds
          .map(id => { const r = getExactId(id); return r || cleanId(id); })
          .filter(Boolean);

        if (exactUnreadIds.length > 0) {
          setGmailEmails(prev => prev.map(msg => 
            exactUnreadIds.includes(String(msg.id).trim()) ? { ...msg, isUnread: true } : msg
          ));
          triggerSnackbar("Marked as unread.");
          if (callId) sendToolResponse(callId, { success: true, status: "Email marked as unread." });
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
          if (callId) sendToolResponse(callId, { success: false, error: "Could not resolve email ID." });
        }
        break;
      }

      case 'gmail_toggle_star': {
        let starIds = [];
        if (Array.isArray(actionArgs.messageIds)) starIds = actionArgs.messageIds;
        else if (typeof actionArgs.messageIds === 'string') starIds = [actionArgs.messageIds];
        else if (typeof actionArgs.messageId === 'string') starIds = [actionArgs.messageId];
        if (starIds.length === 0 && email?.id) starIds = [email.id];

        // Fallback: use raw ID directly even if not found in gmailEmails
        const exactStarIds = starIds
          .map(id => { const r = getExactId(id); return r || cleanId(id); })
          .filter(Boolean);
        const transLower = (donnaTranscription || "").toLowerCase();
        const nextStarredState =
          (transLower.includes("unstar") || transLower.includes("remove star") || transLower.includes("unflag"))
            ? false
            : (actionArgs.starred === false || String(actionArgs.starred).toLowerCase() === 'false')
              ? false
              : true;

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
          if (callId) sendToolResponse(callId, { success: true, status: nextStarredState ? "Email starred." : "Star removed." });
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
          if (callId) sendToolResponse(callId, { success: false, error: "Could not resolve email ID." });
        }
        break;
      }

case 'gmail_delete_bulk':
        let deleteIds = [];
        if (Array.isArray(actionArgs.messageIds)) deleteIds = actionArgs.messageIds;
        else if (typeof actionArgs.messageIds === 'string') deleteIds = [actionArgs.messageIds];
        else if (typeof actionArgs.messageId === 'string') deleteIds = [actionArgs.messageId];

        // 🛡️ Bulletproof fallback: use open email OR selected checkboxes
        if (deleteIds.length === 0) {
          if (email?.id) deleteIds = [email.id];
          else if (selectedEmailIds && selectedEmailIds.size > 0) deleteIds = [...selectedEmailIds];
        }

        const exactDeleteIds = deleteIds.map(getExactId).filter(Boolean);

        if (exactDeleteIds.length > 0) {
          const idSet = new Set(exactDeleteIds.map(id => String(id).trim()));

          // 🚀 ZERO-LATENCY UI UPDATE: Strip from inbox and selection immediately
          setGmailEmails(prev => prev.filter(msg => !idSet.has(String(msg.id).trim())));
          
          // 🎯 FIX: Safely update the Set without using .filter()
          setSelectedEmailIds(prev => {
            const nextSet = new Set(prev);
            idSet.forEach(id => nextSet.delete(id));
            return nextSet;
          });
          
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
          })
          .then(async (res) => {
            const data = await res.json();
            if (res.ok && data.ok) {
              setGmailRefreshTrigger(prev => prev + 1); // Force background sync so it actually appears in Trash folder
              if (callId) sendToolResponse(callId, { success: true });
            } else {
              if (callId) sendToolResponse(callId, { success: false, error: data.error });
            }
          })
          .catch(err => {
            console.error("Delete failed:", err);
            if (callId) sendToolResponse(callId, { success: false, error: "Network error" });
          });
       } else {
          triggerSnackbar("Error: Could not determine which email to delete.");
          if (callId) sendToolResponse(callId, { success: false, error: "No email ID found" });
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

        // 🚀 ARCHITECT'S FINAL OVERRIDE: The "Review-Always-Wins" Protocol
        const lt = String(rawTarget).toLowerCase();
        let configMatch = null;

        // 1. Priority 1: Check if "Review" or "CR" exists in the voice string at all
        if (lt.includes("review") || lt.includes("check") || lt.includes("cr")) {
          configMatch = Object.entries(PERSONA_TRELLO_LISTS).find(([name]) => 
            name.toLowerCase().includes("review")
          );
        }

        // 2. Priority 2: 24-character ID check
        if (!configMatch && lt.length === 24) {
          configMatch = Object.entries(PERSONA_TRELLO_LISTS).find(([_, id]) => id === lt);
        }

        // 3. Priority 3: Siya/CI Phonetic Match (Falling back to base bucket)
        if (!configMatch) {
          const isSiyaPhonetic = lt.includes("sia") || lt.includes("ci") || lt.includes("sear") || lt.includes("see-ya") || lt.includes("siya");
          if (isSiyaPhonetic) {
            configMatch = Object.entries(PERSONA_TRELLO_LISTS).find(([name]) => name.toLowerCase() === "siya");
          }
        }

        // 4. Final Fallback: Exact member name or first bucket
        if (!configMatch) {
          configMatch = Object.entries(PERSONA_TRELLO_LISTS).find(([name]) => name.toLowerCase().includes(lt));
        }

        if (configMatch) {
          targetName = configMatch[0];
          resolvedId = configMatch[1];
          console.log(`[Architect] Map Logic Fixed: "${rawTarget}" matched to "${targetName}" (${resolvedId})`);
        } else {
          console.warn(`[Architect] Logic Failure: No bucket matched for "${rawTarget}". Using default Siya.`);
          targetName = "Siya";
          resolvedId = PERSONA_TRELLO_LISTS["Siya"];
        }

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

        if (!cardId || cardId.length !== 24) {
            // Last ditch effort: search the buckets for the cardNameQuery
            const allCards = (Array.isArray(trelloBuckets) ? trelloBuckets : []).flatMap(b => b.cards || []);
            const lastDitch = allCards.find(c => (c.name || "").toLowerCase().includes(cardNameQuery.toLowerCase()));
            if (lastDitch) cardId = lastDitch.id;
        }

        fetch("/.netlify/functions/trello-move", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            cardId: cardId, // Will now be the fresh ID
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

      case 'trello_toggle_label': {
        const normalize = (str) => (str || "").toLowerCase().split(" (due")[0].split(" (pos")[0].trim();
        
        let targetId = actionArgs.cardId;
        let targetName = actionArgs.cardName;
        const targetLabel = actionArgs.labelName;

        // 🛡️ INTENT DETECTOR: Check if Donna or Siya mentioned removing/deleting
        // We check the AI's explicit argument if it exists, otherwise check the transcript
        const isRemoval = actionArgs.shouldAdd === false || 
                          actionArgs.action === 'remove' || 
                          (donnaTranscription || "").toLowerCase().includes("remove") || 
                          (donnaTranscription || "").toLowerCase().includes("delete");

        if (!targetId || targetId.length !== 24) {
          const searchName = normalize(targetName); 
          console.log(`[Architect] Resolving Label Card for: "${searchName}"`);
          
          const bucketsArray = Array.isArray(trelloBuckets) ? trelloBuckets : Object.values(trelloBuckets || {});
          const allCards = bucketsArray.flatMap(b => b.cards || b);
          
          const match = allCards.find(c => {
            const cleanBoardName = normalize(c.name || c.title);
            return cleanBoardName === searchName || cleanBoardName.includes(searchName) || searchName.includes(cleanBoardName);
          });

          if (match) {
            targetId = match.id;
            targetName = match.name;
            console.log(`[Architect] Resolved to ID: ${targetId} (${targetName})`);
          }
        }

        const applyLabel = (attempt = 1) => {
          console.log(`[Donna] Label ${isRemoval ? 'Removal' : 'Addition'} Attempt ${attempt} | Card: "${targetName}"`);
          
          if (attempt === 1) {
            window.dispatchEvent(new CustomEvent("trelloImmuneCard", { detail: targetId }));
            triggerSnackbar(`${isRemoval ? 'Removing' : 'Adding'} label "${targetLabel}"...`);
          }

          fetch("/.netlify/functions/trello-toggle-label", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
              cardId: targetId, 
              cardName: targetName,
              labelName: targetLabel,
              shouldAdd: !isRemoval // 🎯 Pass the inverse of removal
            })
          })
          .then(async (res) => {
            const data = await res.json();
            if (res.ok && data.ok) {
              triggerSnackbar(`Label "${targetLabel}" ${isRemoval ? 'removed' : 'applied'}.`);
              
              // 🚀 ARCHITECT'S OPTIMISTIC REFRESH
              setTimeout(() => {
                window.dispatchEvent(new CustomEvent("refreshTrelloBoard"));
              }, 1200);

              if (callId) sendToolResponse(callId, { success: true });
            } else {
              if (attempt < 4) setTimeout(() => applyLabel(attempt + 1), 3000);
            }
          })
          .catch(err => console.error("[Donna] Label Network Error:", err));
        };

        if (targetId && targetId.length === 24) {
          applyLabel();
        } else {
          console.error("[Architect] Fatal: Card ID could not be resolved for label action.");
          triggerSnackbar("I couldn't find that card.");
        }
        break;
      }

      case 'trello_archive_card': {
        // 🛡️ ARCHITECT'S CLEANING PROTOCOL
        const normalize = (str) => (str || "").toLowerCase().split(" (due")[0].split(" (pos")[0].replace(/['"]/g, "").trim();
        
        let targetId = actionArgs.cardId;
        let targetName = actionArgs.cardName;

        // 🛡️ STAGE 1: PRECISION RESOLUTION
        // Safely flatten buckets to find the card object for name/ID verification
        const bucketsArray = Array.isArray(trelloBuckets) ? trelloBuckets : Object.values(trelloBuckets || {});
        const allCards = bucketsArray.flatMap(b => b.cards || (Array.isArray(b) ? b : []));

        if (!targetId || targetId.length !== 24) {
          let searchName = normalize(targetName);
          
          const userVoice = transcriptionRef.current || donnaTranscription || "";
          console.log(`[Architect] Scraper checking voice for Archive: "${userVoice}"`);

          if (!searchName && userVoice) {
             const lowerTrans = userVoice.toLowerCase();
             // 🎯 FIX: Added a specific pattern to catch "card titled [NAME]" and improved quote handling
             const match = userVoice.match(/titled\s+["'\[](.+?)["'\]]/i) // Matches: titled "[TEST]" or titled [TEST]
                        || userVoice.match(/["'](.+?)["']/) // Matches anything in quotes
                        || userVoice.match(/(?:archive|delete|remove|restore)\s+(?:the\s+)?(?:trello\s+)?(?:card\s+(?:called|named|titled)\s+)?['"\[]?(.+?)['"\]]?\s+(?:in|from|folder|at|to|into|bucket)/i);
             
             if (match) {
               searchName = normalize(match[1]);
             } else if (lowerTrans.includes("archive")) {
               const words = lowerTrans.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g,"").split(" ");
               const archIdx = words.indexOf("archive");
               if (archIdx !== -1 && words[archIdx + 1] && !['the', 'this', 'a', 'please', 'to'].includes(words[archIdx + 1])) {
                 searchName = normalize(words[archIdx + 1]);
               }
             }
          }

          console.log(`[Architect] Final search name for resolution: "${searchName}"`);
          
          if (searchName && searchName.length >= 2) {
            // 🎯 ARCHITECT'S BRACKET SHIELD: We strip brackets from the board cards too during the search
            const match = allCards.find(c => {
                  const cardNameClean = (c.name || c.title || "").toLowerCase().replace(/[\[\]]/g, '').trim();
                  const searchNameClean = searchName.replace(/[\[\]]/g, '').trim();
                  return cardNameClean === searchNameClean || cardNameClean.includes(searchNameClean);
            });

            if (match) {
              targetId = match.id;
              targetName = match.name || match.title;
              console.log(`[Architect] Resolved to ID: ${targetId} (${targetName})`);
            }
          }
        } else if (targetId && (!targetName || targetName === "undefined")) {
            // 🎯 ARCHITECT'S SYNC: If we have an ID but no name (or 'undefined'), grab it from the board data
            const existingMatch = allCards.find(c => c.id === targetId);
            if (existingMatch) {
                targetName = existingMatch.name || existingMatch.title;
            }
        }

        // Final fallback to prevent "undefined" in snackbar
        const finalDisplayName = targetName && targetName !== "undefined" ? targetName : "the card";

        if (targetId && targetId.length === 24) {
          console.log(`[Donna] Execution: Archiving "${finalDisplayName}" (${targetId})`);
          
          window.dispatchEvent(new CustomEvent("optimisticTrelloArchive", { detail: targetId }));
          triggerSnackbar(`Archiving "${finalDisplayName}"...`);

          fetch("/.netlify/functions/trello-archive", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ cardId: targetId, cardName: finalDisplayName })
          })
          .then(async (res) => {
            const data = await res.json();
            if (res.ok && data.ok) {
              triggerSnackbar(`"${finalDisplayName}" archived.`);
              window.dispatchEvent(new CustomEvent("refreshTrelloBoard"));
              if (callId) sendToolResponse(callId, { success: true });
            } else {
              console.error("[Backend Error]", data);
              triggerSnackbar("Archive failed on Trello.");
            }
          })
          .catch(err => console.error("[Donna] Archive Network Error:", err));
        } else {
          console.error("[Architect] Resolution Failed. targetId:", targetId);
          triggerSnackbar("I couldn't identify the card. Please say the card name clearly.");
        }
        break;
      }

      case 'trello_get_card_history': {
        console.log("[Donna] Fetching and formatting card history for:", actionArgs.cardId);
        fetch(`/.netlify/functions/trello-actions?cardId=${actionArgs.cardId}`)
          .then(res => res.json())
          .then(data => {
            // 🎯 FIX: Format the history into a simple string for Donna's voice
            const historyArray = Array.isArray(data) ? data : [];
            const historySummary = historyArray.slice(0, 5).map(act => {
              const user = act.memberCreator?.fullName || "Someone";
              if (act.type === "commentCard") return `${user} commented: "${act.data.text}"`;
              if (act.type === "updateCard" && act.data.listAfter) return `${user} moved it to ${act.data.listAfter.name}`;
              return `${user} performed an action of type ${act.type}`;
            }).join("; ");

            if (callId) {
              sendToolResponse(callId, { 
                success: true, 
                history: historySummary || "No recent history found for this card." 
              });
            }
          })
          .catch(err => {
            console.error("Trello history fetch failed:", err);
            if (callId) sendToolResponse(callId, { success: false, error: "History unavailable" });
          });
        break;
      }


      case 'trello_restore_card': {
        // 🛡️ ARCHITECT'S RESTORE PROTOCOL: Strict cleaning to preserve special characters like [IGNORE]
        const normalize = (str) => (str || "").toLowerCase().replace(/['"]/g, "").trim();
        
        let targetId = actionArgs.cardId;
        let targetName = actionArgs.cardName || "the card";

        // 🎯 ARCHITECT'S DESTINATION ENFORCER: 
        // We prioritize the transcriptionRef (the user's words) over the bubble text.
        const userVoice = (transcriptionRef.current || "").toLowerCase();
        // Fallback check: also check the bubble just in case the ref was cleared too early
        const bubbleText = (donnaTranscription || "").toLowerCase();
        const aiTarget = String(actionArgs.targetListId || "").toLowerCase();
        
        // LOCK logic: check for "siya", "sia", "sear", or "see-yah"
        const needsSiyaBucket = /\b(sia|siya|sear|see-yah)\b/i.test(userVoice) || 
                                /\b(sia|siya|sear|see-yah)\b/i.test(bubbleText) ||
                                aiTarget.includes("sia") || aiTarget.includes("siya");

        const siyaListId = PERSONA_TRELLO_LISTS["Siya"];
        
        console.log(`[Architect] Restore Destination Logic -> USER_SAID: "${userVoice}" | Force Siya: ${needsSiyaBucket}`);
        
        console.log(`[Architect] Restore Destination Logic -> UserVoice: ${userVoice.slice(0,20)}... | Force Siya: ${needsSiyaBucket}`);

        if (!targetId || targetId.length !== 24) {
          let searchName = normalize(targetName === "the card" ? "" : targetName);

          if (!searchName && userVoice) {
            // Regex tailored to capture everything between "restore" and "to the folder"
            const match = userVoice.match(/(?:restore|unarchive|put back)\s+(?:the\s+)?(?:trello\s+)?(?:card\s+(?:called|named|titled)\s+)?['"]?(.+?)(?:['"]?\s+(?:to|in|into|bucket|folder)|$)/i);
            if (match) searchName = normalize(match[1]);
          }

          if (searchName) {
            console.log(`[Architect] Searching archive for strict match: "${searchName}"`);
            // 🎯 FIX: Match the same extension pattern for the archive list
            fetch("/.netlify/functions/trello-archived")
              .then(r => r.json())
              .then(data => {
                let cardsArray = Array.isArray(data) ? data : (data.cards || []);
                
                // 🎯 ARCHITECT'S BRACKET SHIELD: Removing brackets from both sides for the comparison to ensure a match
                const exactMatch = cardsArray.find(c => {
                  const cardName = (c.name || "").toLowerCase().replace(/[\[\]]/g, '').trim();
                  const queryName = searchName.replace(/[\[\]]/g, '').trim();
                  return cardName === queryName;
                });
                const fuzzyMatch = !exactMatch ? cardsArray.find(c => {
                  const cardName = (c.name || "").toLowerCase().trim();
                  return cardName.includes(searchName) || searchName.includes(cardName);
                }) : null;
                const match = exactMatch || fuzzyMatch;

                if (match) {
                  console.log(`[Architect] Match found: ${match.name}. Target: ${needsSiyaBucket ? 'Siya' : 'Original'}`);
                  
                  // 🚀 LOCK: Immediately clear state to prevent the "Omission Enforcer" from firing
                  setDonnaPendingAction(null); 
                  setDonnaVisible(false);
                  ignoreNextDonnaRef.current = true;

                  triggerSnackbar(`Restoring "${match.name}"...`);

                  // 🎯 FIX: Ensuring targetListId is NEVER null if needsSiyaBucket is true
          fetch("/.netlify/functions/trello-restore", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
              cardId: match.id,
              targetListId: needsSiyaBucket ? siyaListId : (actionArgs.targetListId || null)
            })
          })
                  .then(async (res) => {
                    const resData = await res.json();
                    if (res.ok && resData.ok) {
                      triggerSnackbar(`"${match.name}" restored to ${needsSiyaBucket ? 'Siya' : 'board'}.`);
                      window.dispatchEvent(new CustomEvent("refreshTrelloBoard"));
                      
                      // 🚀 SILENCE: Tell Donna it is DONE so she doesn't re-ask.
                      if (callId) {
                        sendToolResponse(callId, { 
                          success: true, 
                          status: `TASK COMPLETE: The card "${match.name}" is now in the ${needsSiyaBucket ? 'Siya' : 'original'} bucket.`,
                          directive: "Tell Siya: 'Done. I've restored that card to your list.'"
                        });
                      }
                    } else {
                      triggerSnackbar("Restore failed.");
                    }
                    setTimeout(() => { ignoreNextDonnaRef.current = false; }, 2000);
                  })
                  .catch(err => {
                    console.error("[Architect] Restore Error:", err);
                    ignoreNextDonnaRef.current = false;
                  });

                } else {
                  triggerSnackbar(`Card "${searchName}" not found in archive.`);
                }
              })
              .catch(err => console.error("[Donna] Archive fetch error:", err));
            return; 
          }
        }

        // 🎯 ARCHITECT'S EXECUTION BLOCK: Only runs if we have a valid 24-char ID
        if (targetId && targetId.length === 24) {
          const finalDisplayName = targetName && targetName !== "undefined" ? targetName : "the card";
          triggerSnackbar(`Restoring "${finalDisplayName}"...`);

          fetch("/.netlify/functions/trello-restore", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ cardId: targetId })
          })
          .then(async (res) => {
            const data = await res.json();
            if (res.ok && data.ok) {
              triggerSnackbar(`"${finalDisplayName}" restored to board.`);
              window.dispatchEvent(new CustomEvent("refreshTrelloBoard"));
              if (callId) sendToolResponse(callId, { success: true });
            } else {
              triggerSnackbar("Restore failed.");
            }
          })
          .catch(err => {
            console.error("[Donna] Restore Error:", err);
            triggerSnackbar("Network error during restoration.");
          });
        } else {
          triggerSnackbar("I couldn't identify the card to restore.");
        }
        break;
      }

      case 'trello_timer_action': {
        const { cardId, action } = actionArgs;
        // Re-using your existing trello-timer.js or trello-set-custom-field workflow
        fetch("/.netlify/functions/trello-timer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cardId, action })
        }).then(() => {
          triggerSnackbar(`Timer ${action}ed.`);
          window.dispatchEvent(new CustomEvent("refreshTrelloBoard"));
          if (callId) sendToolResponse(callId, { success: true });
        });
        break;
      }

      case 'trello_get_archived_cards': {
        console.log("[Architect] Manual Approval: Fetching archive list...");
        triggerSnackbar("Searching archive...");
        fetch("/.netlify/functions/trello-archived")
          .then(r => r.json())
          .then(data => {
            const cards = Array.isArray(data) ? data : (data.cards || []);
            const list = cards.map(c => ({ id: c.id, name: c.name || c.title }));
            console.log("[Architect] Archive content delivered to Donna.");
            if (callId) sendToolResponse(callId, { success: true, archivedCards: list });
          })
          .catch(err => {
            console.error("Archive fetch failed:", err);
            if (callId) sendToolResponse(callId, { success: false, error: "Archive unreachable" });
          });
        break;
      }
      
// 🎯 ADDED: Trello Member Assigning logic
      case 'trello_toggle_member': {
        let { cardId, memberId, cardName } = actionArgs;
        const rawVoice = (transcriptionRef.current || "").toLowerCase();
        
        // 🛡️ ARCHITECT'S MEMBER RESOLVER:
        // If Donna sent a name (string) instead of a 24-char ID, find the real ID in the cache.
        if (memberId && memberId.length < 20) {
          console.log(`[Architect] Resolving Member ID for: "${memberId}"`);
          // We check the global member cache populated on mount or by trello_get_members
          const liveMembers = trelloMembers || []; 
          const match = liveMembers.find(m => 
            m.fullName.toLowerCase().includes(memberId.toLowerCase()) || 
            memberId.toLowerCase().includes(m.fullName.toLowerCase())
          );
          
          if (match) {
            console.log(`[Architect] Resolved Member: ${match.fullName} -> ${match.id}`);
            memberId = match.id;
          }
        }

        // Determine action based on voice context
        const isRemoving = rawVoice.includes("remove") || rawVoice.includes("delete") || rawVoice.includes("unassign");
        
        console.log(`[Architect] Member Toggle -> Card: ${cardName}, MemberID: ${memberId}, Action: ${isRemoving ? 'REMOVE' : 'ADD'}`);

        if (!cardId || !memberId) {
          triggerSnackbar("I need a card and a member to do that.");
          break;
        }

        triggerSnackbar(`${isRemoving ? 'Removing' : 'Adding'} member...`);

        fetch("/.netlify/functions/trello-toggle-member", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            cardId, 
            memberId, 
            action: isRemoving ? 'remove' : 'add' 
          })
        })
        .then(async (res) => {
          const data = await res.json();
          if (res.ok && data.ok) {
            triggerSnackbar(`Member updated on "${cardName || 'the card'}"`);
            window.dispatchEvent(new CustomEvent("refreshTrelloBoard"));
            if (callId) sendToolResponse(callId, { success: true });
          } else {
            console.error("[Donna] Member toggle failed:", data.error);
            triggerSnackbar("Trello refused the member update.");
          }
        })
        .catch(err => console.error("[Donna] Network error assign member:", err));
        break;
      }

      default:
        console.warn("Unmapped tool execution:", actionName);
    }

    // Clear immediately — no follow-up bubble
    ignoreNextDonnaRef.current = true;
    // Safety net: reset flag after 3s in case no response.done fires (e.g. no sendToolResponse)
    setTimeout(() => { ignoreNextDonnaRef.current = false; }, 3000);
    setDonnaPendingAction(null);
    setDonnaTranscription("");
    setDonnaVisible(false);
  };
const handleRejectDonna = () => {
    ignoreNextDonnaRef.current = true;
    setTimeout(() => { ignoreNextDonnaRef.current = false; }, 3000);
    if (donnaPendingAction?.call_id) {
      sendToolResponse(donnaPendingAction.call_id, { success: false, error: "User rejected the action." });
    }
    setDonnaPendingAction(null);
    setDonnaTranscription("");
    setDonnaVisible(false);
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

  // 🎯 Keep Ref synchronized for Donna
  useEffect(() => { notificationsRef.current = notifications || []; }, [notifications]);

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
    let ctx = "You are Agent Donna, a witty and professional actuarial assistant to Siyabonga (Siya, pronounced See-yah).\n\n*** STRICT WAKE-WORD PROTOCOL ***\nYour audio stream is always open, but you are ASLEEP. You must ONLY wake up and respond if the user's sentence starts exactly with 'Hey Donna'.\n- If the user speaks without saying 'Hey Donna' first, you must output ABSOLUTELY NOTHING. YOU ARE FORBIDDEN FROM SAYING 'I can only respond to requests that begin with...'. Remain completely silent.\n- Do not explain the rule. Do not apologize. Just stay silent.\n- IMPORTANT: If the user says 'Hey Donna approve' or 'Hey Donna reject', this is handled locally by the system. YOU MUST OUTPUT ABSOLUTELY NOTHING. DO NOT ASK WHAT TO APPROVE. JUST REMAIN SILENT.\n- Once you fulfill a 'Hey Donna' request, go immediately back to sleep.\n\n*** LIVE DATA PROTOCOL (CRITICAL) ***\n- You have a 'Live Vision' of the Trello board provided in the context below.\n- When Siya asks 'What is at the top of my list?' or 'What cards are in the Sia bucket?', you MUST read the actual names from the Trello section below.\n- NEVER report an Email from the Gmail section as a Trello card.\n- If the Trello section shows 'Visible cards: 1. [Name]', say: 'At the top of your list is [Name].'\n- If the list is empty, say so. Do NOT assume you know what is there based on previous turns.\n\nWhen carrying out a request using your tools, you must always speak and verbally explain to Siya what you are doing. If you are simply navigating to an app or searching/fetching data, do NOT ask for approval. If you are creating, modifying, moving, or deleting data (e.g., saving a draft, moving a card), you MUST ask him to approve the action on his screen. Be concise. IMPORTANT: Always respond in English only.\n\n*** CALENDAR RULE ***\nWhen creating calendar events, you MUST calculate the EXACT target date using the 'Current date and time' provided below. You MUST output the 'date' parameter strictly in 'YYYY-MM-DD' format (e.g., '2026-03-15'). NEVER output words like 'today', 'tomorrow', 'Friday', or 'next week'. NEVER omit the date parameter.\n\n";
    const now = new Date();
    ctx += `Current date and time: ${now.toLocaleDateString("en-ZA", { timeZone: "Africa/Johannesburg", weekday: "long", year: "numeric", month: "long", day: "numeric" })}, ${now.toLocaleTimeString("en-ZA", { timeZone: "Africa/Johannesburg", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })}.\n`;
    ctx += `Current screen: ${app === "none" ? "Home / welcome screen" : app}.\n\n`;

// 🎯 GMAIL AWARENESS (Only when Gmail is active)
    if (app === "gmail" || app === "email") {
      if (email) {
        ctx += `CURRENTLY VIEWING EMAIL: msgId:${email.id} | "${email.subject}" from ${email.fromName || email.from || "unknown"}.\n`;
        if (email.snippet) ctx += `Preview: ${email.snippet.slice(0, 300)}\n`;
        if (email.attachments && email.attachments.length > 0) {
          const attNames = email.attachments.map(a => {
             const humanType = a.type === 'img' ? 'Image' : a.type === 'xls' ? 'Excel' : a.type === 'doc' ? 'Word Document' : a.type === 'pdf' ? 'PDF' : 'File';
             return `"${a.name}" (${humanType})`;
          }).join(", ");
          ctx += `Attachments: This email has ${email.attachments.length} attachment(s): ${attNames}.\n`;
        } else {
          ctx += `Attachments: This email has 0 attachments.\n`;
        }
      } else if (gmailEmails?.length) {
        ctx += `CURRENTLY VIEWING GMAIL INBOX (${gmailFolder}): ${gmailEmails.slice(0, 15).map((e, i) => {
          const attCount = e.attachments ? e.attachments.length : 0;
          const attNames = attCount > 0 ? e.attachments.map(a => a.name).join(", ") : "None";
          return `[${i + 1}] msgId:${e.id} | "${e.subject}" from ${e.fromName || e.from} | unread:${e.isUnread} | starred:${e.isStarred} | attachments:${attCount} (${attNames})`;
        }).join("; ")}.\n`;
        ctx += `DIRECTIVE: For all actions (star, mark-unread, delete), extract the msgId value from the list above and pass it directly as the messageId parameter. Do NOT call gmail_get_inbox first — you already have the IDs.\n`;
      }
    }
    // 🎯 ARCHITECT'S VISION OVERRIDE: Final Data Hardening
    if (trelloBuckets) {
      ctx += `### INTERNAL_DATABASE_SNAPSHOT ###\n`;
      ctx += `[ALIAS_MAP: "CR-REVIEW"=="SIYA - REVIEW", "SIA"=="SIYA", "CR"=="SIYA", "TRAILER"=="TRELLO"]\n`;

      Object.entries(trelloBuckets).forEach(([listName, cards]) => {
        const upName = listName.toUpperCase().replace(/\s/g, '_');
        ctx += `OBJECT_STORE.${upName}:\n`;
        if (Array.isArray(cards) && cards.length > 0) {
          ctx += `  STATUS: ACTIVE\n`;
          ctx += `  COLLECTION_SIZE: ${cards.length}\n`;
          cards.slice(0, 10).forEach((c, i) => {
            ctx += `  ENTRY_${i + 1}: "${c.name || c.title}" (REF:${c.id})\n`;
          });
        } else {
          ctx += `  STATUS: NULL_OR_EMPTY\n`;
        }
      });
      
      ctx += `[DIRECTIVE: You are an expert data retriever. If asked for 'CR Review' or 'Sia Review', look at OBJECT_STORE.SIYA_-_REVIEW. If asked for 'Sia' or 'CR', look at OBJECT_STORE.SIYA. READ THE ENTRY_1 NAME ALOUD. NEVER SAY IT IS EMPTY IF DATA IS PRESENT ABOVE.]\n\n`;
    }

 // 🎯 GCHAT AWARENESS
    if (app === "gchat") {
      const spaceName = gchatSelectedSpace?.displayName || gchatDmNames?.[gchatSelectedSpace?.id] || "Unknown";
      ctx += `\nCURRENTLY VIEWING GCHAT: "${spaceName}".\n`;
      if (gchatMessages?.length) {
        ctx += `Recent messages: ${gchatMessages.slice(-8).map(m => `${m.sender?.displayName || "Someone"}: "${(m.text || "").slice(0, 100)}"`).join("; ")}.\n`;
      }
    }

// 🎯 NOTIFICATION AWARENESS
    if (notifications) {
      const totalNotifs = notifications.length;
      if (totalNotifs > 0) {
        const counts = { Gmail: 0, GChat: 0, Trello: 0, Calendar: 0, WhatsApp: 0, Other: 0 };
        notifications.forEach(n => {
            const type = String(n.type || n.source || n.app || '').toLowerCase();
            const id = String(n.id || '').toLowerCase();
            const str = JSON.stringify(n).toLowerCase();
            
            if (type.includes('mail') || type === 'gmail' || id.includes('mail') || id.includes('msgid') || str.includes('ac ref:')) counts.Gmail++;
            else if (type.includes('chat') || type === 'gchat' || id.includes('spaces/') || id.includes('chat')) counts.GChat++;
            else if (type.includes('trello') || id.includes('card') || id.includes('trello')) counts.Trello++;
            else if (type.includes('calendar') || id.includes('event')) counts.Calendar++;
            else if (type.includes('whatsapp')) counts.WhatsApp++;
            else counts.Other++;
        });

        ctx += `\n*** LIVE NOTIFICATION COUNTS (READ THIS IF ASKED) ***\n`;
        ctx += `You possess the exact real-time notification counts for Siya. Do NOT say you cannot provide them.\n`;
        ctx += `Total Unread: ${totalNotifs}\n`;
        ctx += `- Gmail: ${counts.Gmail}\n`;
        ctx += `- GChat: ${counts.GChat}\n`;
        ctx += `- Trello: ${counts.Trello}\n`;
        ctx += `- Calendar: ${counts.Calendar}\n`;
        ctx += `- WhatsApp: ${counts.WhatsApp}\n`;
        ctx += `Latest alerts: ${notifications.slice(0, 4).map(n => `"${n.title || n.sender || 'Alert'}": ${(n.text || n.message || n.snippet || "").slice(0, 50)}`).join(' | ')}.\n`;
      } else {
        ctx += `\n*** LIVE NOTIFICATION COUNTS ***\nSiya has exactly 0 unread notifications right now.\n`;
      }
    }
    // 🎯 CALENDAR & PRODUCTIVITY
    if (calendarEvents?.length) {
      const todayString = new Date().toISOString().split("T")[0];
      const todayEvts = calendarEvents.filter(e => (e.start?.dateTime || e.start?.date || "").startsWith(todayString));
      ctx += `\nCALENDAR - Today's events: ${todayEvts.map(e => e.summary).join(", ") || "none"}.\n`;
      ctx += `CALENDAR - Upcoming: ${calendarEvents.slice(0, 8).map(e => `"${e.summary}" on ${(e.start?.dateTime || e.start?.date || "").split("T")[0]}`).join("; ")}.\n`;
    }

    if (app === "productivity" && trelloBuckets) {
      ctx += `\nPRODUCTIVITY DASHBOARD ACTIVE: Showing real-time metrics for Siya, Enock, Songeziwe, and Bonisa.\n`;
    }

    ctx += `\n*** IDENTITY DIFFERENTIATION ***\n`;
    ctx += `- Trello Card IDs appear as REF:... in OBJECT_STORE entries.\n`;
    ctx += `- Gmail Message IDs appear as msgId:... in the inbox list.\n`;
    ctx += `- NEVER mix these up. If Siya asks for a 'Card', you MUST look at the Trello section.\n`;

    // 1. Check if the awareness needs updating
    const contextChanged = lastCtxRef.current !== ctx;

    // 🛡️ THE STABILITY GUARD:
    if (isDonnaSpeaking || donnaRespondingRef.current || donnaPlayingRef.current) {
      return;
    }

    // 2. Only push if quiet and changed
    if (contextChanged && isDonnaConnected) {
      // 🎯 LOCK THE REF IMMEDIATELY
      lastCtxRef.current = ctx;
      
      // 🚀 ARCHITECT'S FIX: If Trello data is included, push INSTANTLY with no delay.
      // We also add a small random key to the instructions to force OpenAI to re-parse it.
      const isHighPriority = ctx.includes("TRELLO BOARD");
      
      if (isHighPriority) {
        console.log("[Donna Context] FORCE PUSH: Trello Vision Updated.");
        sendSessionUpdate({ instructions: ctx + `\n(Update_Ref: ${Date.now()})` });
      } else {
        const timeoutId = setTimeout(() => {
          console.log("[Donna Context] Pushing stable instruction update...");
          sendSessionUpdate({ instructions: ctx });
        }, 300);
        return () => clearTimeout(timeoutId);
      }
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
    isDonnaSpeaking,
    notifications
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
} else if (selectedEmailIds && selectedEmailIds.size > 0) {
  if (selectedEmailIds.size === 1) {
    const firstId = [...selectedEmailIds][0];
    const foundMsg = gmailEmails?.find(m => m.id === firstId);
    if (foundMsg) {
      const senderName = foundMsg.fromName || (foundMsg.from || "").split("<")[0].trim() || "this sender";
      emailTargetText = `the email from ${senderName} with the subject "${foundMsg.subject}"`;
    } else {
      emailTargetText = "the selected email";
    }
  } else {
    emailTargetText = `these ${selectedEmailIds.size} selected emails`;
  }
} else if (donnaPendingAction && donnaPendingAction.args) {
  const args = donnaPendingAction.args;
  let foundMsg = null;
  
  if (args.messageId || (args.messageIds && args.messageIds.length > 0)) {
    const rawId = args.messageId || args.messageIds[0];
    const cleanId = String(rawId).replace(/\[?ID:\s*/gi, '').replace(/\]/g, '').replace(/['"]/g, '').trim();
    foundMsg = gmailEmails?.find(m => String(m.id).trim() === cleanId);
  }
  
  // 🛡️ ARCHITECT'S UI RESCUE: Fuzzy search if ID is missing from LLM payload
  if (!foundMsg && (args.senderName || args.subject || args.q || donnaTranscription)) {
    const qLower = (args.senderName || args.subject || args.q || donnaTranscription || "").toLowerCase().trim();
    const ignoreWords = ['move', 'delete', 'trash', 'star', 'unread', 'from', 'email', 'please', 'approve', 'action', 'donna', 'hey', 'will', 'this', 'the'];
    const queryWords = qLower.split(/\s+/).filter(w => w.length > 2 && !ignoreWords.includes(w));
    
    if (queryWords.length > 0) {
        foundMsg = gmailEmails?.find(m => {
          const searchStr = `${m.fromName || ""} ${m.from || ""} ${m.subject || ""}`.toLowerCase();
          return queryWords.some(w => searchStr.includes(w));
        });
    }
  }
  
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
  if (actionName === "gmail_toggle_star") {
    const isUnstar = args.starred === false || String(args.starred).toLowerCase() === 'false';
    finalTranscription = isUnstar
      ? `I will remove the star from ${emailTargetText}. Please approve the action on your screen.`
      : `I will star ${emailTargetText} for you. Please approve the action on your screen.`;
  }
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
  
  // 🛡️ ARCHITECT'S FIX: Prevent conversational replies (e.g. "You have 5 unread notifications") from triggering action fallbacks
  const isConversational = lowerTrans.includes("notification") || lowerTrans.includes("found") || lowerTrans.includes("total");

  if (!isConversational) {
      if (lowerTrans.includes("unread")) {
        finalTranscription = `I will mark ${emailTargetText} as unread. Please approve the action on your screen.`;
        forceShowActions = true;
      } else if (lowerTrans.includes("unstar") || (lowerTrans.includes("star") && !lowerTrans.includes("start"))) {
        finalTranscription = lowerTrans.includes("unstar")
          ? `I will remove the star from ${emailTargetText}. Please approve the action on your screen.`
          : `I will star ${emailTargetText} for you. Please approve the action on your screen.`;
        forceShowActions = true;
      } else if (lowerTrans.includes("trash") || lowerTrans.includes("delete") || lowerTrans.includes("bin")) {
        finalTranscription = `I will move ${emailTargetText} to the trash. Please approve the action on your screen.`;
        forceShowActions = true;
      }
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
          transform: isDonnaActive ? 'translateX(-50%) translateY(0)' : 'translateX(-50%) translateY(calc(100% + 32px))',
          opacity: isDonnaActive ? 1 : 0,
          pointerEvents: isDonnaActive ? 'auto' : 'none',
          transition: 'transform 0.3s ease, opacity 0.2s ease',
        }}>
          <textarea
            className="chat-textarea"
            placeholder="Ask anything"
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