// Complète les fiches incomplètes avec l'IA (fonction « ia » de Supabase, recherche Google) :
// adresse, téléphone, site, Instagram, réservation, photo, petit résumé.
// Ne remplace jamais une info déjà présente ; chaque info trouvée est vérifiée (lien qui répond, image qui s'affiche…).
// Un lot par passage, pour rester dans le quota gratuit.
import { readFile, writeFile } from "node:fs/promises";

const FILE = new URL("../data/places.json", import.meta.url);
const places = JSON.parse(await readFile(FILE, "utf8"));
const conf = JSON.parse(await readFile(new URL("../data/config.json", import.meta.url), "utf8")).avis || {};
const MAX = +process.env.AI_MAX || 60; // appels à l'IA par passage
const PER = 4; // lieux par appel
const V = 1;
const FIELDS = ["address", "phone", "website", "instagram", "booking", "photo", "summary"];
const missing = (p) => FIELDS.filter((k) => !p[k] && !(k === "website" && p.menu && /^https?:/.test(p.menu) && !/\.pdf/i.test(p.menu)));

async function get(url, ms = 10000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctrl.signal, redirect: "follow", headers: {
      "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
      "accept-language": "fr-FR,fr;q=0.9" } });
    const type = r.headers.get("content-type") || "";
    const size = +r.headers.get("content-length") || 0;
    await r.body?.cancel().catch(() => {});
    return { status: r.status, type, size, url: r.url };
  } catch { return null; } finally { clearTimeout(t); }
}
const isUrl = (u) => /^https?:\/\/[^\s"]+\.[a-z]{2,}/i.test(u || "");
const BAD_SITE = /google\.|instagram\.|facebook\.|tiktok\.|tripadvisor|yelp|restaurantguru|sluurpy|pagesjaunes|lefooding|timeout|sortiraparis|michelin|wanderlog|ubereats|deliveroo/i;
const BOOKING = /thefork|lafourchette|zenchef|sevenrooms|resy|opentable|guestonline|privateaser|tablebooker|resengo|bookatable|quandoo|formitable|covermanager|mozrest|r[eé]serv|booking|book/i;

async function ask(batch) {
  const items = batch.map((p) => ({
    id: p.id, nom: p.name, type: p.cat || "", liste: p.list,
    lieu: p.list === "villes" ? p.city || "" : p.arr ? `Paris ${p.arr}e` : "Paris / Île-de-France",
    adresse: p.address || "", site: p.website || "", instagram: p.instagram || "",
    a_trouver: missing(p),
  }));
  const prompt = `Tu complètes les fiches d'un carnet d'adresses (restos, bars, sorties). Pour chaque lieu ci-dessous, cherche sur le web UNIQUEMENT les infos listées dans "a_trouver".
Règles strictes :
- Vérifie que c'est bien CE lieu (même nom, même ville ou arrondissement). Au moindre doute sur une info, laisse-la vide. N'invente jamais.
- "address" : adresse postale complète avec code postal et ville.
- "phone" : numéro du lieu, format français « 01 23 45 67 89 » pour la France.
- "website" : site officiel du lieu (pas TripAdvisor, Google, TheFork, Instagram).
- "instagram" : compte officiel du lieu, sans @.
- "booking" : lien direct de réservation (TheFork, Zenchef, SevenRooms, page Réserver du site…).
- "photo" : URL directe d'une belle image du lieu ou de ses plats (fichier .jpg, .png ou .webp sur le site officiel, la presse ou TheFork). Laisse vide si tu n'as pas une URL d'image exacte.
- "summary" : 1 à 2 phrases en français, ce qu'il faut y goûter et l'ambiance.
Lieux :
${JSON.stringify(items, null, 1)}
Réponds uniquement avec un tableau JSON, un objet par lieu : [{"id": "", "address": "", "phone": "", "website": "", "instagram": "", "booking": "", "photo": "", "summary": ""}]`;
  const r = await fetch(`${conf.url}/functions/v1/ia`, {
    method: "POST",
    headers: { apikey: conf.key, "content-type": "application/json" },
    body: JSON.stringify({ prompt, web: true }),
  });
  const out = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(out.error || `erreur ${r.status}`);
  const t = String(out.text || "");
  return JSON.parse(t.slice(t.indexOf("["), t.lastIndexOf("]") + 1));
}

async function apply(p, r) {
  const got = [];
  const want = new Set(missing(p));
  if (want.has("address") && r.address && r.address.length > 8) {
    const zip = r.address.match(/\b75(0\d\d)\b/);
    const okArr = p.list !== "paris" || (zip && (!p.arr || +zip[1] === +p.arr));
    if (okArr) { p.address = r.address.trim(); if (zip && p.list !== "villes" && !p.arr) p.arr = +zip[1]; got.push("adresse"); }
  }
  if (want.has("phone") && /(\+?\d[\d .-]{7,}\d)/.test(r.phone || "") && (r.phone.match(/\d/g) || []).length >= 9) { p.phone = r.phone.trim(); got.push("tél"); }
  if (want.has("instagram")) {
    const h = String(r.instagram || "").replace(/^@|https?:\/\/(www\.)?instagram\.com\//g, "").replace(/[/?].*$/, "").trim();
    if (/^[a-z0-9._]{2,30}$/i.test(h)) { p.instagram = h; got.push("insta"); }
  }
  if (want.has("website") && isUrl(r.website) && !BAD_SITE.test(r.website)) {
    const g = await get(r.website);
    if (g && (g.status < 400 || g.status === 403)) { p.website = r.website; delete p.enriched; delete p.bookingScan; got.push("site"); }
  }
  if (want.has("booking") && isUrl(r.booking) && BOOKING.test(r.booking)) {
    const g = await get(r.booking);
    if (g && (g.status < 400 || g.status === 403)) { p.booking = r.booking; got.push("résa"); }
  }
  if (want.has("photo") && isUrl(r.photo)) {
    const g = await get(r.photo);
    if (g && g.status < 400 && /^image\//.test(g.type) && !(g.size && g.size < 8000)) { p.photo = r.photo; got.push("photo"); }
  }
  if (want.has("summary") && r.summary && r.summary.length > 20 && r.summary.length < 400) { p.summary = r.summary.trim(); got.push("résumé"); }
  return got;
}

const todo = places.filter((p) => (+p.aiFill || 0) < V && missing(p).length);
console.log(`${todo.length} fiches incomplètes, ${Math.min(todo.length, MAX * PER)} traitées ce passage`);
let calls = 0, filled = 0, fails = 0;
for (let i = 0; i < todo.length && calls < MAX; i += PER) {
  const batch = todo.slice(i, i + PER);
  calls++;
  let res;
  try { res = await ask(batch); } catch (e) {
    console.log(`lot ${calls} : ${e.message.slice(0, 1500)}`);
    if (++fails >= 4) { console.log("Quota atteint, on reprendra au prochain passage"); break; }
    // Limite par minute du quota gratuit : on souffle, puis on retente ce lot.
    await new Promise((ok) => setTimeout(ok, 65000));
    i -= PER;
    continue;
  }
  fails = 0;
  for (const p of batch) {
    const r = (Array.isArray(res) ? res : []).find((x) => x && x.id === p.id);
    p.aiFill = V;
    if (!r) { if (!p.phone) p.noPhone = 1; if (!p.menu && !p.website) p.noMenu = 1; continue; }
    const got = await apply(p, r);
    // Rien trouvé : on le note sur la fiche (« pas de numéro », « pas de menu en ligne », « pas d'Instagram »).
    if (!p.phone) p.noPhone = 1;
    if (!p.menu && !p.website) p.noMenu = 1;
    if (!p.instagram && !/instagram\.com/.test(p.source || "")) p.noInsta = 1;
    if (got.length) { filled++; console.log(`${p.name} : ${got.join(", ")}`); }
  }
  await writeFile(FILE, JSON.stringify(places, null, 1));
  await new Promise((ok) => setTimeout(ok, 5000));
}
console.log(`${calls} appels, ${filled} fiches complétées`);

// Réservation : pour les lieux sans lien de résa, on note comment on réserve
// ("telephone" = par téléphone seulement, "sans" = sans réservation, "inconnu" = pas de résa en ligne trouvée).
const RESA = 8;
const noBook = places.filter((p) => !p.booking && !p.resa);
console.log(`${noBook.length} lieux sans lien de réservation`);
let fails2 = 0;
for (let i = 0; i < noBook.length && calls < MAX; i += RESA) {
  const batch = noBook.slice(i, i + RESA);
  calls++;
  const items = batch.map((p) => ({ id: p.id, nom: p.name, type: p.cat || "", lieu: p.address || p.city || "Paris", site: p.website || "" }));
  const prompt = `Pour chacun de ces lieux (restos, bars, sorties), cherche sur le web comment on réserve.
Réponds "en_ligne" avec le lien direct de réservation (TheFork, Zenchef, SevenRooms, page Réserver du site…) s'il existe,
"telephone" si on réserve seulement par téléphone, "sans" si le lieu ne prend pas de réservation (premier arrivé, premier servi),
ou "" si tu ne trouves pas d'info fiable. Vérifie que c'est bien CE lieu. N'invente jamais de lien.
Lieux :
${JSON.stringify(items, null, 1)}
Réponds uniquement avec un tableau JSON : [{"id": "", "resa": "en_ligne|telephone|sans|", "booking": ""}]`;
  let res;
  try {
    const r = await fetch(`${conf.url}/functions/v1/ia`, { method: "POST", headers: { apikey: conf.key, "content-type": "application/json" }, body: JSON.stringify({ prompt, web: true }) });
    const out = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(out.error || `erreur ${r.status}`);
    const t = String(out.text || "");
    res = JSON.parse(t.slice(t.indexOf("["), t.lastIndexOf("]") + 1));
  } catch (e) {
    console.log(`résa lot : ${e.message.slice(0, 300)}`);
    if (++fails2 >= 4) break;
    await new Promise((ok) => setTimeout(ok, 65000));
    i -= RESA;
    continue;
  }
  fails2 = 0;
  for (const p of batch) {
    const r = (Array.isArray(res) ? res : []).find((x) => x && x.id === p.id) || {};
    let mode = ["telephone", "sans"].includes(r.resa) ? r.resa : "inconnu";
    if (r.resa === "en_ligne" && isUrl(r.booking) && BOOKING.test(r.booking)) {
      const g = await get(r.booking);
      if (g && (g.status < 400 || g.status === 403)) { p.booking = r.booking; mode = ""; }
    }
    if (mode) p.resa = mode;
    console.log(`${p.name} : ${p.booking ? "résa en ligne" : mode}`);
  }
  await writeFile(FILE, JSON.stringify(places, null, 1));
  await new Promise((ok) => setTimeout(ok, 5000));
}
