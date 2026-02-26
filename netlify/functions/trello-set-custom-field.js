// netlify/functions/trello-set-custom-field.js
exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };

  try {
    const { cardId, fieldName, valueText } = JSON.parse(event.body);
    const key = process.env.TRELLO_API_KEY || process.env.TRELLO_KEY;
    const token = process.env.TRELLO_TOKEN;

    // 1. Get Board ID from the Card
    const cardRes = await fetch(`https://api.trello.com/1/cards/${cardId}?fields=idBoard&key=${key}&token=${token}`);
    const cardData = await cardRes.json();
    const boardId = cardData.idBoard;

    // 2. Fetch all Custom Fields on this Board
    const cfRes = await fetch(`https://api.trello.com/1/boards/${boardId}/customFields?key=${key}&token=${token}`);
    const cfData = await cfRes.json();

    // 3. FUZZY MATCH: Find the field regardless of exact casing or spaces (e.g., "WorkTimerStart" matches "Work Timer Start")
    const targetName = fieldName.toLowerCase().replace(/\s/g, '');
    const field = cfData.find(f => f.name.toLowerCase().replace(/\s/g, '') === targetName);

    if (!field) {
        console.error(`Trello error: Field '${fieldName}' not found on board.`);
        return { statusCode: 404, body: JSON.stringify({ ok: false, error: "Field not found" }) };
    }

    // 4. AUTO-FORMAT PAYLOAD: Trello demands text fields be sent as text, and number fields as numbers!
    let payload = { value: "" }; // Default to clearing the field
    
    if (valueText !== "" && valueText !== null) {
         if (field.type === "number") {
             payload = { value: { number: String(valueText) } };
         } else if (field.type === "text") {
             payload = { value: { text: String(valueText) } };
         }
    }

    // 5. Send the exact formatted data to Trello
    const updateRes = await fetch(`https://api.trello.com/1/cards/${cardId}/customField/${field.id}/item?key=${key}&token=${token}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    if (!updateRes.ok) {
         const errText = await updateRes.text();
         console.error("Trello API Rejected Save:", errText);
         return { statusCode: updateRes.status, body: JSON.stringify({ ok: false, error: errText }) };
    }

    return { statusCode: 200, body: JSON.stringify({ ok: true }) };

  } catch (err) {
     console.error("Set Custom Field Error:", err);
     return { statusCode: 500, body: JSON.stringify({ ok: false, error: err.message }) };
  }
};