// Vite-only: this is compile-time transformed (works in prod)
const _AVATAR_MODULES = import.meta.glob(
  "../slack-profiles/*.{png,PNG,jpg,JPG,jpeg,JPEG,webp,WEBP,gif,GIF}",
  { eager: true }
);

const AVATARS = (() => {
  const map = {};
  for (const fullPath in _AVATAR_MODULES) {
    const mod = _AVATAR_MODULES[fullPath];
    // With { eager: true } (no import:"default"), Vite returns a module object; .default is the URL string.
    // Guard: if mod is already a string (some Vite versions / configs), use it directly.
    const url = typeof mod === "string" ? mod : (mod?.default ?? null);
    if (!url) continue;

    const fileBase = fullPath.split("/").pop().replace(/\.[^.]+$/, ""); // e.g. "Albert"
    const keyFull  = fileBase.toLowerCase().trim();                     // "albert"
    const tokens   = keyFull.split(/\s+/);

    // full filename ("albert", "alicia o")
    if (!map[keyFull]) map[keyFull] = url;

    // first word
    if (tokens[0] && !map[tokens[0]]) map[tokens[0]] = url;

    // initials (e.g. "ao" from "Alicia O")
    if (tokens.length >= 2) {
      const initials = (tokens[0][0] + tokens[1][0]).toLowerCase();
      if (!map[initials]) map[initials] = url;
    }
  }
  return map;
})();

// Normalise aliases (two-letter codes etc.)
const AVATAR_ALIASES = {
  namir: "Namir", nw: "Namir",
  joel: "Joel", jj: "Joel",
  dionee: "Dionee", dd: "Dionee",
  "simoné": "Simoné", sm: "Simoné",
  ryan: "Ryan", ry: "Ryan",
  conah: "Conah", co: "Conah",
  thami: "Thami", th: "Thami",
  melissa: "Melissa", me: "Melissa",
  waldo: "Waldo", wa: "Waldo",
  melvin: "Melvin", mv: "Melvin",
  tiffany: "Tiffany", ti: "Tiffany",
  albert: "Albert", al: "Albert",
  "alicia k": "Alicia K", ak: "Alicia K",
  "alicia o": "Alicia O", ao: "Alicia O",
  ethan: "Ethan", et: "Ethan",
  martin: "Martin", ma: "Martin",
  leonah: "Leonah", le: "Leonah",
  matthew: "Matthew", mt: "Matthew",
  siyabonga: "Siya", siya: "Siya", sd: "Siya",
  enock: "Enock", en: "Enock",
  treasure: "Treasure", tr: "Treasure",
  melokuhle: "Melokuhle", mk: "Melokuhle",
  eugene: "Eugene", eu: "Eugene",
  bianca: "Bianca", bi: "Bianca",
  jonathan: "Jonathan", jw: "Jonathan",
  bonolo: "Bonolo", bo: "Bonolo", users_109833975621386956073: "Bonolo",
  willem: "Willem", wi: "Willem",
  shamiso: "Shamiso", sh: "Shamiso",
  "miné": "Miné", mn: "Miné",
  songeziwe: "Songeziwe", so: "Songeziwe",
  michelle: "Michelle", mw: "Michelle",
  kwakhanya: "Kwakhanya", kw: "Kwakhanya",
  jennifer: "Jennifer", je: "Jennifer",
  munyaradzi: "Munyaradzi", mu: "Munyaradzi",
  leroy: "Leroy", lr: "Leroy",
  cameron: "Cameron", ca: "Cameron",
  jenny: "Jenny", jn: "Jenny",
  yolandie: "Yolandie", ys: "Yolandie",
  vanessa: "Vanessa", va: "Vanessa",
  yael: "Yael", ya: "Yael",
  cynthia: "Cynthia", cy: "Cynthia",
};

export function remapBotName(name) {
  if (!name) return name;
  const trimmed = String(name).trim();
  // Any variant of "ActuarySpaceBot" becomes "Yolandie"
  if (/^actuaryspacebot$/i.test(trimmed)) return "Yolandie";
  return trimmed;
}

// 👇 Global cache for live Trello avatars
export let LIVE_TRELLO_AVATARS = {};

export function avatarFor(name) {
  if (!name) return null;

  // strip things like " (web)", " (bot)", etc.
  let key = String(name).toLowerCase().trim();
  key = key.replace(/\([^)]*\)/g, "").trim();
  key = key.replace(/\s+/g, " ");

  const parts = key.split(/\s+/);
  const firstWord = parts[0];

  // 1. Check aliases → local files FIRST (reliable, always available)
  const alias = AVATAR_ALIASES[key] || AVATAR_ALIASES[firstWord];
  if (alias) {
    const ak = alias.toLowerCase();
    const aliasParts = ak.split(/\s+/);
    const inits = aliasParts.map((p) => p[0]).join("");
    const localUrl = AVATARS[ak] || AVATARS[aliasParts[0]] || AVATARS[inits];
    if (localUrl) return localUrl;
  }

  // 2. Direct hits in local files: full name / first token / initials
  const inits = parts.map((p) => p[0]).join("");
  const directUrl = AVATARS[key] || AVATARS[firstWord] || AVATARS[inits];
  if (directUrl) return directUrl;

  // 3. Fall back to Live Trello Avatars (only for people without a local photo)
  if (LIVE_TRELLO_AVATARS[key]) return LIVE_TRELLO_AVATARS[key];
  if (LIVE_TRELLO_AVATARS[firstWord]) return LIVE_TRELLO_AVATARS[firstWord];

  return null;
}
