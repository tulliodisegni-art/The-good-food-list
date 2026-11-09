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

// Photos : l'image de partage (og:image) du site officiel du lieu, quand il en a un.
async function html(url, ms = 12000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctrl.signal, redirect: "follow", headers: { "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15", "accept-language": "fr-FR,fr;q=0.9" } });
    if (!r.ok || !/html/.test(r.headers.get("content-type") || "")) return null;
    return { text: (await r.text()).slice(0, 400000), url: r.url };
  } catch { return null; } finally { clearTimeout(t); }
}
function ogImage(h) {
  for (const prop of ["og:image:secure_url", "og:image", "twitter:image", "twitter:image:src"]) {
    const m = h.match(new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]*content=["']([^"']+)["']`, "i"))
      || h.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']${prop}["']`, "i"));
    if (m) return m[1].replace(/&amp;/g, "&");
  }
  return "";
}
// Grandes images de la page (hors logos, icônes, pictos).
function pageImages(h) {
  const out = [];
  for (const m of h.matchAll(/<img\b[^>]*>/gi)) {
    const tag = m[0];
    const src = (tag.match(/\b(?:data-src|data-lazy-src|src)=["']([^"']+)["']/i) || [])[1]
      || ((tag.match(/\bsrcset=["']([^"']+)["']/i) || [])[1] || "").split(",").pop().trim().split(" ")[0];
    if (!src || !/\.(jpe?g|webp|png)(\?|$)/i.test(src)) continue;
    if (/logo|icon|favicon|picto|sprite|placeholder|avatar|badge|flag|arrow|svg/i.test(tag)) continue;
    const w = +(tag.match(/\bwidth=["']?(\d+)/i) || [])[1] || 0;
    if (w && w < 300) continue;
    out.push(src);
    if (out.length >= 3) break;
  }
  return out;
}
async function okImage(img, base) {
  try { img = new URL(img.replace(/&amp;/g, "&"), base).href; } catch { return ""; }
  if (/logo|favicon|icon|placeholder|default/i.test(img)) return "";
  const g = await get(img);
  return g && g.status < 400 && /^image\//.test(g.type) && !(g.size && g.size < 15000) ? img : "";
}
// Wikipédia : pour les adresses connues (brasseries, institutions…), l'image de l'article.
const norm = (x) => String(x || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");
async function wikiPhoto(p) {
  const n = norm(p.name.replace(/\(.*\)/, ""));
  if (n.length < 5) return "";
  const city = p.list === "villes" ? p.city || "" : "Paris";
  const q = `https://fr.wikipedia.org/w/api.php?action=query&format=json&generator=search&gsrlimit=3&gsrsearch=${encodeURIComponent(`${p.name} ${city}`)}&prop=pageimages|extracts&exintro=1&explaintext=1&exchars=500&piprop=thumbnail&pithumbsize=1000`;
  try {
    const r = await fetch(q, { headers: { "user-agent": "GoodFoodList/1.0 (carnet d'adresses personnel; github.com/tulliodisegni-art/The-good-food-list)" } });
    const pages = Object.values((await r.json())?.query?.pages || {}).sort((a, b) => a.index - b.index);
    for (const pg of pages) {
      const t = norm(pg.title);
      if (!pg.thumbnail?.source || !(t === n || (t.includes(n) && t.length - n.length < 12))) continue;
      if (city && !norm(pg.extract).includes(norm(city))) continue;
      // L'article doit parler d'un lieu où l'on mange ou sort (pas d'un tableau ou d'un film du même nom).
      if (!/restaurant|brasserie|caf[eé]|bistrot|bar |h[oô]tel|palace|glacier|p[aâ]tisserie|salon de th[eé]|cabaret|boulangerie|traiteur|chef/i.test(pg.extract || "")) continue;
      return pg.thumbnail.source;
    }
  } catch {}
  return "";
}
const PHOTO_V = 2;
const siteOf = (p) => p.website || (/^https?:/.test(p.menu || "") && !/\.pdf/i.test(p.menu) ? p.menu : "");
const picKey = (p) => `${PHOTO_V}|${siteOf(p)}|${p.booking || ""}`;
const noPic = places.filter((p) => !p.photo && p.ogTry !== picKey(p) && (+p.ogTry || 0) !== PHOTO_V);
let pics = 0, wpics = 0;
for (let i = 0; i < noPic.length; i += 8) {
  await Promise.all(noPic.slice(i, i + 8).map(async (p) => {
    p.ogTry = picKey(p);
    // 1. Site officiel puis page de réservation : image de partage, sinon grandes photos de la page.
    const srcs = [siteOf(p), p.booking].filter((u) => isUrl(u) && !/google\.|instagram\.|facebook\.|tiktok\./i.test(u));
    for (const u of [...new Set(srcs)]) {
      const page = await html(u);
      if (!page) continue;
      for (const c of [ogImage(page.text), ...pageImages(page.text)].filter(Boolean)) {
        const img = await okImage(c, page.url);
        if (img) { p.photo = img; pics++; console.log(`${p.name} : photo (${new URL(u).hostname})`); return; }
      }
    }
    // 2. Wikipédia.
    const w = await wikiPhoto(p);
    if (w) { p.photo = w; wpics++; console.log(`${p.name} : photo Wikipédia`); }
  }));
}
console.log(`${noPic.length} fiches sans photo regardées : ${pics} photos des sites, ${wpics} de Wikipédia`);
if (noPic.length) await writeFile(FILE, JSON.stringify(places, null, 1));

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

// Photos par la presse : l'IA donne l'adresse d'un article ou d'une fiche consacrés au lieu (Le Fooding, Sortir à Paris,
// Time Out, guides…) ; on ouvre la page, on vérifie qu'elle parle bien de ce lieu, et on prend son image de partage.
const PRESS = 6;
const noPic2 = places.filter((p) => !p.photo && !p.pressTry);
let ppics = 0, fails3 = 0;
console.log(`${noPic2.length} fiches sans photo pour la recherche presse`);
for (let i = 0; i < noPic2.length && calls < MAX; i += PRESS) {
  const batch = noPic2.slice(i, i + PRESS);
  calls++;
  const items = batch.map((p) => ({ id: p.id, nom: p.name, type: p.cat || "", lieu: p.address || p.city || "Paris" }));
  const prompt = `Pour chacun de ces lieux (restos, bars, sorties), cherche sur le web jusqu'à 3 pages consacrées à CE lieu précis avec une photo : article ou fiche du lieu sur Le Fooding, Sortir à Paris, Time Out, Le Bonbon, Paris Zigzag, Télérama, Le Figaro, Michelin, Gault&Millau, TheFork, ou le site officiel.
Donne l'URL exacte de la page (pas d'image, pas de page de recherche, pas de liste générale). Vérifie que c'est bien CE lieu (même nom, même ville). N'invente jamais d'URL.
Lieux :
${JSON.stringify(items, null, 1)}
Réponds uniquement avec un tableau JSON : [{"id": "", "pages": ["", ""]}]`;
  let res;
  try {
    const r = await fetch(`${conf.url}/functions/v1/ia`, { method: "POST", headers: { apikey: conf.key, "content-type": "application/json" }, body: JSON.stringify({ prompt, web: true }) });
    const out = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(out.error || `erreur ${r.status}`);
    const t = String(out.text || "");
    res = JSON.parse(t.slice(t.indexOf("["), t.lastIndexOf("]") + 1));
  } catch (e) {
    console.log(`photos presse : ${e.message.slice(0, 300)}`);
    if (++fails3 >= 4) break;
    await new Promise((ok) => setTimeout(ok, 65000));
    i -= PRESS;
    continue;
  }
  fails3 = 0;
  await Promise.all(batch.map(async (p) => {
    p.pressTry = 1;
    const r = (Array.isArray(res) ? res : []).find((x) => x && x.id === p.id) || {};
    const n = norm(p.name.replace(/\(.*\)/, ""));
    for (const u of (Array.isArray(r.pages) ? r.pages : []).filter(isUrl).slice(0, 3)) {
      if (/google\.|instagram\.|facebook\.|tiktok\./i.test(u)) continue;
      const page = await html(u);
      if (!page) continue;
      const title = (page.text.match(/<title[^>]*>([^<]*)/i) || [])[1] || "";
      const head = norm(`${title} ${(page.text.match(/<meta[^>]+og:title["'][^>]*content=["']([^"']+)/i) || [])[1] || ""} ${(page.text.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || [])[1] || ""}`);
      if (n.length < 3 || !head.includes(n)) continue;
      const img = await okImage(ogImage(page.text) || "", page.url);
      if (img) { p.photo = img; ppics++; console.log(`${p.name} : photo (${new URL(page.url).hostname})`); return; }
    }
  }));
  await writeFile(FILE, JSON.stringify(places, null, 1));
  await new Promise((ok) => setTimeout(ok, 5000));
}
console.log(`photos presse : ${ppics} ajoutées`);
