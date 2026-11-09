// Horaires d'ouverture : conversion du format OpenStreetMap (« Mo-Fr 12:00-14:30,19:00-22:30; Sa 19:00-23:00; Su off »)
// vers le format de l'appli : 7 jours, du lundi au dimanche, chacun "12:00-14:30,19:00-22:30" ou "" quand c'est fermé.
// Seules les écritures simples sont acceptées : au moindre doute (jours fériés seuls, mois, semaines, lever du soleil…),
// on renvoie null plutôt que d'afficher de faux horaires.
const DAY = { mo: 0, tu: 1, we: 2, th: 3, fr: 4, sa: 5, su: 6 };
const TIME = /^([01]?\d|2[0-4]):([0-5]\d)$/;

function days(spec) {
  const out = new Set();
  for (const part of spec.split(",")) {
    const m = part.trim().toLowerCase().match(/^(mo|tu|we|th|fr|sa|su)(?:-(mo|tu|we|th|fr|sa|su))?$/);
    if (!m) return null;
    const a = DAY[m[1]], b = m[2] ? DAY[m[2]] : a;
    for (let i = a; ; i = (i + 1) % 7) { out.add(i); if (i === b) break; }
  }
  return out;
}
function spans(spec) {
  const out = [];
  for (const part of spec.split(",")) {
    const m = part.trim().match(/^(\d{1,2}:\d{2})-(\d{1,2}:\d{2})$/);
    if (!m || !TIME.test(m[1]) || !TIME.test(m[2])) return null;
    const pad = (t) => t.padStart(5, "0");
    if (pad(m[1]) === pad(m[2])) return null;
    out.push(`${pad(m[1])}-${pad(m[2])}`);
  }
  return out.join(",");
}

export function parseOsmHours(raw) {
  let s = String(raw || "").trim();
  if (!s || s.length > 300) return null;
  if (s === "24/7") return Array(7).fill("00:00-24:00");
  const week = Array(7).fill("");
  let any = false;
  for (let rule of s.split(/\s*(?:;|\|\|)\s*/)) {
    rule = rule.trim().replace(/\s*"[^"]*"\s*$/, ""); // commentaire final : « "sur réservation" »
    if (!rule) continue;
    // Règles sur les jours fériés seuls : ignorées (l'appli ne connaît pas le calendrier des fériés).
    if (/^PH\b/i.test(rule)) continue;
    rule = rule.replace(/,\s*PH\b|\bPH\s*,\s*/gi, "");
    const m = rule.match(/^((?:(?:Mo|Tu|We|Th|Fr|Sa|Su)(?:-(?:Mo|Tu|We|Th|Fr|Sa|Su))?)(?:\s*,\s*(?:Mo|Tu|We|Th|Fr|Sa|Su)(?:-(?:Mo|Tu|We|Th|Fr|Sa|Su))?)*)?\s*(.*)$/i);
    const ds = m[1] ? days(m[1].replace(/\s+/g, "")) : new Set([0, 1, 2, 3, 4, 5, 6]);
    if (!ds) return null;
    const body = m[2].trim().toLowerCase();
    let val;
    if (body === "off" || body === "closed") val = "";
    else if (body === "24/7" || body === "00:00-24:00") val = "00:00-24:00";
    else { val = spans(body.replace(/\s+/g, "")); if (val == null) return null; }
    for (const d of ds) week[d] = val;
    any = true;
  }
  return any && week.some(Boolean) ? week : null;
}

// Même format, fourni par l'IA : on vérifie qu'il est propre avant de le garder.
export function cleanWeek(w) {
  if (!Array.isArray(w) || w.length !== 7) return null;
  const out = [];
  for (const d of w) {
    const s = String(d ?? "").trim().toLowerCase();
    if (!s || s === "fermé" || s === "ferme" || s === "closed" || s === "off") { out.push(""); continue; }
    const v = spans(s.replace(/\s+/g, "").replace(/h(?=\d)/g, ":").replace(/(\d)h(?=-|,|$)/g, "$1:00"));
    if (v == null) return null;
    out.push(v);
  }
  return out.some(Boolean) ? out : null;
}
