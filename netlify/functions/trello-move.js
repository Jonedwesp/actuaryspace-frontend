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

    // 🌟 THE INTERCEPTOR: If frontend sent a fake ID, look up the real one dynamically!
    if (realTargetId.startsWith("list-") || realTargetId.length !== 24) {
        if (!targetListName) return { statusCode: 400, body: JSON.stringify({ error: "Missing list name to resolve fake ID" }) };
        
        // 1. Ask Trello which board this card belongs to
        const cardRes = await fetch(`https://api.trello.com/1/cards/${cardId}?fields=idBoard&${auth}`);
        const cardData = await cardRes.json();

        // 2. Fetch all lists on that board
        const listsRes = await fetch(`https://api.trello.com/1/boards/${cardData.idBoard}/lists?fields=id,name&${auth}`);
        const listsData = await listsRes.json();

        // 3. Find the real list ID by matching the name
        const realList = listsData.find(l => l.name.toLowerCase().trim() === targetListName.toLowerCase().trim());
        
        if (realList) {
            realTargetId = realList.id;
        } else {
            return { statusCode: 404, body: JSON.stringify({ error: `Could not find real ID for list named ${targetListName}` }) };
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