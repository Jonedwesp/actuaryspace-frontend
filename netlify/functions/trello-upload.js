// netlify/functions/trello-upload.js
exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };

  try {
    const { cardId, filename, mimeType, fileBase64 } = JSON.parse(event.body);
    const key = process.env.TRELLO_API_KEY || process.env.TRELLO_KEY;
    const token = process.env.TRELLO_TOKEN;

    // 1. Convert the Base64 string back into a binary buffer
    const buffer = Buffer.from(fileBase64, 'base64');

    // 2. Build a multipart/form-data payload manually (Required for Trello API)
    const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
    let postData = '';
    
    postData += `--${boundary}\r\n`;
    postData += `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n`;
    postData += `Content-Type: ${mimeType}\r\n\r\n`;
    
    // We have to combine strings and buffers to send the file cleanly
    const postDataStart = Buffer.from(postData, 'utf8');
    const postDataEnd = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8');
    const finalPayload = Buffer.concat([postDataStart, buffer, postDataEnd]);

    // 3. Send to Trello
    const res = await fetch(`https://api.trello.com/1/cards/${cardId}/attachments?key=${key}&token=${token}`, {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': finalPayload.length
      },
      body: finalPayload
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("Trello Upload Error:", err);
      return { statusCode: res.status, body: JSON.stringify({ error: err }) };
    }

    const data = await res.json();
    return { statusCode: 200, body: JSON.stringify({ ok: true, attachment: data }) };

  } catch (err) {
    console.error("Upload process crashed:", err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};