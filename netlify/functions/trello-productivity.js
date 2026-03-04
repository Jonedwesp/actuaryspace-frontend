const https = require('https');

exports.handler = async (event, context) => {
  const API_KEY = process.env.TRELLO_API_KEY;
  const TOKEN = process.env.TRELLO_TOKEN;
  const BOARD_ID = process.env.TRELLO_BOARD_ID;

  if (!API_KEY || !TOKEN || !BOARD_ID) {
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: 'Missing Trello config' }) };
  }

  // Fetch the last 1000 list movements on the board
  const url = `https://api.trello.com/1/boards/${BOARD_ID}/actions?filter=updateCard:idList&limit=1000&key=${API_KEY}&token=${TOKEN}`;

  return new Promise((resolve) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const actions = JSON.parse(data);
          
          // Trello returns newest first. We reverse it to simulate time moving forward.
          actions.reverse();

          // The active buckets we are tracking
          const TARGET_USERS = ["Siya", "Enock", "Songeziwe", "Bonisa"];
          const userTimes = { "Siya": 0, "Enock": 0, "Songeziwe": 0, "Bonisa": 0 };
          
          // Tracks cards currently sitting in a bucket: { cardId: { listName: "Enock", enteredAt: timestamp } }
          const activeCards = {};

          // We only want to log time for TODAY.
          const startOfToday = new Date();
          startOfToday.setHours(0, 0, 0, 0); 

          actions.forEach(action => {
            const cardId = action.data.card.id;
            const listAfter = action.data.listAfter.name;
            const listBefore = action.data.listBefore.name;
            const actionTime = new Date(action.date);

            // 1. EXIT LOGIC: Card moved out of a tracked user's list (e.g., to "Siya - Review")
            if (TARGET_USERS.includes(listBefore) && activeCards[cardId]?.listName === listBefore) {
              let enteredAt = activeCards[cardId].enteredAt;
              
              // If the card entered their list yesterday, we only start the clock at midnight today
              if (enteredAt < startOfToday) {
                  enteredAt = startOfToday;
              }

              // Calculate minutes spent in the bucket
              if (actionTime > enteredAt) {
                const diffMins = (actionTime - enteredAt) / 1000 / 60;
                userTimes[listBefore] += diffMins;
              }
              
              delete activeCards[cardId]; // Clock stopped. Remove from active tracking.
            }

            // 2. ENTRY LOGIC: Card moved INTO a tracked user's list
            if (TARGET_USERS.includes(listAfter)) {
              activeCards[cardId] = {
                listName: listAfter,
                enteredAt: actionTime
              };
            }
          });

          // 3. LIVE TICKING LOGIC: Add time for cards that are STILL in their lists right now
          const now = new Date();
          Object.values(activeCards).forEach(active => {
              let enteredAt = active.enteredAt;
              if (enteredAt < startOfToday) enteredAt = startOfToday;
              
              if (now > enteredAt) {
                  const diffMins = (now - enteredAt) / 1000 / 60;
                  userTimes[active.listName] += diffMins;
              }
          });

          resolve({
            statusCode: 200,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ok: true, stats: userTimes })
          });
        } catch (err) {
          resolve({ statusCode: 500, body: JSON.stringify({ ok: false, error: err.message }) });
        }
      });
    }).on('error', (err) => {
      resolve({ statusCode: 500, body: JSON.stringify({ ok: false, error: err.message }) });
    });
  });
};