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
    if (!boards.data || !Array.isArray(boards.data)) return { statusCode: 200, body: JSON.stringify({ cards: [] }) };
    
    let allClosedCards = [];

    for (const board of boards.data) {
       // 1. Fetch closed cards
       const cardsRes = await trelloRequest(`/1/boards/${board.id}/cards/closed?fields=id,name,labels,idMembers,idList,desc,cover,dateLastActivity&customFieldItems=true&key=${key}&token=${token}`);
       
       // 2. Fetch the "Dictionary" of custom fields to translate ID numbers to text
       const cfDefsRes = await trelloRequest(`/1/boards/${board.id}/customFields?key=${key}&token=${token}`);
       
       if (cardsRes.status === 200 && Array.isArray(cardsRes.data)) {
           let cfMap = {};
           if (cfDefsRes.status === 200 && Array.isArray(cfDefsRes.data)) {
               cfDefsRes.data.forEach(field => {
                   cfMap[field.id] = { name: field.name, options: {} };
                   if (field.options) {
                       field.options.forEach(opt => {
                           cfMap[field.id].options[opt.id] = opt.value.text;
                       });
                   }
               });
           }

           // 3. Map the cards to include the beautifully translated custom fields
           const mappedCards = cardsRes.data.map(card => {
               let parsedFields = {};
               if (card.customFieldItems) {
                   card.customFieldItems.forEach(item => {
                       const def = cfMap[item.idCustomField];
                       if (def) {
                           let val = item.value ? item.value.text : null;
                           // Translate dropdown IDs
                           if (item.idValue && def.options[item.idValue]) {
                               val = def.options[item.idValue];
                           }
                           if (val) parsedFields[def.name] = val;
                           // Specifically handle the timer durations
                           if (def.name.includes("Duration") || def.name.includes("Timer")) {
                               parsedFields[def.name.replace(/[^a-zA-Z]/g, "")] = val; 
                           }
                       }
                   });
               }
               return { ...card, parsedCustomFields: parsedFields };
           });

           allClosedCards = allClosedCards.concat(mappedCards);
       }
    }
    
    // Sort by most recently archived first
    allClosedCards.sort((a, b) => new Date(b.dateLastActivity) - new Date(a.dateLastActivity));
    return { statusCode: 200, body: JSON.stringify({ cards: allClosedCards }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};