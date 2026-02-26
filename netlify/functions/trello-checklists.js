// netlify/functions/trello-checklists.js
exports.handler = async (event) => {
    const key = process.env.TRELLO_API_KEY || process.env.TRELLO_KEY;
    const token = process.env.TRELLO_TOKEN;
    const method = event.httpMethod;

    try {
        // 1. GET request: Fetch all checklists for a card
        if (method === 'GET') {
            const { cardId } = event.queryStringParameters;
            const res = await fetch(`https://api.trello.com/1/cards/${cardId}/checklists?key=${key}&token=${token}`);
            return { statusCode: 200, body: JSON.stringify(await res.json()) };
        }

        // 2. POST request: Handle all interactive actions
        const body = JSON.parse(event.body);
        const { action, cardId, checklistId, idCheckItem, name, state, idChecklistSource } = body;

        // Create a new checklist
        if (action === 'create_checklist') {
            let url = `https://api.trello.com/1/checklists?idCard=${cardId}&name=${encodeURIComponent(name)}&key=${key}&token=${token}`;
            if (idChecklistSource) url += `&idChecklistSource=${idChecklistSource}`;
            const res = await fetch(url, { method: 'POST' });
            return { statusCode: 200, body: JSON.stringify(await res.json()) };
        }
        
        // Delete a checklist
        if (action === 'delete_checklist') {
            await fetch(`https://api.trello.com/1/checklists/${checklistId}?key=${key}&token=${token}`, { method: 'DELETE' });
            return { statusCode: 200, body: JSON.stringify({ ok: true }) };
        }
        
        // Add a new item to a checklist
        if (action === 'add_item') {
            const res = await fetch(`https://api.trello.com/1/checklists/${checklistId}/checkItems?name=${encodeURIComponent(name)}&key=${key}&token=${token}`, { method: 'POST' });
            return { statusCode: 200, body: JSON.stringify(await res.json()) };
        }
        
        // Toggle an item (Complete / Incomplete)
        if (action === 'toggle_item') {
            const res = await fetch(`https://api.trello.com/1/cards/${cardId}/checkItem/${idCheckItem}?state=${state}&key=${key}&token=${token}`, { method: 'PUT' });
            return { statusCode: 200, body: JSON.stringify(await res.json()) };
        }

        return { statusCode: 400, body: JSON.stringify({ error: "Unknown action" }) };

    } catch (e) {
        console.error("Checklist API Error:", e);
        return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
    }
};