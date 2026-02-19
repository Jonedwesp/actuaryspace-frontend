export async function handler(event) {
  // 1. Standard Auth (Same as Chat)
  const RT = process.env.AS_GCHAT_RT; // (Or whatever env var holds the user's refresh token)
  // ... (Token exchange logic is identical to Chat functions) ...

  // 2. Fetch Emails from Gmail API
  // 'me' is the magic word that means "The user who owns this token" (Siya)
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=20&q=in:inbox`;

  const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` }
  });
  
  const json = await res.json();
  
  // Gmail returns a list of IDs. We often have to fetch details for each one,
  // but let's start by just getting the list.
  return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, messages: json.messages })
  };
}