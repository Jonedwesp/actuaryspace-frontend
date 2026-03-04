export const handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };

  try {
    const { cardId, fieldName, valueText } = JSON.parse(event.body);
    const key = process.env.TRELLO_API_KEY || process.env.TRELLO_KEY;
    const token = process.env.TRELLO_TOKEN;

    // 1. Get Board ID
    const cardRes = await fetch(`https://api.trello.com/1/cards/${cardId}?fields=idBoard&key=${key}&token=${token}`);
    const cardData = await cardRes.json();
    const boardId = cardData.idBoard;

    // 2. Fetch Custom Fields
    const cfRes = await fetch(`https://api.trello.com/1/boards/${boardId}/customFields?key=${key}&token=${token}`);
    const cfData = await cfRes.json();

    // 3. 🚨 THE TRANSLATOR: Map React's internal names to your exact Trello Power-Up names
    let targetTrelloName = fieldName;
    if (fieldName === "WorkTimerStart" || fieldName === "WorkStartTime") {
        targetTrelloName = "[SYSTEM] WorkStartTime";
    } else if (fieldName === "WorkDuration") {
        targetTrelloName = "[SYSTEM] WorkDuration";
    }

    // Find the field on Trello
    const field = cfData.find(f => f.name === targetTrelloName || f.name === fieldName);

    if (!field) {
        console.error(`Trello error: Field '${targetTrelloName}' not found on board.`);
        return { statusCode: 404, body: JSON.stringify({ ok: false, error: "Field not found" }) };
    }

    // 4. 🚨 FORMAT PAYLOAD DYNAMICALLY BASED ON FIELD TYPE
    let payload = {};
    const stringValue = valueText !== undefined && valueText !== null ? String(valueText) : "";

    if (field.type === 'list') {
        // Dropdown fields (Status, Priority, Active)
        if (stringValue === "" || stringValue === "(None)") {
            payload = { idValue: "" }; // Clear field
        } else {
            // Match the text to get the Trello Option ID
            const option = field.options.find(opt => 
                opt.value.text.toLowerCase().trim() === stringValue.toLowerCase().trim()
            );
            if (!option) {
                return { statusCode: 400, body: JSON.stringify({ ok: false, error: `Option '${stringValue}' not found in field '${fieldName}'` }) };
            }
            payload = { idValue: option.id };
        }
    } else if (field.type === 'number') {
        // Number fields
        if (stringValue === "") {
            payload = { value: "" };
        } else {
            payload = { value: { number: stringValue } };
        }
    } else {
        // Standard Text fields (Timers)
        if (stringValue === "") {
            payload = { value: "" }; 
        } else {
            payload = { value: { text: stringValue } };
        }
    }

    // 5. Send to Trello
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