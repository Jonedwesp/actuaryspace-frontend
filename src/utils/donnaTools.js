// src/utils/donnaTools.js

export const DONNA_TOOLS = [
  // navigate_to_app — auto-executed without approval
  {
    "type": "function",
    "function": {
      "name": "navigate_to_app",
      "description": "Open or close a specific app or screen. Use this when the user asks to open or close Gmail, Google Chat, Calendar, Trello, the Productivity dashboard, or a specific Trello card by name. Use 'none' to close the current app and return to the home screen.",
      "parameters": {
        "type": "object",
        "properties": {
          "app": {
            "type": "string",
            "enum": ["gmail", "gchat", "calendar", "trello", "productivity", "none"],
            "description": "The app to navigate to. Use 'none' to close the current app."
          },
          "trello_card_name": {
            "type": "string",
            "description": "Optional. Part of the name of a specific Trello card to open. Only used when app is 'trello'."
          }
        },
        "required": ["app"]
      }
    }
  },

// calendar-create.js
  {
    "type": "function",
    "function": {
      "name": "calendar_create",
      "description": "Creates a new event in the Google Calendar and automatically generates a Google Meet link. Use this when the user asks to schedule a meeting or block out time.",
      "parameters": {
        "type": "object",
        "properties": {
          "summary": { "type": "string", "description": "The title of the calendar event." },
          "description": { "type": "string", "description": "Detailed notes or description for the event." },
          "location": { "type": "string", "description": "The physical location of the event, if applicable." },
          "date": { "type": "string", "description": "REQUIRED. The exact date of the event strictly in YYYY-MM-DD format. Do not use words like 'today' or 'tomorrow'." },
          "startTime": { "type": "string", "description": "The start time of the event in 24-hour format, e.g. '09:00' or '14:30'." },
          "endTime": { "type": "string", "description": "The end time of the event in 24-hour format, e.g. '10:00' or '15:30'." },
          "guests": { "type": "string", "description": "Comma-separated list of guest email addresses." }
        },
        "required": ["summary", "date"]
      }
    }
  },

 // calendar-delete.js
  {
    "type": "function",
    "function": {
      "name": "calendar_delete",
      "description": "Deletes an existing event from the user's Google Calendar. Use this when the user asks to cancel, remove, or delete a scheduled meeting or event.",
      "parameters": {
        "type": "object",
        "properties": { "eventTitle": { "type": "string", "description": "The exact title or summary of the event to be deleted (e.g., 'Donna Test')." } },
        "required": ["eventTitle"]
      }
    }
  },

  // calendar-events.js
  {
    "type": "function",
    "function": {
      "name": "calendar_get_events",
      "description": "Fetches a list of events from the user's Google Calendar. Use this when the user asks to check their schedule, check their availability, or asks 'what meetings do I have today?'.",
      "parameters": {
        "type": "object",
        "properties": {
          "timeMin": { "type": "string", "description": "Optional. The start of the time range to fetch events for, formatted as an ISO 8601 string." },
          "timeMax": { "type": "string", "description": "Optional. The end of the time range to fetch events for, formatted as an ISO 8601 string." }
        }
      }
    }
  },

  // drive-download.js
  {
    "type": "function",
    "function": {
      "name": "drive_download_file",
      "description": "Downloads a specific file from Google Drive using its unique file ID. Use this when the user asks to retrieve, download, or view a specific file from their Drive.",
      "parameters": {
        "type": "object",
        "properties": {
          "id": { "type": "string", "description": "The unique Google Drive ID of the file to download." },
          "name": { "type": "string", "description": "Optional. The name of the file to be downloaded, including the file extension." },
          "mimeType": { "type": "string", "description": "Optional. The exact MIME type of the file." }
        },
        "required": ["id"]
      }
    }
  },

  // excel-export.cjs
  {
    "type": "function",
    "function": {
      "name": "excel_export",
      "description": "Exports extracted AI document data into a formatted CSV/Excel file. Use this when the user asks to export the results, submit to sheets, or download the extraction data.",
      "parameters": {
        "type": "object",
        "properties": { "batchId": { "type": "string", "description": "The unique Firestore batch ID containing the extracted data." } },
        "required": ["batchId"]
      }
    }
  },

  // firestore-approve-doc.js
  {
    "type": "function",
    "function": {
      "name": "firestore_approve_doc",
      "description": "Approves a specific document extraction within a batch, marking it as verified. Use this when the user says 'approve this document' or 'mark extraction as correct'.",
      "parameters": {
        "type": "object",
        "properties": {
          "batchId": { "type": "string", "description": "The unique Firestore batch ID." },
          "fileName": { "type": "string", "description": "The original name of the file being approved (e.g., 'payslip.pdf')." }
        },
        "required": ["batchId", "fileName"]
      }
    }
  },

  // firestore-batch-status.js
  {
    "type": "function",
    "function": {
      "name": "firestore_batch_status",
      "description": "Checks the AI extraction status (e.g., Extracting, Approved) for a specific email or document batch.",
      "parameters": {
        "type": "object",
        "properties": { "messageId": { "type": "string", "description": "The unique Gmail message ID associated with the document batch." } },
        "required": ["messageId"]
      }
    }
  },

  // gchat-delete-spaces.js
  {
    "type": "function",
    "function": {
      "name": "gchat_delete_space",
      "description": "Deletes or hides a Google Chat space or direct message thread. Use this when the user asks to delete a chat.",
      "parameters": {
        "type": "object",
        "properties": { "spaceId": { "type": "string", "description": "The Google Chat space ID to delete." } },
        "required": ["spaceId"]
      }
    }
  },

  // gchat-find-gm.js
  {
    "type": "function",
    "function": {
      "name": "gchat_start_direct_message",
      "description": "Starts a new Google Chat direct message with a specific user.",
      "parameters": {
        "type": "object",
        "properties": { "email": { "type": "string", "description": "The email address of the person to start a chat with." } },
        "required": ["email"]
      }
    }
  },

// gchat-mark-read.js
  {
    "type": "function",
    "function": {
      "name": "gchat_mark_read_status",
      "description": "Marks a Google Chat space as read. Use this when the user asks to clear notifications or mark a chat as seen.",
      "parameters": {
        "type": "object",
        "properties": { "spaceId": { "type": "string", "description": "The Google Chat space ID to mark as read." } },
        "required": ["spaceId"]
      }
    }
  },

  // gchat-mute.js
  {
    "type": "function",
    "function": {
      "name": "gchat_mute_space",
      "description": "Mutes or unmutes a specific Google Chat space or direct message. Use this when the user asks to mute a chat, silence a conversation, or unmute someone.",
      "parameters": {
        "type": "object",
        "properties": {
          "spaceId": { "type": "string", "description": "The Google Chat space ID to mute or unmute. If the user doesn't specify, you can omit this to target the currently open chat." },
          "mute": { "type": "boolean", "description": "True to mute the space, false to unmute it." }
        },
        "required": ["mute"]
      }
    }
  },

  // gchat-messages.js
  {
    "type": "function",
    "function": {
      "name": "gchat_get_messages",
      "description": "Fetches the message history for a specific Google Chat space.",
      "parameters": {
        "type": "object",
        "properties": {
          "space": { "type": "string", "description": "The Google Chat space ID." },
          "before": { "type": "string", "description": "Optional. An ISO timestamp to fetch messages older than this date." }
        },
        "required": ["space"]
      }
    }
  },

  // gchat-react.js
  {
    "type": "function",
    "function": {
      "name": "gchat_react_message",
      "description": "Adds an emoji reaction to a specific Google Chat message.",
      "parameters": {
        "type": "object",
        "properties": {
          "messageId": { "type": "string", "description": "The full Google Chat message ID." },
          "type": { "type": "string", "enum": ["like", "heart", "laugh"], "description": "The type of emoji reaction to add." }
        },
        "required": ["messageId", "type"]
      }
    }
  },

  // gchat-send.js
  {
    "type": "function",
    "function": {
      "name": "gchat_send_message",
      "description": "Sends a text message to a Google Chat space or direct message.",
      "parameters": {
        "type": "object",
        "properties": {
          "space": { "type": "string", "description": "The Google Chat space ID or the exact name of the space/person to send the message to." },
          "text": { "type": "string", "description": "The actual text content of the message to send." }
        },
        "required": ["space", "text"]
      }
    }
  },

  // gchat-spaces.js
  {
    "type": "function",
    "function": {
      "name": "gchat_get_spaces",
      "description": "Retrieves the list of all Google Chat spaces and direct messages the user is part of.",
      "parameters": {
        "type": "object",
        "properties": {}
      }
    }
  },

  // gmail-inbox.js
  {
    "type": "function",
    "function": {
      "name": "gmail_get_inbox",
      "description": "Fetches a list of emails from the user's Gmail account. Use this when the user asks to check their email, read their inbox, or search for a specific email.",
      "parameters": {
        "type": "object",
        "properties": {
          "folder": { "type": "string", "enum": ["INBOX", "TRASH", "STARRED", "SENT", "DRAFTS"], "description": "The specific folder to view. Defaults to INBOX." },
          "limit": { "type": "string", "description": "The number of emails to return (e.g., '50')." },
          "q": { "type": "string", "description": "Optional keyword search query to find specific emails." }
        }
      }
    }
  },

// gmail-message.js
  {
    "type": "function",
    "function": {
      "name": "gmail_get_message",
      "description": "Fetches the full content, body, and attachment details of a specific email. Use this when the user asks to open, read, check for attachments, summarize, or explain a specific email.",
      "parameters": {
        "type": "object",
        "properties": { 
          "messageId": { "type": "string", "description": "The unique ID of the Gmail message." },
          "senderName": { "type": "string", "description": "The name of the person who sent the email. Used to display context to the user." },
          "subject": { "type": "string", "description": "The subject line of the email." }
        },
        "required": ["messageId", "senderName", "subject"]
      }
    }
  },

  // gmail-send-email.js
  {
    "type": "function",
    "function": {
      "name": "gmail_send_email",
      "description": "Sends a new email from the user's account.",
      "parameters": {
        "type": "object",
        "properties": {
          "to": { "type": "string", "description": "The recipient's email address." },
          "subject": { "type": "string", "description": "The subject line of the email." },
          "body": { "type": "string", "description": "The main text body of the email." }
        },
        "required": ["to", "subject", "body"]
      }
    }
  },

  // gmail-save-draft.js
  {
    "type": "function",
    "function": {
      "name": "gmail_save_draft",
      "description": "Saves an email as a draft without sending it. Use this when the user asks to draft an email or prepare a response for later.",
      "parameters": {
        "type": "object",
        "properties": {
          "to": { "type": "string", "description": "The intended recipient's email address." },
          "subject": { "type": "string", "description": "The subject line of the draft." },
          "body": { "type": "string", "description": "The main text body of the draft." }
        },
        "required": ["to", "subject", "body"]
      }
    }
  },

// gmail-delete-bulk.js
  {
    "type": "function",
    "function": {
      "name": "gmail_delete_bulk",
      "description": "Moves emails to trash, permanently deletes them, or restores them from the trash.",
      "parameters": {
        "type": "object",
        "properties": {
          "messageIds": { "type": "array", "items": { "type": "string" }, "description": "An array of Gmail message IDs to affect." },
          "permanent": { "type": "boolean", "description": "Set to true to permanently delete the emails." },
          "restore": { "type": "boolean", "description": "Set to true to pull the emails out of the trash and back into the inbox." },
          "senderName": { "type": "string", "description": "The name of the sender of the email(s) being deleted or restored." },
          "subject": { "type": "string", "description": "The subject line of the email(s) being deleted or restored." }
        },
        "required": ["messageIds", "senderName", "subject"]
      }
    }
  },

 // gmail-toggle-star.js
  {
    "type": "function",
    "function": {
      "name": "gmail_toggle_star",
      "description": "Stars or unstars a specific email in Gmail. Use this when the user asks to flag, star, or highlight an email.",
      "parameters": {
        "type": "object",
        "properties": {
          "messageId": { "type": "string", "description": "The unique ID of the Gmail message." },
          "starred": { "type": "boolean", "description": "True to add a star, false to remove the star." },
          "senderName": { "type": "string", "description": "The name of the sender of the email." },
          "subject": { "type": "string", "description": "The subject line of the email." }
        },
        "required": ["messageId", "starred", "senderName", "subject"]
      }
    }
  },

// gmail-mark-unread.js
  {
    "type": "function",
    "function": {
      "name": "gmail_mark_unread",
      "description": "Marks a specific email as unread in Gmail. Use this when the user asks to mark an email as unread.",
      "parameters": {
        "type": "object",
        "properties": {
          "messageId": { "type": "string", "description": "The unique ID of the Gmail message." },
          "senderName": { "type": "string", "description": "The name of the sender of the email." },
          "subject": { "type": "string", "description": "The subject line of the email." }
        },
        "required": ["messageId", "senderName", "subject"]
      }
    }
  },

  // sheet-update-tracker.js
  {
    "type": "function",
    "function": {
      "name": "sheet_update_tracker",
      "description": "Appends a new row to the Google Sheet tracker using the raw text of an Actuarial Case Card.",
      "parameters": {
        "type": "object",
        "properties": { "caseCardText": { "type": "string", "description": "The raw text string containing the case details (Claimant, Matter, AC REF)." } },
        "required": ["caseCardText"]
      }
    }
  },

  // trello-lists.js
  {
    "type": "function",
    "function": {
      "name": "trello_get_lists",
      "description": "Fetches all lists on the Trello board. Use this to find the targetListId before moving a card.",
      "parameters": {
        "type": "object",
        "properties": {}
      }
    }
  },

  // trello-members.js
  {
    "type": "function",
    "function": {
      "name": "trello_get_members",
      "description": "Fetches all members on the Trello board. Use this to find a memberId before assigning someone to a card.",
      "parameters": {
        "type": "object",
        "properties": {}
      }
    }
  },

  // trello-move.js
  {
    "type": "function",
    "function": {
      "name": "trello_move_card",
      "description": "Moves a Trello card to a different list. Use this to change the status or progress of a card.",
      "parameters": {
        "type": "object",
        "properties": {
          "cardId": { "type": "string", "description": "The ID or the exact name of the card to move." },
          "targetListId": { "type": "string", "description": "The ID or exact name of the list to move the card into (e.g., 'Bonisa')." },
          "newIndex": { "type": "number", "description": "Optional. The specific position index in the list." }
        },
        "required": ["cardId", "targetListId"]
      }
    }
  },

  // trello-add-comment.js
  {
    "type": "function",
    "function": {
      "name": "trello_add_comment",
      "description": "Adds a comment to a specific Trello card.",
      "parameters": {
        "type": "object",
        "properties": {
          "cardId": { "type": "string", "description": "The ID or the exact name of the Trello card." },
          "text": { "type": "string", "description": "The comment text." }
        },
        "required": ["cardId", "text"]
      }
    }
  },

  // trello-set-custom-field.js
  {
    "type": "function",
    "function": {
      "name": "trello_set_custom_field",
      "description": "Updates a custom field (like Priority, Status, or Active) on a Trello card.",
      "parameters": {
        "type": "object",
        "properties": {
          "cardId": { "type": "string", "description": "The ID or the exact name of the Trello card." },
          "fieldName": { "type": "string", "description": "The exact name of the field to update (e.g., 'Priority', 'Status', 'Active')." },
          "valueText": { "type": "string", "description": "The new value to set (e.g., 'HIGH URGENT', 'To Do - RAF')." }
        },
        "required": ["cardId", "fieldName", "valueText"]
      }
    }
  },

  // trello-timer.js
  {
    "type": "function",
    "function": {
      "name": "trello_timer",
      "description": "Starts or stops the activity timer on a Trello card.",
      "parameters": {
        "type": "object",
        "properties": {
          "cardId": { "type": "string", "description": "The ID or the exact name of the Trello card." },
          "action": { "type": "string", "enum": ["start", "stop"], "description": "Whether to start or stop the timer." }
        },
        "required": ["cardId", "action"]
      }
    }
  },

  // trello-toggle-label.js
  {
    "type": "function",
    "function": {
      "name": "trello_toggle_label",
      "description": "Adds or removes a colored label on a Trello card.",
      "parameters": {
        "type": "object",
        "properties": {
          "cardId": { "type": "string", "description": "The ID or the exact name of the Trello card." },
          "labelName": { "type": "string", "description": "The text name of the label (e.g., 'RAF LOE', 'RyanGPT')." },
          "shouldAdd": { "type": "boolean", "description": "True to add the label, false to remove it." }
        },
        "required": ["cardId", "labelName", "shouldAdd"]
      }
    }
  },

  // trello-toggle-member.js
  {
    "type": "function",
    "function": {
      "name": "trello_toggle_member",
      "description": "Assigns or unassigns a team member to a Trello card.",
      "parameters": {
        "type": "object",
        "properties": {
          "cardId": { "type": "string", "description": "The ID or the exact name of the Trello card." },
          "memberId": { "type": "string", "description": "The ID of the Trello member." },
          "shouldAdd": { "type": "boolean", "description": "True to assign the member, false to remove them." }
        },
        "required": ["cardId", "memberId", "shouldAdd"]
      }
    }
  },

  // trello-add-card.js
  {
    "type": "function",
    "function": {
      "name": "trello_add_simple_card",
      "description": "Creates a basic, generic Trello card. You MUST provide the numerical targetListId (idList). If you do not have the ID for the list Siya mentioned, call 'trello_get_lists' first.",
      "parameters": {
        "type": "object",
        "properties": {
          "name": { "type": "string", "description": "The title of the task or card." },
          "idList": { "type": "string", "description": "The unique numerical ID of the Trello list. Do not use the name (e.g., 'Siya'); use the ID from your context or trello_get_lists." }
        },
        "required": ["name", "idList"]
      }
    }
  },

  // trello-set-description.js
  {
    "type": "function",
    "function": {
      "name": "trello_set_description",
      "description": "Updates the main description text of a Trello card.",
      "parameters": {
        "type": "object",
        "properties": {
          "cardId": { "type": "string", "description": "The ID or the exact name of the Trello card." },
          "desc": { "type": "string", "description": "The new description text." }
        },
        "required": ["cardId", "desc"]
      }
    }
  },

  // trello-archive.js
  {
    "type": "function",
    "function": {
      "name": "trello_archive_card",
      "description": "Archives a Trello card, removing it from the active board.",
      "parameters": {
        "type": "object",
        "properties": { "cardId": { "type": "string", "description": "The ID or the exact name of the Trello card to archive." } },
        "required": ["cardId"]
      }
    }
  },

  // gmail-mark-read.js
  {
    "type": "function",
    "function": {
      "name": "gmail_mark_read",
      "description": "Marks a Gmail message as read (pass messageId), OR marks a Google Chat space as read (pass spaceId). You must provide exactly one of the two IDs.",
      "parameters": {
        "type": "object",
        "properties": {
          "messageId": { "type": "string", "description": "The unique ID of the Gmail message to mark as read. Provide this OR spaceId, not both." },
          "spaceId": { "type": "string", "description": "The Google Chat space ID to mark as read. Provide this OR messageId, not both." }
        }
      }
    }
  },

  // trello-productivity.js
  {
    "type": "function",
    "function": {
      "name": "trello_get_productivity",
      "description": "Fetches the live productivity stats for the team today, showing how many minutes each person (Siya, Enock, Songeziwe, Bonisa) has logged.",
      "parameters": {
        "type": "object",
        "properties": {}
      }
    }
  },

  // trello-actions.js
  {
    "type": "function",
    "function": {
      "name": "trello_get_card_history",
      "description": "Fetches the activity history and comments of a specific Trello card. Use this to see who moved a card, who commented, or what happened previously.",
      "parameters": {
        "type": "object",
        "properties": {
          "cardId": { "type": "string", "description": "The ID or the exact name of the Trello card." }
        },
        "required": ["cardId"]
      }
    }
  },

  // trello-add-card.js
  {
    "type": "function",
    "function": {
      "name": "trello_add_simple_card",
      "description": "Creates a basic, generic Trello card (unlike the complex case cards). Use this for simple tasks, reminders, or general notes.",
      "parameters": {
        "type": "object",
        "properties": {
          "name": { "type": "string", "description": "The title of the task or card." },
          "idList": { "type": "string", "description": "The ID or the exact name of the list where the card should be created." }
        },
        "required": ["name", "idList"]
      }
    }
  },

  // trello-archived.js
  {
    "type": "function",
    "function": {
      "name": "trello_get_archived_cards",
      "description": "Fetches a list of recently archived or closed cards from the board.",
      "parameters": {
        "type": "object",
        "properties": {}
      }
    }
  },

  // trello-restore.js
  {
    "type": "function",
    "function": {
      "name": "trello_restore_card",
      "description": "Restores an archived card back to the active Trello board.",
      "parameters": {
        "type": "object",
        "properties": {
          "cardId": { "type": "string", "description": "The ID of the Trello card to restore." }
        },
        "required": ["cardId"]
      }
    }
  },

  // trello-attach-link.js
  {
    "type": "function",
    "function": {
      "name": "trello_attach_link",
      "description": "Attaches a URL link to a Trello card.",
      "parameters": {
        "type": "object",
        "properties": {
          "cardId": { "type": "string", "description": "The ID or the exact name of the Trello card." },
          "url": { "type": "string", "description": "The URL to attach." },
          "name": { "type": "string", "description": "Optional name for the link." }
        },
        "required": ["cardId", "url"]
      }
    }
  },

  // trello-checklists.js
  {
    "type": "function",
    "function": {
      "name": "trello_manage_checklists",
      "description": "Creates, deletes, or updates checklists and checklist items on a Trello card.",
      "parameters": {
        "type": "object",
        "properties": {
          "action": { "type": "string", "enum": ["create_checklist", "delete_checklist", "add_item", "toggle_item"], "description": "The specific checklist action to perform." },
          "cardId": { "type": "string", "description": "The ID or the exact name of the Trello card." },
          "checklistId": { "type": "string", "description": "Required for delete_checklist and add_item." },
          "idCheckItem": { "type": "string", "description": "Required for toggle_item." },
          "name": { "type": "string", "description": "The name of the new checklist or item to add." },
          "state": { "type": "string", "enum": ["complete", "incomplete"], "description": "Required for toggle_item." }
        },
        "required": ["action", "cardId"]
      }
    }
  },

  // trello-edit-comment.js
  {
    "type": "function",
    "function": {
      "name": "trello_edit_comment",
      "description": "Edits an existing comment on a Trello card.",
      "parameters": {
        "type": "object",
        "properties": {
          "actionId": { "type": "string", "description": "The ID of the comment action." },
          "text": { "type": "string", "description": "The new text for the comment." }
        },
        "required": ["actionId", "text"]
      }
    }
  },

  // trello-delete-comment.js
  {
    "type": "function",
    "function": {
      "name": "trello_delete_comment",
      "description": "Deletes a comment from a Trello card.",
      "parameters": {
        "type": "object",
        "properties": {
          "actionId": { "type": "string", "description": "The ID of the comment action to delete." }
        },
        "required": ["actionId"]
      }
    }
  },

  // gmail-contacts.js
  {
    "type": "function",
    "function": {
      "name": "gmail_get_contacts",
      "description": "Fetches the user's full contacts list as a name-to-email map. Use this whenever you need to look up someone's email address by name before sending an email or starting a chat.",
      "parameters": {
        "type": "object",
        "properties": {}
      }
    }
  },

  // trello-delete-card.js
  {
    "type": "function",
    "function": {
      "name": "trello_delete_card",
      "description": "Permanently deletes a Trello card. This is irreversible — use trello_archive_card instead if the user may want to restore it later.",
      "parameters": {
        "type": "object",
        "properties": {
          "cardId": { "type": "string", "description": "The ID of the Trello card to permanently delete." }
        },
        "required": ["cardId"]
      }
    }
  },

  // gmail-mark-unread-bulk.js
  {
    "type": "function",
    "function": {
      "name": "gmail_mark_unread_bulk",
      "description": "Marks multiple emails as unread in a single batch operation. Use this when the user asks to mark several emails unread at once.",
      "parameters": {
        "type": "object",
        "properties": {
          "messageIds": { "type": "array", "items": { "type": "string" }, "description": "An array of Gmail message IDs to mark as unread." }
        },
        "required": ["messageIds"]
      }
    }
  },

  // gchat-upload.js
  {
    "type": "function",
    "function": {
      "name": "gchat_upload_file",
      "description": "Sends a file attachment to a Google Chat space or direct message.",
      "parameters": {
        "type": "object",
        "properties": {
          "space": { "type": "string", "description": "The Google Chat space ID to send the file to." },
          "filename": { "type": "string", "description": "The name of the file including its extension (e.g., 'report.pdf')." },
          "mimeType": { "type": "string", "description": "The MIME type of the file (e.g., 'application/pdf', 'image/png')." },
          "fileBase64": { "type": "string", "description": "The file content encoded as a Base64 string." },
          "text": { "type": "string", "description": "Optional. A text message to accompany the file." }
        },
        "required": ["space", "filename", "fileBase64"]
      }
    }
  },

// trello-attachments.js
  {
    "type": "function",
    "function": {
      "name": "trello_manage_attachments",
      "description": "Lists all attachments on a Trello card, or deletes a specific attachment.",
      "parameters": {
        "type": "object",
        "properties": {
          "action": { "type": "string", "enum": ["list", "delete"], "description": "'list' to fetch all attachments on a card, 'delete' to remove a specific one." },
          "cardId": { "type": "string", "description": "The ID of the Trello card." },
          "idAttachment": { "type": "string", "description": "Required for 'delete'. The ID of the specific attachment to remove." }
        },
        "required": ["action", "cardId"]
      }
    }
  },

 // system-toggle-mute
  {
    "type": "function",
    "function": {
      "name": "system_toggle_mute",
      "description": "Mutes or unmutes all system-wide notifications across all apps (Gmail, GChat, Trello, Calendar). Use this when the user asks to mute everything, silence notifications, or turn off sounds.",
      "parameters": {
        "type": "object",
        "properties": {
          "mute": { "type": "boolean", "description": "True to mute all notifications, false to unmute them." }
        },
        "required": ["mute"]
      }
    }
  },

// system-read-notifications
  {
    "type": "function",
    "function": {
      "name": "system_read_notifications",
      "description": "Reads the exact number and details of unread notifications for Gmail, Google Chat, Trello, Calendar, or WhatsApp. Use this whenever the user asks 'how many notifications do I have', 'check my messages', 'read my notifications', or asks to list notifications from a specific person or timeframe.",
      "parameters": {
        "type": "object",
        "properties": {
          "senderName": { "type": "string", "description": "Optional. The name of the specific person the user is asking about (e.g., 'Bonolo', 'Jonathan')." },
          "timeframeMinutes": { "type": "number", "description": "Optional. The timeframe in minutes to filter notifications. For example, for 'past 2 hours' pass 120, for 'last 30 minutes' pass 30." }
        }
      }
    }
  }
];