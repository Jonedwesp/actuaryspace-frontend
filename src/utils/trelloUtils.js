
/* ---------- Trello card modal (helpers) ---------- */
export function deriveDescriptionFromTitle(title = "") {
  // strip LM/MD time tags and the Due tag, keep other text
  let s = String(title);
  s = s.replace(/\(\s*(LM|MD)\s+\d{1,2}\s+\w+\s+\d{2}:\d{2}\s*\)/gi, "");
  s = s.replace(/\(\s*Due[^)]*\)/gi, "");
  s = s.replace(/\s{2,}/g, " ").replace(/\s*-\s*$/,"").trim();
  // Style: "Re: <remaining>"
  return s ? `Re: ${s}` : "";
}


export function parseCustomFieldsFromBadges(badges = []) {
  const out = {};
  badges.forEach(b => {
    const t = b.text || "";
    if (/^Priority/i.test(t)) out.priority = canonicalPriority(t.replace(/^Priority:\s*/i, ""));
    if (/^Status/i.test(t))   out.status   = t.replace(/^Status:\s*/i, "");
    if (/^Active/i.test(t))   out.active   = t.replace(/^Active:\s*/i, "");
  });
  return out;
}

// --- Trello custom field setter ---
export async function setCardCustomField(cardId, fieldName, valueText) {
  const res = await fetch("/.netlify/functions/trello-set-custom-field", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ cardId, fieldName, valueText }),
  });
  const json = await res.json().catch(async () => ({ raw: await res.text().catch(() => "") }));
  if (!res.ok || json?.ok !== true) {
    const msg = JSON.stringify(json);
    throw new Error(`Trello write failed (${res.status}): ${msg}`);
  }
  return json;
}

// Description setter (writes Trello card.desc)
export async function setCardDescription(cardId, desc) {
  const res = await fetch("/.netlify/functions/trello-set-description", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ cardId, desc }),
  });
  const json = await res.json().catch(async () => ({ raw: await res.text().catch(() => "") }));
  if (!res.ok || json?.ok !== true) {
    const msg = JSON.stringify(json);
    throw new Error(`Trello description write failed (${res.status}): ${msg}`);
  }
  return json;
}

/* --- CUSTOM FIELD OPTIONS & COLORS --- */

export const PRIORITY_OPTIONS = [
  "HIGH URGENT",
  "URGENT + IMPORTANT",
  "URGENT",
  "NEW CLIENT"
];

export const ACTIVE_OPTIONS = [
  "Working on it",
  "Not working on it",
  "Do not move card"
];

export const STATUS_OPTIONS = [
  "To Do - RAF",
  "To Do - Other",
  "Doing",
  "Data Review",
  "Asking IP",
  "Ready to be reviewed - 24hr",
  "Ready to be reviewed - URGENT",
  "Ready to be reviewed - New Client Urgent",
  "Ready to be reviewed - Longer Cases",
  "2nd Review",
  "Analyst to Update",
  "Reviewer Respond",
  "Ready To Send",
  "Waiting for client info",
  "Approved",
  "Actuary Expert",
  "Pause",
  "Asking Senior Analyst",
  "Capturing Data",
  "Checklist Doing"
];

// Helper: Get the CSS class for the Select Box based on the selected value
export function getCFColorClass(field, value) {
  const v = (value || "").trim();
  if (!v) return "cf-grey-light";

  // --- PRIORITY ---
  if (field === "Priority") {
    if (v === "HIGH URGENT") return "cf-green-light";
    if (v === "URGENT + IMPORTANT") return "cf-red-light";
    if (v === "URGENT") return "cf-pink-light";
    if (v === "NEW CLIENT") return "cf-pink-light";
  }

  // --- ACTIVE ---
  if (field === "Active") {
    if (v === "Working on it") return "cf-green-light";
    if (v === "Not working on it") return "cf-orange-light";
    if (v === "Do not move card") return "cf-red-light";
  }

  // --- STATUS ---
  if (field === "Status") {
    // Orange
    if (["To Do - RAF", "Ready to be reviewed - Longer Cases", "Pause"].includes(v)) return "cf-orange-light";
    // Blue
    if (["To Do - Other", "Data Review", "Ready to be reviewed - URGENT", "Analyst to Update", "Actuary Expert"].includes(v)) return "cf-blue-light";
    // Green
    if (["Doing", "Ready To Send", "Capturing Data", "Data Review"].includes(v)) return "cf-green-light";
    // Purple
    if (["Asking IP", "Waiting for client info", "Approved"].includes(v)) return "cf-purple-light";
    // Pink
    if (["Ready to be reviewed - 24hr"].includes(v)) return "cf-pink-light";
    // Yellow
    if (["Ready to be reviewed - New Client Urgent", "Asking Senior Analyst"].includes(v)) return "cf-yellow-light";
    // Grey
    if (["2nd Review", "Checklist Doing"].includes(v)) return "cf-grey-light";
    // Red
    if (["Reviewer Respond"].includes(v)) return "cf-red-light";
  }

  return "cf-grey-light";
}

