const { JWT } = require("google-auth-library");
const { loadServiceAccount } = require("./_google-creds.js");

exports.handler = async (event) => {
  try {
    const { messageIds, permanent } = JSON.parse(event.body);
    const sa = loadServiceAccount();
    const impersonate = process.env.GMAIL_IMPERSONATE;

    const client = new JWT({
      email: sa.client_email,
      key: sa.private_key,
      scopes: ["https://www.googleapis.com/auth/gmail.modify"],
      subject: impersonate,
    });

    await client.authorize();

    // Loop through IDs and choose the correct Gmail API endpoint
for (const id of messageIds) {
  if (permanent) {
    // 1. DELETE forever (Used when clicking delete WHILE in the Trash view)
    const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}`;
    await request(url, { 
      method: "DELETE", 
      headers: { Authorization: `Bearer ${token}` } 
    });
  } else {
    // 2. MOVE TO BIN (Used when clicking delete from the Inbox)
    // This MUST be a POST request to the /trash endpoint
    const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}/trash`;
    await request(url, { 
      method: "POST", 
      headers: { Authorization: `Bearer ${token}` } 
    });
  }
}

    return { 
      statusCode: 200, 
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: true }) 
    };
  } catch (err) {
    console.error("Gmail bulk action failed:", err);
    return { 
      statusCode: 500, 
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: err.message }) 
    };
  }
};