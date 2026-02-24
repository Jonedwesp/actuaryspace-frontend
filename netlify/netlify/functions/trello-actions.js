const https = require("https");

const trelloRequest = (url) => new Promise((resolve, reject) => {
  https.get(url, (res) => {
    let data = "";
    res.on("data", c => data += c);
    res.on("end", () => {
      try { resolve(JSON.parse(data)); } catch(e) { reject(e); }
    });
  }).on("error", reject);
});

exports.handler = async (event) => {
  const { cardId } = event.queryStringParameters;
  if (!cardId) return { statusCode: 400, body: "Missing cardId" };

  const key = process.env.TRELLO_KEY;
  const token = process.env.TRELLO_TOKEN;

  // We filter for specific actions to mimic the screenshot:
  // comments, moving between lists, archiving/unarchiving, and creation.
  // We also request specific fields for the person who did the action to build avatars.
  const filter = "commentCard,updateCard:idList,updateCard:closed,createCard,copyCard";
  const fields = "memberCreator_fields=fullName,avatarHash";
  const url = `https://api.trello.com/1/cards/${cardId}/actions?filter=${filter}&limit=50&${fields}&key=${key}&token=${token}`;

  try {
    const actions = await trelloRequest(url);
    return {
      statusCode: 200,
      // Cache this heavily so navigating between cards is fast
      headers: { "Cache-Control": "public, s-maxage=60" }, 
      body: JSON.stringify(actions)
    };
  } catch (err) {
    console.error("Trello Actions Error:", err);
    return { statusCode: 500, body: JSON.stringify({ error: "Failed to fetch actions" }) };
  }
};