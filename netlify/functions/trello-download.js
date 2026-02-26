// netlify/functions/trello-download.js
exports.handler = async (event) => {
    const { url, mimeType } = event.queryStringParameters;
    if (!url) return { statusCode: 400, body: "Missing URL" };

    const key = process.env.TRELLO_API_KEY || process.env.TRELLO_KEY;
    const token = process.env.TRELLO_TOKEN;

    try {
        // 🛡️ FIX: Trello requires the strict OAuth Authorization header to download files
        const res = await fetch(url, {
            headers: {
                'Authorization': `OAuth oauth_consumer_key="${key}", oauth_token="${token}"`
            }
        });

        if (!res.ok) {
            const errorText = await res.text();
            return { statusCode: res.status, body: `Trello blocked the download: ${res.status} - ${errorText}` };
        }

        const buffer = await res.arrayBuffer();

        return {
            statusCode: 200,
            headers: {
                // Prioritize the requested mimeType, fallback to what Trello says, fallback to generic binary
                'Content-Type': mimeType || res.headers.get('content-type') || 'application/octet-stream',
                'Content-Disposition': 'inline', // 👈 THE MAGIC WORD: Forces browser to view instead of download
                'Access-Control-Allow-Origin': '*'
            },
            body: Buffer.from(buffer).toString('base64'),
            isBase64Encoded: true
        };
    } catch (e) {
        return { statusCode: 500, body: e.message };
    }
};