const https = require("https");

exports.handler = async (event) => {
  const key = process.env.TRELLO_KEY || process.env.TRELLO_API_KEY;
  const token = process.env.TRELLO_TOKEN || process.env.TRELLO_API_TOKEN;

  const trelloRequest = (path) => new Promise((resolve, reject) => {
    const req = https.request({ hostname: "api.trello.com", path, method: "GET" }, (res) => {
      let data = "";
      res.on("data", c => data += c);
      res.on("end", () => resolve({ status: res.statusCode, data: JSON.parse(data || "{}") }));
    });
    req.on("error", reject);
    req.end();
  });

  try {
    // Get the primary board dynamically, then fetch its closed cards
    const boards = await trelloRequest(`/1/members/me/boards?fields=id&key=${key}&token=${token}`);
    if (!boards.data || boards.data.length === 0) return { statusCode: 404, body: "No boards found" };
    
    const boardId = boards.data[0].id;
    const closedCards = await trelloRequest(`/1/boards/${boardId}/cards/closed?fields=id,name,labels,idMembers,idList,dateLastActivity&customFieldItems=true&key=${key}&token=${token}`);
    
    return { statusCode: 200, body: JSON.stringify({ cards: closedCards.data }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};