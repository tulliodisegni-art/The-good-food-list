// Complète les fiches depuis le site de chaque resto : photo (og:image),
// téléphone et lien de réservation. Ne remplace jamais une info déjà présente.
import { readFile, writeFile } from "node:fs/promises";

const FILE = new URL("../data/places.json", import.meta.url);
const places = JSON.parse(await readFile(FILE, "utf8"));

// Hébergeurs de fichiers ou plateformes : leur page d'accueil n'est pas celle du resto.
const NOT_A_SITE = /google\.|thefork|drive\.|linktr\.ee|amazonaws|squarespace-cdn|static1\.squarespace|website-files|dish\.co|instagram|facebook|ubereats|deliveroo|restaurantguru|tripadvisor|canva|calameo|issuu|wixstatic|flipsnack|menu\.|\.pdf$/i;

function siteOf(url) {
  try {
    const u = new URL(url);
    if (NOT_A_SITE.test(u.hostname) || /\.pdf($|\?)/i.test(u.pathname)) return null;
    return u.origin;
  } catch { return null; }
}

async function get(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 9000);
  try {
    const r = await fetch(url, { signal: ctrl.signal, redirect: "follow", headers: { "user-agent": "Mozilla/5.0 (GoodFoodList)", "accept-language": "fr-FR,fr" } });
    if (!r.ok || !/html/.test(r.headers.get("content-type") || "")) return null;
    return { html: (await r.text()).slice(0, 600000), url: r.url };
  } catch { return null; } finally { clearTimeout(t); }
}

