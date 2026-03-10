// netlify/functions/daily-ledger.js
import { schedule } from "@netlify/functions";
import { google } from "googleapis";

// Wakes up every day at exactly 21:55 UTC (11:55 PM SAST)
const cronExpression = "55 21 * * *"; 

async function captureSnapshot(event) {
  console.log("[DAILY LEDGER] Waking up to capture midnight productivity snapshot...");

  const { 
    TRELLO_KEY, TRELLO_TOKEN, TRELLO_BOARD_ID, 
    GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY, DAILY_LEDGER_SHEET_ID 
  } = process.env;

  if (!DAILY_LEDGER_SHEET_ID || !GOOGLE_SERVICE_ACCOUNT_EMAIL || !GOOGLE_PRIVATE_KEY) {
    console.error("[DAILY LEDGER] Missing Google Sheets env vars.");
    return { statusCode: 500, body: "Missing env vars" };
  }

  try {
    const base = "https://api.trello.com/1";
    const auth = `key=${TRELLO_KEY}&token=${TRELLO_TOKEN}`;
    
    // 1. Fetch live Trello data
    const [listsRes, cardsRes, membersRes, customFieldsRes] = await Promise.all([
      fetch(`${base}/boards/${TRELLO_BOARD_ID}/lists?${auth}`),
      fetch(`${base}/boards/${TRELLO_BOARD_ID}/cards?customFieldItems=true&fields=name,idList,idMembers&${auth}`),
      fetch(`${base}/boards/${TRELLO_BOARD_ID}/members?${auth}`),
      fetch(`${base}/boards/${TRELLO_BOARD_ID}/customFields?${auth}`)
    ]);

    const rawLists = await listsRes.json();
    const rawCards = await cardsRes.json();
    const rawMembers = await membersRes.json();
    const rawCustomFields = await customFieldsRes.json();

    // 🛡️ SAFETY NET: Ensure Trello returned arrays. Prevents ".find is not a function" crashes.
    const lists = Array.isArray(rawLists) ? rawLists : [];
    const cards = Array.isArray(rawCards) ? rawCards : [];
    const members = Array.isArray(rawMembers) ? rawMembers : [];
    const customFields = Array.isArray(rawCustomFields) ? rawCustomFields : [];

    // 2. Map IDs for accurate counting
    const reviewListId = lists.find(l => l.name === "Siya - Review")?.id;
    const yolandieListId = lists.find(l => l.name === "Yolandie to Send")?.id;
    
    // 🟢 CHANGED: Explicitly target the WorkLog (JSON) field
    const workLogFieldId = customFields.find(f => f.name.includes("WorkLog"))?.id;
    const timerStartFieldId = customFields.find(f => f.name.includes("WorkTimerStart"))?.id;

    const targetUsers = ["Siya", "Enock", "Songeziwe", "Bonisa", "Siya - Review"];
    const todayStr = new Date().toLocaleDateString("en-GB"); 
    const nowMs = Date.now();
    const snapshotRows = [];

    // 3. Process each user
    targetUsers.forEach(user => {
      let completedCards = [];
      let totalMinutes = 0;
      
      const memberId = members.find(m => m.fullName.toLowerCase().includes(user.split(' ')[0].toLowerCase()))?.id;

      cards.forEach(c => {
        if (!c.name || c.name.toLowerCase().includes("out of office")) return;

        // 🟢 Pass the full user/list name to extract their specific time from the JSON
        const { minutes, workedOnIt } = getCardTimeForUser(c, workLogFieldId, timerStartFieldId, user, nowMs);
        totalMinutes += minutes;

        // Completed Logic
        if (user === "Siya - Review") {
          // Siya's Score: All cards currently sitting in Yolandie to Send
          if (c.idList === yolandieListId) {
             completedCards.push(c);
          }
        } else {
          // Data Capturers Score: Cards in Review or Yolandie to Send
          const isCompleted = (c.idList === reviewListId || c.idList === yolandieListId);
          
          // Give credit if they explicitly tracked time on it OR are assigned to it
          const belongsToUser = workedOnIt || (memberId && (c.idMembers || []).includes(memberId));
          
          if (isCompleted && belongsToUser) {
             completedCards.push(c);
          }
        }
      });

      // Deduplicate cards just to be safe
      completedCards = [...new Map(completedCards.map(item => [item.id, item])).values()];

      // Format Time beautifully
      const h = Math.floor(totalMinutes / 60);
      const m = Math.floor(totalMinutes % 60);
      const timeStr = `${h}h ${m}m`;

      // Extract specific card names and join them
      const cardNamesStr = completedCards.map(c => c.name).join("  |  ");

      // Push all 5 columns to the row
      snapshotRows.push([todayStr, user, completedCards.length, timeStr, cardNamesStr]);
    });

    // 4. Authenticate and Push to Google Sheets
    const formattedKey = GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n');
    const authClient = new google.auth.JWT(
      GOOGLE_SERVICE_ACCOUNT_EMAIL,
      null,
      formattedKey,
      ['https://www.googleapis.com/auth/spreadsheets']
    );

    const sheets = google.sheets({ version: 'v4', auth: authClient });

    await sheets.spreadsheets.values.append({
      spreadsheetId: DAILY_LEDGER_SHEET_ID,
      range: 'Daily Ledger!A:E',
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: snapshotRows },
    });

    console.log("[DAILY LEDGER] Successfully backed up scores for the day.");
    return { statusCode: 200, body: JSON.stringify({ ok: true, message: "Ledger updated" }) };

  } catch (error) {
    console.error("[DAILY LEDGER] Fatal error:", error);
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: error.toString() }) };
  }
}

// 🟢 NEW HELPER: Extracts JSON from WorkLog using the List Name
function getCardTimeForUser(c, workLogId, timerStartId, targetListName, nowMs) {
  let minutes = 0;
  let workedOnIt = false;
  const cfItems = c.customFieldItems || [];
  
  // 1. Extract from JSON WorkLog
  const logItem = cfItems.find(item => item.idCustomField === workLogId);
  if (logItem && logItem.value?.text) {
      try {
        const parsed = JSON.parse(logItem.value.text);
        if (parsed[targetListName]) {
          minutes += parseFloat(parsed[targetListName]);
          workedOnIt = true; // We know for a fact they worked on this!
        }
      } catch(e) {}
  }
  
  // 2. Add currently ticking timer if it belongs to this list
  const startItem = cfItems.find(item => item.idCustomField === timerStartId);
  if (startItem && startItem.value?.text) {
    const rawStart = String(startItem.value.text);
    
    // Check if the timer start string contains their list name (timestamp|listName)
    if (rawStart.includes("|")) {
      const parts = rawStart.split("|");
      const activeListName = parts[1];
      
      if (activeListName === targetListName) {
        const startVal = parseFloat(parts[0]);
        if (startVal > 1000000000000) {
          minutes += (nowMs - startVal) / 1000 / 60;
          workedOnIt = true;
        }
      }
    }
  }
  
  // Safety guard against NaN UI glitches
  if (isNaN(minutes) || minutes < 0) minutes = 0;
  return { minutes, workedOnIt };
}

export const handler = schedule(cronExpression, captureSnapshot);