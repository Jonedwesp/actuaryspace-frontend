// netlify/functions/trello-move.js

export const handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };

  try {
    const { cardId, targetListId, targetListName, newIndex } = JSON.parse(event.body || "{}");
    if (!cardId || !targetListId) return { statusCode: 400, body: JSON.stringify({ error: "Missing IDs" }) };

    const key = process.env.TRELLO_KEY || process.env.TRELLO_API_KEY;
    const token = process.env.TRELLO_TOKEN || process.env.TRELLO_API_TOKEN;
    const auth = `key=${key}&token=${token}`;

    let realTargetId = targetListId;

    // 🌟 ARCHITECT'S UPGRADE: Trust the targetListName over the ID if provided.
    // This allows Donna to survive phonetic hallucinations like "Sia" or "Sear".
    if (targetListName || realTargetId.startsWith("list-") || realTargetId.length !== 24) {
        
        // 1. Ask Trello which board this card belongs to
        const cardRes = await fetch(`https://api.trello.com/1/cards/${cardId}?fields=idBoard&${auth}`);
        if (!cardRes.ok) return { statusCode: 404, body: JSON.stringify({ error: "Card not found on Trello." }) };
        const cardData = await cardRes.json();

        // 2. Fetch all lists on that board
        const listsRes = await fetch(`https://api.trello.com/1/boards/${cardData.idBoard}/lists?fields=id,name&${auth}`);
        const listsData = await listsRes.json();

        // 3. Find the real list ID by matching the name
        console.log(`[Backend] Resolving list for: "${targetListName || realTargetId}"`);
        
        const searchStr = (targetListName || "").toLowerCase().trim();
        const realList = listsData.find(l => {
            const listName = l.name.toLowerCase().trim();
            // If we don't have a name, match by the ID we were given
            if (!searchStr) return l.id === realTargetId;
            
            return listName === searchStr || 
                   listName.includes(searchStr) || 
                   searchStr.includes(listName) ||
                   ((searchStr === "sia" || searchStr === "sear") && listName === "siya"); 
        });
        
        if (realList) {
            console.log(`[Backend] Resolved to: ${realList.name} (${realList.id})`);
            realTargetId = realList.id;
        } else if (realTargetId.length !== 24) {
            // Only fail if we couldn't find a name match AND the ID is garbage
            console.error(`[Backend] RESOLUTION FAILED. Available lists:`, listsData.map(l => l.name));
            return { 
              statusCode: 400, 
              body: JSON.stringify({ ok: false, error: `Trello bucket "${targetListName || realTargetId}" not found.` }) 
            };
        }
    }

    // Now proceed with normal position math using the realTargetId
    const listRes = await fetch(`https://api.trello.com/1/lists/${realTargetId}/cards?fields=id,pos&${auth}`);
    let newPos = "bottom"; 
    
    if (listRes.ok) {
        const listData = await listRes.json();
        if (Array.isArray(listData)) {
            const cards = listData.filter(c => c.id !== cardId);
            const index = typeof newIndex === "number" ? newIndex : -1;

            if (index <= 0) {
                newPos = "top";
            } else if (index >= cards.length) {
                newPos = "bottom";
            } else {
                const prev = cards[index - 1].pos;
                const next = cards[index].pos;
                newPos = (prev + next) / 2;
            }
        }
    }

    // Move the card securely
    const moveRes = await fetch(`https://api.trello.com/1/cards/${cardId}?idList=${realTargetId}&pos=${newPos}&${auth}`, {
        method: "PUT"
    });

    if (moveRes.ok) {
      return { statusCode: 200, body: JSON.stringify({ ok: true, pos: newPos }) };
    } else {
      const errText = await moveRes.text();
      console.error("Trello API Rejected Move:", errText);
      return { statusCode: moveRes.status, body: JSON.stringify({ error: errText }) };
    }

  } catch (err) {
    console.error("Function Error:", err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};