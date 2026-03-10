import { google } from "googleapis";

async function processLedger(event) {
  // Check if this is a live UI request from your website
  const isLiveUI = event.queryStringParameters && event.queryStringParameters.mode === "live";
  
  const { TRELLO_KEY, TRELLO_TOKEN, TRELLO_BOARD_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY, DAILY_LEDGER_SHEET_ID } = process.env;

  if (!TRELLO_KEY || !TRELLO_BOARD_ID) return { statusCode: 500, body: JSON.stringify({ error: "Missing Trello Env Vars" }) };

  try {
    const base = "https://api.trello.com/1";
    const auth = `key=${TRELLO_KEY}&token=${TRELLO_TOKEN}`;
    
    // 1. Get Midnight in SAST (South African Standard Time)
    const now = new Date();
    const sastFormatter = new Intl.DateTimeFormat('en-US', { timeZone: 'Africa/Johannesburg', year: 'numeric', month: '2-digit', day: '2-digit' });
    const [month, day, year] = sastFormatter.format(now).split('/');
    const midnightSAST = new Date(`${year}-${month}-${day}T00:00:00+02:00`).toISOString();

    // 2. Fetch Board State AND Today's Move Actions
    const [listsRes, cardsRes, actionsRes, customFieldsRes] = await Promise.all([
      fetch(`${base}/boards/${TRELLO_BOARD_ID}/lists?${auth}`),
      fetch(`${base}/boards/${TRELLO_BOARD_ID}/cards?customFieldItems=true&fields=name,idList&${auth}`),
      // 🌟 NEW: Fetch all list-movements since midnight!
      fetch(`${base}/boards/${TRELLO_BOARD_ID}/actions?filter=updateCard:idList&since=${midnightSAST}&limit=1000&${auth}`),
      fetch(`${base}/boards/${TRELLO_BOARD_ID}/customFields?${auth}`)
    ]);

    const lists = Array.isArray(await listsRes.json()) ? await listsRes.json() : [];
    const cards = Array.isArray(await cardsRes.json()) ? await cardsRes.json() : [];
    const actions = Array.isArray(await actionsRes.json()) ? await actionsRes.json() : [];
    const customFields = Array.isArray(await customFieldsRes.json()) ? await customFieldsRes.json() : [];

    const reviewListId = lists.find(l => l.name === "Siya - Review")?.id;
    const yolandieListId = lists.find(l => l.name === "Yolandie to Send")?.id;
    const workLogFieldId = customFields.find(f => f.name.includes("WorkLog"))?.id;

    // 3. Map out which cards crossed the border TODAY
    const movedToReviewToday = new Set();
    const movedToYolandieToday = new Set();

    actions.forEach(action => {
       const destName = action.data?.listAfter?.name || "";
       if (destName === "Siya - Review") movedToReviewToday.add(action.data.card.id);
       if (destName === "Yolandie to Send") movedToYolandieToday.add(action.data.card.id);
    });

    const targetUsers = ["Enock", "Songeziwe", "Bonisa", "Siya - Review"];
    const liveStats = {};
    const snapshotRows = [];
    const todayStr = new Date().toLocaleDateString("en-GB", { timeZone: 'Africa/Johannesburg' });

    // 4. Calculate Scores
    targetUsers.forEach(user => {
      let completedCards = [];
      const bucketKey = user.substring(0, 3).toUpperCase(); // e.g., ENO, SON, BON, SIY

      cards.forEach(c => {
        if (!c.name || c.name.toLowerCase().includes("out of office")) return;

        // Determine if they worked on it via the JSON WorkLog
        let workedOnIt = false;
        const logItem = (c.customFieldItems || []).find(item => item.idCustomField === workLogFieldId);
        if (logItem && logItem.value?.text) {
            try {
               const parsed = JSON.parse(logItem.value.text);
               if (parsed[bucketKey] > 0) workedOnIt = true;
            } catch(e) {}
        }

        // 🌟 THE LOGIC: 
        if (user === "Siya - Review") {
           // Siya's score: Card is currently in Yolandie, it was moved there TODAY, and Siya worked on it.
           if (c.idList === yolandieListId && movedToYolandieToday.has(c.id) && workedOnIt) {
               completedCards.push(c);
           }
        } else {
           // Data Capturers score: Card is currently in Review OR Yolandie (didn't bounce back),
           // it was moved to one of them TODAY, and the capturer worked on it.
           const isDownstream = (c.idList === reviewListId || c.idList === yolandieListId);
           const movedToday = (movedToReviewToday.has(c.id) || movedToYolandieToday.has(c.id));
           
           if (isDownstream && movedToday && workedOnIt) {
               completedCards.push(c);
           }
        }
      });

      liveStats[user] = completedCards.length;
      const cardNamesStr = completedCards.map(c => c.name).join("  |  ");
      snapshotRows.push([todayStr, user, completedCards.length, "N/A", cardNamesStr]);
    });

    // 5. If called by React UI, return stats instantly and DO NOT write to Google Sheets
    if (isLiveUI) {
       return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify(liveStats) };
    }

    // 6. IF MIDNIGHT: Write to Google Sheets
    if (!DAILY_LEDGER_SHEET_ID || !GOOGLE_SERVICE_ACCOUNT_EMAIL || !GOOGLE_PRIVATE_KEY) {
       return { statusCode: 500, body: "Missing Google Sheets Env Vars" };
    }

    const formattedKey = GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n');
    const authClient = new google.auth.JWT(
      GOOGLE_SERVICE_ACCOUNT_EMAIL, null, formattedKey, ['https://www.googleapis.com/auth/spreadsheets']
    );
    const sheets = google.sheets({ version: 'v4', auth: authClient });

    await sheets.spreadsheets.values.append({
      spreadsheetId: DAILY_LEDGER_SHEET_ID,
      range: 'Daily Ledger!A:E',
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: snapshotRows },
    });

    return { statusCode: 200, body: JSON.stringify({ ok: true, message: "Ledger updated to Google Sheets", stats: liveStats }) };

  } catch (error) {
    console.error("Ledger error:", error);
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: error.toString() }) };
  }
}

export const handler = async (event, context) => {
  return processLedger(event);
};