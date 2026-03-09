import agentDonnaPic from "./assets/Agent Donna.png";
import agentDonnaVideo from "./assets/Agent Donna.mp4";
import React, { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import StorytellerMockup from "./StorytellerMockup";
import BlueprintVideo from "./BlueprintVideo";
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

export const launchWorkstationWindow = (url) => {

  window.dispatchEvent(new CustomEvent("openWorkstationPane", { detail: url }));

  if (url.includes("meet.google.com")) {
    window.dispatchEvent(new CustomEvent("googleMeetLaunched"));
  }
};

export default function App() {
  const [callBtnHovered, setCallBtnHovered] = useState(false);
  const [systemErrors, setSystemErrors] = useState({});
  const [showSystemPopup, setShowSystemPopup] = useState(false);

  const { isConnected: isDonnaConnected, connectDonna, disconnectDonna, client: donnaClient } = useDonna();

  useEffect(() => {
    connectDonna();
    return () => disconnectDonna();
  }, [connectDonna, disconnectDonna]);

  const reportSystemError = (source, message) => setSystemErrors(prev => ({ ...prev, [source]: message }));
  const clearSystemError = (source) => setSystemErrors(prev => { const next = { ...prev }; delete next[source]; return next; });
  useEffect(() => {
    const onReport = (e) => setSystemErrors(prev => ({ ...prev, [e.detail.source]: e.detail.message }));
    const onClear = (e) => setSystemErrors(prev => { const next = { ...prev }; delete next[e.detail]; return next; });
    window.addEventListener("systemReportError", onReport);
    window.addEventListener("systemClearError", onClear);
    return () => { window.removeEventListener("systemReportError", onReport); window.removeEventListener("systemClearError", onClear); };
  }, []);

  const [isDonnaActive, setIsDonnaActive] = useState(false);
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

<div className="brand-stack" style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>

      <div
          className="brand-rect"
          title="Agent Donna"
          onClick={(e) => {
            if (!isDonnaActive) setIsDonnaLoading(true);
            setIsDonnaActive(!isDonnaActive);
            const el = e.currentTarget;
            el.style.animation = 'none';
            void el.offsetWidth;
            el.style.animation = 'press-bounce 0.25s ease';
          }}
          style={{ width: '100%', height: '120px', overflow: 'hidden', borderRadius: '12px', cursor: 'pointer', background: '#f1f3f4', position: 'relative' }}
        >
          {isDonnaActive ? (
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
          style={{ width: '100%', height: '120px', overflow: 'hidden', borderRadius: '12px', background: '#f1f3f4', position: 'relative', cursor: isLiveCallActive ? 'pointer' : 'default' }}
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