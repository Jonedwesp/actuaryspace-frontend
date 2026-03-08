// Central Identity Map for all AC contacts to ensure accurate name resolution
export const GCHAT_ID_MAP = {
  "users/109833975621386956073": "Jonathan Espanol",
  "users/114414123510536881172": "Bonolo Mokatse",
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
  "users/104654529926543347255": "Martin Otto",
  "users/111372729949487816593": "Melokuhle Mabuza",
  "users/113385769871096416574": "Willem Havenga",
  "users/103669371912398598964": "Jennifer Mouton",
  "users/117489264027903000976": "Conah MacFarlane",
  "users/112422887282158931745": "Repository",
  "users/117124449099034019701": "Robyn Anderson",
  "users/112417469383977278282": "Siyolise Mazwi",
};

export function normalizeGChatMessage(m) {
  return m?.message || m;
}

export function getMsgTs(m) {
  const msg = normalizeGChatMessage(m);
  return new Date(msg?.createTime || msg?.updateTime || 0).getTime();
}

export function msgKey(m) {
  const msg = normalizeGChatMessage(m);
  return msg?.name || msg?.id || "";
}

export function dedupeMergeMessages(prev, incoming, isLatestFetch = false) {
  const mergedMap = new Map();

  // 1. Load previous messages into map
  (prev || []).forEach(m => {
    const k = msgKey(m);
    if (k) mergedMap.set(k, m);
  });

  // 2. Overwrite with incoming (Newer data wins)
  (incoming || []).forEach(m => {
    const msg = normalizeGChatMessage(m);
    const k = msgKey(msg);
    if (k) {
      const existing = mergedMap.get(k);
      // Preserve local tombstones or local edits
      if (existing && (existing.isDeletedLocally || existing.isEditedLocally)) {
        mergedMap.set(k, { ...msg, ...existing });
      } else {
        mergedMap.set(k, msg);
      }
    }
  });

  // 3. Sync deletions if this is a fresh polling fetch
  if (isLatestFetch && incoming?.length > 0) {
    const incomingKeys = new Set(incoming.map(m => msgKey(m)));
    const oldestIncomingTs = Math.min(...incoming.map(m => getMsgTs(m)));

    mergedMap.forEach((m, k) => {
      if (getMsgTs(m) >= oldestIncomingTs && !incomingKeys.has(k)) {
        if (!m.isDeletedLocally && m.text !== "Message deleted by its author") {
          mergedMap.delete(k);
        }
      }
    });
  }

  return Array.from(mergedMap.values()).sort((a, b) => getMsgTs(a) - getMsgTs(b));
}
