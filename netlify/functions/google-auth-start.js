// netlify/functions/google-auth-start.js

export async function handler(event) {
  // --- HARDCODED FIXES ---
  const clientId = "255077263612-j39k16rqh685nn7sd4oh1qkn5f7eb1ls.apps.googleusercontent.com"; // 
  const redirectUri = "http://localhost:8888/.netlify/functions/google-oauth-callback";
  // -----------------------

  const SCOPES = [
    "openid",
    "email",
    "profile",
    "https://www.googleapis.com/auth/chat.spaces.readonly",
    "https://www.googleapis.com/auth/chat.memberships.readonly",
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/directory.readonly"
  ];

  const rootUrl = "https://accounts.google.com/o/oauth2/v2/auth";
  const options = {
    redirect_uri: redirectUri,
    client_id: clientId,
    access_type: "offline",
    response_type: "code",
    prompt: "consent",
    scope: SCOPES.join(" "),
  };

  const qs = new URLSearchParams(options).toString();
  return {
    statusCode: 302,
    headers: { Location: `${rootUrl}?${qs}` },
    body: "",
  };
}