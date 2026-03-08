import { useEffect } from "react";
import { ensureBadgeTypes } from "../utils/trelloUtils.js";
import { deriveDescriptionFromTitle } from "../utils/trelloUtils.js";

export function useWorkspaceListeners({
  currentView, setCurrentView,
  setEmailPreview,
  setTrelloCard, setTrelloMenuOpen, setDescEditing, setDescDraft,
}) {

  // Clear right-panel client files when not viewing an email
  useEffect(() => {
    if (currentView.app !== "email") {
      window.dispatchEvent(new CustomEvent("setClientFiles", { detail: { files: [] } }));
    }
  }, [currentView.app]);

  // Open PDF attachment in split-view when clicked from right panel
  useEffect(() => {
    const handler = (e) => {
      const file = e.detail?.file;
      if (!file) return;
      setCurrentView({ app: "email", contact: null });
      setEmailPreview(file);
    };
    window.addEventListener("openEmailAttachmentPreview", handler);
    return () => window.removeEventListener("openEmailAttachmentPreview", handler);
  }, []);

  // Open Trello card modal from any event dispatcher
  useEffect(() => {
    const handler = (e) => {
      setTrelloMenuOpen(false);
      setDescEditing(false);
      setDescDraft("");
      setCurrentView({ app: "trello", contact: null });
      setTrelloCard({
        id: e.detail.id,
        boardList: e.detail.list || "Yolandie",
        listId: e.detail.listId || null,
        title: e.detail.title,
        dueDisplay: e.detail.due,
        members: e.detail.people || [],
        labels: Array.isArray(e.detail.labels) ? e.detail.labels : [],
        badges: ensureBadgeTypes(Array.isArray(e.detail.badges) ? e.detail.badges : []),
        description: (e.detail.description ?? deriveDescriptionFromTitle(e.detail.title)),
        customFields: e.detail.customFields || {},
        timers: { time: e.detail.eta || "0m" },
        activity: [],
        isArchived: e.detail.isArchived || false,
        powerUpData: e.detail.powerUpData || null,
        fromProductivity: e.detail.fromProductivity || false
      });
    };
    window.addEventListener("openTrelloCard", handler);
    return () => window.removeEventListener("openTrelloCard", handler);
  }, []);
}
