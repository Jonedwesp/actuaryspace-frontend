// netlify/functions/trello.js
console.log("[TRELLO FUNC VERSION] 2026-01-30 vSAFE 🔥 COMMIT TEST");

// ---- In-memory caches (persist per warm Netlify function instance) ----
let CACHE_SHORT = { ts: 0, body: null }; // buckets cache (lists+cards)
let CACHE_LONG = { ts: 0, members: null, cfs: null }; // members+customFields cache

const SHORT_TTL_MS = 15_000; // serve buckets from cache for 15s
const LONG_TTL_MS = 5 * 60_000; // members/customFields cache for 5 minutes

export async function handler(event) {
  const VERSION = "2026-01-30 vSAFE";
  console.log("[TRELLO FUNC VERSION]", VERSION);

  const { TRELLO_KEY, TRELLO_TOKEN, TRELLO_BOARD_ID } = process.env;
  if (!TRELLO_KEY || !TRELLO_TOKEN || !TRELLO_BOARD_ID) {
    return resp(500, { version: VERSION, error: "Missing TRELLO_* env vars" });
  }

  const wantLists = (event.queryStringParameters?.lists || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const base = "https://api.trello.com/1";
  const auth = `key=${encodeURIComponent(TRELLO_KEY)}&token=${encodeURIComponent(
    TRELLO_TOKEN
  )}`;

  try {
    const now = Date.now();

    // ✅ If we have a fresh cached response, return it immediately.
    if (CACHE_SHORT.body && now - CACHE_SHORT.ts < SHORT_TTL_MS) {
      return resp(200, { version: VERSION, cached: true, ...CACHE_SHORT.body });
    }

    // Decide whether to refresh members/customFields
    const needLong = !(
      CACHE_LONG.members &&
      CACHE_LONG.cfs &&
      now - CACHE_LONG.ts < LONG_TTL_MS
    );

    // Always fetch lists + cards. Fetch members/customFields only when LONG cache expires.
    const reqs = [
      fetch(
        `${base}/boards/${TRELLO_BOARD_ID}/lists?cards=none&filter=open&${auth}`
      ),
      fetch(
        `${base}/boards/${TRELLO_BOARD_ID}/cards?filter=open&fields=name,idList,due,idMembers,labels,shortLink,desc&customFieldItems=true&${auth}`
      ),
    ];

    if (needLong) {
      reqs.push(fetch(`${base}/boards/${TRELLO_BOARD_ID}/members?${auth}`));
      reqs.push(fetch(`${base}/boards/${TRELLO_BOARD_ID}/customFields?${auth}`));
    }

    const resArr = await Promise.all(reqs);
    const [listsRes, cardsRes, membersRes, cfRes] = resArr;

    // ✅ Special handling: If Trello rate-limits cards, serve cached buckets if possible
    if (cardsRes && cardsRes.status === 429) {
      const retryAfter =
        cardsRes.headers?.get("retry-after") ||
        cardsRes.headers?.get("Retry-After") ||
        "10";

      console.error("[TRELLO] 429 rate limit on cards. Serving cache if possible.", {
        retryAfter,
      });

      if (CACHE_SHORT.body) {
        return resp(200, {
          version: VERSION,
          cached: true,
          rateLimited: true,
          retryAfter,
          ...CACHE_SHORT.body,
        });
      }

      return resp(429, { version: VERSION, error: "Trello rate limited", retryAfter });
    }

    // Basic HTTP diagnostics (helps when Trello auth fails etc.)
    // Note: members/customFields might be undefined if using LONG cache
    if (
      !listsRes?.ok ||
      !cardsRes?.ok ||
      (needLong && (!membersRes?.ok || !cfRes?.ok))
    ) {
      const listsTxt = await listsRes?.text().catch(() => "");
      const cardsTxt = await cardsRes?.text().catch(() => "");
      const membersTxt = needLong
        ? await membersRes?.text().catch(() => "")
        : "(cached)";
      const cfTxt = needLong ? await cfRes?.text().catch(() => "") : "(cached)";

      console.error("[TRELLO] Upstream HTTP failure", {
        lists: { status: listsRes?.status, body: (listsTxt || "").slice(0, 400) },
        cards: { status: cardsRes?.status, body: (cardsTxt || "").slice(0, 400) },
        members: {
          status: needLong ? membersRes?.status : "cached",
          body: (membersTxt || "").slice(0, 400),
        },
        customFields: {
          status: needLong ? cfRes?.status : "cached",
          body: (cfTxt || "").slice(0, 400),
        },
      });

      return resp(502, {
        version: VERSION,
        error: "Upstream Trello HTTP error",
        upstream: {
          lists: listsRes?.status,
          cards: cardsRes?.status,
          members: needLong ? membersRes?.status : "cached",
          customFields: needLong ? cfRes?.status : "cached",
        },
      });
    }

    const [lists, cards] = await Promise.all([
      listsRes.json().catch(() => []),
      cardsRes.json().catch(() => []),
    ]);

    // ---- LONG cache populate (members + customFields) ----
    if (needLong) {
      const membersJson = await membersRes.json().catch(() => []);
      const cfRaw = await cfRes.text().catch(() => "[]");
      let cfJson = [];
      try {
        cfJson = JSON.parse(cfRaw);
      } catch {
        cfJson = [];
      }

      CACHE_LONG = {
        ts: Date.now(),
        members: Array.isArray(membersJson) ? membersJson : [],
        cfs: Array.isArray(cfJson) ? cfJson : [],
      };
    }

    const members = CACHE_LONG.members || [];
    const safeBoardCFs = Array.isArray(CACHE_LONG.cfs) ? CACHE_LONG.cfs : [];

    const membersById = Object.fromEntries(
      (Array.isArray(members) ? members : []).map((m) => [
        m.id,
        m.fullName || m.username || m.id,
      ])
    );

    // Build helper maps to translate option IDs -> text
    const cfById = Object.fromEntries(safeBoardCFs.map((f) => [f.id, f]));

    const optionTextById = new Map();
    safeBoardCFs.forEach((f) => {
      (Array.isArray(f.options) ? f.options : []).forEach((o) => {
        optionTextById.set(o.id, (o.value?.text || "").trim());
      });
    });

    const openLists = (Array.isArray(lists) ? lists : []).filter((l) => !l.closed);

    // Support either PERSONA or VITE_PERSONA (so you don't break anything)
    const persona = (process.env.PERSONA || process.env.VITE_PERSONA || "")
      .trim()
      .toUpperCase();

    console.log("[TRELLO] PERSONA RAW =", process.env.PERSONA);
    console.log("[TRELLO] PERSONA EFFECTIVE =", persona);

    // If the frontend passes ?lists=Name1,Name2, keep that behaviour (but be case-safe)
    const wantSet = new Set(wantLists.map((s) => s.toLowerCase()));

    // Persona ALWAYS wins for ActuarySpace
    const personaTitles =
      persona === "SIYA"
        ? ["Siya", "Siya - Review"]
        : persona === "YOLANDIE"
        ? ["Yolandie", "Yolandie - Review"]
        : [];

    // Default: persona-based selection
    let selected = openLists;

    if (personaTitles.length) {
      const titleSet = new Set(personaTitles.map((s) => s.toLowerCase()));
      selected = openLists.filter((l) =>
        titleSet.has((l.name || "").toLowerCase())
      );
    }

    // Optional override ONLY if persona is not set
    if (!personaTitles.length && wantLists.length) {
      selected = openLists.filter((l) =>
        wantSet.has((l.name || "").toLowerCase())
      );
    }

    const safeCards = Array.isArray(cards) ? cards : [];

    const buckets = selected.map((list) => ({
      id: list.id,
      title: list.name,
      cards: safeCards
        .filter((c) => c.idList === list.id)
        .map((c) => {
          // 1) existing label-badges for your card colours
          const labelBadges = (Array.isArray(c.labels) ? c.labels : []).map((l) => {
            const text = l.name || l.color || "Label";
            const type = /RAF LOE/i.test(text)
              ? "amber"
              : /RAF LOS/i.test(text)
              ? "teal"
              : "green";
            return { type, text };
          });

          // 2) translate customFieldItems into a {Priority, Active, Status}
          const customFields = {};
          (Array.isArray(c.customFieldItems) ? c.customFieldItems : []).forEach(
            (item) => {
              const field = cfById[item.idCustomField];
              if (!field) return;

              // Only support the 3 dropdowns we care about
              const name = (field.name || "").trim();
              if (!["Priority", "Active", "Status"].includes(name)) return;

              // list/dropdown -> item.idValue => option text
              const text = item.idValue
                ? optionTextById.get(item.idValue) || ""
                : "";
              if (text) customFields[name] = text;
            }
          );

          // 3) merge those into text badges your UI understands ("Priority: X", etc.)
          //    Ensure there's exactly ONE canonical Priority badge and make it come FIRST.
          const cfBadges = [];
          const canonicalPriority = (txt) => {
            const p = String(txt || "")
              .replace(/\s+/g, " ")
              .trim()
              .toUpperCase();

            if (p === "HIGH URGENT" || p === "HIGH-URGENT") return "HIGH URGENT";
            if (p === "URGENT + IMPORTANT" || p === "URGENT+IMPORTANT")
              return "URGENT + IMPORTANT";
            if (p === "URGENT") return "URGENT";
            if (p === "NEW CLIENT" || p === "NEW-CLIENT") return "NEW CLIENT";
            return "";
          };

          let prioBadge = null;
          if (customFields.Priority) {
            const canon = canonicalPriority(customFields.Priority);
            const priorityClass =
              canon === "HIGH URGENT"
                ? "priority-green"
                : canon === "URGENT + IMPORTANT"
                ? "priority-red"
                : canon === "URGENT" || canon === "NEW CLIENT"
                ? "priority-purple"
                : "priority-default";

            if (canon) prioBadge = { text: `Priority: ${canon}`, type: priorityClass };
          }

          if (customFields.Active) cfBadges.push({ text: `Active: ${customFields.Active}` });
          if (customFields.Status) cfBadges.push({ text: `Status: ${customFields.Status}` });

          const people = (Array.isArray(c.idMembers) ? c.idMembers : []).map(
            (id) => membersById[id] || id
          );

          // Priority FIRST, then labels, then other CF (so modal comparisons are deterministic)
          const priorityFirst = prioBadge ? [prioBadge] : [];
          const badges = [...priorityFirst, ...labelBadges, ...cfBadges];

          return {
            id: c.id,
            title: c.name,
            due: c.due,
            badges,
            labels: (Array.isArray(c.labels) ? c.labels : [])
              .map((l) => l.name || l.color)
              .filter(Boolean),
            people,
            listId: c.idList,
            list: list.name,
            customFields,
            description: c.desc || "", // ← pass the Trello description through
          };
        }),
    }));

    // ✅ Save SHORT cache of what we return
    CACHE_SHORT = { ts: Date.now(), body: { buckets } };

    // ✅ Include version so you can prove which deploy answered
    return resp(200, { version: VERSION, cached: false, buckets });
  } catch (e) {
    console.error("[TRELLO] handler fatal", e);
    return resp(500, {
      version: "2026-01-30 vSAFE",
      error: e.message || "Trello fetch failed",
    });
  }
}

function resp(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      // Optional: helps avoid weird caching of functions in some setups
      "Cache-Control": "no-store",
    },
    body: JSON.stringify(body),
  };
}