const decode = (s) => s.replace(/&amp;/g, "&").replace(/&#0?39;/g, "'").replace(/&quot;/g, '"');

function ogImage(html, base) {
  const m = html.match(/<meta[^>]+(?:property|name)=["'](?:og:image(?::secure_url)?|twitter:image)["'][^>]*>/i);
  const c = m && m[0].match(/content=["']([^"']+)["']/i);
  if (!c) return null;
  try {
    const u = new URL(decode(c[1]), base).href;
    return /logo|favicon|placeholder/i.test(u) ? null : u;
  } catch { return null; }
}

// Sans og:image : image déclarée en JSON-LD, sinon la première grande photo de la page.
function anyImage(html, base) {
  const bad = /logo|favicon|icon|sprite|placeholder|avatar|badge|flag|arrow|loader|pixel|\.svg|\.gif|data:/i;
  const cands = [
    ...[...html.matchAll(/"image"\s*:\s*(?:\[\s*)?"([^"]+)"/gi)].map((m) => m[1]),
    ...[...html.matchAll(/<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']+)/gi)].map((m) => m[1]),
    ...[...html.matchAll(/<img[^>]+>/gi)].map((m) => {
      const tag = m[0];
      const set = tag.match(/(?:data-)?srcset=["']([^"']+)["']/i);
      if (set) { const parts = set[1].split(",").map((x) => x.trim().split(/\s+/)[0]); return parts[parts.length - 1]; }
      return (tag.match(/(?:data-src|data-lazy-src|src)=["']([^"']+)["']/i) || [])[1];
    }),
    ...[...html.matchAll(/background-image:\s*url\(["']?([^"')]+)/gi)].map((m) => m[1]),
  ];
  for (const c of cands) {
    if (!c || bad.test(c) || !/\.(jpe?g|webp|png)(\?|$)|images?\/|uploads|cdn|media/i.test(c)) continue;
    try { return new URL(decode(c), base).href; } catch {}
  }
  return null;
}

// Mention kasher ou halal sur le site.
const textOf = (html) => html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ");
// « cacher » seul est aussi le verbe : il ne compte que dans « restaurant cacher », « cacher sous… ».
const KASHER = /\b(casher|kasher|kosher|beth[ -]?din|bet din|glatt)\b|\b(?:restaurant|cuisine|viande|traiteur|resto)s?\s+cacher\b|\bcacher\s+(?:sous|beth|glatt|certifi)/i;
const HALAL = /\bhalal\b/i;

function phone(html) {
  const text = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ");
  const cands = [
    ...[...html.matchAll(/href=["']tel:([^"']+)["']/gi)].map((m) => m[1]),
    ...[...html.matchAll(/"telephone"\s*:\s*"([^"]+)"/gi)].map((m) => m[1]),
    // Numéro écrit dans la page (01 42 60 59 66, +33 1 42…).
    ...[...text.matchAll(/(?:\+33\s?\(?0?\)?\s?|\b0)[1-9](?:[\s.\u00a0-]?\d{2}){4}\b/g)].map((m) => m[0]),
  ];
  for (const raw of cands) {
    let d = decodeURIComponent(raw).replace(/[^\d+]/g, "");
    if (d.startsWith("0033")) d = "+33" + d.slice(4);
    if (d.startsWith("+330")) d = "+33" + d.slice(4);
    if (/^0[1-9]\d{8}$/.test(d)) return d.replace(/(\d{2})(?=\d)/g, "$1 ").trim();
    if (/^\+33[1-9]\d{8}$/.test(d)) return "0" + d.slice(3).replace(/(\d)(\d{2})(\d{2})(\d{2})(\d{2})/, "$1 $2 $3 $4 $5");
  }
  return null;
}

// Plateformes de réservation reconnues dans les liens du site.
const BOOKING = /thefork\.|lafourchette|zenchef|sevenrooms|resy\.com|opentable|guestonline|formitable|tablebooker|resengo|covermanager|bookenda|privateaser|tock\.com|booking\.(?:zenchef|mozrest)|mozrest|resa\.|libib|ezeeresto|eatapp\.co/i;

function booking(html, base) {
  const links = [...html.matchAll(/<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]{0,200}?)<\/a>/gi)];
  let byText = null;
  for (const [, href, inner] of links) {
    let u;
    try { u = new URL(decode(href), base); } catch { continue; }
    if (!/^https?:$/.test(u.protocol)) continue;
    if (BOOKING.test(u.hostname + u.pathname)) return u.href;
    const text = inner.replace(/<[^>]+>/g, " ");
    if (!byText && /r[ée]serv|book a table|booking/i.test(text + " " + u.pathname)) byText = u.href;
  }
  // Widget Zenchef intégré à la page, sans lien visible.
  const zc = html.match(/zenchef[\s\S]{0,400}?(?:rid=|data-restaurant=["'])(\d{3,})/i);
  return zc ? `https://bookings.zenchef.com/results?rid=${zc[1]}` : byText;
}

// Pages internes qui donnent souvent le numéro ou le lien de réservation.
function subpage(html, base) {
  for (const m of html.matchAll(/<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]{0,120}?)<\/a>/gi)) {
    let u;
    try { u = new URL(decode(m[1]), base); } catch { continue; }
    if (u.origin !== new URL(base).origin) continue;
    if (/contact|infos?|acc[eè]s|reserv|r%C3%A9serv|booking|nous-trouver|find-us|location/i.test(u.pathname + " " + m[2].replace(/<[^>]+>/g, ""))) return u.href;
  }
  return null;
}

// Compte Instagram du resto, d'après les liens de son site.
function instagram(html) {
  for (const m of html.matchAll(/instagram\.com\/([A-Za-z0-9._]{2,30})\/?(?:["'?#])/g)) {
    if (!/^(p|reel|reels|explore|stories|accounts|tv|share|direct|about|legal|developer)$/i.test(m[1])) return m[1];
  }
  return null;
}

// Version 5 : photo de secours (JSON-LD, première grande image) et mention kasher / halal.
// (4 : compte Instagram ; 3 : numéros écrits en clair, page Contact / Réserver.)
const V = 5;
const todo = places.filter((p) => (+p.enriched || 0) < V && (p.menu || p.website));
const bySite = new Map();
for (const p of todo) {
  const site = siteOf(p.website || p.menu);
  if (!site) { p.enriched = V; continue; }
  if (!bySite.has(site)) bySite.set(site, []);
  bySite.get(site).push(p);
}

let photos = 0, phones = 0, books = 0, done = 0;
const sites = [...bySite.keys()];
async function worker() {
  while (sites.length) {
    const site = sites.shift();
    const page = await get(site + "/");
    const sub = page && subpage(page.html, page.url);
    const page2 = sub && sub !== page.url ? await get(sub) : null;
    for (const p of bySite.get(site)) {
      p.enriched = V;
      if (!p.website) p.website = site;
      if (!page) continue;
      const img = !p.photo && (ogImage(page.html, page.url) || anyImage(page.html, page.url) || (page2 && anyImage(page2.html, page2.url)));
      const txt = textOf(page.html + (page2 ? page2.html : ""));
      if (p.kasher === undefined && KASHER.test(txt)) p.kasher = true;
      if (p.halal === undefined && HALAL.test(txt)) p.halal = true;
      if (img) { p.photo = img; photos++; }
      // Un même site peut servir plusieurs adresses : le numéro n'est gardé que s'il n'y en a qu'une.
      const tel = !p.phone && bySite.get(site).length === 1 && (phone(page.html) || (page2 && phone(page2.html)));
      if (tel) { p.phone = tel; phones++; }
      const ig = !p.instagram && (instagram(page.html) || (page2 && instagram(page2.html)));
      if (ig) p.instagram = ig;
      const book = !p.booking && (booking(page.html, page.url) || (page2 && booking(page2.html, page2.url)));
      if (book) { p.booking = book; books++; }
    }
    done++;
  }
}
await Promise.all(Array.from({ length: 8 }, worker));
await writeFile(FILE, JSON.stringify(places, null, 1));
console.log(`${done} sites lus : ${photos} photos, ${phones} téléphones, ${books} liens de réservation ajoutés`);
