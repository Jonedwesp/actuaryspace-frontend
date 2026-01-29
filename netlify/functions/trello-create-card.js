// netlify/functions/trello-create-card.js
// Creates a Trello card from a "Case Card Summary" text block

// 🔑 Support BOTH old and new env var names so it works with your existing vars
const TRELLO_KEY =
  process.env.TRELLO_KEY || process.env.TRELLO_API_KEY;
const TRELLO_TOKEN =
  process.env.TRELLO_TOKEN || process.env.TRELLO_API_TOKEN;

// Optional board ID (not strictly needed if list is enough)
const TRELLO_BOARD_ID =
  process.env.TRELLO_BOARD_ID || process.env.TRELLO_API_BOARD_ID;

// Inbox list where new cards go (your "Yolandie to Data Capture" list)
const TRELLO_INBOX_LIST_ID = process.env.TRELLO_INBOX_LIST_ID;

function pad2(n) {
  return String(n).padStart(2, "0");
}

function parseCaseCardText(txt = "") {
  const get = (label) => {
    const m = txt.match(new RegExp(label + "\\s*:\\s*(.+)", "i"));
    return m ? m[1].trim() : "";
  };

  const claimant    = get("Claimant");
  const matter      = get("Matter");
  const acRef       = get("AC REF");
  const description = get("Description");

  return { claimant, matter, acRef, description };
}

// "Siyanda Sidwell Kali" -> "SS Kali"
function makeShortName(full = "") {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "Unknown Claimant";
  if (parts.length === 1) return parts[0];

  const surname  = parts[parts.length - 1];
  const initials = parts
    .slice(0, -1)
    .map((p) => p[0].toUpperCase())
    .join("");

  return `${initials} ${surname}`;
}

function buildDue(instructionTimeIso) {
  const base = instructionTimeIso ? new Date(instructionTimeIso) : new Date();
  const due  = new Date(base.getTime() + 24 * 60 * 60 * 1000); // +24h

  const monthNames = [
    "January","February","March","April","May","June",
    "July","August","September","October","November","December",
  ];

  const day   = due.getDate();
  const month = monthNames[due.getMonth()];
  const hh    = pad2(due.getHours());
  const mm    = pad2(due.getMinutes());

  const display = `Due ${day} ${month} ${hh}:${mm}`;
  return { due, display };
}

export async function handler(event) {
  try {
    if (event.httpMethod !== "POST") {
      return {
        statusCode: 405,
        body: JSON.stringify({ ok: false, error: "Use POST" }),
      };
    }

    // ✅ NEW error text so we can see this version is active
    if (!TRELLO_KEY || !TRELLO_TOKEN || !TRELLO_INBOX_LIST_ID) {
      return {
        statusCode: 500,
        body: JSON.stringify({
          ok: false,
          error:
            "Missing Trello env vars v2 (need TRELLO_KEY/TRELLO_API_KEY, TRELLO_TOKEN/TRELLO_API_TOKEN, TRELLO_INBOX_LIST_ID)",
        }),
      };
    }

    const body = JSON.parse(event.body || "{}");
    const {
      caseCardText = "",
      instructionTimeIso,
      fallbackDescription = "",
    } = body;

    const { claimant, matter, acRef, description } =
      parseCaseCardText(caseCardText);

    const shortName = makeShortName(claimant || "Unknown Claimant");
    const { due, display: dueDisplay } = buildDue(instructionTimeIso);

    const cardName = `${shortName} (${dueDisplay})`;

    const lines = [];
    if (description) lines.push(description);
    if (acRef)       lines.push(`AC REF: ${acRef}`);
    if (matter)      lines.push(`Matter: ${matter}`);
    if (fallbackDescription && fallbackDescription !== description) {
      lines.push("");
      lines.push(`Email subject: ${fallbackDescription}`);
    }

    const cardDesc = lines.join("\n");

    // --- Create card on Trello ---
    const params = new URLSearchParams({
      key: TRELLO_KEY,
      token: TRELLO_TOKEN,
      idList: TRELLO_INBOX_LIST_ID,
      ...(TRELLO_BOARD_ID ? { idBoard: TRELLO_BOARD_ID } : {}),
      name: cardName,
      desc: cardDesc,
      pos: "top",
      due: due.toISOString(),
    });

    const createRes = await fetch(
      `https://api.trello.com/1/cards?${params.toString()}`,
      { method: "POST" }
    );

    const data = await createRes.json().catch(() => null);

    if (!createRes.ok) {
      console.error("Trello create error", createRes.status, data);
      return {
        statusCode: 500,
        body: JSON.stringify({
          ok: false,
          error: `Trello API error ${createRes.status}`,
          details: data,
        }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, card: data, dueDisplay }),
    };
  } catch (err) {
    console.error("trello-create-card fatal error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({
        ok: false,
        error: err.message || String(err),
      }),
    };
  }
}
