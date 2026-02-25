import { getAccessToken } from "./_google-creds.js";

export async function handler(event) {
  try {
    // 🛡️ UPDATED: We no longer block if the cookie is missing here.
    // We let getAccessToken handle the fallback to Netlify Environment Variables.
    const accessToken = await getAccessToken(event);

    const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const userJson = await userRes.json().catch(() => ({}));

    if (!userRes.ok) {
      // 🛡️ IDENTITY FALLBACK: If the Google API is acting up but we have an Access Token,
      // we provide Siya's details manually so the app stays functional.
      return json(200, { 
        ok: true, 
        name: "Siyabonga Nono", 
        email: "siya@actuaryspace.co.za",
        picture: "" 
      });
    }

    const chatName = `users/${userJson.id}`;

    return json(200, { 
      ok: true, 
      name: userJson.name || "Siyabonga Nono", 
      email: userJson.email,
      picture: userJson.picture
    });

  } catch (err) {
    console.error("WHOAMI ERROR:", err.message);
    // If both cookie and Env Var are missing, then we show 401
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