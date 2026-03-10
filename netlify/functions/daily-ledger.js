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

    // 2. Fetch Board State AND Today's Move Actions
    const [listsRes, cardsRes, actionsRes] = await Promise.all([
      fetch(`${base}/boards/${TRELLO_BOARD_ID}/lists?${auth}`),
      fetch(`${base}/boards/${TRELLO_BOARD_ID}/cards?fields=name,idList&${auth}`),
      fetch(`${base}/boards/${TRELLO_BOARD_ID}/actions?filter=updateCard:idList&since=${midnightSAST}&limit=1000&${auth}`)
    ]);

    const rawLists = await listsRes.json();
    const lists = Array.isArray(rawLists) ? rawLists : [];

    const rawCards = await cardsRes.json();
    const cards = Array.isArray(rawCards) ? rawCards : [];

    const rawActions = await actionsRes.json();
    const actions = Array.isArray(rawActions) ? rawActions : [];

    const reviewListId = lists.find(l => l.name === "Siya - Review")?.id;
    const yolandieListId = lists.find(l => l.name === "Yolandie to Send")?.id;

    // 3. TRACK EXACT MOVEMENTS (No timer dependency!)
    const cardCredits = {};

    actions.forEach(action => {
       const destName = action.data?.listAfter?.name || "";
       const sourceName = action.data?.listBefore?.name || "";
       const cardId = action.data?.card?.id;

       // If anyone sent it to Review today, credit the list it came from (the sender)
       if (destName === "Siya - Review" && sourceName) {
           // Standardize Boniswa/Bonisa just in case
           const standardizedName = sourceName.includes("Bonis") ? "Bonisa" : sourceName;
           cardCredits[cardId] = standardizedName; 
       }
       // If Siya sent it to Yolandie today, credit Siya - Review
       if (destName === "Yolandie to Send" && sourceName === "Siya - Review") {
           cardCredits[cardId] = "Siya - Review";
       }
    });

    const targetUsers = ["Siya", "Enock", "Songeziwe", "Bonisa", "Siya - Review"];
    const liveStats = {};
    const snapshotRows = [];
    const todayStr = new Date().toLocaleDateString("en-GB", { timeZone: 'Africa/Johannesburg' });

    // 4. Calculate Scores
    targetUsers.forEach(user => {
      let completedCards = [];

      cards.forEach(c => {
        if (!c.name || c.name.toLowerCase().includes("out of office")) return;

        // Did THIS user move THIS card to the target list today?
        if (cardCredits[c.id] === user) {
           // Make sure it didn't bounce back (must still be in Review or Yolandie)
           if (c.idList === reviewListId || c.idList === yolandieListId) {
               completedCards.push(c);
           }
        }
      });

      liveStats[user] = completedCards.length;
      const cardNamesStr = completedCards.map(c => c.name).join("  |  ");
      snapshotRows.push([todayStr, user, completedCards.length, "N/A", cardNamesStr]);
    });

    // 5. Return Live Stats instantly for the UI
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