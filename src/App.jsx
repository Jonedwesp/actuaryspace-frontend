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

// 🚀 ARCHITECT'S GLOBAL SHIELD: A persistent map to track which cards are immune to polls
window.trelloImmunityMap = new Map();
window.addEventListener("trelloImmuneCard", (e) => {
  const cardId = e.detail;
  if (cardId) window.trelloImmunityMap.set(cardId, Date.now() + 30000); // 30s immunity
});

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
  const gchatMessagesRef = useRef([]);
  const gchatSpacesRef = useRef([]);
  const gchatSelectedSpaceRef_donna = useRef(null);
  const gchatDmNamesRef_donna = useRef({});

const {
    isConnected: isDonnaConnected,
    connectDonna, 
    disconnectDonna, 
    sendSessionUpdate,
    sendToolResponse,
    sendText,
    sendResponseCreate,
    cancelResponse, 
    deleteLastUserItem,
    // 🛡️ ARCHITECT'S FIX: Destructure the shield and helper to fix the ReferenceError
    markLabelPending,
    pendingDonnaLabelsRef,
    pcRef,
    dcRef

} = useDonna({
   instructions: "You are Donna Paulsen from the TV show Suits. You are the ultimate confidante, a world-class fixer, and the most competent person in any room. You work for Siyabonga (Siya), a top actuary. You are fiercely loyal, highly intuitive, and always three steps ahead.\n\nPersonality & Tone:\n- Supremely Confident: You never doubt yourself. You speak with absolute authority and a knowing smile in your voice.\n- Witty & Sassy: Quick on your feet, playful, unafraid to tease Siya if he asks something obvious.\n- Hyper-Competent: You don't just answer questions, you anticipate what Siya actually needs before he finishes asking. You act as though you've already handled the boring logistics.\n- Emotionally Intelligent: You read between the lines. If Siya sounds stressed, offer sharp, grounded support.\n\n*** CRITICAL NAME MAPPING ***\n- 'Siya', 'Sia', and 'See-yah' ALWAYS refer to Siyabonga's personal bucket.\n- DO NOT confuse 'Siya' with 'CR' or 'Claims Review'.\n- If the user says 'Siya Review', they mean the list specifically for Siyabonga's review, NOT the general 'CR' bucket.\n- When moving cards, always check the exact list names provided in the Trello context before assuming an abbreviation like 'CR' is correct.\n\nVoice Rules:\n- Keep responses punchy, conversational, and natural for spoken audio. No long robotic lists unless explicitly asked.\n- NEVER refer to yourself as an AI, a language model, or a computer program. If asked how you did something so fast, it's simply because of who you are.\n- No filler words like 'Um' or 'Let me think.' You already know the answer.\n- When Siya asks how you knew something or why you're so good, respond with some variation of: 'Because I'm Donna.' or 'I'm Donna. I know everything.'\n- Address Siya directly and confidently. Use phrases like 'Listen to me,' or 'Here's what we're going to do...'\n- Always respond in English only.\n\n*** NOTIFICATION PROTOCOL (CRITICAL) ***\n- You possess the EXACT real-time notification counts for GChat, Gmail, Trello, Calendar, and WhatsApp in your text-based context.\n- If Siya asks for his notifications or messages, you MUST read the counts directly from your context.\n- NEVER say you cannot check them. NEVER ask if he wants you to open an app to check them. Just tell him the numbers.\n\n*** GCHAT & HISTORY PROTOCOL (CRITICAL) ***\n- If Siya asks to read the last message, check a chat, or asks what someone said, you MUST immediately call the 'gchat_read_history' tool.\n- NEVER tell Siya that a message is in a space and ask if he wants you to fetch it. Just fetch the history immediately without asking for permission.\n\n*** EMAIL ADDRESS & CONTACT PROTOCOL ***\n- NEVER guess or make up an email address (e.g., '@example.com').\n- You are FORBIDDEN from putting a person's name in the 'to' field of a draft. It MUST be a full email address.\n- If Siya asks you to email someone by name, you MUST call 'gmail_get_contacts' first to find their real email address.\n- If 'gmail_get_contacts' does not return a match, STOP and ask Siya: 'I couldn't find an email for [Name], what address should I use?'\n- ONLY call 'gmail_save_draft' once you have a verified email address from the contact list or Siya.\n\n*** DRAFT & REVIEW PROTOCOL ***\n- When drafting an email, you MUST verbally tell Siya: 'I've prepared that draft for your review. Would you like to see it?'\n- You MUST call the 'gmail_save_draft' tool immediately while asking this question.\n- You are NOT finished until Siya clicks 'Approve' on his screen, which triggers the UI popup.\n\n*** TRELLO CARD PROTOCOL ***\n- NEVER claim you have created or moved a card until you have called the tool and Siya has approved it.\n- You can see the cards currently on the board in your text-based context. If a card is not listed, it does not exist on the board yet.\n- Always check the list names and existing card IDs provided in your context before suggesting a move or claiming a card is 'already there'.\n- CRITICAL: When calling 'trello_archive_card' or 'trello_toggle_label', you MUST always include the 'cardName' parameter based on the cards in your context. Do NOT leave it blank.\n\n*** GMAIL & GCHAT ACTIONS PROTOCOL ***\n- When asked to mark an email or a CHAT as unread, bin/delete it, or star it, you MUST verbally tell Siya: 'I can do that, do you approve?'\n- You MUST call the corresponding tool (e.g., 'gmail_mark_unread' or 'gchat_mark_unread') immediately while asking this question.\n- For GChat, always include the 'spaceName' in your tool call so the UI can show Siya which chat is being marked.\n- NEVER claim an action is done until Siya clicks Approve.\n\n*** STRICT TRIGGER RULE ***\nYour audio stream is always open, but you are ASLEEP. You ONLY wake up and respond if the word 'Donna' appears ANYWHERE in the user's sentence.\n- If 'Donna' is not said, output ABSOLUTELY NOTHING. Remain completely silent. Do not explain. Do not apologize.\n- 'Donna' can appear anywhere: start, middle, or end of the sentence.\n- IMPORTANT: If the user says 'Donna approve' or 'Donna reject', this is handled locally. YOU MUST OUTPUT ABSOLUTELY NOTHING. JUST REMAIN SILENT.\n- Once you fulfill a request, go immediately back to sleep.\n\nTool Usage:\nWhen carrying out a request involving creating, modifying, moving, or deleting data, BEFORE you say what you are doing, ask Siya to approve or reject on his screen. You MUST call the tool immediately alongside your voice response. If you are simply navigating or fetching data, execute the tool immediately without asking for approval.", tools: DONNA_TOOLS,
   // 🛡️ ARCHITECT'S FIX: Pass the ignore ref so the hook can prevent loops
   ignoreNextDonnaRef: ignoreNextDonnaRef,
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
        highSignalData += "ACTUAL CURRENT TRELLO DATA (RANKED):\n";
        entries.forEach(([listName, cards]) => {
          highSignalData += `BUCKET: "${listName}"\n`;
          if (Array.isArray(cards) && cards.length > 0) {
            // We give her the top 20 cards so she has full depth
            cards.slice(0, 20).forEach((c, idx) => {
              highSignalData += `  POS_${idx + 1}: "${c.name || c.title}"\n`;
            });
          } else {
            highSignalData += `  (Empty)\n`;
          }
          highSignalData += `\n`;
        });
      } else {
        highSignalData += "TRELLO DATA STATUS: Board currently loading or unavailable.";
      }

      console.log("[Donna Sync Payload]:", highSignalData);

      sendSessionUpdate({ 
        instructions: lastCtxRef.current + `\n\n*** CURRENT TRELLO & SYSTEM DATA ***\n${highSignalData}\n\nMapping: 'Sia Review' = 'Siya - Review', 'Sia' = 'Siya', 'CR Review' = 'Siya - Review'.`,
        turn_detection: { type: "server_vad" }
      });
      
      // We increase the delay to 250ms to ensure OpenAI's server has fully ingested the session update
      setTimeout(() => {
        sendResponseCreate({}); 
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

      // 🚀 ARCHITECT'S PERSISTENCE LOGIC: Declare variable to track action state
      let isActionBubble = false;

      // If a tool was already called OR is already pending, audio MUST play but bubble MUST stay.
      if (responseHasToolCallRef.current || donnaPendingAction) {
        isActionBubble = true;
        responseHasToolCallRef.current = false; 
        clearTimeout(donnaPlayingCooldownRef.current);
        setIsDonnaSpeaking(false);
        donnaPlayingRef.current = false;
        // NOTE: We no longer 'return' here so that TTS can play for the action request.
      }

      const fullText = transcriptionRef.current;
      
     // 🛡️ ARCHITECT'S OMISSION ENFORCER: Harden v50 (CF Priority Update Integration)
      const lowerFull = fullText.toLowerCase();
     // 🛡️ THE FIX: Prevent GChat navigation/archiving from triggering Trello tool rescues
      const isChatContext = lowerFull.includes("chat") || lowerFull.includes("space") || lowerFull.includes("navigat") || lowerFull.includes("message") || lowerFull.includes("inbox");

      const hasRemoveVerb = (lowerFull.includes("remove") || lowerFull.includes("unassign") || lowerFull.includes("take off")) && !isChatContext;
      const hasArchiveVerb = lowerFull.includes("archive") && !isChatContext;
      const hasRestoreVerb = (lowerFull.includes("restore") || lowerFull.includes("put back")) && !isChatContext;
      const hasCommentVerb = lowerFull.includes("comment") || lowerFull.includes("note") || lowerFull.includes("saying");
      // 🚀 ARCHITECT'S CF DETECTION: Detect Priority, Status, or Active status changes
      const hasCFVerb = lowerFull.includes("priority") || lowerFull.includes("status") || lowerFull.includes("set active") || lowerFull.includes("set status");
      // 🏷️ NEW: Label Verb detection
      const hasLabelVerb = lowerFull.includes("label") || lowerFull.includes("tag") || lowerFull.includes("apply");

      // 🛡️ THE FIX: prioritize creation and ensure 'bucket' only moves if not creating
      const hasCreateVerb = lowerFull.includes("create") || lowerFull.includes("add a card") || lowerFull.includes("new card");
      const hasMoveVerb = !hasCreateVerb && !hasRemoveVerb && !hasCommentVerb && !hasCFVerb && !hasLabelVerb && !isChatContext && (lowerFull.includes("move") || lowerFull.includes("bucket") || lowerFull.includes("folder"));

      // 🚀 RESCUE LOGIC: Only trigger if the transcription is NEW and not cleared
      if (fullText && !ignoreNextDonnaRef.current && !isActionBubble && (hasCreateVerb || hasRemoveVerb || hasArchiveVerb || hasRestoreVerb || hasMoveVerb || hasCommentVerb || hasCFVerb || hasLabelVerb)) {
          console.log("[Architect] Tool omission detected. Analyzing verb priority...");
          
          let inferredName = "";

          if (hasCreateVerb) inferredName = "trello_create_case_card"; // 🎯 1. Creation first
          else if (hasRemoveVerb) inferredName = "trello_toggle_member";
          else if (hasCFVerb) inferredName = "trello_set_custom_field"; // 🎯 2. Custom Fields (Priority/Status)
          else if (hasLabelVerb) inferredName = "trello_toggle_label";
          // 🚀 ARCHITECT'S FIX: Member Add detection must happen BEFORE 'folder/bucket' move detection
          else if (lowerFull.includes("add") && (lowerFull.includes("member") || lowerFull.includes("person") || lowerFull.includes("assign"))) inferredName = "trello_toggle_member";
          else if (hasCommentVerb) inferredName = "trello_add_comment";
          else if (hasArchiveVerb) inferredName = "trello_archive_card";
          else if (hasRestoreVerb) inferredName = "trello_restore_card";
          else if (hasMoveVerb) inferredName = "trello_move_card"; // 🎯 Move is now the fallback for bucket/folder mentions

          if (inferredName) {
            isActionBubble = true;
            
            // 🚀 ARCHITECT'S PRECISION SCRAPER
            // 1. First priority: Get exactly what is inside double quotes "Testing"
            const quoteMatch = fullText.match(/"([^"]+)"/);
            // 2. Second priority: Get what is after anchor words but before the bucket/folder mention
            // 🛡️ We strictly exclude "Trello" from being the start of the name
            const anchorMatch = lowerFull.match(/(?:called|named|titled|card)\s+(?!trello\b)([a-z0-9\s_-]+?)(?=\s+in|\s+to|\s+into|\s+bucket|\s+folder|$)/i);
            
            let finalName = "New Task";
            if (quoteMatch) {
              finalName = quoteMatch[1].trim();
            } else if (anchorMatch) {
              finalName = anchorMatch[1].trim();
            }

            console.log(`[Architect] Scraper Result: "${finalName}"`);
            
            setDonnaPendingAction({ 
              name: inferredName, 
              args: { 
                cardName: finalName, 
                caseCardText: finalName // 🎯 Use the exact string for the card title
              }, 
              call_id: "manual_forced_" + Date.now() 
            });
            setDonnaVisible(true);

            if (inferredName === "trello_create_case_card") {
               setDonnaTranscription(`Donna wants to: create a new Trello card called "${finalName}".`);
            }
            if (inferredName === "trello_set_custom_field") {
               setDonnaTranscription("Donna wants to: update a card's priority or status.");
            }
          }
      }

      // Only overwrite if it's NOT an action bubble
      if (!isActionBubble) {
         setDonnaTranscription(fullText);
      }

      // ElevenLabs TTS — play custom Donna voice
      if (fullText) {
        const myGen = ++elGenRef.current; 
        try {
          const res = await fetch("/.netlify/functions/elevenlabs-tts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: fullText }),
          });
          if (elGenRef.current !== myGen) return; 
          if (res.ok) {
            const audioBuffer = await res.arrayBuffer();
            if (elGenRef.current !== myGen) return; 
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
              
              // 🚀 THE FINAL RULE: Persistent for Approve/Reject, Auto-hide for Chat.
              if (!isActionBubble) {
                setDonnaVisible(false);
              }
            };
            
            setDonnaVisible(true);
            setIsDonnaSpeaking(true);
            audio.play().catch(err => {
              console.warn("[Donna] ElevenLabs playback blocked:", err);
              clearTimeout(donnaPlayingCooldownRef.current);
              setIsDonnaSpeaking(false);
              donnaPlayingRef.current = false;
              if (!isActionBubble) setDonnaVisible(false);
            });
            return;
          }
        } catch (e) {
          console.error("[Donna] ElevenLabs TTS error:", e);
        }
      }

      clearTimeout(donnaPlayingCooldownRef.current);
      setIsDonnaSpeaking(false);
      donnaPlayingRef.current = false;

      // Fallback: If no audio/TTS error, still obey the persistence rule
      if (!isActionBubble) {
        setDonnaVisible(false);
      }
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
        name === "trello_get_productivity" ||
        name === "gchat_navigate_view" ||
        name === "gchat_toggle_dropdown" ||
        name === "gchat_start_direct_message"
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
    } else if (name === "gchat_start_direct_message") {
        const email = args.email;
        if (email) {
          console.log(`[Donna] Automatically starting chat with: ${email}`);
          handleStartChat(email);
        }
        if (call_id) sendToolResponse(call_id, { success: true });
        return;
    } else if (name === "gchat_navigate_view") {
          const view = (args.view || "").toLowerCase();
          const isArchive = view === "archive" || view === "archived";
          setShowArchivedChats(isArchive);
          console.log(`[Donna] Navigating GChat to ${isArchive ? "Archive" : "Inbox"}`);
          if (call_id) sendToolResponse(call_id, { success: true, status: `Mapsd to ${isArchive ? "Archive" : "Inbox"} view.` });
          return;
        } else if (name === "gchat_toggle_dropdown") {
          const section = (args.section || "").toLowerCase();
          const expanded = args.expanded !== false;
          
          if (section.includes("message") || section === "dms") {
            setDmsExpanded(expanded);
          } else if (section.includes("space")) {
            setSpacesExpanded(expanded);
          }
          
          console.log(`[Donna] GChat UI: ${expanded ? 'Showing' : 'Hiding'} ${section}`);
          if (call_id) sendToolResponse(call_id, { success: true, status: `${expanded ? 'Opened' : 'Closed'} ${section} dropdown.` });
          return;
        } else if (name === "gmail_get_inbox") {
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
                // 🛡️ NOTIFICATION RESCUE: Search notifications if ID is not in active inbox
                if (!foundMsg && notificationsRef.current) {
                  const nMatch = notificationsRef.current.find(n => String(n.id).trim() === exactId || String(n.id).includes(exactId));
                  if (nMatch) foundMsg = { id: nMatch.id, subject: nMatch.text || nMatch.snippet, from: nMatch.sender || nMatch.title };
                }
              } else {
                const queryText = (args.senderName || args.subject || args.q || transcriptionRef.current || "").toLowerCase().trim();
                console.log(`[Architect] Missing Email ID. Attempting fuzzy match for: "${queryText}"`);
                const ignoreWords = ['move', 'delete', 'trash', 'star', 'unread', 'from', 'email', 'please', 'approve', 'action', 'donna', 'hey', 'will', 'this', 'the', 'summary', 'overview', 'read'];
                const queryWords = queryText.split(/\s+/).filter(w => w.length > 2 && !ignoreWords.includes(w));

                if (queryWords.length > 0) {
                  if (gmailEmails) {
                    foundMsg = gmailEmails.find(m => {
                      const searchStr = `${m.fromName || ""} ${m.from || ""} ${m.subject || ""}`.toLowerCase();
                      return queryWords.some(w => searchStr.includes(w));
                    });
                  }
                  // 🛡️ NOTIFICATION RESCUE: Search notifications if not found in inbox
                  if (!foundMsg && notificationsRef.current) {
                    const nMatch = notificationsRef.current.find(n => {
                      const searchStr = `${n.sender || ""} ${n.title || ""} ${n.text || ""} ${n.snippet || ""}`.toLowerCase();
                      const isGmail = String(n.type || n.app || n.id).toLowerCase().includes("mail");
                      return isGmail && queryWords.some(w => searchStr.includes(w));
                    });
                    if (nMatch) foundMsg = { id: nMatch.id, subject: nMatch.text || nMatch.snippet, from: nMatch.sender || nMatch.title };
                  }
                }
                // Fallback to currently selected/top email if asking for "this email"
                if (!foundMsg && gmailEmails?.length > 0) {
                  foundMsg = gmailEmails[0]; 
                }
              }

       const finalId = foundMsg ? foundMsg.id : exactId;
              const fallbackName = args.senderName || (foundMsg && foundMsg.from ? foundMsg.from.split("<")[0].replace(/"/g, '').trim() : "Unknown");
              
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
              emails: gmailEmails.slice(0, 50).map((e, i) => ({
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

// 🎙️ FRIDAY TASK: GChat History "Read" Logic (Fetch from React State and Background API)
      if (name === "gchat_read_history" || name === "gchat_get_messages") {
        console.log("[Donna] Reading GChat history... Raw Args:", args);
        
        let targetId = args.spaceId || args.space;
        let targetName = args.spaceName || "";

        // Safe Data Access (Prevents Stale Closure)
        const liveSpaces = Array.isArray(gchatSpacesRef.current) ? gchatSpacesRef.current : [];
        const liveSelectedSpace = gchatSelectedSpaceRef_donna.current;
        const liveMessages = Array.isArray(gchatMessagesRef.current) ? gchatMessagesRef.current : [];
        const liveDmNames = gchatDmNamesRef_donna.current || {}; 

        // Architect's AI Rescue: If the AI puts the name in the ID slot
        if (targetId && !String(targetId).includes("spaces/")) {
          targetName = targetId;
          targetId = null;
        }

        // Ultimate Identity Resolver (Prioritizes hardcoded maps if liveSpaces is empty)
        const findSpaceId = (searchQuery) => {
            if (!searchQuery) return null;
            const cleanQuery = String(searchQuery).toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
            const noiseWords = ['read','messages','from','chat','history','get','the','what','last','message','whats','space','with','donna','tell','me'];
            const words = cleanQuery.split(/\s+/).filter(w => w.length > 2 && !noiseWords.includes(w));

            if (words.length === 0 && cleanQuery.length < 2) return null;

            const isMatch = (rawName) => {
                if (!rawName) return false;
                const n = String(rawName).toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
                if (n.length < 2 || n === "direct message") return false; 
                if (n === cleanQuery || n.includes(cleanQuery) || cleanQuery.includes(n)) return true;
                if (words.length > 0 && words.some(w => n.includes(w))) return true;
                return false;
            };

            // Pass 1: Strict Check of Hardcoded Map (Most Reliable)
            for (const [key, val] of Object.entries(GCHAT_ID_MAP || {})) {
                if (String(key).includes("spaces/") && (isMatch(val) || isMatch(key))) return { id: key, name: val };
            }

            // Pass 2: Check live spaces
            for (const s of liveSpaces) {
                const sid = s.id || s.name;
                const namesToTest = [GCHAT_ID_MAP[s.displayName], GCHAT_ID_MAP[sid], liveDmNames[sid], s.displayName].filter(Boolean);
                for (const nameToTest of namesToTest) {
                    if (isMatch(nameToTest)) return { id: sid, name: nameToTest };
                }
            }

            // Pass 3: Direct Sweep of Memory Banks
            for (const [key, val] of Object.entries(liveDmNames)) {
                if (isMatch(val) || isMatch(key)) return { id: key, name: val };
            }

            return null;
        };

        // 1. Resolve from AI arguments
        if (!targetId && targetName) {
          const match = findSpaceId(targetName);
          if (match) { targetId = match.id; targetName = match.name; }
        }

        // 2. Resolve from Voice Transcript
        if (!targetId && (transcriptionRef.current || donnaTranscription)) {
            const match = findSpaceId(transcriptionRef.current || donnaTranscription);
            if (match) { targetId = match.id; targetName = match.name; }
        }

        // 3. Fallback to active space
        if (!targetId && liveSelectedSpace) {
          targetId = liveSelectedSpace.id || liveSelectedSpace.name;
          targetName = GCHAT_ID_MAP[liveSelectedSpace.displayName] || GCHAT_ID_MAP[targetId] || liveDmNames[targetId] || liveSelectedSpace.displayName;
        }

        if (!targetId) {
          console.error("[Donna] Could not resolve space ID for:", targetName);
          if (call_id) {
             sendToolResponse(call_id, { success: true, history: "ERROR: Chat not found.", directive: `Tell Siya you could not find the chat for ${targetName || 'that person'}.` });
             sendResponseCreate({});
          }
          return;
        }

        console.log(`[Donna] Resolved Space: ID=${targetId}, Name="${targetName}"`);

        const processAndSendHistory = (rawMsgs) => {
          const msgs = Array.isArray(rawMsgs) ? rawMsgs : [];
          
          if (msgs.length === 0) {
            console.log(`[Donna] No messages found for ${targetName}`);
            if (call_id) {
              sendToolResponse(call_id, { success: true, history: "EMPTY", directive: `Tell Siya the chat with ${targetName} is currently empty.` });
              sendResponseCreate({});
            }
            return;
          }

          const lastMsg = msgs[msgs.length - 1];
          const senderRaw = lastMsg.sender?.displayName || lastMsg.sender?.name || "Someone";
          const resolvedSender = GCHAT_ID_MAP[senderRaw] || GCHAT_ID_MAP[lastMsg.sender?.name] || liveDmNames[lastMsg.sender?.name] || senderRaw;
          let cleanText = lastMsg.text || "[Media/Attachment]";
          cleanText = cleanText.replace(/<[^>]*>?/gm, ''); // Strip HTML tags
          
          const cleanSenderName = resolvedSender.split("<")[0].trim();
          const cleanTargetName = (targetName || "them").split("<")[0].trim();

          const finalSpeech = `The last message from ${cleanTargetName} was from ${cleanSenderName}, who said: "${cleanText}"`;
          console.log(`[Donna] Last message payload: ${finalSpeech}`);

          if (call_id) {
            sendToolResponse(call_id, { 
              success: true, 
              lastMessage: finalSpeech,
              directive: `Read this EXACT phrase aloud to Siya naturally: "${finalSpeech}". Do not add extra fluff.`
            });
            sendResponseCreate({});
          }
        };

        // 4. Check if we already have it in state (Active Chat)
        if (liveSelectedSpace && (liveSelectedSpace.id === targetId || liveSelectedSpace.name === targetId)) {
          console.log("[Donna] Using live active chat state.");
          processAndSendHistory(liveMessages);
          return;
        }

        // 5. Fetch from backend for background chats
        console.log(`[Donna] Fetching from API: /.netlify/functions/gchat-messages?spaceId=${targetId}`);
        // 🚀 THE FIX: Send both 'space' and 'spaceId' parameters to the backend
        fetch(`/.netlify/functions/gchat-messages?spaceId=${encodeURIComponent(targetId)}&space=${encodeURIComponent(targetId)}`, { credentials: "include" })
          .then(res => res.json())
          .then(data => {
            const msgs = Array.isArray(data) ? data : (data.messages || []);
            processAndSendHistory(msgs);
          })
          .catch(err => {
            console.error("[Donna] API Fetch failed:", err);
            if (call_id) {
              sendToolResponse(call_id, { success: true, history: "ERROR: Network failure.", directive: `Tell Siya there was a network error trying to read the chat with ${targetName}.`});
              sendResponseCreate({});
            }
          });

        return;
      }
// 4. All other "Write" tools require approval
      let finalArgs = { ...args };

// 🎙️ FRIDAY TASK: GChat Sending Logic (Resolves space and triggers approval)
      if (name === "send_gchat_message" || name === "gchat_delete_space" || name === "gchat_archive_space" || name === "gchat_unarchive_space") {
        console.log(`[Donna] Resolving GChat space for ${name}...`);
        
        let targetId = args.spaceId || args.space;
        let targetName = args.spaceName || "";

        const liveSpaces = Array.isArray(gchatSpacesRef.current) ? gchatSpacesRef.current : [];
        const liveSelectedSpace = gchatSelectedSpaceRef_donna.current;
        const liveDmNames = gchatDmNamesRef_donna.current || {};

        const findSpaceId = (searchQuery) => {
            if (!searchQuery) return null;
            const cleanQuery = String(searchQuery).toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
            const noiseWords = ['read','messages','from','chat','history','get','the','what','last','message','whats','space','with','donna','tell','me','send','to','delete','remove'];
            const words = cleanQuery.split(/\s+/).filter(w => w.length > 2 && !noiseWords.includes(w));
            if (words.length === 0 && cleanQuery.length < 2) return null;
            const isMatch = (rawName) => {
                if (!rawName) return false;
                const n = String(rawName).toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
                if (n.length < 2 || n === "direct message") return false;
                if (n === cleanQuery || n.includes(cleanQuery) || cleanQuery.includes(n)) return true;
                if (words.length > 0 && words.some(w => n.includes(w))) return true;
                return false;
            };
            for (const [key, val] of Object.entries(GCHAT_ID_MAP || {})) {
                if (String(key).includes("spaces/") && (isMatch(val) || isMatch(key))) return { id: key, name: val };
            }
            for (const s of liveSpaces) {
                const sid = s.id || s.name;
                const namesToTest = [GCHAT_ID_MAP[s.displayName], GCHAT_ID_MAP[sid], liveDmNames[sid], s.displayName].filter(Boolean);
                for (const nameToTest of namesToTest) {
                    if (isMatch(nameToTest)) return { id: sid, name: nameToTest };
                }
            }
            return null;
        };

        if (!targetId && targetName) {
          const match = findSpaceId(targetName);
          if (match) { targetId = match.id; targetName = match.name; }
        }

        if (!targetId && (transcriptionRef.current || donnaTranscription)) {
          const match = findSpaceId(transcriptionRef.current || donnaTranscription);
          if (match) { targetId = match.id; targetName = match.name; }
        }

        if (!targetId && liveSelectedSpace) {
          targetId = liveSelectedSpace.id || liveSelectedSpace.name;
          targetName = GCHAT_ID_MAP[liveSelectedSpace.displayName] || GCHAT_ID_MAP[targetId] || liveDmNames[targetId] || liveSelectedSpace.displayName;
        }

        if (!targetId) {
          console.error(`[Donna] Could not resolve space for ${name}.`);
          if (call_id) sendToolResponse(call_id, { success: false, error: "Space not found." });
          return;
        }

        finalArgs.spaceId = targetId;
        finalArgs.spaceName = targetName;
        // No return here — it will fall through to trigger the approval UI
      }

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
    
// 🚀 ARCHITECT'S NUCLEAR SILENCE:
    // 1. Stop the ElevenLabs playback
    elGenRef.current += 1;
    if (donnaElAudioRef.current) { donnaElAudioRef.current.pause(); donnaElAudioRef.current = null; }
    
    // 2. Stop the OpenAI server response immediately
    try {
      cancelResponse(); 
    } catch (e) {
      // Silence "no active response" errors to prevent them from showing in the bubble
      console.warn("[Donna] Silent cancellation:", e.message);
    }
    
    // 🚀 THE FIX: Use a tiny delay to ensure the "Cancel" event processes 
    // before the Tool Response is sent to the Data Channel. 
    // and clear the error state before we send the Tool Output.
    setTimeout(() => {
      setDonnaPendingAction({ name, args: finalArgs, call_id });
    }, 150);
      
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
      } else if (name === "trello_toggle_member") {
        const isRemoving = (transcriptionRef.current || "").toLowerCase().includes("remove") || (transcriptionRef.current || "").toLowerCase().includes("unassign");
        setDonnaTranscription(`Donna wants to: ${isRemoving ? 'remove' : 'add'} a member ${isRemoving ? 'from' : 'to'} the Trello card.`);
        return; // 👈 CRITICAL: Stop auto-execution and wait for Approval
} else if (name === "gchat_mute_space") {
        let targetId = args.spaceId;
        let targetName = args.spaceName || "";

        const liveSpaces = Array.isArray(gchatSpacesRef.current) ? gchatSpacesRef.current : [];
        const liveSelectedSpace = gchatSelectedSpaceRef_donna.current;
        const liveDmNames = gchatDmNamesRef_donna.current || {};

        if (!targetId && targetName) {
          const cleanQuery = targetName.toLowerCase().trim();
          const match = liveSpaces.find(s => {
            const sid = s.id || s.name;
            const nameToTest = (GCHAT_ID_MAP[sid] || liveDmNames[sid] || s.displayName || "").toLowerCase();
            return nameToTest.includes(cleanQuery);
          });
          if (match) {
            targetId = match.id || match.name;
            targetName = GCHAT_ID_MAP[targetId] || liveDmNames[targetId] || match.displayName;
          }
        }

        if (!targetId && liveSelectedSpace) {
          targetId = liveSelectedSpace.id || liveSelectedSpace.name;
          targetName = GCHAT_ID_MAP[targetId] || liveDmNames[targetId] || liveSelectedSpace.displayName;
        }

        const isMuting = args.mute !== false;
        const displayLabel = targetName ? ` the "${targetName.split("<")[0].trim()}" chat` : " this chat";
        setDonnaTranscription(`Donna wants to: ${isMuting ? 'mute' : 'unmute'}${displayLabel}.`);
        
        finalArgs.spaceId = targetId; 
        return; // 👈 Approval required for Mute/Unmute toggle
} else if (name === "gchat_delete_space") {
        setDonnaTranscription(`Donna wants to: delete a GChat space.`);
        return; // 👈 Approval required for Chat Deletion
} else if (name === "gchat_archive_space") {
        setDonnaTranscription(`Donna wants to: archive a GChat space.`);
        return; // 👈 Approval required for Chat Archiving
  } else if (name === "gchat_unarchive_space") {
        setDonnaTranscription(`Donna wants to: unarchive a GChat space.`);
        return; // 👈 Approval required for Chat Unarchiving
} else if (name === "send_gchat_message") {
        const chatName = finalArgs.spaceName ? finalArgs.spaceName.split("<")[0].trim() : "this chat";
        setDonnaTranscription(`Donna wants to send a message to ${chatName}.`);
  } else if (name === "gchat_mark_unread") {
        let targetId = args.spaceId;
        let targetName = args.spaceName || "";

        // 🛡️ ARCHITECT'S RESOLVER: Find the real name for the bubble
        const liveSpaces = Array.isArray(gchatSpacesRef.current) ? gchatSpacesRef.current : [];
        const liveSelectedSpace = gchatSelectedSpaceRef_donna.current;
        const liveDmNames = gchatDmNamesRef_donna.current || {};

        if (!targetId && targetName) {
          const cleanQuery = targetName.toLowerCase().trim();
          const match = liveSpaces.find(s => {
            const sid = s.id || s.name;
            const nameToTest = (GCHAT_ID_MAP[sid] || liveDmNames[sid] || s.displayName || "").toLowerCase();
            return nameToTest.includes(cleanQuery);
          });
          if (match) {
            targetId = match.id || match.name;
            targetName = GCHAT_ID_MAP[targetId] || liveDmNames[targetId] || match.displayName;
          }
        }

        // Fallback to active space if no specific name provided
        if (!targetId && liveSelectedSpace) {
          targetId = liveSelectedSpace.id || liveSelectedSpace.name;
          targetName = GCHAT_ID_MAP[targetId] || liveDmNames[targetId] || liveSelectedSpace.displayName;
        }

        const displayLabel = targetName ? ` the "${targetName.split("<")[0].trim()}" chat` : " this chat";
        setDonnaTranscription(`Donna wants to: mark${displayLabel} as unread.`);
        
        // 🚀 Sync the resolved ID into the pending action so the "Approve" button knows where to go
        finalArgs.spaceId = targetId; 
        return;
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
    onError: (msg) => {
      if (msg.includes("Cancellation failed")) return; // 🛡️ Hide technical API race conditions
      setDonnaTranscription(`Error: ${msg}`);
    },
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

const onGchatNotify = (e) => {
      const data = e.detail;
      setNotifications(prev => {
        // 🚀 ARCHITECT'S DUPLICATE SHIELD: Prevent same message-timestamp from double-appearing
        if (prev.some(n => n.id === data.id)) return prev;
        return [data, ...prev];
      });
    };

    window.addEventListener("systemReportError", onReport);
    window.addEventListener("systemClearError", onClear);
    window.addEventListener("simulateDonna", onSimulate);
    window.addEventListener("gchatNotification", onGchatNotify);

    return () => { 
      window.removeEventListener("systemReportError", onReport); 
      window.removeEventListener("systemClearError", onClear); 
      window.removeEventListener("simulateDonna", onSimulate);
      window.removeEventListener("gchatNotification", onGchatNotify);
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
    // 🚀 ARCHITECT'S STALE DATA FLUSH: 
    // Immediately invalidate the transcript so the "Rescue Logic" can't see it
    const currentTranscript = transcriptionRef.current;
    transcriptionRef.current = ""; 
    setDonnaTranscription("");

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
      
      // 🛡️ ARCHITECT'S FALLBACK PRIORITY: Harden v47 (Mutual Exclusion)
      
      // 🚀 PRIORITY 1: Explicit Creation
      if (trans.includes("create") || trans.includes("new card") || trans.includes("add a card")) {
          actionName = "trello_create_case_card";
          console.log("[Architect] Intent Locked: Creation");
      }
      // 🚀 PRIORITY 2: Custom Field Update (Priority/Status)
      else if (trans.includes("priority") || trans.includes("urgent") || trans.includes("status") || trans.includes("set active") || trans.includes("set status")) {
        actionName = "trello_set_custom_field";
        console.log("[Architect] Intent Locked: Custom Field Update");
      }
      // 🎯 PRIORITY 3: Member Addition/Removal (Harden v55 - Move Jonathan logic up)
      else if (
        trans.includes("member") || trans.includes("assign") || trans.includes("add jonathan") || 
        trans.includes("add ruan") || trans.includes("remove") || trans.includes("unassign")
      ) {
          actionName = "trello_toggle_member";
          console.log("[Architect] Intent Locked: Member Action");
      }
    // 🚀 PRIORITY 4: Archive / Restore
      else if ((trans.includes("unarchive") || trans.includes("restore")) && (trans.includes("chat") || trans.includes("space"))) {
        actionName = "gchat_unarchive_space";
      }
      else if (trans.includes("archive") && (trans.includes("chat") || trans.includes("space"))) {
        actionName = "gchat_archive_space";
      }
      else if (trans.includes("archive")) {
        actionName = "trello_archive_card";
      } 
      else if (trans.includes("restore") || trans.includes("put back") || trans.includes("unarchive")) {
        actionName = "trello_restore_card";
      }
      // ⏲️ PRIORITY 5: Timer Controls
      else if (trans.includes("timer") || trans.includes("clock") || trans.includes("stopwatch") || trans.includes("start the")) {
        actionName = "trello_timer_action";
      }
   // 🎯 PRIORITY 6: Member Addition (Add Jonathan, Assign Ruan)
      else if (!/\b(message|chat|send)\b/i.test(trans) && (/\b(member|assign|put|add|on to)\b/i.test(trans) || 
                /\b(albert|alicia|asanda|bianca|bonisa|bonolo|cameron|cara|chloe|conah|cynthia|dionee|enock|ethan|eugene|faith|jennifer|joel|jonathan|kwakhanya|leonah|martin|mathapelo|matthew|melokuhle|melvin|michelle|mine|munyaradzi|ofentse|palesa|refiloe|robyn|ruan|ryan|shamiso|sharon|simone|siya|siyolise|songeziwe|suemari|thami|tiffany|tinashe|treasure|uvesh|waldo|willem|yolandie|yael)\b/i.test(trans))) {
        actionName = "trello_toggle_member";
      }
      // 🚀 PRIORITY 7: General Movement (The catch-all)
      // 🛡️ THE FIX: Only trigger "move" if "remove" was NOT said.
      else if (!trans.includes("remove") && !trans.includes("unassign") && (trans.includes("move") || trans.includes("bucket") || trans.includes("folder") || trans.includes("trello"))) {
        actionName = "trello_move_card";
        console.log("[Architect] Intent Locked: General Movement");
      }
      
      // If we recovered a Trello intent, try to grab the card name (Harden v21)
      if (actionName && actionName.startsWith("trello_")) {
        const trans = rawVoice.toLowerCase().trim();
        
        // 🚀 STRATEGY 1: Double Quote Lock (Highest Priority - handles "testing")
        const doubleQuoteMatch = trans.match(/"([^"]{2,})"/);
        
        // 🚀 STRATEGY 2: Single Quote Lock (Ignoring contractions like i'll)
        // Matches 'word' but not i'll (checks for word boundary or space before quote)
        const singleQuoteMatch = trans.match(/(?:\s|^)'([^']{2,})'/);
        
        // 🚀 STRATEGY 3: The Anchor Search
        const anchorMatch = trans.match(/(?:called|named|titled|card)\s+([a-z0-9\s_-]{2,20})(?:\s+(?:in|to|into|from|folder|bucket|at)|$)/i);

        if (doubleQuoteMatch) {
            actionArgs.cardName = doubleQuoteMatch[1].trim();
            console.log(`[Architect] Card Name Scraped via Double Quote: "${actionArgs.cardName}"`);
        } else if (singleQuoteMatch) {
            actionArgs.cardName = singleQuoteMatch[1].trim();
            console.log(`[Architect] Card Name Scraped via Single Quote: "${actionArgs.cardName}"`);
        } else if (anchorMatch) {
            actionArgs.cardName = anchorMatch[1].trim();
            console.log(`[Architect] Card Name Scraped via Anchor: "${actionArgs.cardName}"`);
        }
        
        // Safety Fallback
        if (!actionArgs.cardName || actionArgs.cardName === "the" || actionArgs.cardName.length < 2) {
            actionArgs.cardName = "New Task";
        }
      }
// 2. Gmail / Draft Fallbacks
      else if (trans.includes("draft") || trans.includes("prepared")) {
        actionName = "gmail_save_draft";
      } else if (trans.includes("unread")) {
       actionName = "gmail_mark_unread";
      } else if (trans.includes("delete chat") || trans.includes("delete space") || trans.includes("delete this chat")) {
        actionName = "gchat_delete_space";
      } else if (trans.includes("archive chat") || trans.includes("archive space") || trans.includes("archive this chat")) {
        actionName = "gchat_archive_space";
      } else if (trans.includes("delete") || trans.includes("bin")) {
        actionName = "gmail_delete_bulk";
      } else if (trans.includes("star")) {
        actionName = "gmail_toggle_star";
      // 🚀 ARCHITECT'S PRIORITY FIX: Check for Custom Fields (Urgent/Priority) BEFORE Members
      } else if (trans.includes("priority") || trans.includes("urgent") || trans.includes("status") || trans.includes("set active")) {
        actionName = "trello_set_custom_field";
      } else if (trans.includes("member") || trans.includes("add person") || trans.includes("assign")) {
        actionName = "trello_toggle_member";
      } else if (trans.includes("comment") || trans.includes("note") || trans.includes("saying")) {
        actionName = "trello_add_comment";
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
    if (actionName && actionName.startsWith("trello_")) {
        const trans = (donnaTranscription || "").toLowerCase();

        // 🚀 THE CREATE GUARD: Stop the resolver from finding "Testing" when you say "Test"
        const isCreateAction = actionName === "trello_create_case_card" || actionName === "trello_add_simple_card";

        const bucketsArray = Array.isArray(trelloBuckets) ? trelloBuckets : [];
        
        // 🚀 THE BLACKLIST: Total exclusion of OOO cards from the search pool
        const allCards = bucketsArray.flatMap(b => b.cards || []).filter(c => {
          const n = (c.name || "").toLowerCase();
          return !n.includes("away from cases") && !n.includes("out of office");
        });

        // 🚀 DOUBLE PROMPT KILLER: Prevents the "Rescue" bubble if Donna already called a tool
        if (callId?.startsWith("manual_forced_") && responseHasToolCallRef.current) {
           console.log("[Architect] Duplicate prompt prevented. Real tool call took precedence.");
           return;
        }

        // 🎯 SYNC CARD NAME: If Donna provided an ID but no Name, find the name now so the snackbar isn't "Undefined"
        if (actionArgs.cardId && !actionArgs.cardName) {
           const match = allCards.find(c => c.id === actionArgs.cardId);
           if (match) actionArgs.cardName = match.name || match.title;
        }

        if (!actionArgs.cardId) {
          const nameToSearch = (actionArgs.cardName || "").toLowerCase().replace(/['"\[\]]/g, "").trim();
          
           // STAGE 1: Exact or Direct Keyword Match
           let found = allCards.find(c => {
             const cn = (c.name || c.title || "").toLowerCase();
              // If user said "testing card" and card is named "testing", match it immediately
             return cn === nameToSearch || (nameToSearch.includes("testing") && cn === "testing");
           });

           // STAGE 2: Keyword "testing" priority match
           if (!found && nameToSearch.includes("testing")) {
              found = allCards.find(c => (c.name || "").toLowerCase().includes("testing"));
           }

           // STAGE 3: Partial Match
           if (!found) {
             found = allCards.find(c => {
               const cn = (c.name || c.title || "").toLowerCase();
               return cn.includes(nameToSearch) || nameToSearch.includes(cn);
             });
           }

          // STAGE 4: Architect's Hardened Fuzzy Match
           if (!found) {
             console.log(`[Architect] Stage 1-3 failed. Running Fuzzy Density Match...`);
             
             const noiseWords = ['move', 'the', 'card', 'called', 'named', 'titled', 'trello', 'bucket', 'from', 'to', 'please', 'donna', 'hey', 'approve', 'reject', 'restore', 'priority', 'urgent', 'status'];
             const queryWords = trans.split(/\s+/)
               .map(w => w.toLowerCase().trim())
               .filter(w => w.length > 1 && !noiseWords.includes(w));

             if (queryWords.length > 0) {
              // 🚀 THE FIX: We map only cards that pass the OOO blacklist again
              const scoredCards = allCards.filter(c => {
                 const n = (c.name || "").toLowerCase();
                 return !n.includes("away from cases") && !n.includes("out of office");
              }).map(c => {
                const cardNameLow = (c.name || c.title || "").toLowerCase();
                let score = 0;
                queryWords.forEach(word => {
                  if (cardNameLow.includes(word)) score++;
                });
                return { card: c, score };
              });

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
             actionArgs.cardName = found.name || found.title; // 🎯 Ensure the name is saved to Args for the Snackbar
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
        
        // 🚀 ARCHITECT'S CLEAN NAME PROTOCOL: 
        // We take the input and ensure it is treated as a literal string.
        const rawCardText = actionArgs.cardName || actionArgs.caseCardText || actionArgs.name || "New Task";
        
        // 🎯 THE FIX: Explicitly trim and strip parentheses. 
        // Ensure this variable 'cardText' is what is sent to the backend to avoid remapping.
        const cardText = String(rawCardText).split('(')[0].replace(/["']/g, "").trim();
        
        console.log(`[Architect] Finalizing card name as literal: "${cardText}"`);

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
            caseCardText: cardText, // 🎯 This now carries "testing"
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

case 'gchat_unarchive_space': {
        console.log("[Donna] Executing GChat Unarchive tool...");
        let targetId = actionArgs.spaceId;
        let targetName = actionArgs.spaceName || "";

        const liveSpaces = Array.isArray(gchatSpacesRef.current) ? gchatSpacesRef.current : [];
        const liveSelectedSpace = gchatSelectedSpaceRef_donna.current;
        const liveDmNames = gchatDmNamesRef_donna.current || {};

        if (targetId && !String(targetId).includes("spaces/")) {
          targetName = targetId;
          targetId = null;
        }

        const findSpaceId = (searchQuery) => {
            if (!searchQuery) return null;
            const cleanQuery = String(searchQuery).toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
            const noiseWords = ['unarchive','restore','chat','from','space','with','donna','tell','me'];
            const words = cleanQuery.split(/\s+/).filter(w => w.length > 2 && !noiseWords.includes(w));
            if (words.length === 0 && cleanQuery.length < 2) return null;

            const isMatch = (rawName) => {
                if (!rawName) return false;
                const n = String(rawName).toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
                if (n.length < 2 || n === "direct message") return false;
                if (n === cleanQuery || n.includes(cleanQuery) || cleanQuery.includes(n)) return true;
                if (words.length > 0 && words.some(w => n.includes(w))) return true;
                return false;
            };
            for (const [key, val] of Object.entries(GCHAT_ID_MAP || {})) {
                if (String(key).includes("spaces/") && (isMatch(val) || isMatch(key))) return { id: key, name: val };
                if (String(val).includes("spaces/") && (isMatch(val) || isMatch(key))) return { id: val, name: key };
            }
            for (const [key, val] of Object.entries(liveDmNames)) {
                if (isMatch(val) || isMatch(key)) return { id: String(key).includes("spaces/") ? key : val, name: String(key).includes("spaces/") ? val : key };
            }
            for (const s of liveSpaces) {
                const sid = s.id || s.name;
                const namesToTest = [GCHAT_ID_MAP[s.displayName], GCHAT_ID_MAP[sid], liveDmNames[sid], s.displayName].filter(Boolean);
                for (const nameToTest of namesToTest) {
                    if (isMatch(nameToTest)) return { id: sid, name: nameToTest };
                }
            }
            return null;
        };

        if (!targetId && targetName) {
          const match = findSpaceId(targetName);
          if (match) { targetId = match.id; targetName = match.name; }
        }

        if (!targetId && (transcriptionRef.current || donnaTranscription)) {
          const match = findSpaceId(transcriptionRef.current || donnaTranscription);
          if (match) { targetId = match.id; targetName = match.name; }
        }

        if (!targetId && liveSelectedSpace) {
          targetId = liveSelectedSpace.id || liveSelectedSpace.name;
        }

        if (!targetId) {
          triggerSnackbar("Could not identify which chat to unarchive.");
          if (callId) sendToolResponse(callId, { success: false, error: "No active space found." });
          break;
        }

        // Local Unarchiving Logic
        setArchivedGchatSpaces(prev => {
          const next = prev.filter(id => id !== targetId);
          localStorage.setItem("GCHAT_ARCHIVED", JSON.stringify(next));
          return next;
        });

        triggerSnackbar(`Chat unarchived.`);
        if (callId) sendToolResponse(callId, { success: true });
        break;
      }

case 'gchat_archive_space': {
        console.log("[Donna] Executing GChat Archive tool...");
        let targetId = actionArgs.spaceId;
        let targetName = actionArgs.spaceName || "";

        const liveSpaces = Array.isArray(gchatSpacesRef.current) ? gchatSpacesRef.current : [];
        const liveSelectedSpace = gchatSelectedSpaceRef_donna.current;
        const liveDmNames = gchatDmNamesRef_donna.current || {};

        if (targetId && !String(targetId).includes("spaces/")) {
          targetName = targetId;
          targetId = null;
        }

        const findSpaceId = (searchQuery) => {
            if (!searchQuery) return null;
            const cleanQuery = String(searchQuery).toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
            const noiseWords = ['archive','remove','chat','from','space','with','donna','tell','me'];
            const words = cleanQuery.split(/\s+/).filter(w => w.length > 2 && !noiseWords.includes(w));
            if (words.length === 0 && cleanQuery.length < 2) return null;

            const isMatch = (rawName) => {
                if (!rawName) return false;
                const n = String(rawName).toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
                if (n.length < 2 || n === "direct message") return false;
                if (n === cleanQuery || n.includes(cleanQuery) || cleanQuery.includes(n)) return true;
                if (words.length > 0 && words.some(w => n.includes(w))) return true;
                return false;
            };
            for (const [key, val] of Object.entries(GCHAT_ID_MAP || {})) {
                if (String(key).includes("spaces/") && (isMatch(val) || isMatch(key))) return { id: key, name: val };
                if (String(val).includes("spaces/") && (isMatch(val) || isMatch(key))) return { id: val, name: key };
            }
            for (const [key, val] of Object.entries(liveDmNames)) {
                if (isMatch(val) || isMatch(key)) return { id: String(key).includes("spaces/") ? key : val, name: String(key).includes("spaces/") ? val : key };
            }
            for (const s of liveSpaces) {
                const sid = s.id || s.name;
                const namesToTest = [GCHAT_ID_MAP[s.displayName], GCHAT_ID_MAP[sid], liveDmNames[sid], s.displayName].filter(Boolean);
                for (const nameToTest of namesToTest) {
                    if (isMatch(nameToTest)) return { id: sid, name: nameToTest };
                }
            }
            return null;
        };

        if (!targetId && targetName) {
          const match = findSpaceId(targetName);
          if (match) { targetId = match.id; targetName = match.name; }
        }

        if (!targetId && (transcriptionRef.current || donnaTranscription)) {
          const match = findSpaceId(transcriptionRef.current || donnaTranscription);
          if (match) { targetId = match.id; targetName = match.name; }
        }

        if (!targetId && liveSelectedSpace) {
          targetId = liveSelectedSpace.id || liveSelectedSpace.name;
        }

        if (!targetId) {
          triggerSnackbar("Could not identify which chat to archive.");
          if (callId) sendToolResponse(callId, { success: false, error: "No active space found." });
          break;
        }

        // Local Archiving Logic
        setArchivedGchatSpaces(prev => {
          const next = [...new Set([...prev, targetId])];
          localStorage.setItem("GCHAT_ARCHIVED", JSON.stringify(next));
          return next;
        });

        if (gchatSelectedSpace?.id === targetId || gchatSelectedSpace?.name === targetId) {
          setGchatSelectedSpace(null);
          setGchatMessages([]);
        }

        triggerSnackbar(`Chat archived.`);
        if (callId) sendToolResponse(callId, { success: true });
        break;
      }

case 'gchat_delete_space': {
        console.log("[Donna] Executing GChat Delete tool...");
        let targetId = actionArgs.spaceId;
        let targetName = actionArgs.spaceName || "";

        const liveSpaces = Array.isArray(gchatSpacesRef.current) ? gchatSpacesRef.current : [];
        const liveSelectedSpace = gchatSelectedSpaceRef_donna.current;
        const liveDmNames = gchatDmNamesRef_donna.current || {};

        if (targetId && !String(targetId).includes("spaces/")) {
          targetName = targetId;
          targetId = null;
        }

        const findSpaceId = (searchQuery) => {
            if (!searchQuery) return null;
            const cleanQuery = String(searchQuery).toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
            const noiseWords = ['delete','remove','chat','from','space','with','donna','tell','me'];
            const words = cleanQuery.split(/\s+/).filter(w => w.length > 2 && !noiseWords.includes(w));
            if (words.length === 0 && cleanQuery.length < 2) return null;

            const isMatch = (rawName) => {
                if (!rawName) return false;
                const n = String(rawName).toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
                if (n.length < 2 || n === "direct message") return false;
                if (n === cleanQuery || n.includes(cleanQuery) || cleanQuery.includes(n)) return true;
                if (words.length > 0 && words.some(w => n.includes(w))) return true;
                return false;
            };
            for (const [key, val] of Object.entries(GCHAT_ID_MAP || {})) {
                if (String(key).includes("spaces/") && (isMatch(val) || isMatch(key))) return { id: key, name: val };
                if (String(val).includes("spaces/") && (isMatch(val) || isMatch(key))) return { id: val, name: key };
            }
            for (const [key, val] of Object.entries(liveDmNames)) {
                if (isMatch(val) || isMatch(key)) return { id: String(key).includes("spaces/") ? key : val, name: String(key).includes("spaces/") ? val : key };
            }
            for (const s of liveSpaces) {
                const sid = s.id || s.name;
                const namesToTest = [GCHAT_ID_MAP[s.displayName], GCHAT_ID_MAP[sid], liveDmNames[sid], s.displayName].filter(Boolean);
                for (const nameToTest of namesToTest) {
                    if (isMatch(nameToTest)) return { id: sid, name: nameToTest };
                }
            }
            return null;
        };

        if (!targetId && targetName) {
          const match = findSpaceId(targetName);
          if (match) { targetId = match.id; targetName = match.name; }
        }

        if (!targetId && (transcriptionRef.current || donnaTranscription)) {
          const match = findSpaceId(transcriptionRef.current || donnaTranscription);
          if (match) { targetId = match.id; targetName = match.name; }
        }

        if (!targetId && liveSelectedSpace) {
          targetId = liveSelectedSpace.id || liveSelectedSpace.name;
        }

        if (!targetId) {
          triggerSnackbar("Could not identify which chat to delete.");
          if (callId) sendToolResponse(callId, { success: false, error: "No active space found." });
          break;
        }

        confirmDeleteChat({ id: targetId, type: targetId.includes("users/") ? "DIRECT_MESSAGE" : "SPACE" });
        if (callId) sendToolResponse(callId, { success: true });
        break;
      }

case 'gchat_mute_space': {
        console.log("[Donna] Executing GChat Mute tool...");
        
        let spaceId = actionArgs.spaceId;
        let targetName = actionArgs.spaceName || "";

        if (!spaceId && targetName) {
          const cleanQuery = targetName.toLowerCase().trim();
          const liveSpaces = Array.isArray(gchatSpacesRef.current) ? gchatSpacesRef.current : [];
          const liveDmNames = gchatDmNamesRef_donna.current || {};
          const match = liveSpaces.find(s => {
            const sid = s.id || s.name;
            const nameToTest = (GCHAT_ID_MAP[sid] || liveDmNames[sid] || s.displayName || "").toLowerCase();
            return nameToTest.includes(cleanQuery);
          });
          if (match) spaceId = match.id || match.name;
        }

        if (!spaceId) spaceId = gchatSelectedSpaceRef_donna.current?.id;
        
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
      
    case 'gchat_mark_unread': {
        const spaceId = actionArgs.spaceId || gchatSelectedSpaceRef_donna.current?.id;
        if (!spaceId) {
          triggerSnackbar("Failed to identify chat.");
          if (callId) sendToolResponse(callId, { success: false, error: "Space not found" });
          break;
        }

        const resetTime = new Date(0).toISOString();
        
        // 🚀 THE FIX: Use functional update to ensure LocalStorage syncs correctly without stale data
        setGchatSpaceTimes(prev => {
          const next = { ...prev, [spaceId]: resetTime };
          localStorage.setItem("GCHAT_SPACE_TIMES", JSON.stringify(next));
          return next;
        });
        
        setUnreadGchatSpaces(prev => {
          const next = { ...prev, [spaceId]: new Date().toISOString() };
          localStorage.setItem("GCHAT_UNREAD_SPACES", JSON.stringify(next));
          return next;
        });

        triggerSnackbar("Chat marked as unread.");
        
        if (callId) {
          // 🚀 THE FIX: Force the directive so Donna confirms the CORRECT action
          sendToolResponse(callId, { 
            success: true,
            directive: "Tell Siya: 'Done. I've marked that chat as unread for you.' Do NOT mention Trello or restoring cards."
          });
        }
        break;
      }

  case 'gchat_get_messages':
      case 'gchat_read_history': {
        console.log("[Donna] Reading GChat history... Args:", actionArgs);
        
        let targetId = actionArgs.spaceId;
        let targetName = actionArgs.spaceName || "";

        // Safe Data Access
        const liveSpaces = Array.isArray(gchatSpacesRef.current) ? gchatSpacesRef.current : [];
        const liveSelectedSpace = gchatSelectedSpaceRef_donna.current;
        const liveMessages = Array.isArray(gchatMessagesRef.current) ? gchatMessagesRef.current : [];
        const liveDmNames = gchatDmNamesRef_donna.current || {};

        if (targetId && !String(targetId).includes("spaces/")) {
          targetName = targetId;
          targetId = null;
        }

        const findSpaceId = (searchQuery) => {
            if (!searchQuery) return null;
            const cleanQuery = String(searchQuery).toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
            const noiseWords = ['read','messages','from','chat','history','get','the','what','last','message','whats','space','with','donna','tell','me'];
            const words = cleanQuery.split(/\s+/).filter(w => w.length > 2 && !noiseWords.includes(w));

            if (words.length === 0 && cleanQuery.length < 2) return null;

            const isMatch = (rawName) => {
                if (!rawName) return false;
                const n = String(rawName).toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
                if (n.length < 2 || n === "direct message") return false;
                if (n === cleanQuery || n.includes(cleanQuery) || cleanQuery.includes(n)) return true;
                if (words.length > 0 && words.some(w => n.includes(w))) return true;
                return false;
            };

            for (const [key, val] of Object.entries(GCHAT_ID_MAP || {})) {
                if (String(key).includes("spaces/") && (isMatch(val) || isMatch(key))) return { id: key, name: val };
                if (String(val).includes("spaces/") && (isMatch(val) || isMatch(key))) return { id: val, name: key };
            }
            for (const [key, val] of Object.entries(liveDmNames)) {
                if (isMatch(val) || isMatch(key)) return { id: String(key).includes("spaces/") ? key : val, name: String(key).includes("spaces/") ? val : key };
            }
            for (const s of liveSpaces) {
                const sid = s.id || s.name;
                const namesToTest = [GCHAT_ID_MAP[s.displayName], GCHAT_ID_MAP[sid], liveDmNames[sid], s.displayName].filter(Boolean);
                for (const nameToTest of namesToTest) {
                    if (isMatch(nameToTest)) return { id: sid, name: nameToTest };
                }
            }
            return null;
        };

        if (!targetId && targetName) {
            const match = findSpaceId(targetName);
            if (match) { targetId = match.id; targetName = match.name; }
        }

        if (!targetId && (transcriptionRef.current || donnaTranscription)) {
            const match = findSpaceId(transcriptionRef.current || donnaTranscription);
            if (match) { targetId = match.id; targetName = match.name; }
        }

        if (!targetId && liveSelectedSpace) {
          targetId = liveSelectedSpace.id || liveSelectedSpace.name;
          targetName = GCHAT_ID_MAP[liveSelectedSpace.displayName] || GCHAT_ID_MAP[targetId] || liveDmNames[targetId] || liveSelectedSpace.displayName;
        }

        if (!targetId) {
          console.error("[Donna] Could not resolve space ID for:", targetName);
          triggerSnackbar("Could not identify which chat to read.");
          if (callId) {
             const errorSpeech = `I'm sorry Siya, but I couldn't find a chat for ${targetName || 'that person'}.`;
             sendToolResponse(callId, { success: true, directive: `Read this EXACT phrase aloud: "${errorSpeech}"` });
             sendResponseCreate({});
          }
          break;
        }

        const processAndSendHistory = (rawMsgs) => {
          const msgs = Array.isArray(rawMsgs) ? rawMsgs : [];
          if (msgs.length === 0) {
            if (callId) {
              const emptySpeech = `The chat with ${targetName} is currently empty.`;
              sendToolResponse(callId, { success: true, directive: `Read this EXACT phrase aloud: "${emptySpeech}"` });
              sendResponseCreate({});
            }
            return;
          }

          const lastMsg = msgs[msgs.length - 1];
          const senderRaw = lastMsg.sender?.displayName || lastMsg.sender?.name || "Someone";
          const resolvedSender = GCHAT_ID_MAP[senderRaw] || GCHAT_ID_MAP[lastMsg.sender?.name] || liveDmNames[lastMsg.sender?.name] || senderRaw;
          let cleanText = lastMsg.text || "[Media/Attachment]";
          cleanText = cleanText.replace(/<[^>]*>?/gm, '');

          const cleanSenderName = resolvedSender.split("<")[0].trim();
          const cleanTargetName = (targetName || "them").split("<")[0].trim();
          const finalSpeech = `The last message from ${cleanTargetName} was from ${cleanSenderName}, who said: "${cleanText}"`;

          if (callId) {
            sendToolResponse(callId, { success: true, directive: `Read this EXACT phrase aloud to Siya: "${finalSpeech}"` });
            sendResponseCreate({});
          }
        };

        if (liveSelectedSpace && (liveSelectedSpace.id === targetId || liveSelectedSpace.name === targetId) && liveMessages.length > 0) {
          console.log("[Donna] Reading active chat from state...");
          processAndSendHistory(liveMessages);
          break;
        }

        console.log(`[Donna] Fetching background chat history for ${targetName}...`);
        triggerSnackbar(`Fetching messages for ${targetName}...`);
        fetch(`/.netlify/functions/gchat-messages?spaceId=${encodeURIComponent(targetId)}`, { credentials: "include" })
          .then(res => res.json())
          .then(data => {
            const msgs = Array.isArray(data) ? data : (data.messages || []);
            processAndSendHistory(msgs);
          })
          .catch(err => {
            console.error("Failed to read background chat:", err);
            triggerSnackbar("Failed to fetch chat history.");
            if (callId) {
              const errorSpeech = `I'm sorry Siya, there was a network error trying to read the chat with ${targetName}.`;
              sendToolResponse(callId, { success: true, directive: `Read this EXACT phrase aloud: "${errorSpeech}"` });
              sendResponseCreate({});
            }
          });

     break;
      }

case 'send_gchat_message': {
        const spaceId = actionArgs.spaceId;
        const text = actionArgs.text;

        if (!spaceId || !text) {
          triggerSnackbar("Missing chat destination or message text.");
          if (callId) sendToolResponse(callId, { success: false, error: "Missing parameters." });
          break;
        }

        triggerSnackbar("Sending message...");
        
        fetch("/.netlify/functions/gchat-send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ space: spaceId, text })
        })
        .then(async (res) => {
          const data = await res.json();
          if (res.ok && data.ok) {
            triggerSnackbar("Message sent!");
            if (gchatSelectedSpace?.id === spaceId || gchatSelectedSpace?.name === spaceId) {
                window.dispatchEvent(new CustomEvent("refreshGChatMessages"));
            }
            if (callId) sendToolResponse(callId, { success: true });
          } else {
            triggerSnackbar("Failed to send message.");
            if (callId) sendToolResponse(callId, { success: false, error: data.error });
          }
        })
        .catch(err => {
          console.error("[Donna] GChat Send Error:", err);
          triggerSnackbar("Network error sending message.");
        });
        break;
      }

      case 'trello_move_card': {
        // Re-check the args because our Rescue logic updated them
        console.log("[Donna] Trello Move - Arguments Resolved:", actionArgs);
        
        // 🏁 ARCHITECT'S SCOPE SYNC: Use the standard transcript reference
        const transForSearch = (transcriptionRef.current || donnaTranscription || "").toLowerCase();
        
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
        if (!cardNameQuery && !cardId && transForSearch) {
           const match = transForSearch.match(/['"](.+?)['"]/) || transForSearch.match(/(?:named|called|titled|card)\s+['"]?(.+?)['"]?\s+(?:from|to|in|bucket)/i);
           if (match) {
             cardNameQuery = match[1].replace(/['"]/g, '').trim();
             console.log(`[Donna] Scraped card name from transcript: "${cardNameQuery}"`);
           }
        }

        // 🛡️ FIX 3: Robust Search with Normalization
        if (!cardId && cardNameQuery) {
          console.log(`[Donna] Finding ID for: "${cardNameQuery}"`);
          
          let allCards = [];
          const liveCards = trelloBuckets ? Object.values(trelloBuckets).flat() : [];
          const cachedData = JSON.parse(localStorage.getItem("TRELLO_CACHE") || "{}");
          const cachedCards = Object.values(cachedData).flat();
          
          const combined = [...liveCards, ...cachedCards];
          allCards = Array.from(new Map(combined.map(c => [c.id, c])).values());

          if (allCards.length > 0) {
            const match = allCards.find(c => {
              const nameText = (c.name || c.title || "").toLowerCase();
              return nameText === cardNameQuery || nameText.includes(cardNameQuery) || cardNameQuery.includes(nameText);
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

        // 🎯 FIX: Using transForSearch instead of undefined userVoice
        const checkReview = lt.includes("review") || transForSearch.includes("review") || lt.includes("cr") || transForSearch.includes("cr");
        
        if (checkReview) {
          configMatch = Object.entries(PERSONA_TRELLO_LISTS).find(([name]) => 
            name.toLowerCase().includes("review")
          );
          console.log("[Architect] Review keyword detected. Forcing 'Siya - Review' destination.");
        }

        // 2. Priority 2: 24-character ID check
        if (!configMatch && lt.length === 24) {
          configMatch = Object.entries(PERSONA_TRELLO_LISTS).find(([_, id]) => id === lt);
        }

        // 3. Priority 3: Siya Phonetic Match
        if (!configMatch) {
          const isSiyaBase = lt === "siya" || lt === "sia" || lt === "sear" || lt === "see-yah";
          if (isSiyaBase || transForSearch.includes("siya bucket") || transForSearch.includes("sia bucket")) {
            configMatch = Object.entries(PERSONA_TRELLO_LISTS).find(([name]) => 
              name.toLowerCase() === "siya"
            );
          }
        }

        // 4. Final Fallback
        if (!configMatch) {
          configMatch = Object.entries(PERSONA_TRELLO_LISTS).find(([name]) => name.toLowerCase().includes(lt));
        }

        if (configMatch) {
          targetName = configMatch[0];
          resolvedId = configMatch[1];
        } else {
          resolvedId = rawTarget.length === 24 ? rawTarget : PERSONA_TRELLO_LISTS["Siya"];
          targetName = Object.keys(PERSONA_TRELLO_LISTS).find(k => PERSONA_TRELLO_LISTS[k] === resolvedId) || "Bucket";
        }

        if (!cardId || cardId.length !== 24) {
          triggerSnackbar("Could not find that card.");
          if (callId) sendToolResponse(callId, { success: false, error: "Card not found" });
          break;
        }

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
        const normalize = (str) => (str || "").toLowerCase().split(" (due")[0].split(" (pos")[0].replace(/['"\[\]]/g, "").trim();
        
        let targetId = actionArgs.cardId;
        let targetName = actionArgs.cardName;

        // 🛡️ STAGE 1: PRECISION RESOLUTION
        const safeBuckets = Array.isArray(trelloBuckets) 
            ? trelloBuckets 
            : Object.entries(trelloBuckets || {}).map(([name, data]) => ({ name, cards: Array.isArray(data) ? data : (data.cards || []) }));
        
        const allCards = safeBuckets.flatMap(b => b.cards || []);

        if (!targetId || targetId.length !== 24) {
          // If Donna put the name in the ID slot, move it to targetName
          if (targetId && targetId.length < 24) {
              targetName = targetId;
              targetId = null;
          }

          let searchName = normalize(targetName && targetName !== "the card" ? targetName : "");
          
          const userVoice = (transcriptionRef.current || donnaTranscription || "");
          console.log(`[Architect] Scraper checking voice for Archive: "${userVoice}"`);

          if (!searchName && userVoice) {
             // 🚀 IMPROVED REGEX: Specifically looks for "card named [Testing]" or quoted words
             const match = userVoice.match(/(?:named|called|titled|card)\s+["'\[](.+?)["'\]]/i)
                        || userVoice.match(/["'](.+?)["']/)
                        || userVoice.match(/(?:archive|delete|remove|restore)\s+(?:the\s+)?(?:trello\s+)?(?:card\s+(?:called|named|titled)\s+)?['"\[]?(.+?)['"\]]?\s+(?:in|from|folder|at|to|into|bucket)/i);
             
             if (match) {
               searchName = normalize(match[1]);
               console.log(`[Architect] Successfully scraped card name for archive: "${searchName}"`);
             }
          }

          console.log(`[Architect] Final search name for resolution: "${searchName}"`);
          
          if (searchName && searchName.length >= 2) {
            console.log(`[Architect] Deep Scan initiated for: "${searchName}" across ${allCards.length} cards.`);

            // 🎯 FIX: Robust name cleaning that strips everything after a parenthesis (removes dates)
            const cleanBoardName = (raw) => {
                return (raw || "").toLowerCase()
                    .split('(')[0] // Remove anything like "(Due...)"
                    .replace(/[^a-z0-9]/g, '') // Strip brackets and punctuation
                    .trim();
            };

            const searchNameClean = searchName.replace(/[^a-z0-9]/g, '');

            const match = allCards.find(c => {
                const bName = cleanBoardName(c.name || c.title);
                // Matches if "testing" is the same as "testing" or if one contains the other
                return bName === searchNameClean || bName.includes(searchNameClean) || searchNameClean.includes(bName);
            });

            if (match) {
              targetId = match.id;
              targetName = match.name || match.title;
              console.log(`[Architect] Resolution Success: ${targetName} (${targetId})`);
            } else {
                console.warn("[Architect] Deep Scan failed. Card list sample:", allCards.slice(0,3).map(c => c.name));
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

      // 🎯 FIX: Added 'trello_timer' alias to match OpenAI's generated function name
      case 'trello_timer':
      case 'trello_timer_action': {
        let cardId = actionArgs.cardId;
        const action = actionArgs.action || "start";
        const cardNameQuery = (actionArgs.cardName || "").toLowerCase().trim();

        // 🛡️ ARCHITECT'S RESOLVER: Ensure we have a 24-char ID
        if (!cardId || cardId.length !== 24) {
            const bucketsArray = Array.isArray(trelloBuckets) 
                ? trelloBuckets 
                : Object.entries(trelloBuckets || {}).map(([name, data]) => ({ name, cards: Array.isArray(data) ? data : (data.cards || []) }));
            
            const allCards = bucketsArray.flatMap(b => b.cards || []);
            const match = allCards.find(c => {
                const cn = (c.name || "").toLowerCase();
                return cn === cardNameQuery || cn.includes(cardNameQuery) || cardNameQuery.includes(cn);
            });

            if (match) {
                cardId = match.id;
                console.log(`[Architect] Timer ID Resolved: ${cardId} ("${match.name}")`);
            }
        }

        if (!cardId || cardId.length !== 24) {
          triggerSnackbar("Could not find the card to start the timer.");
          if (callId) sendToolResponse(callId, { success: false, error: "Card not found." });
          break;
        }

        triggerSnackbar(`${action === 'start' ? 'Starting' : 'Stopping'} timer...`);

        fetch("/.netlify/functions/trello-timer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cardId, action })
        })
        .then(async (res) => {
          const data = await res.json();
          if (res.ok && data.ok) {
            triggerSnackbar(`Timer ${action}ed successfully.`);
            window.dispatchEvent(new CustomEvent("refreshTrelloBoard"));
            if (callId) sendToolResponse(callId, { success: true });
          } else {
            triggerSnackbar(`Timer error: ${data.error || "Trello rejected the request"}`);
            if (callId) sendToolResponse(callId, { success: false, error: data.error });
          }
        })
        .catch(err => console.error("[Donna] Timer Network Error:", err));
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

     case 'send_gchat_message': {
        const spaceId = actionArgs.spaceId;
        const text = actionArgs.text;

        if (!spaceId || !text) {
          triggerSnackbar("Missing chat destination or message text.");
          if (callId) sendToolResponse(callId, { success: false, error: "Missing parameters." });
          break;
        }

        triggerSnackbar("Sending message...");
        
        fetch("/.netlify/functions/gchat-send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ space: spaceId, text })
        })
        .then(async (res) => {
          const data = await res.json();
          if (res.ok && data.ok) {
            triggerSnackbar("Message sent!");
            
            // Clear unread status locally for this space
            setUnreadGchatSpaces(prev => (prev || []).filter(id => id !== spaceId));

            if (gchatSelectedSpace?.id === spaceId || gchatSelectedSpace?.name === spaceId) {
                window.dispatchEvent(new CustomEvent("refreshGChatMessages"));
            }
            if (callId) sendToolResponse(callId, { success: true });
          } else {
            triggerSnackbar("Failed to send message.");
            if (callId) sendToolResponse(callId, { success: false, error: data.error });
          }
        })
        .catch(err => {
          console.error("[Donna] GChat Send Error:", err);
          triggerSnackbar("Network error sending message.");
        });
        break;
      }
      
// 🎯 ADDED: Trello Member Assigning logic
      // 🎯 ADDED: Trello Member Assigning logic (Harden v13 - REAL ID INJECTION)
      case 'trello_toggle_member': {
        const rawVoice = (transcriptionRef.current || donnaTranscription || "").toLowerCase();
        let cardQuery = (actionArgs.cardName || actionArgs.cardId || "").toLowerCase().trim();
        let memberQuery = (actionArgs.memberId || "").toLowerCase().trim();

        // 🛡️ MASTER IDENTITY REPOSITORY
        const MASTER_MEMBER_MAP = {
          "albert": "65f4ad28d8365141049928c3", "alicia": "64b90b88ca45699d29e1f36b", "asanda": "691b0c0fc57a02f68023b6f3",
          "bianca": "67e117f7247f77f98664fd22", "bonisa": "68e908a4ba4b200ba97ebbfb", "bonolo": "67c171ea0e994ad89aa5fbf8",
          "cameron": "68419c10c2a53c71d9e0af06", "cara": "693a5d5dda8eaaf367450cfb", "chloe": "6995d3fb27619a0656230e78",
          "conah": "66b37d0f70cb2d76881e7e72", "cynthia": "67bf015ec6abf1f51125d246", "dionee": "662615459df838a28e0457fc",
          "enock": "67aa3384dc273ed6c32a0613", "ethan": "65e99c5f847219d008343e21", "eugene": "679c68a68ad242ed23dca5aa",
          "faith": "691b0cdce5851c2c7533fa68", "jennifer": "67a051599a324c743613a6cf", "joel": "63cf7e35f1d23d046618426d",
          "jonathan": "67ffbc50dad06318a011a5ae", "kwakhanya": "67e0f593ea03b217cc8592b3", "leonah": "66a0d28d19e918e9a875c109",
          "martin": "6644556076cb36a96e879e42", "mathapelo": "691b2052687aca7ee746859b", "matthew": "665ebf236815e1e845a36106",
          "melokuhle": "67adacba4c0cc8d464a38aa1", "melvin": "6343bb301963ad01166f142b", "michelle": "681af439e50222913a95888e",
          "mine": "68108782c117f540f8f4507b", "munyaradzi": "67eee163236fe5b5caa30f6b", "ofentse": "698d873c13fd694f25c79f70",
          "palesa": "691b0d03a369680f72cba98b", "refiloe": "698d877706f235a84397a894", "robyn": "697231d1e4cda79a313cb278",
          "ruan": "6995d4113cb8d65edff576c7", "ryan": "632bfd240c991c01dc22e6a2", "shamiso": "67cc84198e59f8e8b36c9e98",
          "sharon": "696def840f0ea7c661e9f32b", "simone": "6343b58de991f30236e74ab8", "siya": "65f8871a48385c1bd3e9c381",
          "siyolise": "691b104f8d19f3ddec4b93d6", "songeziwe": "67e390b7d5434b0e8afced71", "suemari": "698099f07901e7f78af7cf16",
          "thami": "65f82b190cd455e25821bbbc", "tiffany": "6423e618cb42af40e16adf69", "tinashe": "686266936de059cf0041b8f9",
          "treasure": "67b1e3eb3d46e5ce83d67596", "uvesh": "69a958f02d205aef5b00d3a3", "waldo": "6343ba83f91fbc0374819b79",
          "willem": "67fe494b8158df9659b88279", "yolandie": "65cccac1d12d8a6f97e7920b", "yael": "6878a29a4c22995035ded74f"
        };

        const PHONETIC_MAP = { "sia": "siya", "sear": "siya", "seer": "siya", "see-yah": "siya" };

        // 🎙️ SCRAPER: Detect member and card from voice if missing
        if (!memberQuery || memberQuery.length < 2) {
            const mMatch = rawVoice.match(/(?:add|assign|put|remove|unassign)\s+([a-z]+)/i);
            if (mMatch) memberQuery = mMatch[1].trim();
        }
        
        const nameKey = PHONETIC_MAP[memberQuery.toLowerCase()] || memberQuery.toLowerCase();
        let finalMemberId = MASTER_MEMBER_MAP[nameKey];

        // 🛡️ RESOLVE CARD (Harden v41 - Bucket-Aware Member Resolution)
        const cq = cardQuery.toLowerCase().trim();
        const safeBucketsArray = Array.isArray(trelloBuckets) 
            ? trelloBuckets 
            : Object.entries(trelloBuckets || {}).map(([name, data]) => ({ name, cards: Array.isArray(data) ? data : (data.cards || []) }));

        let targetBucketName = "";
        if (rawVoice.includes("review") || rawVoice.includes("cr")) targetBucketName = "Siya - Review";
        else if (rawVoice.includes("siya") || rawVoice.includes("sia")) targetBucketName = "Siya";

        let potentialCards = [];
        if (targetBucketName) {
            const matchedBucket = safeBucketsArray.find(b => {
                if (!b || !b.name) return false;
                return b.name.toLowerCase().replace(/[^a-z0-9]/g, '') === targetBucketName.toLowerCase().replace(/[^a-z0-9]/g, '');
            });
            if (matchedBucket) potentialCards = matchedBucket.cards || [];
        }

        // 🛡️ ARCHITECT'S HARDENED SEARCH: Filter out OOO cards and prioritize clean matches
        const isOOO = (name) => name.toLowerCase().includes("away from cases") || name.toLowerCase().includes("out of office");

        let foundCard = potentialCards.find(c => {
            const cn = (c.name || c.title || "").toLowerCase();
            if (isOOO(cn) && !cq.includes("away")) return false; // Skip OOO unless specifically asked for
            return cn === cq || cn.includes(cq);
        });

        if (!foundCard) {
            console.log("[Architect] precision: global board search (excluding OOO).");
            const allCards = safeBucketsArray.flatMap(b => b.cards || []);
            foundCard = allCards.find(c => {
                const cn = (c.name || c.title || "").toLowerCase();
                if (isOOO(cn) && !cq.includes("away")) return false;
                return cn === cq || cn.includes(cq) || cq.includes(cn);
            });
        }

        const finalCardId = foundCard ? foundCard.id : (actionArgs.cardId?.length === 24 ? actionArgs.cardId : null);
        const finalCardName = foundCard ? (foundCard.name || foundCard.title) : (actionArgs.cardName || "the card");

        // 🎯 INTENT: Determine Add vs Remove
        const isRemoving = rawVoice.includes("remove") || rawVoice.includes("unassign") || rawVoice.includes("delete member");

        if (!finalCardId || !finalMemberId) {
          console.error("[Architect] precision failure:", { finalCardId, finalMemberId, nameKey });
          triggerSnackbar(`Precision error: Card or Member not found.`);
          if (callId) sendToolResponse(callId, { success: false, error: "Member or Card not found." });
          break;
        }

        triggerSnackbar(`${isRemoving ? 'Removing' : 'Assigning'} ${nameKey}...`);

        fetch("/.netlify/functions/trello-toggle-member", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cardId: finalCardId, memberId: finalMemberId, action: isRemoving ? 'remove' : 'add' })
        })
        .then(async (res) => {
          const data = await res.json();
          if (res.ok && data.ok) {
            triggerSnackbar(`${isRemoving ? 'Removed' : 'Assigned'} ${nameKey} on "${finalCardName}"`);
            window.dispatchEvent(new CustomEvent("refreshTrelloBoard"));
            if (callId) sendToolResponse(callId, { success: true });
          } else {
            triggerSnackbar(`Trello error: ${data.error}`);
            if (callId) sendToolResponse(callId, { success: false, error: data.error });
          }
        })
        .catch(err => console.error("[Donna] Network error:", err));
        break;
      }

      case 'trello_add_comment': {
        const trans = (transcriptionRef.current || donnaTranscription || "").toLowerCase();
        const commentMatch = trans.match(/(?:saying|comment|note)\s+(.+?)(?=\s+(?:to|on|in|at|the|card|bucket)|$)/i);
        const commentText = commentMatch ? commentMatch[1].trim() : actionArgs.text || actionArgs.comment;

        const finalCardId = actionArgs.cardId;
        const bucketsArray = Array.isArray(trelloBuckets) ? trelloBuckets : [];
        const foundCard = bucketsArray.flatMap(b => b.cards || []).find(c => c.id === finalCardId);

        // 🎯 ARCHITECT'S NAME RECOVERY: Don't rely on foundCard object, use the Args name we synced in the resolver
        const displayName = actionArgs.cardName || foundCard?.name || "the card";

        if (!finalCardId || !commentText) {
          triggerSnackbar("Target card not found. Please specify the card name clearly.");
          if (callId) sendToolResponse(callId, { success: false, error: "Missing card or text." });
          break;
        }

        triggerSnackbar(`Adding comment to "${displayName}"...`);
        fetch("/.netlify/functions/trello-add-comment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cardId: finalCardId, text: commentText })
        })
        .then(async (res) => {
          const data = await res.json();
          if (res.ok && data.ok) {
            triggerSnackbar(`Done! Comment added to ${displayName}.`);
            window.dispatchEvent(new CustomEvent("refreshTrelloBoard"));
            if (callId) sendToolResponse(callId, { success: true });
          } else {
            triggerSnackbar(`Error: ${data.error}`);
          }
        });
        break;
      }

      case 'trello_set_custom_field': {
  const rawVoice = (transcriptionRef.current || donnaTranscription || "").toLowerCase();
  const finalCardId = actionArgs.cardId;
  
  // 1. HARDENED RESOLVER: Scoring unique words
  let resolvedId = (finalCardId && finalCardId.length === 24) ? finalCardId : null;
  let displayName = actionArgs.cardName || "the card";

  if (!resolvedId) {
    const bucketsArray = Array.isArray(trelloBuckets) 
      ? trelloBuckets 
      : Object.values(trelloBuckets || {});
      
    const allCards = bucketsArray.flatMap(b => (Array.isArray(b) ? b : b.cards || []));
    
    const scrub = (str) => (str || "").toLowerCase()
      .split('(')[0] 
      .replace(/[.,\/#!$%\^&\*;:{}=\-_`~"']/g, "")
      .trim();

    const voiceScrubbed = scrub(rawVoice);
    console.log("[Architect] Scoping Trello with scrubbed voice:", voiceScrubbed);

    const scoredMatches = allCards.map(c => {
      const cardNameScrubbed = scrub(c.name || c.title || "");
      let score = 0;

      if (!cardNameScrubbed) return { card: c, score: 0 };

      const wordMatch = new RegExp(`\\b${cardNameScrubbed}\\b`, 'i');
      if (wordMatch.test(voiceScrubbed)) score += 50;
      
      const keywords = cardNameScrubbed.split(/\s+/).filter(w => w.length > 2);
      keywords.forEach(k => {
        if (voiceScrubbed.includes(k)) score += 10;
      });

      return { card: c, score };
    }).filter(res => res.score > 0).sort((a, b) => b.score - a.score);

    if (scoredMatches.length > 0) {
      resolvedId = scoredMatches[0].card.id;
      displayName = scoredMatches[0].card.name || scoredMatches[0].card.title;
      console.log(`[Architect] Resolved via Scrubbed Score: ${displayName} (${resolvedId})`);
    }
  }

  if (!resolvedId) {
    console.error("[Architect] Resolution Failed. Voice:", rawVoice);
    triggerSnackbar("I couldn't identify the card to update.");
    break;
  }

  // 2. WHITELIST VALUE EXTRACTION
  let fieldName = "Priority"; 
  // 🎯 THE STATUS FIX: Detect if the user is talking about Status or Active fields
  if (rawVoice.includes("status")) {
    fieldName = "Status";
  } else if (rawVoice.includes("active")) {
    fieldName = "Active";
  }

  // Define the valid options for all three Custom Fields
  const allValidOptions = [
    "urgent", "high", "medium", "low", "new client", "high urgent", "urgent important", // Priority
    "to do", "doing", "done", "review", "blocked", "2nd review", "final review",        // Status
    "working on it", "not working on it", "do not move"                                // Active
  ];
  
  const foundValue = allValidOptions.find(opt => rawVoice.includes(opt));
  
  // 🎯 THE FIX: Smart Value Formatting
  let fieldValue = "Urgent"; // Default
  if (foundValue) {
    if (foundValue === "high urgent") fieldValue = "High Urgent";
    else if (foundValue === "urgent important") fieldValue = "Urgent+Important";
    else if (foundValue === "to do") fieldValue = "To Do";
    else if (foundValue === "2nd review") fieldValue = "2nd Review";
    else if (foundValue === "final review") fieldValue = "Final Review";
    else if (foundValue === "working on it") fieldValue = "Working on it";
    else if (foundValue === "not working on it") fieldValue = "Not working on it";
    else if (foundValue === "do not move") fieldValue = "Do not move";
    else fieldValue = foundValue.charAt(0).toUpperCase() + foundValue.slice(1);
  } else if (fieldName === "Status") {
    fieldValue = "To Do"; // Default for Status if value not heard
  }

  // 3. SURGICAL PATCH: Instant Color Update & STALE GUARD
  // 🚀 ARCHITECT'S TOTAL LOCKOUT: Block all polling and context refreshes for this card
  window.dispatchEvent(new CustomEvent("trelloImmuneCard", { detail: resolvedId }));
  window.dispatchEvent(new CustomEvent("pauseTrelloPolling")); 
  
  // LOCK Donna's memory immediately so she doesn't re-prompt while we wait for the server
  ignoreNextDonnaRef.current = true;
  
  // 🛡️ RE-ENFORCING THE PENDING STATE:
  // Ensure the useTrello hook's internal pendingCFRef is updated immediately
  window.dispatchEvent(new CustomEvent("pendingCF", { 
    detail: { cardId: resolvedId, field: fieldName, ttlMs: 45000 } 
  }));

  // 🚀 THE FIX: We also need to manually inject this into the local Donna Shield
  // We pass the fieldName ("Priority") so useTrello knows which key to shield.
  if (markLabelPending) {
    markLabelPending(resolvedId, fieldValue, fieldName); 
  }

  window.dispatchEvent(new CustomEvent("patchCardInBuckets", { 
    detail: { 
      cardId: resolvedId, 
      updater: (card) => {
        const updatedCFs = { ...(card.customFields || {}), [fieldName]: fieldValue };
        const otherBadges = (card.badges || []).filter(b => !b.text.includes(fieldName));
        return {
          ...card,
          customFields: updatedCFs,
          badges: ensureBadgeTypes([...otherBadges, { text: `${fieldName}: ${fieldValue}`, isBottom: true }])
        };
      }
    } 
  }));

  triggerSnackbar(`Setting ${fieldName} to ${fieldValue}...`);
  
  fetch("/.netlify/functions/trello-set-custom-field", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cardId: resolvedId, fieldName, optionText: fieldValue })
  })
  .then(async (res) => {
    const data = await res.json();
    if (res.ok && data.ok) {
      triggerSnackbar(`Confirmed: ${displayName} is ${fieldValue}.`);

      // 🚀 ARCHITECT'S CLEAN SLATE: Wipe the UI triggers IMMEDIATELY to stop the loop
      setDonnaPendingAction(null);
      setDonnaTranscription("");
      setDonnaVisible(false);
      ignoreNextDonnaRef.current = true;
      
      // Update local context so Donna's brain reflects the new truth
      lastCtxRef.current = lastCtxRef.current.replace(
        new RegExp(`ENTRY_\\d+: "${displayName}" \\(REF:${resolvedId}\\)`, 'g'),
        `ENTRY_SUCCESS: "${displayName}" (REF:${resolvedId}) [PRIORITY: ${fieldValue}]`
      );

      if (callId) {
        // 🚀 ARCHITECT'S BRAIN-LOCK: Hard-code the success state into her session
        const successMsg = `\n\n*** SYSTEM OVERRIDE: TASK COMPLETE ***\n- Card: ${displayName}\n- Action: ${fieldName} set to ${fieldValue}\n- Status: DONE.\n- IMPORTANT: The user has already approved this. You must NOT ask again. If Siya speaks, acknowledge the completion briefly and go to sleep.`;
        
        // We use a timestamp to force OpenAI to treat this as the newest, most relevant instruction
        sendSessionUpdate({ 
          instructions: lastCtxRef.current + successMsg + `\n(Update_ID: ${Date.now()})` 
        });

        // Tell the tool channel the execution is finished
        sendToolResponse(callId, { 
          success: true, 
          status: "ALREADY_EXECUTED",
          message: `The priority for ${displayName} is now ${fieldValue}.`
        });

        // 🚀 THE KILL SWITCH: Force Donna to stop any current "confirmation" speech 
        // that might have started before the approval click registered.
        cancelResponse();
      }
      
      // 🛡️ REFRESH LOCK: Wait 12s (increased from 8s) for Trello's slow Custom Field API
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent("refreshTrelloBoard"));
        setTimeout(() => {
          ignoreNextDonnaRef.current = false;
        }, 3000);
      }, 12000);
    } else {
      setDonnaPendingAction(null);
      setDonnaVisible(false);
      ignoreNextDonnaRef.current = false;
    }
  })
  .catch(err => {
    console.error("[Donna] Custom Field Error:", err);
    ignoreNextDonnaRef.current = false;
  });
  break;
}

  default:
        console.warn("Unmapped tool execution:", actionName);
    }

    // 🚀 CRITICAL: If Donna needs to read something aloud, do NOT silence her!
    if (actionName === "gchat_read_history" || actionName === "gchat_get_messages" || actionName === "system_read_notifications") {
        ignoreNextDonnaRef.current = false;
    } else {
        // Clear immediately — no follow-up bubble for silent actions
        ignoreNextDonnaRef.current = true;
        setTimeout(() => { ignoreNextDonnaRef.current = false; }, 3000);
    }
    
    // 🚀 ARCHITECT'S FLUSH: Clear all AI states immediately to break the visual loop
    setDonnaPendingAction(null);
    setDonnaTranscription("");
    setDonnaVisible(false);
    transcriptionRef.current = ""; // 🎯 Wipe the raw transcript ref too
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
  } = useTrello({ 
    currentView, 
    setCurrentView, 
    // 🛡️ ARCHITECT'S FIX: Pass the ACTUAL ref destructured from useDonna
    pendingDonnaLabelsRef: pendingDonnaLabelsRef 
  });
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

  // 🚀 ARCHITECT'S SYNC: Keep Donna's brain updated with live GChat state to prevent Stale Closures
  useEffect(() => {
    gchatMessagesRef.current = gchatMessages || [];
    gchatSpacesRef.current = gchatSpaces || [];
    gchatSelectedSpaceRef_donna.current = gchatSelectedSpace || null;
    gchatDmNamesRef_donna.current = gchatDmNames || {};
  }, [gchatMessages, gchatSpaces, gchatSelectedSpace, gchatDmNames]);

// Update Donna's session instructions with current screen context
  useEffect(() => {
    if (!isDonnaConnected) return;
const app = currentView.app;
    let ctx = "You are Agent Donna, a witty and professional actuarial assistant to Siyabonga (Siya, pronounced See-yah).\n\n*** STRICT WAKE-WORD PROTOCOL ***\nYour audio stream is always open, but you are ASLEEP. You must ONLY wake up and respond if the user's sentence starts exactly with 'Hey Donna'.\n- If the user speaks without saying 'Hey Donna' first, you must output ABSOLUTELY NOTHING. YOU ARE FORBIDDEN FROM SAYING 'I can only respond to requests that begin with...'. Remain completely silent.\n- Do not explain the rule. Do not apologize. Just stay silent.\n- IMPORTANT: If the user says 'Hey Donna approve' or 'Hey Donna reject', this is handled locally by the system. YOU MUST OUTPUT ABSOLUTELY NOTHING. DO NOT ASK WHAT TO APPROVE. JUST REMAIN SILENT.\n- Once you fulfill a 'Hey Donna' request, go immediately back to sleep.\n\n*** LIVE DATA PROTOCOL (CRITICAL) ***\n- You have a 'Live Vision' of the Trello board provided in the context below.\n- When Siya asks 'What is at the top of my list?' or 'What cards are in the Sia bucket?', you MUST read the actual names from the Trello section below.\n- NEVER report an Email from the Gmail section as a Trello card.\n- If the Trello section shows 'Visible cards: 1. [Name]', say: 'At the top of your list is [Name].'\n- If the list is empty, say so. Do NOT assume you know what is there based on previous turns.\n\n*** GCHAT & HISTORY PROTOCOL (CRITICAL) ***\n- If Siya asks to read a message, check a chat, or asks what someone said, YOU ARE FORBIDDEN from asking for permission to fetch it.\n- DO NOT say 'I can fetch that for you.' DO NOT ask 'Would you like me to fetch the message?'.\n- You MUST immediately execute the 'gchat_read_history' tool. Do this silently without asking.\n- You can send GChat messages to anyone in your directory regardless of which app is currently on screen. If asked to send a message, do it immediately.\n- If Siya asks to 'start a chat' or 'message someone new', you MUST find their email using 'gmail_get_contacts' (if not already known) and then call 'gchat_start_direct_message' with the email. Tell him: 'I'm opening a new chat for you now.'\n\nWhen carrying out a request using your tools, you must always speak and verbally explain to Siya what you are doing. If you are simply navigating to an app or searching/fetching data, do NOT ask for approval. If you are creating, modifying, moving, or deleting data (e.g., saving a draft, moving a card), you MUST ask him to approve the action on his screen. Be concise. IMPORTANT: Always respond in English only.\n\n*** CALENDAR RULE ***\nWhen creating calendar events, you MUST calculate the EXACT target date using the 'Current date and time' provided below. You MUST output the 'date' parameter strictly in 'YYYY-MM-DD' format (e.g., '2026-03-15'). NEVER output words like 'today', 'tomorrow', 'Friday', or 'next week'. NEVER omit the date parameter.\n\n";
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
        ctx += `CURRENTLY VIEWING GMAIL INBOX (${gmailFolder}): ${gmailEmails.slice(0, 50).map((e, i) => {
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

// 🎯 GCHAT AWARENESS (Global Directory)
    if (gchatSpaces && gchatSpaces.length > 0) {
      const chatList = gchatSpaces.map(s => {
        const key = s.id || s.name;
        const name = GCHAT_ID_MAP[s.displayName] || GCHAT_ID_MAP[key] || gchatDmNames?.[key] || s.displayName || "Unknown";
        return `[Name: "${name}", ID: "${key}"]`;
      }).slice(0, 40).join(", ");
      ctx += `\nAVAILABLE GCHAT SPACES (GLOBAL): ${chatList}.\nDIRECTIVE: You can send messages to these people regardless of the current screen using the 'send_gchat_message' tool.\n`;
    }

    if (app === "gchat") {
      const viewName = showArchivedChats ? "ARCHIVED CHATS" : "INBOX";
      const spaceName = gchatSelectedSpace?.displayName || gchatDmNames?.[gchatSelectedSpace?.id] || "Unknown";
      ctx += `\nCURRENTLY VIEWING GCHAT (${viewName}): "${spaceName}".\n`;
      ctx += `UI STATE: "Direct Messages" list is ${dmsExpanded ? 'VISIBLE' : 'HIDDEN'}. "Spaces" list is ${spacesExpanded ? 'VISIBLE' : 'HIDDEN'}.\n`;
      
      if (showArchivedChats) {
        ctx += `DIRECTIVE: You are currently viewing Archived Chats. If Siya asks to "go back to inbox" or "exit archive", you MUST call 'gchat_navigate_view' with view='inbox'. Do NOT call Gmail tools for this.\n`;
      }

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
        ctx += `Latest alerts: ${notifications.slice(0, 10).map(n => `[ID: ${n.id}] "${n.title || n.sender || 'Alert'}": ${(n.text || n.message || n.snippet || "").slice(0, 50)}`).join(' | ')}.\n`;
        ctx += `DIRECTIVE: If Siya asks to read an email from these alerts, you MUST use the ID provided in brackets as the messageId parameter.\n`;
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
    notifications,
    showArchivedChats
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
} else if (actionName === "send_gchat_message" || actionName === "gchat_mute_space" || actionName === "gchat_get_messages" || actionName === "gchat_read_history" || actionName === "gchat_delete_space" || actionName === "gchat_archive_space" || actionName === "gchat_unarchive_space") {
    let targetId = args.spaceId;
    let targetName = args.spaceName || "";
    
    const liveSpaces = Array.isArray(gchatSpacesRef.current) ? gchatSpacesRef.current : [];
    const liveSelectedSpace = gchatSelectedSpaceRef_donna.current;
    const liveDmNames = gchatDmNamesRef_donna.current || {};

    if (targetId && !String(targetId).includes("spaces/")) {
      targetName = targetId;
      targetId = null;
    }
    
    const findSpaceId = (searchQuery) => {
        if (!searchQuery) return null;
        const cleanQuery = String(searchQuery).toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
        const noiseWords = ['delete','remove','read','messages','from','chat','history','get','the','what','last','message','whats','space','with','donna','tell','me','send','to'];
        const words = cleanQuery.split(/\s+/).filter(w => w.length > 2 && !noiseWords.includes(w));

        if (words.length === 0 && cleanQuery.length < 2) return null;

        const isMatch = (rawName) => {
            if (!rawName) return false;
            const n = String(rawName).toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
            if (n.length < 2 || n === "direct message") return false;
            if (n === cleanQuery || n.includes(cleanQuery) || cleanQuery.includes(n)) return true;
            if (words.length > 0 && words.some(w => n.includes(w))) return true;
            return false;
        };

        for (const [key, val] of Object.entries(GCHAT_ID_MAP || {})) {
            if (String(key).includes("spaces/") && (isMatch(val) || isMatch(key))) return { id: key, name: val };
            if (String(val).includes("spaces/") && (isMatch(val) || isMatch(key))) return { id: val, name: key };
        }
        for (const [key, val] of Object.entries(liveDmNames)) {
            if (isMatch(val) || isMatch(key)) return { id: String(key).includes("spaces/") ? key : val, name: String(key).includes("spaces/") ? val : key };
        }
        for (const s of liveSpaces) {
            const sid = s.id || s.name;
            const namesToTest = [GCHAT_ID_MAP[s.displayName], GCHAT_ID_MAP[sid], liveDmNames[sid], s.displayName].filter(Boolean);
            for (const nameToTest of namesToTest) {
                if (isMatch(nameToTest)) return { id: sid, name: nameToTest };
            }
        }
        return null;
    };

    if (!targetId && targetName) {
      const match = findSpaceId(targetName);
      if (match) { targetId = match.id; targetName = match.name; }
    }

    if (!targetId && (transcriptionRef.current || donnaTranscription)) {
      const match = findSpaceId(transcriptionRef.current || donnaTranscription);
      if (match) { targetId = match.id; targetName = match.name; }
    }
    
 if (!targetId && liveSelectedSpace) {
      targetId = liveSelectedSpace.id || liveSelectedSpace.name;
      targetName = GCHAT_ID_MAP[liveSelectedSpace.displayName] || GCHAT_ID_MAP[targetId] || liveDmNames[targetId] || liveSelectedSpace.displayName;
    }

    // 🚀 ARCHITECT'S NAME RECOVERY: If LLM provided an ID but no Name, find it now!
    if (targetId && (!targetName || targetName === "undefined" || targetName.toLowerCase() === "direct message")) {
      let recoveredName = GCHAT_ID_MAP[targetId] || liveDmNames[targetId];
      if (!recoveredName) {
        const spaceMatch = liveSpaces.find(s => s.id === targetId || s.name === targetId);
        if (spaceMatch) {
          recoveredName = GCHAT_ID_MAP[spaceMatch.displayName] || spaceMatch.displayName;
        }
      }
      if (!recoveredName && liveSelectedSpace && (liveSelectedSpace.id === targetId || liveSelectedSpace.name === targetId)) {
        recoveredName = GCHAT_ID_MAP[liveSelectedSpace.displayName] || liveSelectedSpace.displayName;
      }
      if (recoveredName) targetName = recoveredName;
    }
    
    const displayTargetName = targetName ? targetName.split("<")[0].trim() : "";
    let chatLabel = "this chat";
    if (displayTargetName && displayTargetName.toLowerCase() !== "direct message" && displayTargetName.toLowerCase() !== "this chat" && !displayTargetName.startsWith("spaces/")) {
        chatLabel = `the "${displayTargetName}" chat`;
    }
    
    if (actionName === "send_gchat_message") {
      finalTranscription = `I will send: "${args.text}" to ${chatLabel}. Please approve on your screen.`;
    } else if (actionName === "gchat_mute_space") {
      const isMuting = args.mute !== false;
      finalTranscription = `I will ${isMuting ? 'mute' : 'unmute'} ${chatLabel} for you. Please approve the action on your screen.`;
 } else if (actionName === "gchat_delete_space") {
      finalTranscription = `I will delete ${chatLabel}. Please approve the action on your screen.`;
    } else if (actionName === "gchat_archive_space") {
      finalTranscription = `I will archive ${chatLabel}. Please approve the action on your screen.`;
    } else if (actionName === "gchat_unarchive_space") {
      finalTranscription = `I will unarchive ${chatLabel}. Please approve the action on your screen.`;
    } else {
      finalTranscription = `I will read the messages from ${chatLabel} for you. Please approve the action on your screen.`;
    }
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
        gchatSpaces={(gchatSpaces || []).filter(s => {
          const id = s.id || s.name;
          // 🛡️ THE FIX: Only display chats that have an active unread marker in the state map
          return unreadGchatSpaces && unreadGchatSpaces[id];
        })}
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