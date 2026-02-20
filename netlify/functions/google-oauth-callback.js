function cookie(name, value, opts = {}) {
  const { path = "/", httpOnly = true, secure = true, sameSite = "Lax", maxAge } = opts;
  let out = `${name}=${encodeURIComponent(value)}; Path=${path}; SameSite=${sameSite}`;
  if (httpOnly) out += "; HttpOnly";
  if (secure) out += "; Secure";
  if (typeof maxAge === "number") out += `; Max-Age=${maxAge}`;
  return out;
}

export async function handler(event) {
  const qs = event.queryStringParameters || {};
  const code = qs.code;
  if (!code) return { statusCode: 400, body: "Missing ?code" };

  const clientId = "255077263612-j39k16rqh685nn7sd4oh1qkn5f7eb1ls.apps.googleusercontent.com"; 
  const clientSecret = "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"; 
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT;

  const tokenUrl = "https://oauth2.googleapis.com/token";
  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });

  const resp = await fetch(tokenUrl, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  const tokenJson = await resp.json().catch(() => ({}));
  if (!resp.ok) return { statusCode: 500, body: `Token Error: ${JSON.stringify(tokenJson)}` };

  const refreshToken = tokenJson.refresh_token || ""; 

  // --- TEMPORARY HACK TO CATCH THE TOKEN ON SCREEN ---
  return {
    statusCode: 200,
    headers: { "Content-Type": "text/html" },
    body: `
      <div style="font-family: sans-serif; padding: 50px; max-width: 800px; margin: 0 auto;">
        <h1 style="color: green;">SUCCESS!</h1>
        <h2>Siya: Please copy the ENTIRE text inside the box below and WhatsApp/Slack it to Jonathan right now.</h2>
        <textarea style="width: 100%; height: 150px; font-family: monospace; font-size: 18px; padding: 10px; border: 3px solid #ccc;">${refreshToken || 'NO_REFRESH_TOKEN_FOUND'}</textarea>
        <p>Once you send this to Jonathan, you can close this tab.</p>
      </div>
    `,
  };
}