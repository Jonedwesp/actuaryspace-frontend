// src/utils/donnaTools.js

export const DONNA_TOOLS = [
  // calendar-create.js
  {
    "type": "function",
    "function": {
      "name": "calendar_create",
      "description": "Creates a new event in the Google Calendar and automatically generates a Google Meet link. Use this when the user asks to schedule a meeting or block out time.",
      "parameters": {
        "type": "object",
        "properties": {
          "summary": {
            "type": "string",
            "description": "The title of the calendar event."
          },
          "description": {
            "type": "string",
            "description": "Detailed notes or description for the event."
          },
          "location": {
            "type": "string",
            "description": "The physical location of the event, if applicable."
          },
          "start": {
            "type": "object",
            "description": "The start time of the event. Must include 'dateTime' (ISO 8601 format) and 'timeZone' (e.g., 'Africa/Johannesburg').",
            "properties": {
              "dateTime": {
                "type": "string",
                "description": "ISO 8601 formatted date and time, e.g., '2026-03-10T09:00:00+02:00'"
              },
              "timeZone": {
                "type": "string",
                "description": "The IANA timezone ID, e.g., 'Africa/Johannesburg'"
              }
            },
            "required": ["dateTime", "timeZone"]
          },
          "end": {
            "type": "object",
            "description": "The end time of the event. Must include 'dateTime' (ISO 8601 format) and 'timeZone'.",
            "properties": {
              "dateTime": {
                "type": "string",
                "description": "ISO 8601 formatted date and time, e.g., '2026-03-10T10:00:00+02:00'"
              },
              "timeZone": {
                "type": "string",
                "description": "The IANA timezone ID, e.g., 'Africa/Johannesburg'"
              }
            },
            "required": ["dateTime", "timeZone"]
          },
          "attendees": {
            "type": "array",
            "description": "List of attendees to invite to the event.",
            "items": {
              "type": "object",
              "properties": {
                "email": {
                  "type": "string",
                  "description": "The email address of the attendee."
                }
              },
              "required": ["email"]
            }
          }
        },
        "required": ["summary", "start", "end"]
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
        "properties": {
          "eventId": {
            "type": "string",
            "description": "The unique Google Calendar ID of the event to be deleted."
          }
        },
        "required": ["eventId"]
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
          "timeMin": {
            "type": "string",
            "description": "Optional. The start of the time range to fetch events for, formatted as an ISO 8601 string (e.g., '2026-03-09T00:00:00Z'). If omitted, defaults to the start of the current month."
          },
          "timeMax": {
            "type": "string",
            "description": "Optional. The end of the time range to fetch events for, formatted as an ISO 8601 string (e.g., '2026-03-09T23:59:59Z'). If omitted, defaults to the end of the next month."
          }
        }
      }
    }
  }
];