/* Exact Colors from Screenshot 11 */
export const ALL_LABEL_OPTIONS = [
  // Green
  { name: "Breach of Contract", bg: "#baf3db", color: "#164b35" },
  { name: "Paid", bg: "#baf3db", color: "#164b35" },
  { name: "Payment arrangement", bg: "#baf3db", color: "#164b35" },
  { name: "Personal injury", bg: "#baf3db", color: "#164b35" },
  { name: "Financial Loss and Damages", bg: "#4bce97", color: "#164b35" },
  { name: "RAF LOE", bg: "#4bce97", color: "#164b35" },
  { name: "Non-RAF LOE", bg: "#4bce97", color: "#164b35" },
  { name: "Pension Calculations", bg: "#1f845a", color: "#ffffff" },

  // Yellow/Gold
  { name: "Labour", bg: "#f8e6a0", color: "#533f04" },
  { name: "Maintenance", bg: "#f5cd47", color: "#533f04" },
  { name: "Investment Portfolio Calc", bg: "#9a782d", color: "#ffffff" },
  { name: "Training", bg: "#9a782d", color: "#ffffff" },

  // Orange
  { name: "Innovation", bg: "#ffe2bd", color: "#5f3811" },
  { name: "Medical Expenses", bg: "#ffe2bd", color: "#5f3811" },
  { name: "Past Medical Negligence", bg: "#faa53d", color: "#5f3811" },
  { name: "Arbitration", bg: "#b65c02", color: "#ffffff" },

  // Red
  { name: "Benefits Calculation", bg: "#ffd2cc", color: "#5d1f1a" },
  { name: "Bond Calculation", bg: "#ffd2cc", color: "#5d1f1a" },
  { name: "Forensic Audit", bg: "#f87462", color: "#5d1f1a" },
  { name: "RyanGPT", bg: "#c9372c", color: "#ffffff" },
  { name: "Waiting payment", bg: "#c9372c", color: "#ffffff" },

  // Purple
  { name: "Broken Contract Calc", bg: "#dfd8fd", color: "#352c63" },
  { name: "Building Model", bg: "#dfd8fd", color: "#352c63" },
  { name: "Other", bg: "#9f8fef", color: "#352c63" },
  { name: "Deceased Estate", bg: "#6e5dc6", color: "#ffffff" },

  // Teal/Cyan
  { name: "RAF LOS", bg: "#579dff", color: "#09326c" },
];

export function getLabelStyle(name) {
  const colorClass = getLabelColor(name);
  const colorMap = {
    "label-green-light": { backgroundColor: "#baf3db", color: "#164b35" },
    "label-green-norm": { backgroundColor: "#4bce97", color: "#164b35" },
    "label-green-dark": { backgroundColor: "#1f845a", color: "#ffffff" },
    "label-yellow-light": { backgroundColor: "#f8e6a0", color: "#533f04" },
    "label-yellow-norm": { backgroundColor: "#f5cd47", color: "#533f04" },
    "label-brown-norm": { backgroundColor: "#d3c4a5", color: "#4a3a23" },
    "label-orange-light": { backgroundColor: "#ffe2bd", color: "#5f3811" },
    "label-orange-norm": { backgroundColor: "#faa53d", color: "#5f3811" },
    "label-orange-dark": { backgroundColor: "#b65c02", color: "#ffffff" },
    "label-red-light": { backgroundColor: "#ffd2cc", color: "#5d1f1a" },
    "label-red-norm": { backgroundColor: "#f87462", color: "#5d1f1a" },
    "label-red-dark": { backgroundColor: "#ca3521", color: "#ffffff" },
    "label-purple-light": { backgroundColor: "#dfd8fd", color: "#352c63" },
    "label-purple-norm": { backgroundColor: "#9f8fef", color: "#352c63" },
    "label-purple-dark": { backgroundColor: "#6e5dc6", color: "#ffffff" },
    "label-blue-norm": { backgroundColor: "#579dff", color: "#09326c" },
    "label-teal-norm": { backgroundColor: "#2c7a8b", color: "#ffffff" },
    "label-default": { backgroundColor: "#091e420f", color: "#172b4d" }
  };
  return colorMap[colorClass] || colorMap["label-default"];
}

