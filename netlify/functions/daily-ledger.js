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
    
    // 1. Fetch live Trello data (Lists, Cards, Members, and Custom Fields)
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
    
    // 🟢 UPDATED to look for the WorkFlow fields with the [SYSTEM] tag
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

      if (user === "Siya - Review") {
        // Siya's Score: Cards currently in Yolandie to Send
        completedCards = cards.filter(c => c.idList === yolandieListId && !c.name.toLowerCase().includes("out of office"));
        
        // Siya's Time: Sum time across ALL cards assigned to the person Siya
        const siyaMemberId = members.find(m => m.fullName.toLowerCase().includes("siya"))?.id;
        const allSiyaCards = cards.filter(c => c.idMembers.includes(siyaMemberId));
        totalMinutes = calculateTime(allSiyaCards, durationFieldId, timerStartFieldId, nowMs);

      } else {
        // Data Capturers
        const memberId = members.find(m => m.fullName.toLowerCase().includes(user.toLowerCase()))?.id;
        const assignedCards = cards.filter(c => c.idMembers.includes(memberId) && !c.name.toLowerCase().includes("out of office"));
        
        // Data Capturer Score: Cards they worked on that are in Review OR Yolandie to Send
        completedCards = assignedCards.filter(c => c.idList === reviewListId || c.idList === yolandieListId);
        
        // Data Capturer Time
        totalMinutes = calculateTime(assignedCards, durationFieldId, timerStartFieldId, nowMs);
      }

      // Format Time beautifully (e.g., 4h 15m)
      const h = Math.floor(totalMinutes / 60);
      const m = Math.floor(totalMinutes % 60);
      const timeStr = `${h}h ${m}m`;

      // Extract specific card names and join them with a separator
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
      range: 'Daily Ledger!A:E', // 🟢 Changed to A:E to include the 5th column
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

// Helper function to extract and sum time from Trello Custom Fields
function calculateTime(cardArray, durationId, timerStartId, nowMs) {
  let minutes = 0;
  cardArray.forEach(c => {
    const cfItems = c.customFieldItems || [];
    
    // Add saved duration
    const durItem = cfItems.find(item => item.idCustomField === durationId);
    if (durItem && durItem.value?.text) {
      minutes += parseFloat(durItem.value.text);
    }
    
    // Add currently ticking timer
    const startItem = cfItems.find(item => item.idCustomField === timerStartId);
    if (startItem && startItem.value?.text) {
      const startVal = parseFloat(startItem.value.text);
      if (startVal > 1000000000000) { 
        minutes += (nowMs - startVal) / 1000 / 60;
      }
    }
  });
  return minutes;
}

export const handler = schedule(cronExpression, captureSnapshot);