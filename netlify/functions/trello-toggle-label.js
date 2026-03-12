import https from 'https';

// Helper for Trello requests
const trelloRequest = (url, method) => new Promise((resolve, reject) => {
  const req = https.request(url, { method }, (res) => {
    let data = "";
    res.on("data", c => data += c);
    res.on("end", () => {
      let parsed;
      try { parsed = JSON.parse(data || "{}"); } catch { parsed = { _raw: data }; }
      resolve({ status: res.statusCode, data: parsed });
    });
  });
  req.on("error", reject);
  req.end();
});

export const handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };

  const { cardId, labelName, shouldAdd, cardName } = JSON.parse(event.body || "{}");
  if (!cardId && !cardName) return { statusCode: 400, body: "Missing card identifier" };

  const key = process.env.TRELLO_KEY;
  const token = process.env.TRELLO_TOKEN;
  const auth = `key=${key}&token=${token}`;
  const defaultBoardId = process.env.TRELLO_BOARD_ID;

  try {
    let finalCardId = cardId;
    let boardId = defaultBoardId;

    // 🚀 ARCHITECT'S UNIFIED RESOLVER: Same as trello-move.js
    // 1. If we have a 24-char ID, try to get the board ID from it
    if (finalCardId && finalCardId.length === 24) {
      const cardRes = await trelloRequest(`https://api.trello.com/1/cards/${finalCardId}?fields=idBoard&${auth}`, "GET");
      if (cardRes.status === 200) {
        boardId = cardRes.data.idBoard;
      } else {
        // If the ID failed, treat it as a name search trigger
        finalCardId = null;
      }
    }

    // 2. If ID is missing or was rejected, perform a Direct List Scan
    if (!finalCardId || finalCardId.length !== 24) {
      console.log(`[Backend] Performing Direct List Scan for: "${cardName || cardId}"`);
      
      // Get all lists on the board to find where the card might be
      const boardListsRes = await trelloRequest(`https://api.trello.com/1/boards/${boardId}/lists?${auth}`, "GET");
      const lists = Array.isArray(boardListsRes.data) ? boardListsRes.data : [];
      const query = (cardName || cardId || "").toLowerCase().trim();
      let found = null;

      // Scan each list directly (real-time data, bypasses slow board-wide index)
      for (const list of lists) {
        const listCardsRes = await trelloRequest(`https://api.trello.com/1/lists/${list.id}/cards?fields=name&${auth}`, "GET");
        const cards = Array.isArray(listCardsRes.data) ? listCardsRes.data : [];
        const cleanQuery = query.split(" (due")[0].trim().toLowerCase();
        
        // 🚀 ARCHITECT'S RANKED MATCHING: 
        // 1. Check for Exact match (stripped)
        found = cards.find(c => c.name.toLowerCase().split(" (due")[0].trim() === cleanQuery);
        
        // 2. Check for "Starts With" match (handles "Test" matching "Test - [IGNORE]")
        if (!found) {
          found = cards.find(c => c.name.toLowerCase().split(" (due")[0].trim().startsWith(cleanQuery));
        }

        // 3. Last resort fuzzy
        if (!found) {
          found = cards.find(c => c.name.toLowerCase().includes(cleanQuery));
        }
        
        if (found) {
          console.log(`[Backend] Found card "${found.name}" in list: ${list.name}`);
          break;
        }
      }
      
      if (!found) {
        // Return 404 with the specific error string your App.jsx retry logic looks for
        return { statusCode: 404, body: JSON.stringify({ error: "invalid id", message: "Card not found in any list yet." }) };
      }
      
      finalCardId = found.id;
      console.log(`[Backend] Resolved to ID: ${finalCardId}`);
    }

    // 3. Resolve the Label ID
    const labelsRes = await trelloRequest(`https://api.trello.com/1/boards/${boardId}/labels?${auth}`, "GET");
    const labels = Array.isArray(labelsRes.data) ? labelsRes.data : [];
    
    // 🛡️ Exact match priority, fallback to includes
    const labelObj = labels.find(l => (l.name || "").toLowerCase() === labelName.toLowerCase()) 
                  || labels.find(l => (l.name || "").toLowerCase().includes(labelName.toLowerCase()));

    if (!labelObj) return { statusCode: 404, body: JSON.stringify({ error: `Label '${labelName}' not found` }) };

    // 4. Execute the Label Change
    const method = (shouldAdd === false) ? "DELETE" : "POST";
    const actionUrl = method === "POST"
      ? `https://api.trello.com/1/cards/${finalCardId}/idLabels?value=${labelObj.id}&${auth}`
      : `https://api.trello.com/1/cards/${finalCardId}/idLabels/${labelObj.id}?${auth}`;

    const labelActionRes = await trelloRequest(actionUrl, method);

    // 🛡️ ARCHITECT'S API SHIELD: Treat "Already Added" (400) as Success (200)
    if (labelActionRes.status === 200 || (method === "POST" && labelActionRes.status === 400)) {
      console.log(`[Backend] Label ${labelName} ${method === "POST" ? "added to" : "removed from"} card.`);
      return { statusCode: 200, body: JSON.stringify({ ok: true }) };
    } else {
      console.error(`[Backend] Trello Error ${labelActionRes.status}:`, labelActionRes.data);
      return { statusCode: labelActionRes.status, body: JSON.stringify({ error: labelActionRes.data.message || "Trello API error" }) };
    }

  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};