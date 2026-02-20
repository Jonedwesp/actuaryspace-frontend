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

  const accessToken = tokenJson.access_token || "";
  const refreshToken = tokenJson.refresh_token || ""; 

  const headers = [
    cookie("AS_GCHAT_AT", accessToken, { maxAge: Number(tokenJson.expires_in || 3600) }),
    cookie("AS_GCHAT_OK", "1", { maxAge: 10368000, httpOnly: false }),
    cookie("AS_GCHAT_RT", refreshToken, { maxAge: 31536000 })
  ];

  return {
    statusCode: 302,
    multiValueHeaders: { "Set-Cookie": headers },
    headers: { 
      // Redirects the user back to the home page after logging in
      "Location": "https://siya.actuaryspace.co.za/", 
      "Cache-Control": "no-cache" 
    },
    body: "",
  };
}