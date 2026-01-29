// netlify/functions/trello.js
export async function handler(event) {
  const { TRELLO_KEY, TRELLO_TOKEN, TRELLO_BOARD_ID } = process.env;
  if (!TRELLO_KEY || !TRELLO_TOKEN || !TRELLO_BOARD_ID) {
    return resp(500, { error: "Missing TRELLO_* env vars" });
  }

  const wantLists = (event.queryStringParameters?.lists || "")
    .split(",").map(s => s.trim()).filter(Boolean);

  const base = "https://api.trello.com/1";
  const auth = `key=${encodeURIComponent(TRELLO_KEY)}&token=${encodeURIComponent(TRELLO_TOKEN)}`;

  try {
    // fetch lists, cards(+customFieldItems), members, and board customFields
const [listsRes, cardsRes, membersRes, cfRes] = await Promise.all([
  fetch(`${base}/boards/${TRELLO_BOARD_ID}/lists?cards=none&filter=open&${auth}`),
  // include desc so we can show/edit the card Description in the app
  fetch(`${base}/boards/${TRELLO_BOARD_ID}/cards?filter=open&fields=name,idList,due,idMembers,labels,shortLink,desc&customFieldItems=true&${auth}`),
  fetch(`${base}/boards/${TRELLO_BOARD_ID}/members?${auth}`),
  fetch(`${base}/boards/${TRELLO_BOARD_ID}/customFields?${auth}`),
]);

const [lists, cards, members, boardCFs] = await Promise.all([
  listsRes.json(), cardsRes.json(), membersRes.json(), cfRes.json()
]);

const membersById = Object.fromEntries(
  (Array.isArray(members) ? members : []).map(m => [m.id, m.fullName || m.username || m.id])
);

// Build helper maps to translate option IDs -> text
const cfById = Object.fromEntries((boardCFs || []).map(f => [f.id, f]));
const optionTextById = new Map();
(boardCFs || []).forEach(f => (f.options || []).forEach(o => {
  optionTextById.set(o.id, (o.value?.text || "").trim());
}));

const openLists = (lists || []).filter(l => !l.closed);

const persona = (process.env.VITE_PERSONA || "").trim().toUpperCase();

// If the frontend passes ?lists=Name1,Name2, keep your existing behaviour.
let selected = wantLists.length
  ? openLists.filter(l => wantLists.includes(l.name))
  : openLists;

// If no ?lists=... was passed, auto-select lists by persona using list IDs.
if (!wantLists.length) {
  const personaListIds = [];

  if (persona === "SIYA") {
    if (process.env.VITE_TRELLO_LIST_SIYA) personaListIds.push(process.env.VITE_TRELLO_LIST_SIYA);
    if (process.env.VITE_TRELLO_LIST_SIYA_REVIEW) personaListIds.push(process.env.VITE_TRELLO_LIST_SIYA_REVIEW);
  }

  if (persona === "YOLANDIE") {
    if (process.env.VITE_TRELLO_LIST_YOLANDIE) personaListIds.push(process.env.VITE_TRELLO_LIST_YOLANDIE);
    if (process.env.VITE_TRELLO_LIST_YOLANDIE_REVIEW) personaListIds.push(process.env.VITE_TRELLO_LIST_YOLANDIE_REVIEW);
  }

  if (personaListIds.length) {
    selected = openLists.filter(l => personaListIds.includes(l.id));
  }
}

const buckets = selected.map(list => ({
  id: list.id,
  title: list.name,
  cards: (cards || [])
    .filter(c => c.idList === list.id)
    .map(c => {
      // 1) existing label-badges for your card colours
      const labelBadges = (c.labels || []).map(l => {
        const text = l.name || l.color || "Label";
        const type =
          /RAF LOE/i.test(text) ? "amber" :
          /RAF LOS/i.test(text) ? "teal"  :
          "green";
        return { type, text };
      });

      // 2) translate customFieldItems into a {Priority, Active, Status}
      const customFields = {};
      (c.customFieldItems || []).forEach(item => {
        const field = cfById[item.idCustomField];
        if (!field) return;

        // Only support the 3 dropdowns we care about
        const name = (field.name || "").trim();
        if (!["Priority","Active","Status"].includes(name)) return;

        // list/dropdown -> item.idValue => option text
        const text = item.idValue ? (optionTextById.get(item.idValue) || "") : "";
        if (text) customFields[name] = text;
      });

      // 3) merge those into text badges your UI understands ("Priority: X", etc.)
      //    Ensure there's exactly ONE canonical Priority badge and make it come FIRST.
      const cfBadges = [];
      const canonicalPriority = (txt) => {
        const p = String(txt || "").replace(/\s+/g, " ").trim().toUpperCase();
        if (p === "HIGH URGENT" || p === "HIGH-URGENT") return "HIGH URGENT";
        if (p === "URGENT + IMPORTANT" || p === "URGENT+IMPORTANT") return "URGENT + IMPORTANT";
        if (p === "URGENT") return "URGENT";
        if (p === "NEW CLIENT" || p === "NEW-CLIENT") return "NEW CLIENT";
        return "";
      };

      let prioBadge = null;
      if (customFields.Priority) {
        const canon = canonicalPriority(customFields.Priority);
        const priorityClass =
          canon === "HIGH URGENT"        ? "priority-green"  :
          canon === "URGENT + IMPORTANT" ? "priority-red"    :
          (canon === "URGENT" || canon === "NEW CLIENT") ? "priority-purple" : "priority-default";
        if (canon) prioBadge = { text: `Priority: ${canon}`, type: priorityClass };
      }

      if (customFields.Active) cfBadges.push({ text: `Active: ${customFields.Active}` });
      if (customFields.Status) cfBadges.push({ text: `Status: ${customFields.Status}` });

      const people = (c.idMembers || []).map(id => membersById[id] || id);

      // Priority FIRST, then labels, then other CF (so modal comparisons are deterministic)
      const priorityFirst = prioBadge ? [prioBadge] : [];
      const badges = [...priorityFirst, ...labelBadges, ...cfBadges];

      return {
        id: c.id,
        title: c.name,
        due: c.due,
        badges,
        labels: (c.labels || []).map(l => l.name || l.color).filter(Boolean),
        people,
        listId: c.idList,
        list: list.name,
        customFields,
        description: c.desc || "",   // ← pass the Trello description through
      };
    })
}));

return resp(200, { buckets });
  } catch (e) {
    return resp(500, { error: e.message || "Trello fetch failed" });
  }
}

function resp(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*"
    },
    body: JSON.stringify(body)
  };
}
