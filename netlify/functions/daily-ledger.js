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
      fetch(`${base}/boards/${TRELLO_BOARD_ID}/cards?customFieldItems=true&fields=name,idList,labels&${auth}`), // <-- Added labels!
      fetch(`${base}/boards/${TRELLO_BOARD_ID}/actions?filter=updateCard:idList&since=${midnightSAST}&limit=1000&${auth}`),
      fetch(`${base}/boards/${TRELLO_BOARD_ID}/customFields?${auth}`) // <-- Fetching the fields so we can find IdleLog
    ]);

    const lists = await listsRes.json();
    const cards = await cardsRes.json();
    const actions = await actionsRes.json();
    const customFields = await customFieldsRes.json();

    // Find the new IdleLog field ID safely
    const idleFieldId = customFields.find(f => f.name && f.name.includes("IdleLog"))?.id;
    const workLogFieldId = customFields.find(f => f.name && f.name.includes("WorkLog"))?.id;
    const workTimerStartFieldId = customFields.find(f => f.name && (f.name.includes("WorkTimerStart") || f.name.includes("WorkStartTime")))?.id;

    // 3. TRACK EXACT MOVEMENTS
    const cardCredits = {};

    actions.forEach(action => {
       const destName = action.data?.listAfter?.name || "";
       const sourceName = action.data?.listBefore?.name || "";
       const cardId = action.data?.card?.id;

       if (!cardCredits[cardId]) cardCredits[cardId] = new Set();

       // A. If card lands in Siya - Review, credit the analyst who sent it
       if (destName === "Siya - Review" && sourceName) {
           const standardizedName = sourceName.includes("Bonis") ? "Bonisa" : sourceName;
           cardCredits[cardId].add(standardizedName); 
       }

       // B. If card lands in any Yolandie list FROM Siya - Review, credit Siya - Review
       if (destName.toLowerCase().includes("yolandie") && sourceName === "Siya - Review") {
           cardCredits[cardId].add("Siya - Review");
       }
    });

    const targetUsers = ["Siya", "Enock", "Songeziwe", "Bonisa", "Siya - Review"];
    const liveStats = {};
    const snapshotRows = [];
    const todayStr = new Date().toLocaleDateString("en-GB", { timeZone: 'Africa/Johannesburg' });

    // --- 🌟 NEW: SAST BUSINESS HOURS CALCULATOR (8am - 5pm) ---
    const getBusinessMinutes = (startTs, endTs) => {
        if (!startTs || !endTs || startTs >= endTs) return 0;
        let totalMins = 0;
        let current = new Date(startTs);
        let safetyCap = 0; // Prevents infinite loops on bad data
        
        while (current.getTime() < endTs && safetyCap < 1000) {
            safetyCap++;
            // Force the dates into SAST so the Netlify UTC server doesn't miscalculate 5pm
            const formatter = new Intl.DateTimeFormat('en-US', { timeZone: 'Africa/Johannesburg', year: 'numeric', month: '2-digit', day: '2-digit' });
            const [month, day, year] = formatter.format(current).split('/');
            
            const dayStart = new Date(`${year}-${month}-${day}T08:00:00+02:00`).getTime();
            const dayEnd = new Date(`${year}-${month}-${day}T17:00:00+02:00`).getTime();

            const overlapStart = Math.max(current.getTime(), dayStart);
            const overlapEnd = Math.min(endTs, dayEnd);

            if (overlapEnd > overlapStart) {
                totalMins += (overlapEnd - overlapStart) / 60000;
            }

            // Jump exactly to 8 AM the next morning to continue the loop
            current = new Date(dayStart + 24 * 60 * 60 * 1000);
        }
        return totalMins;
    };
    // ----------------------------------------------------------

    // 4. Calculate Scores AND Idle Time (ONE ROW PER CASE)
    targetUsers.forEach(user => {
      let completedCards = [];
      const bucketKey = user === "Siya - Review" ? "SRV" : user.substring(0, 3).toUpperCase();

      cards.forEach(c => {
        let cardIdle = 0;
        let cardActive = 0;

       // --- A. Calculate Idle Time for THIS specific card ---
        if (idleFieldId) {
            const idleItem = c.customFieldItems?.find(i => i.idCustomField === idleFieldId);
            try {
                const parsed = JSON.parse(idleItem?.value?.text || "{}");
                const idleKey = `${user}_idle`;
                if (parsed[idleKey]) cardIdle += parsed[idleKey];
                
                if (parsed._topReachedAt && parsed._topUser === user) {
                    // 🌟 Replaced 24/7 subtraction with the new 8-to-5 Calculator
                    cardIdle += getBusinessMinutes(parsed._topReachedAt, new Date().getTime());
                }
            } catch(e) {}
        }

        // --- B. Calculate Active Time for THIS specific card ---
        if (workLogFieldId) {
            const workItem = c.customFieldItems?.find(i => i.idCustomField === workLogFieldId);
            try {
                const parsed = JSON.parse(workItem?.value?.text || "{}");
                const durFromName = parseFloat(parsed[user] || "0");
                const durFromKey = parseFloat(parsed[bucketKey] || "0");
                cardActive += (durFromName > 0 ? durFromName : durFromKey) || 0;
            } catch(e) {}
        }

        if (workTimerStartFieldId) {
             const startItem = c.customFieldItems?.find(i => i.idCustomField === workTimerStartFieldId);
             if (startItem?.value?.text) {
                 const [startTsStr, startList] = startItem.value.text.split("|");
                 const startTs = parseFloat(startTsStr);
                 if (startTs > 1000000000000 && (startList === user || (startList && startList.substring(0, 3).toUpperCase() === bucketKey))) {
                     cardActive += Math.max(0, new Date().getTime() - startTs) / 1000 / 60;
                 }
             }
        }

        // --- C. Calculate Movement (Is this card completed?) ---
        if (!c.name || c.name.toLowerCase().includes("out of office")) {
            // Ignore
        } else if (cardCredits[c.id] && cardCredits[c.id].has(user)) {
           const currentListName = lists.find(l => l.id === c.idList)?.name;
           if (currentListName !== user) {
               completedCards.push(c);
               
               // Extract strict Case Type for THIS specific card
               const validLabels = (c.labels || []).map(l => typeof l === 'string' ? l : l?.name).filter(name => name && name.toLowerCase() !== "ryangpt");
               const caseTypeStr = validLabels.length > 0 ? validLabels.join(", ") : "Unknown";

               // 🌟 NEW: Calculate True "Excess" Idle Time by subtracting Active Time
               let excessIdle = Math.max(0, cardIdle - cardActive);

               const formatTime = (m) => m > 0 ? `${Math.floor(m / 60)}h ${Math.floor(m % 60)}m` : "0h 0m";

               // PUSH A DEDICATED ROW FOR THIS COMPLETED CASE 
               // Columns: [Date, Team Member, Case Name, Case Type, Active Time, Excess Idle Time]
               snapshotRows.push([todayStr, user, c.name, caseTypeStr, formatTime(cardActive), formatTime(excessIdle)]);
           }
        }
      });

      liveStats[user] = completedCards.length;
      liveStats[`${user}_cards`] = completedCards.map(c => c.id);
      
      // Keep rescued frontend objects intact for the UI
      liveStats[`${user}_completed_objects`] = completedCards.map(c => {
          const listName = lists.find(l => l.id === c.idList)?.name || "Moved";
          const mappedCustomFields = {};
          
          if (c.customFieldItems) {
              c.customFieldItems.forEach(item => {
                  const fieldDef = customFields.find(f => f.id === item.idCustomField);
                  if (fieldDef && fieldDef.name) {
                      if (item.value?.text) mappedCustomFields[fieldDef.name] = item.value.text;
                      if (item.value?.number) mappedCustomFields[fieldDef.name] = String(item.value.number);
                      if (item.idValue) {
                          const option = fieldDef.options?.find(o => o.id === item.idValue);
                          if (option) mappedCustomFields[fieldDef.name] = option.value?.text;
                      }
                  }
              });
          }
          
          return { id: c.id, title: c.name, list: listName, customFields: mappedCustomFields, labels: c.labels || [] };
      });
    });

    // 5. If called by React UI, return stats instantly and DO NOT write to Google Sheets
    if (isLiveUI) {
       return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify(liveStats) };
    }
  // --- NEW: CHUNKED HISTORY MODE ---
    const isWeekly = event.queryStringParameters && event.queryStringParameters.mode === "weekly";
    if (isWeekly) {
        try {
            let formattedKey = GOOGLE_PRIVATE_KEY;
            if (formattedKey.startsWith('"') && formattedKey.endsWith('"')) formattedKey = formattedKey.slice(1, -1);
            formattedKey = formattedKey.replace(/\\n/g, '\n');

            const authClient = new google.auth.JWT({
              email: GOOGLE_SERVICE_ACCOUNT_EMAIL,
              key: formattedKey,
              scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
            });
            await authClient.authorize();
            const sheets = google.sheets({ version: 'v4', auth: authClient });

            const response = await sheets.spreadsheets.values.get({
                spreadsheetId: process.env.DAILY_LEDGER_SHEET_ID,
                range: 'Daily Ledger!A:F' // <-- Add the exact tab name here!
            });

            const rows = response.data.values || [];
            const allData = {};
            targetUsers.forEach(u => allData[u] = []);

            // Safely parse the requested date boundaries (default to fetching everything if missing)
            const qStart = event.queryStringParameters.start;
            const qEnd = event.queryStringParameters.end;
            const startDate = qStart ? new Date(`${qStart}T00:00:00`) : new Date(0);
            const endDate = qEnd ? new Date(`${qEnd}T23:59:59`) : new Date(8640000000000000);

            for (let i = 1; i < rows.length; i++) {
                // Read the 6 column structure
                const [dateStr, rawName, caseNameStr, caseTypeStr, activeStr, idleStr] = rows[i] || [];
                
                // Clean the name of any accidental trailing spaces from manual entry
                const name = (rawName || "").trim();
                
                if (!dateStr || !name || !targetUsers.includes(name)) continue;
                
                let rowDate;
                // Handle DD/MM/YYYY format
                if (dateStr.includes('/')) {
                    const parts = dateStr.split('/');
                    if (parts.length === 3) rowDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}T12:00:00`);
                } 
                // Handle YYYY-MM-DD format
                else {
                    rowDate = new Date(`${dateStr}T12:00:00`);
                }
                
                // If it couldn't parse a valid date, skip it
                if (!rowDate || isNaN(rowDate.getTime())) continue;
                
                // Only send back the data if it falls within the requested 6-week window
                if (rowDate >= startDate && rowDate <= endDate) {
                    const parseTime = (t) => {
                        if (!t || t === "-" || t === "N/A") return 0;
                        let m = 0;
                        const hMatch = String(t).match(/(\d+)h/);
                        const mMatch = String(t).match(/(\d+)m/);
                        if (hMatch) m += parseInt(hMatch[1]) * 60;
                        if (mMatch) m += parseInt(mMatch[1]);
                        return m;
                    };

                    allData[name].push({
                        date: rowDate.toISOString(),
                        cases: 1, 
                        caseName: caseNameStr || "Unknown",
                        caseType: (caseTypeStr || "").toLowerCase(),
                        activeMins: parseTime(activeStr),
                        idleMins: parseTime(idleStr)
                    });
                }
            }
            return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify(allData) };
        } catch (error) {
            return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
        }
    }
    // ------------------------------

    // 6. IF MIDNIGHT: Write to Google Sheets
    if (!DAILY_LEDGER_SHEET_ID || !GOOGLE_SERVICE_ACCOUNT_EMAIL || !GOOGLE_PRIVATE_KEY) {
       return { statusCode: 500, body: JSON.stringify({ error: "Missing Google Sheets Env Vars" }) };
    }

    // 1. Strip literal quotes from the .env string, then fix the newlines
    let formattedKey = GOOGLE_PRIVATE_KEY;
    if (formattedKey.startsWith('"') && formattedKey.endsWith('"')) {
        formattedKey = formattedKey.slice(1, -1);
    }
    formattedKey = formattedKey.replace(/\\n/g, '\n');

    // 2. Use the strict object-based configuration required by newer Google APIs
    const authClient = new google.auth.JWT({
      email: GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: formattedKey,
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });
    
    // Explicitly force authorization to prevent silent token failures
    await authClient.authorize();
    
    const sheets = google.sheets({ version: 'v4', auth: authClient });

    await sheets.spreadsheets.values.append({
      spreadsheetId: DAILY_LEDGER_SHEET_ID,
      range: 'Daily Ledger!A:F',
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