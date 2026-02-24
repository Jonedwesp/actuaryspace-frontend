const https = require("https");

const trelloRequest = (url) => new Promise((resolve, reject) => {
  https.get(url, (res) => {
    let data = "";
    res.on("data", c => data += c);
    res.on("end", () => {
      // 🛡️ SAFETY SHIELD: If Trello sends an error (like "invalid id"), capture it gracefully!
      if (res.statusCode >= 400) {
         resolve({ error: true, status: res.statusCode, message: data });
         return;
      }
      try { 
         resolve(JSON.parse(data)); 
      } catch(e) { 
         resolve({ error: true, status: 500, message: "Invalid JSON from Trello: " + data }); 
      }
    });
  }).on("error", reject);
});

exports.handler = async (event) => {
  // 🛡️ PREVENT CRASH IF QUERY PARAMS ARE MISSING
  const { cardId } = event.queryStringParameters || {};
  if (!cardId) return { statusCode: 400, body: JSON.stringify({ error: "Missing cardId" }) };

  const key = process.env.TRELLO_KEY;
  const token = process.env.TRELLO_TOKEN;

  const filter = "commentCard,updateCard:idList,updateCard:closed,createCard,copyCard";
  const fields = "memberCreator_fields=fullName,avatarHash";
  const url = `https://api.trello.com/1/cards/${cardId}/actions?filter=${filter}&limit=50&${fields}&key=${key}&token=${token}`;

  try {
    const actions = await trelloRequest(url);
    
    // If Trello complained, send the exact complaint to the frontend
    if (actions.error) {
        console.error("Trello API Error:", actions.message);
        return { statusCode: actions.status || 500, body: JSON.stringify({ error: actions.message }) };
    }

    return {
      statusCode: 200,
      headers: { "Cache-Control": "public, s-maxage=60" }, 
      body: JSON.stringify(actions)
    };
  } catch (err) {
    console.error("Trello Actions Backend Error:", err);
    return { statusCode: 500, body: JSON.stringify({ error: "Failed to fetch actions" }) };
  }
};