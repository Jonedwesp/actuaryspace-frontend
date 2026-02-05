// netlify/functions/google-oauth-callback.js

function parseState(stateB64) {
  if (!stateB64) return null;
  try {
    const json = Buffer.from(stateB64, "base64url").toString("utf8");
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function cookie(name, value, opts = {}) {
  const {
    path = "/",
    httpOnly = true,
    secure = true,
    sameSite = "Lax",
    maxAge,
  } = opts;

  let out = `${name}=${encodeURIComponent(value)}; Path=${path}; SameSite=${sameSite}`;
  if (httpOnly) out += "; HttpOnly";
  if (secure) out += "; Secure";
  if (typeof maxAge === "number") out += `; Max-Age=${maxAge}`;
  return out;
}

export async function handler(event) {
  const qs = event.queryStringParameters || {};
  const code = qs.code;
  const stateRaw = qs.state;

  if (!code) return { statusCode: 400, body: "Missing ?code" };

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT;

  if (!clientId || !clientSecret || !redirectUri) {
    return {
      statusCode: 500,
      body: "Missing GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_OAUTH_REDIRECT",
    };
  }

  const stateObj = parseState(stateRaw) || {};
  const as = String(stateObj.as || "").toLowerCase();
  const setup = String(stateObj.setup || "");

  const tokenUrl = "https://oauth2.googleapis.com/token";
  const body = new URLSearchParams();
  body.set("code", code);
  body.set("client_id", clientId);
  body.set("client_secret", clientSecret);
  body.set("redirect_uri", redirectUri);
  body.set("grant_type", "authorization_code");

  let tokenJson;
  try {
    const resp = await fetch(tokenUrl, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    tokenJson = await resp.json().catch(() => ({}));

    if (!resp.ok) {
      return {
        statusCode: 500,
        body: `Token exchange failed: ${JSON.stringify(tokenJson)}`,
      };
    }
  } catch (err) {
    return {
      statusCode: 500,
      body: `Token exchange error: ${String(err?.message || err)}`,
    };
  }

  const accessToken = tokenJson.access_token || "";
  const refreshToken = tokenJson.refresh_token || "";
  const expiresIn = Number(tokenJson.expires_in || 3600);

  const setupKeyOk =
    as === "siya" &&
    !!setup &&
    !!process.env.AS_OAUTH_SETUP_KEY &&
    setup === process.env.AS_OAUTH_SETUP_KEY;

  if (setupKeyOk) {
    return {
      statusCode: 200,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ok: true,
        refresh_token: refreshToken || null,
        note: refreshToken
          ? "Copy refresh_token into Netlify env var AS_SIYA_GCHAT_REFRESH_TOKEN"
          : "No refresh token returned. Siya must revoke access in Google Account → Security → Third-party access, then run setup again (with prompt=consent).",
      }),
    };
  }

  const headers = [];

  if (accessToken) {
    headers.push(cookie("AS_GCHAT_AT", accessToken, { maxAge: expiresIn }));
  }

  if (refreshToken) {
    headers.push(cookie("AS_GCHAT_RT", refreshToken, { maxAge: 60 * 60 * 24 * 120 }));
  }

  headers.push(
    cookie("AS_GCHAT_OK", "1", { maxAge: 60 * 60 * 24 * 120, httpOnly: false })
  );

  return {
    statusCode: 302,
    headers: {
      Location: "/?google=connected",
    },
    multiValueHeaders: {
      "Set-Cookie": headers, // ✅ Put the array here!
    },
    body: "",
  };
}