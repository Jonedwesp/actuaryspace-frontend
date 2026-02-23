// netlify/functions/google-auth-start.js

export async function handler(event) {
  // --- PRODUCTION CONFIGURATION ---
  const clientId = "255077263612-j39k16rqh685nn7sd4oh1qkn5f7eb1ls.apps.googleusercontent.com";
  
  // FIX: Redirecting to your LIVE production domain
  const redirectUri = "https://siya.actuaryspace.co.za/.netlify/functions/google-auth-callback";
  // --------------------------------

  const SCOPES = [
    "openid",
    "email",
    "profile",
    "https://www.googleapis.com/auth/chat.spaces",      // 🔓 Unlocks "Start direct message"
    "https://www.googleapis.com/auth/chat.memberships", // 🔓 Unlocks Space management
    "https://www.googleapis.com/auth/chat.messages",    // 🔓 Unlocks Replies/Reactions
    "https://www.googleapis.com/auth/gmail",            // 🔓 Unlocks Email Composing
    "https://www.googleapis.com/auth/directory.readonly"
  ];

  const rootUrl = "https://accounts.google.com/o/oauth2/v2/auth";
  const options = {
    redirect_uri: redirectUri,
    client_id: clientId,
    access_type: "offline",
    response_type: "code",
    prompt: "consent", // Forces the checkboxes to appear for Siya
    scope: SCOPES.join(" "),
  };

  const qs = new URLSearchParams(options).toString();
  return {
    statusCode: 302,
    headers: { 
      Location: `${rootUrl}?${qs}` 
    },
    body: "",
  };
}