// netlify/functions/trello-webhook-setup.js
// One-time setup function. Call it ONCE after deploying to production:
//   POST /.netlify/functions/trello-webhook-setup
//
// What it does:
//   1. Registers the trello-webhook.js function as a Trello board webhook
//   2. Optionally resets all WorkDuration fields on active cards to "0"
//      (clears the NaN state so the new system can start fresh)
//      Add ?reset=true to the URL to trigger the reset.

export const handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const key     = process.env.TRELLO_KEY || process.env.TRELLO_API_KEY;
  const token   = process.env.TRELLO_TOKEN;
  const boardId = process.env.TRELLO_BOARD_ID;
  const siteUrl = process.env.URL; // Netlify sets this automatically in production

  if (!siteUrl) {
    return {
      statusCode: 500,
      body: JSON.stringify({ ok: false, error: "URL env var not set. Are you running this in production?" })
    };
  }

  const auth = `key=${key}&token=${token}`;
  const callbackURL = `${siteUrl}/.netlify/functions/trello-webhook`;

  try {
    // 1. Register the webhook with Trello
    const webhookRes = await fetch(`https://api.trello.com/1/webhooks?${auth}`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        callbackURL,
        idModel:     boardId,
        description: "ActuarySpace WorkLog Sync"
      })
    });
    const webhookData = await webhookRes.json();

    if (!webhookRes.ok) {
      return {
        statusCode: 500,
        body: JSON.stringify({ ok: false, error: "Webhook registration failed", details: webhookData })
      };
    }

    const results = { webhookId: webhookData.id, callbackURL, reset: null };

    // 2. Optionally reset all WorkDuration fields to "0" (clears NaN state)
    if (event.queryStringParameters?.reset === "true") {
      const boardCFRes = await fetch(`https://api.trello.com/1/boards/${boardId}/customFields?${auth}`);
      const boardCFs   = await boardCFRes.json();
      const durField   = boardCFs.find(f => f.name.includes("WorkDuration"));
      const logField   = boardCFs.find(f => f.name.includes("WorkLog"));

      if (!durField) {
        results.reset = "Skipped: [SYSTEM]WorkDuration field not found";
      } else {
        // Fetch all cards across all lists
        const listsRes = await fetch(`https://api.trello.com/1/boards/${boardId}/lists?fields=id&${auth}`);
        const lists    = await listsRes.json();

        let cleared = 0;
        for (const list of lists) {
          const cardsRes = await fetch(`https://api.trello.com/1/lists/${list.id}/cards?fields=id&customFieldItems=true&${auth}`);
          const cards    = await cardsRes.json();

          for (const card of cards) {
            const hasDur = (card.customFieldItems || []).some(cf => cf.idCustomField === durField.id);
            if (hasDur) {
              await fetch(`https://api.trello.com/1/cards/${card.id}/customField/${durField.id}/item?${auth}`, {
                method:  "PUT",
                headers: { "Content-Type": "application/json" },
                body:    JSON.stringify({ value: { text: "0" } })
              });
              cleared++;
            }

            // Also clear WorkLog if it exists
            if (logField) {
              const hasLog = (card.customFieldItems || []).some(cf => cf.idCustomField === logField.id);
              if (hasLog) {
                await fetch(`https://api.trello.com/1/cards/${card.id}/customField/${logField.id}/item?${auth}`, {
                  method:  "PUT",
                  headers: { "Content-Type": "application/json" },
                  body:    JSON.stringify({ value: { text: "{}" } })
                });
              }
            }
          }
        }
        results.reset = `Cleared WorkDuration to "0" on ${cleared} cards`;
      }
    }

    return { statusCode: 200, body: JSON.stringify({ ok: true, ...results }) };

  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: err.message }) };
  }
};
