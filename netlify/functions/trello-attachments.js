// netlify/functions/trello-attachments.js
exports.handler = async (event) => {
    const key = process.env.TRELLO_API_KEY || process.env.TRELLO_KEY;
    const token = process.env.TRELLO_TOKEN;
    const method = event.httpMethod;

    try {
        // 1. GET Request: Load all attachments for the card
        if (method === 'GET') {
            const { cardId } = event.queryStringParameters;
            const res = await fetch(`https://api.trello.com/1/cards/${cardId}/attachments?key=${key}&token=${token}`);
            return { statusCode: 200, body: JSON.stringify(await res.json()) };
        }

        // 2. POST Request: Delete an attachment
        const body = JSON.parse(event.body);
        if (body.action === 'delete') {
            await fetch(`https://api.trello.com/1/cards/${body.cardId}/attachments/${body.idAttachment}?key=${key}&token=${token}`, { method: 'DELETE' });
            return { statusCode: 200, body: JSON.stringify({ ok: true }) };
        }

        return { statusCode: 400, body: JSON.stringify({ error: "Unknown action" }) };
    } catch (e) {
        return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
    }
};