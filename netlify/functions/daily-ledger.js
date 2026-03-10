import { google } from "googleapis";

async function processLedger(event) {
  // Check if this is a live UI request from your website
  const isLiveUI = event.queryStringParameters && event.queryStringParameters.mode === "live";
  
  const { TRELLO_KEY, TRELLO_TOKEN, TRELLO_BOARD_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY, DAILY_LEDGER_SHEET_ID } = process.env;

  if (!TRELLO_KEY || !TRELLO_BOARD_ID) return { statusCode: 500, body: JSON.stringify({ error: "Missing Trello Env Vars" }) };

  try {
    const base = "https://api.trello.com/1";
    const auth = `key=${TRELLO_KEY}&token=${TRELLO_TOKEN}`;
    
    // 1. Get Midnight in SAST
    const now = new Date();
    const sastFormatter = new Intl.DateTimeFormat('en-US', { timeZone: 'Africa/Johannesburg', year: 'numeric', month: '2-digit', day: '2-digit' });
    const [month, day, year] = sastFormatter.format(now).split('/');
    const midnightSAST = new Date(`${year}-${month}-${day}T00:00:00+02:00`).toISOString();

    // 2. Fetch Board State, Today's Actions, AND Custom Fields
    const [listsRes, cardsRes, actionsRes, customFieldsRes] = await Promise.all([
      fetch(`${base}/boards/${TRELLO_BOARD_ID}/lists?${auth}`),
      fetch(`${base}/boards/${TRELLO_BOARD_ID}/cards?customFieldItems=true&fields=name,idList&${auth}`), // <-- Added customFieldItems=true so we can see the IdleLog!
      fetch(`${base}/boards/${TRELLO_BOARD_ID}/actions?filter=updateCard:idList&since=${midnightSAST}&limit=1000&${auth}`),
      fetch(`${base}/boards/${TRELLO_BOARD_ID}/customFields?${auth}`) // <-- Fetching the fields so we can find IdleLog
    ]);

    const lists = await listsRes.json();
    const cards = await cardsRes.json();
    const actions = await actionsRes.json();
    const customFields = await customFieldsRes.json();

    // Find the new IdleLog field ID safely
    const idleFieldId = customFields.find(f => f.name && f.name.includes("IdleLog"))?.id;

    // 3. TRACK EXACT MOVEMENTS
    const cardCredits = {};

    actions.forEach(action => {
       const destName = action.data?.listAfter?.name || "";
       const sourceName = action.data?.listBefore?.name || "";
       const cardId = action.data?.card?.id;

       if (!cardCredits[cardId]) cardCredits[cardId] = new Set();

       if (destName === "Siya - Review" && sourceName) {
           const standardizedName = sourceName.includes("Bonis") ? "Bonisa" : sourceName;
           cardCredits[cardId].add(standardizedName); 
       }
       if (destName === "Yolandie to Send" && sourceName === "Siya - Review") {
           cardCredits[cardId].add("Siya - Review");
       }
    });

    const targetUsers = ["Siya", "Enock", "Songeziwe", "Bonisa", "Siya - Review"];
    const liveStats = {};
    const snapshotRows = [];
    const todayStr = new Date().toLocaleDateString("en-GB", { timeZone: 'Africa/Johannesburg' });

    // 4. Calculate Scores AND Idle Time
    targetUsers.forEach(user => {
      let completedCards = [];
      let totalIdleMins = 0; // Track idle time across all cards for the day

      cards.forEach(c => {
        // --- A. Calculate Idle Time using the new [SYSTEM]IdleLog field ---
        if (idleFieldId) {
            const idleItem = c.customFieldItems?.find(i => i.idCustomField === idleFieldId);
            try {
                const parsed = JSON.parse(idleItem?.value?.text || "{}");
                const idleKey = `${user}_idle`;
                
                // Add previously stored idle time
                if (parsed[idleKey]) totalIdleMins += parsed[idleKey];
                
                // Add currently ticking idle time (if they left it at the top of the list right now)
                if (parsed._topReachedAt && parsed._topUser === user) {
                    totalIdleMins += (new Date().getTime() - parsed._topReachedAt) / 60000;
                }
            } catch(e) {}
        }

        // --- B. Calculate Movement ---
        if (!c.name || c.name.toLowerCase().includes("out of office")) return;

        if (cardCredits[c.id] && cardCredits[c.id].has(user)) {
           const currentListName = lists.find(l => l.id === c.idList)?.name;
           if (currentListName !== user) {
               completedCards.push(c);
           }
        }
      });

      liveStats[user] = completedCards.length;
      liveStats[`${user}_cards`] = completedCards.map(c => c.id);
      const cardNamesStr = completedCards.map(c => c.name).join("  |  ");
      const formattedIdleTime = `${Math.floor(totalIdleMins / 60)}h ${Math.floor(totalIdleMins % 60)}m`;

      // Build the row exactly matching the 6 Google Sheet columns: [Date, Name, Cases, Active Time, Idle Time, Card Names]
      snapshotRows.push([todayStr, user, completedCards.length, "N/A", formattedIdleTime, cardNamesStr]);
    });

    // 5. If called by React UI, return stats instantly and DO NOT write to Google Sheets
    if (isLiveUI) {
       return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify(liveStats) };
    }

    // 6. IF MIDNIGHT: Write to Google Sheets
    if (!DAILY_LEDGER_SHEET_ID || !GOOGLE_SERVICE_ACCOUNT_EMAIL || !GOOGLE_PRIVATE_KEY) {
       return { statusCode: 500, body: JSON.stringify({ error: "Missing Google Sheets Env Vars" }) };
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

export const handler = async (event) => {
  return processLedger(event);
};