import https from 'https';

export const handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };
  
  // 🎯 FIX: Added targetListId extraction from the payload
  const { cardId, targetListId } = JSON.parse(event.body || "{}");
  if (!cardId) return { statusCode: 400, body: "Missing cardId" };

  const key = process.env.TRELLO_KEY || process.env.TRELLO_API_KEY;
  const token = process.env.TRELLO_TOKEN || process.env.TRELLO_API_TOKEN;

  try {
    const res = await new Promise((resolve, reject) => {
      // 🎯 FIX: Dynamically construct the path. 
      // If targetListId is provided, append it to the PUT request so the card moves to Siya's list.
      let apiPath = `/1/cards/${cardId}?closed=false&key=${key}&token=${token}`;
      if (targetListId) {
        apiPath += `&idList=${targetListId}`;
      }

      const req = https.request({
        hostname: "api.trello.com",
        path: apiPath,
        method: "PUT"
      }, (res) => {
        let data = "";
        res.on("data", c => data += c);
        res.on("end", () => {
          try {
            const isJson = res.headers['content-type']?.includes('application/json');
            const parsedData = isJson ? JSON.parse(data || "{}") : { raw: data };
            
            resolve({ 
              status: res.statusCode, 
              data: parsedData 
            });
          } catch (e) {
            console.error("[Trello API] Critical Parse Error. Raw body:", data);
            resolve({ status: res.statusCode, data: { error: "Malformed JSON", raw: data } });
          }
        });
      });
      req.on("error", (err) => {
        console.error("[Trello API] Network/Request Error:", err.message);
        reject(err);
      });
      req.end();
    });

    // 🎯 FIX: Trello returns 200 OK for most PUTs, but standardizing the "ok" flag to handle empty successes
    return { 
      statusCode: res.status, 
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: res.status >= 200 && res.status < 300, data: res.data }) 
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};