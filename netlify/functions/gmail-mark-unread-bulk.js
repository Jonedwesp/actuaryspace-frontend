import { getAccessToken } from './_google-creds.js';

export const handler = async function(event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const { messageIds } = JSON.parse(event.body);
    if (!messageIds || !messageIds.length) {
      return { statusCode: 400, body: JSON.stringify({ ok: false, error: "Missing messageIds" }) };
    }

    const accessToken = await getAccessToken(event);

    const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/batchModify", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ids: messageIds, addLabelIds: ["UNREAD"] }),
    });

    if (!res.ok && res.status !== 204) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error?.message || `batchModify failed: ${res.status}`);
    }

    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    console.error("gmail-mark-unread-bulk error:", err);
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: err.message }) };
  }
};
