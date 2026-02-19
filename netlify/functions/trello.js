// netlify/functions/trello.js
const https = require("https");

console.log("[TRELLO FUNC VERSION] 2026-02-07 vHTTPS-NATIVE ✅");

// --- 1. Helper: Native HTTPS Request (Replaces fetch) ---
function nativeFetch(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        resolve({
          ok: res.statusCode >= 200 && res.statusCode < 300,
          status: res.statusCode,
          statusText: res.statusMessage,
          json: () => {
            try { return Promise.resolve(JSON.parse(data)); }
            catch (e) { return Promise.reject(e); }
          },
          text: () => Promise.resolve(data),
        });
      });
    }).on("error", (e) => reject(e));
  });
}

// --- 2. Helper: Response Builder ---
function resp(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-store",
    },
    body: JSON.stringify(body),
  };
}

// --- 3. Main Handler (Your Original Logic) ---
exports.handler = async (event) => {
  const VERSION = "2026-02-07 vHTTPS-NATIVE";
  console.log("[TRELLO FUNC VERSION]", VERSION);

  const { TRELLO_KEY, TRELLO_TOKEN, TRELLO_BOARD_ID } = process.env;
  if (!TRELLO_KEY || !TRELLO_TOKEN || !TRELLO_BOARD_ID) {
    return resp(500, { version: VERSION, error: "Missing TRELLO_* env vars" });
  }

  // Your original query param logic
  const wantLists = (event.queryStringParameters?.lists || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const base = "https://api.trello.com/1";
  const auth = `key=${encodeURIComponent(TRELLO_KEY)}&token=${encodeURIComponent(TRELLO_TOKEN)}`;

  try {
    // --- 4. Parallel Fetch (Using Native Helper) ---
    const [listsRes, cardsRes, membersRes, cfRes] = await Promise.all([
      nativeFetch(`${base}/boards/${TRELLO_BOARD_ID}/lists?cards=none&filter=open&${auth}`),
      nativeFetch(`${base}/boards/${TRELLO_BOARD_ID}/cards?filter=open&fields=name,idList,due,idMembers,labels,shortLink,desc,pos&customFieldItems=true&${auth}`),
      nativeFetch(`${base}/boards/${TRELLO_BOARD_ID}/members?${auth}`),
      nativeFetch(`${base}/boards/${TRELLO_BOARD_ID}/customFields?${auth}`),
    ]);

    // --- 5. Diagnostics (Your Original Logic) ---
    if (!listsRes.ok || !cardsRes.ok || !membersRes.ok || !cfRes.ok) {
      const [listsTxt, cardsTxt, membersTxt, cfTxt] = await Promise.all([
        listsRes.text().catch(() => ""),
        cardsRes.text().catch(() => ""),
        membersRes.text().catch(() => ""),
        cfRes.text().catch(() => ""),
      ]);

      console.error("[TRELLO] Upstream HTTP failure", {
        lists: { status: listsRes.status, body: listsTxt.slice(0, 400) },
        cards: { status: cardsRes.status, body: cardsTxt.slice(0, 400) },
        members: { status: membersRes.status, body: membersTxt.slice(0, 400) },
        customFields: { status: cfRes.status, body: cfTxt.slice(0, 400) },
      });

      return resp(502, {
        version: VERSION,
        error: "Upstream Trello HTTP error",
        upstream: {
          lists: listsRes.status,
          cards: cardsRes.status,
          members: membersRes.status,
          customFields: cfRes.status,
        },
      });
    }

    const [lists, cards, members] = await Promise.all([
      listsRes.json().catch(() => []),
      cardsRes.json().catch(() => []),
      membersRes.json().catch(() => []),
    ]);

    // --- 6. Custom Fields Logic (Your Original Logic) ---
    let boardCFsRawText = "";
    let boardCFs = [];

    try {
      boardCFsRawText = await cfRes.text();
      const parsed = JSON.parse(boardCFsRawText);
      boardCFs = Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.error("[TRELLO] customFields parse failed", e);
      boardCFs = [];
    }

    const safeBoardCFs = Array.isArray(boardCFs) ? boardCFs : [];
    const membersById = Object.fromEntries(
      (Array.isArray(members) ? members : []).map((m) => [m.id, m.fullName || m.username || m.id])
    );
    const cfById = Object.fromEntries(safeBoardCFs.map((f) => [f.id, f]));
    const optionTextById = new Map();
    safeBoardCFs.forEach((f) => {
      (Array.isArray(f.options) ? f.options : []).forEach((o) => {
        optionTextById.set(o.id, (o.value?.text || "").trim());
      });
    });

    const openLists = (Array.isArray(lists) ? lists : []).filter((l) => !l.closed);

    // --- 7. Persona Filtering (Your Original Logic) ---
    const persona = (process.env.PERSONA || process.env.VITE_PERSONA || "").trim().toUpperCase();
    const wantSet = new Set(wantLists.map((s) => s.toLowerCase()));

    const personaTitles = persona === "SIYA"
        ? ["Siya - Review", "Siya", "Bonolo S", "Bonisa", "Songeziwe", "Enock"]
        : persona === "YOLANDIE"
        ? ["Yolandie to Data Capture", "Yolandie to Analyst", "Yolandie to Data Analyst", "Yolandie to Reviewer", "Yolandie to Send"]
        : [];

    let selected = openLists;
    if (personaTitles.length) {
      const titleSet = new Set(personaTitles.map((s) => s.toLowerCase()));
      selected = openLists.filter((l) => titleSet.has((l.name || "").toLowerCase()));
      // Ensure sorting matches Persona order
      selected.sort((a, b) => {
         const idxA = personaTitles.findIndex(t => t.toLowerCase() === a.name.toLowerCase());
         const idxB = personaTitles.findIndex(t => t.toLowerCase() === b.name.toLowerCase());
         return (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB);
      });
    }

    // --- 8. Build Buckets (Your Original Logic) ---
    const safeCards = Array.isArray(cards) ? cards : [];
    const buckets = selected.map((list) => ({
      id: list.id,
      title: list.name,
      cards: safeCards
        .filter((c) => c.idList === list.id)
        .sort((a, b) => (a.pos || 0) - (b.pos || 0)) // Ensure strict Trello order
        .map((c) => {
          const labelBadges = (Array.isArray(c.labels) ? c.labels : []).map((l) => {
            const text = l.name || l.color || "Label";
            const type = /RAF LOE/i.test(text) ? "amber" : /RAF LOS/i.test(text) ? "teal" : "green";
            return { type, text };
          });

     const customFields = {};
          (Array.isArray(c.customFieldItems) ? c.customFieldItems : []).forEach((item) => {
            const field = cfById[item.idCustomField];
            if (!field) return;
            const name = (field.name || "").trim();

            /// Timer fields are number type, not dropdowns
            if (name === "TimerStart" || name === "Duration" || name === "WorkTimerStart" || name === "WorkDuration") {
              const val = item.value?.number ?? item.value?.text ?? "";
              if (val !== "" && val !== null && val !== undefined) customFields[name] = String(val);
              return;
            }
            if (!["Priority", "Active", "Status"].includes(name)) return;
            const text = item.idValue ? (optionTextById.get(item.idValue) || "") : "";
            if (text) customFields[name] = text;
          });

          const cfBadges = [];
          const canonicalPriority = (txt) => {
            const p = String(txt || "").replace(/\s+/g, " ").trim().toUpperCase();
            if (p.includes("HIGH URGENT")) return "HIGH URGENT";
            if (p.includes("URGENT + IMPORTANT")) return "URGENT + IMPORTANT";
            if (p === "URGENT") return "URGENT";
            if (p.includes("NEW CLIENT")) return "NEW CLIENT";
            return "";
          };

          let prioBadge = null;
          if (customFields.Priority) {
            const canon = canonicalPriority(customFields.Priority);
            const priorityClass =
              canon === "HIGH URGENT" ? "priority-green" :
              canon === "URGENT + IMPORTANT" ? "priority-red" :
              (canon === "URGENT" || canon === "NEW CLIENT") ? "priority-purple" : "priority-default";
            if (canon) prioBadge = { text: `Priority: ${canon}`, type: priorityClass };
          }

          // 1. Status (Middle)
          if (customFields.Status) cfBadges.push({ text: `Status: ${customFields.Status}` });
          // 2. Active (Bottom)
          if (customFields.Active) cfBadges.push({ text: `Active: ${customFields.Active}` });

          const people = (Array.isArray(c.idMembers) ? c.idMembers : []).map((id) => membersById[id] || id);
          
          // 0. Priority (Top)
          const priorityFirst = prioBadge ? [prioBadge] : [];
          
          // Final Order: Priority -> Status -> Active -> Labels
          // Note: Labels are usually visual tags, here we put them after Priority but before CFs if you want 
          // strict Priority -> Status -> Active.
          
          // Let's force the order requested: Priority -> Status -> Active
          // We will separate labelBadges from the CF badges for clearer sorting if needed, 
          // but based on your request, this order is what affects the vertical stack.
          const badges = [...priorityFirst, ...cfBadges, ...labelBadges];

          return {
            id: c.id,
            title: c.name,
            due: c.due,
            badges,
            labels: (Array.isArray(c.labels) ? c.labels : []).map((l) => l.name || l.color).filter(Boolean),
            people,
            listId: c.idList,
            list: list.name,
            customFields,
            description: c.desc || "",
          };
        }),
    }));

    return resp(200, { version: VERSION, buckets });

  } catch (e) {
    console.error("[TRELLO] handler fatal", e);
    return resp(500, { version: VERSION, error: e?.message || "Trello fetch failed" });
  }
};