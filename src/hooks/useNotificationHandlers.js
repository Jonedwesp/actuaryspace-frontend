export function useNotificationHandlers({
  setCurrentView,
  setNotifications, dismissedNotifsRef, setExitingNotifIds,
  setUnreadGchatSpaces, setTrashedGchatSpaces, gchatSpaces, setGchatMessages, setGchatSelectedSpace,
  setGmailEmails, gmailFolder, setSelectedDraftTemplate, setDraftTo, setDraftAttachments, setEmail, setEmailPreview,
  setCalendarViewDate, setSelectedEvent,
}) {

  const dismissNotification = (n) => {
    if (n.alt === "Gmail" && n.gmailData?.id) {
      fetch("/.netlify/functions/gmail-mark-read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId: n.gmailData.id })
      }).catch(err => console.error("Mark read failed", err));
      setGmailEmails(prev => prev.map(e => e.id === n.gmailData.id ? { ...e, isUnread: false } : e));
    }

    const idToRemove = typeof n === "string" ? n : n.id;
    dismissedNotifsRef.current.add(idToRemove);
    localStorage.setItem("DISMISSED_NOTIFS", JSON.stringify(Array.from(dismissedNotifsRef.current)));

    setExitingNotifIds(prev => new Set([...prev, idToRemove]));
    setTimeout(() => {
      setNotifications((prev) => prev.filter((x) => x.id !== idToRemove));
      setExitingNotifIds(prev => { const next = new Set(prev); next.delete(idToRemove); return next; });
    }, 220);
  };

  const onNotificationClick = async (n) => {
    dismissNotification(n);

    // 1. Google Chat Handler
    if (n.alt === "Google Chat") {
      setCurrentView({ app: "gchat", contact: null });
      const sid = n.spaceId || n.gmailData?.spaceId || n.id;
      if (sid) {
        setUnreadGchatSpaces(prev => {
          const next = { ...prev };
          delete next[sid];
          return next;
        });

        fetch("/.netlify/functions/gchat-mark-read", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ spaceId: sid })
        }).catch(err => console.error("GChat mark-read failed", err));

        setNotifications(prev => {
          const toRemove = prev.filter(x => x.alt === "Google Chat" && (x.spaceId === sid));
          toRemove.forEach(x => { dismissedNotifsRef.current.add(x.id); });
          if (toRemove.length > 0) {
            localStorage.setItem("DISMISSED_NOTIFS", JSON.stringify(Array.from(dismissedNotifsRef.current)));
          }
          return prev.filter(x => !(x.alt === "Google Chat" && x.spaceId === sid));
        });

        setTrashedGchatSpaces(prev => {
          if (!prev.includes(sid)) return prev;
          const next = prev.filter(id => id !== sid);
          localStorage.setItem("GCHAT_TRASHED", JSON.stringify(next));
          return next;
        });

        const targetSpace = gchatSpaces.find((s) => s.id === sid || s.name === sid);
        const targetId = targetSpace?.id || sid;
        const cachedPillStr = localStorage.getItem(`GCHAT_MSGS_${targetId}`);
        try { setGchatMessages(cachedPillStr ? JSON.parse(cachedPillStr) : []); }
        catch(e) { setGchatMessages([]); }
        if (targetSpace) {
          setGchatSelectedSpace(targetSpace);
        } else {
          setGchatSelectedSpace({ id: sid, name: sid, type: "DIRECT_MESSAGE", displayName: n.senderName });
        }
      }
      return;
    }

    // 2. Trello Handler
    if (n.alt === "Trello" && n.cardData) {
      setCurrentView({ app: "trello", contact: null });
      window.dispatchEvent(new CustomEvent("openTrelloCard", { detail: n.cardData }));
      return;
    }

    // 3. Gmail Inbox Handler (Real API)
    if (n.alt === "Gmail" && n.gmailData) {
      const msg = n.gmailData;
      setGmailEmails(prev => prev.map(e => e.id === msg.id ? { ...e, isUnread: false } : e));

      if (msg.labelIds?.includes("DRAFT") || gmailFolder === "DRAFTS") {
        const openDraft = (bodyStr, atts) => {
          const isHtml = /<(html|body|div|p|br|b|strong|i|em|a|span|table|style)[^>]*>/i.test(bodyStr || "");
          const rawBody = isHtml ? bodyStr.replace(/<[^>]+>/g, "") : (bodyStr || "");
          let toEmail = "";
          if (msg.to) {
            const toStr = Array.isArray(msg.to) ? msg.to[0] : msg.to;
            const emailMatch = (typeof toStr === "string" ? toStr : "").match(/<([^>]+)>/);
            toEmail = emailMatch ? emailMatch[1].trim() : (typeof toStr === "string" ? toStr.replace(/"/g, '').trim() : "");
          }
          setSelectedDraftTemplate({ id: "existing_draft", draftId: msg.id, label: "Edit Draft", subject: msg.subject || "", body: rawBody + "\n\n", isForward: false });
          setDraftTo(toEmail);
          if (atts?.length > 0) {
            Promise.all(atts.map(async (a) => { const res = await fetch(`/.netlify/functions/gmail-download?messageId=${msg.id}&attachmentId=${a.id}&filename=${encodeURIComponent(a.name)}&mimeType=${encodeURIComponent(a.mimeType)}`); const blob = await res.blob(); return new File([blob], a.name, { type: a.mimeType }); })).then(files => setDraftAttachments(files));
          }
          setEmail(null);
          setCurrentView({ app: "gmail", contact: null });
        };
        if (msg.bodyLoaded) {
          openDraft(msg.body, msg.attachments);
        } else {
          fetch(`/.netlify/functions/gmail-message?messageId=${msg.id}`).then(r => r.json()).then(json => {
            if (json.ok) { setGmailEmails(prev => prev.map(e => e.id === msg.id ? { ...e, body: json.body, attachments: json.attachments, bodyLoaded: true } : e)); openDraft(json.body, json.attachments); }
          }).catch(() => openDraft("", []));
        }
        return;
      }

      const fromParts = msg.from ? msg.from.split("<") : ["Unknown", ""];
      const fromName = fromParts[0].replace(/"/g, '').trim();
      const fromEmail = fromParts[1] ? "<" + fromParts[1] : "";
      const baseEmail = { id: msg.id, messageId: msg.messageId, subject: msg.subject, fromName, fromEmail, to: msg.to, date: msg.date, isStarred: msg.isStarred, snippet: msg.snippet || "", labelIds: msg.labelIds || [], time: new Date(msg.date).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }), actions: [{ key: "submit_trello", label: "Submit to Trello" }, { key: "update_tracker", label: "Update AC Tracker" }] };
      const processBody = (bodyStr, atts) => {
        const isHtml = /<(html|body|div|p|br|b|strong|i|em|a|span|table|style)[^>]*>/i.test(bodyStr || "");
        let rawBody = bodyStr || msg.snippet || "";
        if (!isHtml && rawBody.split('\n').length < 4) { rawBody = rawBody.replace(/(---------- Forwarded message ---------)/gi, '\n\n$1\n').replace(/(From:|Date:|Subject:|To:|Cc:)/g, '\n$1').replace(/(Dear\s+[A-Za-z]+|Hi\s+[A-Za-z]+|Good\s+day)/gi, '\n\n$1\n\n').replace(/(Kind\s+Regards|Regards|Sincerely|Thank\s+you)/gi, '\n\n$1\n').replace(/(On\s+(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[^:]+wrote:)/gi, '\n\n$1\n').trim(); }
        return { body: isHtml ? "" : rawBody, bodyHtml: isHtml ? bodyStr : "", attachments: (atts || []).map(a => ({ ...a, type: a.mimeType.includes("pdf") ? "pdf" : a.mimeType.includes("image") ? "img" : a.mimeType.includes("spreadsheet") || a.mimeType.includes("excel") ? "xls" : "file", url: `/.netlify/functions/gmail-download?messageId=${msg.id}&attachmentId=${a.id}&filename=${encodeURIComponent(a.name)}&mimeType=${encodeURIComponent(a.mimeType)}` })) };
      };
      if (msg.bodyLoaded) {
        setEmail({ ...baseEmail, ...processBody(msg.body, msg.attachments), bodyLoading: false });
      } else {
        setEmail({ ...baseEmail, body: "", bodyHtml: "", attachments: [], bodyLoading: true });
        fetch(`/.netlify/functions/gmail-message?messageId=${msg.id}`).then(r => r.json()).then(json => {
          if (!json.ok) return;
          setGmailEmails(prev => prev.map(e => e.id === msg.id ? { ...e, body: json.body, attachments: json.attachments, bodyLoaded: true } : e));
          setEmail(prev => { if (!prev || prev.id !== msg.id) return prev; return { ...prev, ...processBody(json.body, json.attachments), bodyLoading: false }; });
        }).catch(() => setEmail(prev => prev?.id === msg.id ? { ...prev, body: msg.snippet || "", bodyLoading: false } : prev));
      }

      setEmailPreview(null);
      setCurrentView({ app: "email", contact: null });
      return;
    }

    // 4. Drive Email Handler (Legacy Data Centre)
    if (n.alt === "Gmail" && n.driveEmail) {
      setCurrentView({ app: "email", contact: null });
      return;
    }

    // 5. Calendar Meeting Reminder Handler
    if (n.alt === "Calendar" && n.calendarEventData) {
      const ev = n.calendarEventData;
      const evDate = ev.start?.dateTime ? new Date(ev.start.dateTime) : new Date();
      setCurrentView({ app: "calendar", contact: null });
      setCalendarViewDate(new Date(evDate.getFullYear(), evDate.getMonth(), 1));
      setSelectedEvent(ev);
      return;
    }
  };

  return { onNotificationClick, dismissNotification };
}
