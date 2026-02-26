// netlify/functions/google-auth-start.js
export async function handler(event) {
  const clientId = "255077263612-j39k16rqh685nn7sd4oh1qkn5f7eb1ls.apps.googleusercontent.com";
  
  // UPDATED: Points to google-oauth-callback (not auth-callback)
  const redirectUri = "https://siya.actuaryspace.co.za/.netlify/functions/google-oauth-callback";

  const SCOPES = [
    "https://mail.google.com/", // 👈 REQUIRED for permanent deletion
    "openid",
    "email",
    "profile",
    "https://www.googleapis.com/auth/chat.spaces",
    "https://www.googleapis.com/auth/chat.spaces.create",
    "https://www.googleapis.com/auth/chat.memberships",
    "https://www.googleapis.com/auth/chat.messages",
    "https://www.googleapis.com/auth/chat.messages.reactions",
    "https://www.googleapis.com/auth/chat.users.readstate",
    "https://www.googleapis.com/auth/gmail.modify",
    "https://www.googleapis.com/auth/directory.readonly",
    "https://www.googleapis.com/auth/contacts.other.readonly" // 👈 NEW: Required for previously contacted people
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