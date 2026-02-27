import { getAccessToken } from "./_google-creds.js";

// 🏆 THE MASTER LIST
const KNOWN_USERS = {
  "users/116712532865547233135": "Siya ActuarySpace",
  "users/109833975621386956073": "Jonathan Espanol",
  "users/116928759608148752435": "Simoné Streicher",
  "users/101273447946115685891": "Tiffany Harzon-Cuyler",
  "users/110481684541592719996": "Albert Grobler",
  "users/103060225088465733197": "Tinashe Chikwamba",
  "users/105158373279991959375": "Ethan Maburutse",
  "users/112681921793658298066": "Miné Moolman",
  "users/114609724339659491302": "Bianca Wiid",
  "users/100183703799963986718": "Alicia Oberholzer",
  "users/106094639157491328183": "Leonah Marewangepo",
  "users/100973980027446317396": "Eugene Cloete",
  "users/101954867987984084170": "Alicia Kotzé",
  "users/108929714281084389788": "Songeziwe Chiya",
  "users/110745530036003772233": "Bonisa Mqonqo",
  "users/100710383419487896813": "Cameron Curtis",
  "users/104310623309718505350": "Shamiso Hapaguti",
  "users/113565695109176296608": "Waldo Jenkins",
  "users/108628384720735354945": "Melvin Smith",
  "users/115863503558522206541": "Yolandie",
  "users/105726015150067918055": "Enock Kazembe",
  "users/114022848581179253421": "Matthew Darch",
  "users/104654529926543347255": "Martin Otto"
};

const EMOJI_MAP = {
  "👍": "like",
  "❤️": "heart",
  "😆": "laugh"
};

export async function handler(event) {
  try {
    const { space, pageToken } = event.queryStringParameters || {};
    if (!space) return json(400, { ok: false, error: "Missing ?space" });

    // 🛡️ SECURITY FIX: No longer strictly requiring cookies here.
    // getAccessToken will now automatically fall back to process.env.AS_GCHAT_RT
    const accessToken = await getAccessToken(event);
    // 2) List messages
    const url = new URL(`https://chat.googleapis.com/v1/${space}/messages`);
    url.searchParams.set("pageSize", "100"); // ⚡ INCREASED: Fetches more history per click
    url.searchParams.set("orderBy", "createTime desc");
    
    if (pageToken) {
      url.searchParams.set("pageToken", pageToken);
    }

    url.searchParams.set(
      "fields", 
      "messages(name,text,createTime,sender(name,displayName,email,type),emojiReactionSummaries,attachment(name,contentName,contentType,downloadUri,attachmentDataRef)),nextPageToken"
    );
    
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return json(502, { ok: false, error: "List failed", details: data });
    }
    const msgs = Array.isArray(data.messages) ? data.messages : [];

    // 3) Process Messages
    const messages = msgs.map((m) => {
      const senderId = m?.sender?.name || null; 
      const apiDisplay = m?.sender?.displayName;
      const apiEmail = m?.sender?.email;
      
      let resolved = "Unknown";
      if (senderId && KNOWN_USERS[senderId]) {
        resolved = KNOWN_USERS[senderId];
      } else if (apiDisplay) {
        resolved = apiDisplay;
      } else if (apiEmail) {
        resolved = apiEmail.split("@")[0];
      } else if (senderId) {
        resolved = senderId; 
      }

      const reactions = [];
      if (m.emojiReactionSummaries) {
        m.emojiReactionSummaries.forEach(r => {
          const unicode = r.emoji?.unicode;
          if (unicode && EMOJI_MAP[unicode]) {
            if (r.reactionCount > 0) {
              reactions.push(EMOJI_MAP[unicode]);
            }
          }
        });
      }

      return {
        id: m.name,
        text: m.text || "",
        createTime: m.createTime || null,
        sender: {
          id: senderId,
          name: senderId,
          displayName: resolved,
          type: m?.sender?.type,
        },
        reactions,
        attachment: m.attachment || [] 
      };
    });

    return json(200, { ok: true, messages, nextPageToken: data.nextPageToken });
  } catch (err) {
    console.error("GCHAT-MESSAGES ERROR:", err.message);
    const isAuthError = err.message.includes("No Refresh Token");
    return json(isAuthError ? 401 : 500, { ok: false, error: err.message });
  }
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: { 
      "Content-Type": "application/json",
      "Cache-Control": "no-cache" 
    },
    body: JSON.stringify(body),
  };
}