export async function handler(event) {
  const qs = event.queryStringParameters || {};
  const as = String(qs.as || "").toLowerCase();
  const setup = String(qs.setup || "");

  const clientId = process.env.GOOGLE_CLIENT_ID;
  
  // KEEP LOCALHOST for now to avoid "redirect_uri_mismatch"
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT;

  if (!clientId || !redirectUri) {
    return {
      statusCode: 500,
      body: "Missing GOOGLE_CLIENT_ID or GOOGLE_OAUTH_REDIRECT",
    };
  }

  const SCOPES = [
    "openid",
    "email",
    "profile",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
    "https://www.googleapis.com/auth/chat.messages",
    "https://www.googleapis.com/auth/chat.spaces",
    "https://www.googleapis.com/auth/chat.memberships",
    // ❌ REMOVED: chat.users.readonly (This was causing the Error 400)
  ];

  const stateObj = { ts: Date.now(), as, setup };
  const state = Buffer.from(JSON.stringify(stateObj)).toString("base64url");

  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", SCOPES.join(" "));
  authUrl.searchParams.set("access_type", "offline");
  authUrl.searchParams.set("prompt", "consent");
  authUrl.searchParams.set("include_granted_scopes", "true");
  authUrl.searchParams.set("state", state);

  return {
    statusCode: 302,
    headers: { Location: authUrl.toString() },
    body: "",
  };
}