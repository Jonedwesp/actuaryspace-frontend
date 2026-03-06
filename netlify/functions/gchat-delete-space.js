import { getAccessToken } from "./_google-creds.js";

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const { spaceId } = JSON.parse(event.body || "{}");
    if (!spaceId) {
      return { statusCode: 400, body: JSON.stringify({ error: "Missing spaceId" }) };
    }

    const accessToken = await getAccessToken(event);
    const formattedSpaceId = spaceId.startsWith("spaces/") ? spaceId : `spaces/${spaceId}`;

    // 1. First, check the space type
    const spaceRes = await fetch(`https://chat.googleapis.com/v1/${formattedSpaceId}`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const spaceData = await spaceRes.json();

    let res;
    if (spaceData.type === "DIRECT_MESSAGE") {
      // 2. For DMs, we delete Siya's membership to "remove" it from his UI
      // Membership for the current user is always 'members/me'
      res = await fetch(`https://chat.googleapis.com/v1/${formattedSpaceId}/members/me`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` }
      });
    } else {
      // 3. For Named Spaces, we can attempt a full delete (if Siya is owner)
      res = await fetch(`https://chat.googleapis.com/v1/${formattedSpaceId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` }
      });
    }

    // Even if DELETE fails (e.g., Siya isn't admin of a Space), 
    // we return ok: true so the frontend hides it locally.
    return {
      statusCode: 200,
      body: JSON.stringify({ 
        ok: res.ok, 
        methodUsed: spaceData.type === "DIRECT_MESSAGE" ? "membership.delete" : "space.delete" 
      })
    };
  } catch (error) {
    console.error("Delete space error:", error);
    return {
      statusCode: 200,
      body: JSON.stringify({ ok: false, error: error.message })
    };
  }
}
