import { getAccessToken } from "./_google-creds.js";

export async function handler(event) {
  try {
    // 🛡️ SECURITY CHECK: Only try to get a token if a cookie actually exists
    const cookieHeader = event.headers.cookie || event.headers.Cookie || "";
    if (!cookieHeader.includes("AS_GCHAT_RT")) {
      return json(401, { ok: false, error: "Not logged in" });
    }

    const accessToken = await getAccessToken(event);

    const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const userJson = await userRes.json().catch(() => ({}));

    if (!userRes.ok) {
      return json(502, { ok: false, where: "userinfo", status: userRes.status, error: userJson });
    }

    const chatName = `users/${userJson.id}`;

    return json(200, { 
      ok: true, 
      name: chatName, 
      email: userJson.email,
      picture: userJson.picture
    });

  } catch (err) {
    console.error("WHOAMI ERROR:", err.message);
    const isAuthError = err.message.includes("No Refresh Token");
    return json(isAuthError ? 401 : 500, { ok: false, error: err.message });
  }
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: { 
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-cache" 
    },
    body: JSON.stringify(body),
  };
}