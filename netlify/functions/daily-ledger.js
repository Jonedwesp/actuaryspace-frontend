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

  if (!DAILY_LEDGER_SHEET_ID || !GOOGLE_SERVICE_ACCOUNT_EMAIL) {
    console.error("[DAILY LEDGER] Missing Google Sheets env vars.");
    return { statusCode: 500 };
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

    const lists = await listsRes.json();
    const cards = await cardsRes.json();
    const members = await membersRes.json();
    const customFields = await customFieldsRes.json();

    // 2. Map IDs for accurate counting
    const reviewListId = lists.find(l => l.name === "Siya - Review")?.id;
    const yolandieListId = lists.find(l => l.name === "Yolandie to Send")?.id;
    
    const durationFieldId = customFields.find(f => f.name === "[SYSTEM]WorkDuration")?.id;
    const timerStartFieldId = customFields.find(f => f.name === "[SYSTEM]WorkTimerStart")?.id;

    const targetUsers = ["Siya", "Enock", "Songeziwe", "Bonisa", "Siya - Review"];
    const todayStr = new Date().toLocaleDateString("en-GB"); // DD/MM/YYYY format
    const nowMs = Date.now();
    const snapshotRows = [];

    // 3. Process each user
    targetUsers.forEach(user => {
      let completedCards = [];
      let totalMinutes = 0;
      
      // Safely grab the member ID (e.g. mapping "Siya - Review" to "Siya")
      const memberId = members.find(m => m.fullName.toLowerCase().includes(user.split(' ')[0].toLowerCase()))?.id;

      cards.forEach(c => {
        if (c.name.toLowerCase().includes("out of office")) return;

        // 🟢 NEW: Use the JSON-aware time calculator to pull EXACTLY this user's time
        const { minutes, workedOnIt } = getCardTimeForUser(c, durationFieldId, timerStartFieldId, user, nowMs, lists);
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
          
          // 🟢 NEW: Give credit if they explicitly tracked time on it OR are assigned to it
          const belongsToUser = workedOnIt || (memberId && c.idMembers.includes(memberId));
          
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
    return { statusCode: 200, body: "Ledger updated" };

  } catch (error) {
    console.error("[DAILY LEDGER] Fatal error:", error);
    return { statusCode: 500, body: error.toString() };
  }
}

// 🟢 NEW HELPER: Extracts JSON time and determines fair ownership
function getCardTimeForUser(c, durationId, timerStartId, targetListName, nowMs, lists) {
  let minutes = 0;
  let workedOnIt = false;
  const cfItems = c.customFieldItems || [];
  const targetListId = lists.find(l => l.name === targetListName)?.id;
  
  // 1. Extract Saved Duration JSON
  const durItem = cfItems.find(item => item.idCustomField === durationId);
  if (durItem && durItem.value?.text) {
    const rawDur = String(durItem.value.text);
    if (rawDur.startsWith("{")) {
      try {
        const parsed = JSON.parse(rawDur);
        if (parsed[targetListName]) {
          minutes += parseFloat(parsed[targetListName]);
          workedOnIt = true;
        }
      } catch(e) {}
    } else if (c.idList === targetListId) {
       // Legacy fallback: if it's a raw number, count it if it's currently in their list
       minutes += parseFloat(rawDur) || 0;
       workedOnIt = true;
    }
  }
  
  // 2. Extract Active Ticking Timer (timestamp|listName)
  const startItem = cfItems.find(item => item.idCustomField === timerStartId);
  if (startItem && startItem.value?.text) {
    const rawStart = String(startItem.value.text);
    if (rawStart.includes("|")) {
      const parts = rawStart.split("|");
      const startTsStr = parts[0];
      const listName = parts[1];
      
      if (listName === targetListName) {
        const startVal = parseFloat(startTsStr);
        if (startVal > 1000000000000) {
          minutes += (nowMs - startVal) / 1000 / 60;
          workedOnIt = true;
        }
      }
    } else if (c.idList === targetListId) {
       // Legacy fallback
       const startVal = parseFloat(rawStart);
       if (startVal > 1000000000000) {
          minutes += (nowMs - startVal) / 1000 / 60;
          workedOnIt = true;
       }
    }
  }
  
  if (isNaN(minutes) || minutes < 0) minutes = 0;
  return { minutes, workedOnIt };
}

export const handler = schedule(cronExpression, captureSnapshot);