export function canonicalPriority(txt) {
  const p = String(txt || "").replace(/\s+/g, " ").trim().toUpperCase();
  if (p.includes("HIGH URGENT")) return "HIGH URGENT";
  if (p.includes("URGENT + IMPORTANT")) return "URGENT + IMPORTANT";
  if (p === "URGENT") return "URGENT";
  if (p.includes("NEW CLIENT")) return "NEW CLIENT";
  return "";
}

export function priorityTypeFromText(txt) {
  const p = canonicalPriority(txt);
  return getCFColorClass("Priority", p).replace("cf-", "priority-");
}

export function statusTypeFromText(txt) {
  return getCFColorClass("Status", txt).replace("cf-", "status-");
}

export function activeTypeFromText(txt) {
  return getCFColorClass("Active", txt).replace("cf-", "active-");
}

// Helper to assign specific colors and shades to standard labels
export function getLabelColor(text) {
  const t = (text || "").toLowerCase().trim();

  // --- GREEN ---
  if (["breach of contract", "paid", "payment arrangement", "personal injury"].some(k => t.includes(k))) return "label-green-light";
  if (["financial loss", "non-raf loe", "raf loe"].some(k => t.includes(k))) return "label-green-norm";
  if (["pension calculations"].some(k => t.includes(k))) return "label-green-dark";

  // --- YELLOW ---
  if (["labour"].some(k => t.includes(k))) return "label-yellow-light";
  if (["maintenance"].some(k => t.includes(k))) return "label-yellow-norm";

  // --- BROWN ---
  if (["investment portfolio", "training"].some(k => t.includes(k))) return "label-brown-norm";

  // --- ORANGE ---
  if (["innovation", "medical expenses"].some(k => t.includes(k))) return "label-orange-light";
  if (["past medical negligence"].some(k => t.includes(k))) return "label-orange-norm";
  if (["arbitration"].some(k => t.includes(k))) return "label-orange-dark";

  // --- RED ---
  if (["benefits calculation", "bond calculation"].some(k => t.includes(k))) return "label-red-light";
  if (["forensic audit"].some(k => t.includes(k))) return "label-red-norm";
  if (["ryangpt", "ryan gpt", "waiting payment"].some(k => t.includes(k))) return "label-red-dark";

  // --- PURPLE ---
  if (["broken contract", "building model"].some(k => t.includes(k))) return "label-purple-light";
  if (["other"].some(k => t === "other" || t.includes("other -"))) return "label-purple-norm";
  if (["deceased estate"].some(k => t.includes(k))) return "label-purple-dark";

  // --- BLUE ---
  if (["non-raf los", "share valuation", "farm", "joint actuarial", "professional negligence", "wrongful", "divorce", "accrual", "commercial", "ip los", "general damages", "interest"].some(k => t.includes(k))) return "label-blue-norm";

  // --- TEAL/CYAN ---
  if (["raf los"].some(k => t.includes(k))) return "label-blue-norm";

  return "label-default";
}

export function ensureBadgeTypes(badges = []) {
  return (badges || []).map(b => {
    const t = b?.text || "";

    // 1. Status / Active (Bottom Row)
    if (/^Active\s*:/i.test(t)) {
      const val = t.replace(/^Active\s*:\s*/i, "");
      return { ...b, type: b.type || activeTypeFromText(val), isBottom: true };
    }
    if (/^Status\s*:/i.test(t)) {
      const val = t.replace(/^Status\s*:\s*/i, "");
      return { ...b, type: b.type || statusTypeFromText(val), isBottom: true };
    }

    // 2. Priority (Bottom Row)
    if (/^Priority\s*:/i.test(t)) {
      const val = t.replace(/^Priority\s*:\s*/i, "");
      return { ...b, type: b.type || priorityTypeFromText(val), isBottom: true };
    }

    // 3. Standard Labels (Top Row) - Assign colors dynamically
    return { ...b, type: b.type || getLabelColor(t), isTop: true };
  });
}

// Helper: Match card titles to Trello Cover Colors
export function getTrelloCoverColor(title) {
  const t = String(title || "").toLowerCase();
  if (t.includes("out of office")) return "#6CC3E0";
  if (t.includes("training - analyst")) return "#579dff";
  if (t.includes("innovation gold")) return "#faa53d";
  return null;
}
