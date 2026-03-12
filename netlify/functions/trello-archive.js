import https from 'https';

// Helper for Trello requests to prevent JSON.parse crashes
const trelloRequest = (url, method) => new Promise((resolve, reject) => {
  const req = https.request(url, { method }, (res) => {
    let data = "";
    res.on("data", c => data += c);
    res.on("end", () => {
      let parsed;
      try { 
        // 🛡️ ARCHITECT'S GUARD: Check header before attempting parse
        const isJson = res.headers['content-type']?.includes('application/json');
        
        if (isJson) {
          parsed = JSON.parse(data || "{}");
        } else {
          // If not JSON, capture raw text so we can log it without crashing
          parsed = { ok: false, message: "Non-JSON response received", raw: data };
        }
      } catch (e) { 
        console.error("[Trello Archive] Parse Error:", e.message);
        parsed = { ok: false, message: "Malformed JSON response", raw: data }; 
      }
      resolve({ status: res.statusCode, data: parsed });
    });
  });
  req.on("error", (err) => {
    console.error("[Trello Archive] Request Error:", err.message);
    reject(err);
  });
  req.end();
});

export const handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };

  const { cardId, cardName } = JSON.parse(event.body || "{}");
  if (!cardId && !cardName) return { statusCode: 400, body: "Missing card identifier" };

  const key = process.env.TRELLO_KEY || process.env.TRELLO_API_KEY;
  const token = process.env.TRELLO_TOKEN || process.env.TRELLO_API_TOKEN;
  const auth = `key=${key}&token=${token}`;
  const boardId = process.env.TRELLO_BOARD_ID;

  try {
    let finalCardId = cardId;

    // 🛡️ ARCHITECT'S BACKEND RESOLVER (Safety Net)
    // If ID is messy or not 24 chars, scan the board for the card
    if (!finalCardId || finalCardId.length !== 24) {
      console.log(`[Archive Backend] Resolving messy identifier: "${cardName || cardId}"`);
      const listsRes = await trelloRequest(`https://api.trello.com/1/boards/${boardId}/lists?${auth}`, "GET");
      const lists = Array.isArray(listsRes.data) ? listsRes.data : [];
      const query = (cardName || cardId || "").toLowerCase().split(" (due")[0].trim();

      for (const list of lists) {
        const cardsRes = await trelloRequest(`https://api.trello.com/1/lists/${list.id}/cards?fields=name&${auth}`, "GET");
        const cards = Array.isArray(cardsRes.data) ? cardsRes.data : [];
        const match = cards.find(c => c.name.toLowerCase().split(" (due")[0].trim().includes(query));
        if (match) {
          finalCardId = match.id;
          break;
        }
      }
    }

    if (!finalCardId || finalCardId.length !== 24) {
      return { statusCode: 404, body: JSON.stringify({ error: "Could not resolve card ID for archive" }) };
    }

    // 🚀 EXECUTE ARCHIVE (PUT closed=true)
    const url = `https://api.trello.com/1/cards/${finalCardId}?closed=true&${auth}`;
    const archiveRes = await trelloRequest(url, "PUT");

    if (archiveRes.status >= 200 && archiveRes.status < 300) {
      console.log(`[Backend] Successfully archived card: ${finalCardId}`);
      return { statusCode: 200, body: JSON.stringify({ ok: true }) };
    } else {
      console.error(`[Backend] Trello Error ${archiveRes.status}:`, archiveRes.data);
      return { statusCode: archiveRes.status, body: JSON.stringify(archiveRes.data) };
    }

  } catch (err) {
    console.error("[Archive Backend Fatal]:", err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};