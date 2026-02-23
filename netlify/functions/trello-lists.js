const https = require("https");

exports.handler = async (event) => {
  const key = process.env.TRELLO_KEY || process.env.TRELLO_API_KEY;
  const token = process.env.TRELLO_TOKEN || process.env.TRELLO_API_TOKEN;

  const trelloRequest = (path) => new Promise((resolve, reject) => {
    const req = https.request({ hostname: "api.trello.com", path, method: "GET" }, (res) => {
      let data = "";
      res.on("data", c => data += c);
      res.on("end", () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data || "{}") }); }
        catch(e) { resolve({ status: res.statusCode, data: [] }); }
      });
    });
    req.on("error", reject);
    req.end();
  });

  try {
    const boards = await trelloRequest(`/1/members/me/boards?fields=id,name&key=${key}&token=${token}`);
    if (!boards.data || !Array.isArray(boards.data)) return { statusCode: 200, body: JSON.stringify({ lists: [] }) };
    
    let allLists = [];
    for (const board of boards.data) {
       // Fetch every list on the board
       const listsRes = await trelloRequest(`/1/boards/${board.id}/lists?fields=id,name&key=${key}&token=${token}`);
       if (listsRes.status === 200 && Array.isArray(listsRes.data)) {
           allLists = allLists.concat(listsRes.data);
       }
    }
    
    return { statusCode: 200, body: JSON.stringify({ lists: allLists }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};