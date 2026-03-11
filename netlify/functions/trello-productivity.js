export const handler = async (event) => {
  const { TRELLO_KEY, TRELLO_TOKEN, TRELLO_BOARD_ID } = process.env;
  if (!TRELLO_KEY || !TRELLO_BOARD_ID) return { statusCode: 500, body: JSON.stringify({ error: "Missing Env Vars" }) };

  try {
    const base = "https://api.trello.com/1";
    const auth = `key=${TRELLO_KEY}&token=${TRELLO_TOKEN}`;

        const [listsRes, cardsRes, customFieldsRes] = await Promise.all([
      fetch(`${base}/boards/${TRELLO_BOARD_ID}/lists?${auth}`),
      fetch(`${base}/boards/${TRELLO_BOARD_ID}/cards?customFieldItems=true&${auth}`),
      fetch(`${base}/boards/${TRELLO_BOARD_ID}/customFields?${auth}`)
    ]);

    const lists = await listsRes.json();
    const allCards = await cardsRes.json();
    const customFields = await customFieldsRes.json();

    const idleFieldId = customFields.find(f => f.name.includes("IdleLog"))?.id;

    if (!idleFieldId) {
      return { statusCode: 400, body: JSON.stringify({ error: "Could not find IdleLog Custom Field" }) };
    }

    const targetUsers = ["Siya", "Enock", "Songeziwe", "Bonisa", "Siya - Review"];
    const topCardsMap = new Map();

    lists.forEach(list => {
       const listName = list.name.trim();
       const matchedUser = targetUsers.find(u => u.toLowerCase() === listName.toLowerCase());
       if (matchedUser) {
           const listCards = allCards.filter(c => c.idList === list.id).sort((a, b) => a.pos - b.pos);
           if (listCards.length > 0) {
               const absoluteTopCard = listCards[0];
               const isAwayCard = absoluteTopCard.name.toLowerCase().includes("out of office") || absoluteTopCard.name.toLowerCase().includes("away from cases");
               
               // If the top card is NOT an away card, assign it the idle tracker
               if (!isAwayCard) {
                   topCardsMap.set(absoluteTopCard.id, matchedUser);
               }
               // If it IS an away card, NO card gets the tracker. 
               // The backend will naturally close out the previous card's session, 
               // save its accumulated time, and delete its arrival timestamp!
           }
       }
    });
    const apiUpdates = [];
    const nowTs = Date.now();

    const updateTrelloJSON = (cardId, jsonObject) => {
        apiUpdates.push(
            fetch(`${base}/cards/${cardId}/customField/${idleFieldId}/item?${auth}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ value: { text: JSON.stringify(jsonObject) } })
            }).catch(e => console.error("Failed to update JSON:", e))
        );
    };

    allCards.forEach(card => {
        const durItem = card.customFieldItems?.find(i => i.idCustomField === idleFieldId);
        let workLog = {};
        try { workLog = JSON.parse(durItem?.value?.text || "{}"); } catch(e) {}

        const isTopUser = topCardsMap.get(card.id);
        let needsUpdate = false;

        if (isTopUser) {
            // Card is at the top
            if (!workLog._topReachedAt) {
                workLog._topReachedAt = nowTs;
                workLog._topUser = isTopUser;
                needsUpdate = true;
            } else if (workLog._topUser !== isTopUser) {
                // Moved directly from top of one list to top of another
                const elapsedMins = (nowTs - workLog._topReachedAt) / 60000;
                const idleKey = `${workLog._topUser}_idle`;
                workLog[idleKey] = (workLog[idleKey] || 0) + elapsedMins;
                
                workLog._topReachedAt = nowTs;
                workLog._topUser = isTopUser;
                needsUpdate = true;
            }
        } else {
            // Card is NOT at the top
            if (workLog._topReachedAt) {
                const elapsedMins = (nowTs - workLog._topReachedAt) / 60000;
                const idleKey = `${workLog._topUser}_idle`;
                workLog[idleKey] = (workLog[idleKey] || 0) + elapsedMins;

                delete workLog._topReachedAt;
                delete workLog._topUser;
                needsUpdate = true;
            }
        }

        if (needsUpdate) updateTrelloJSON(card.id, workLog);
    });

    if (apiUpdates.length > 0) await Promise.allSettled(apiUpdates);
    return { statusCode: 200, body: JSON.stringify({ ok: true }) };

  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: error.message }) };
  }
};