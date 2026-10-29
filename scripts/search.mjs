// Cherche sur le web le site, le compte Instagram et la page TheFork des lieux qui n'en ont pas.
// Le site trouvé est ensuite lu par enrich.mjs (téléphone, réservation, photo).
// Un lot par passage (chaque jour), pour rester discret auprès des moteurs de recherche.
import { readFile, writeFile } from "node:fs/promises";

const FILE = new URL("../data/places.json", import.meta.url);
const places = JSON.parse(await readFile(FILE, "utf8"));
const MAX = +process.env.SEARCH_MAX || 150;
const V = 1;

const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
  .replace(/\b(le|la|les|l|the|chez|restaurant|resto|paris)\b/g, " ").replace(/[^a-z0-9]+/g, "");
// Annuaires, réseaux et guides : jamais pris pour le site du lieu.
const NOT_SITE = /google\.|instagram\.|facebook\.|tiktok\.|twitter\.|x\.com|youtube\.|tripadvisor|thefork|lafourchette|yelp|ubereats|deliveroo|justeat|pagesjaunes|petitfute|restaurantguru|sluurpy|lefooding|timeout|sortiraparis|parisinfo|michelin|gaultmillau|wikipedia|linkedin|pinterest|foursquare|zenchef\.com\/?$|bing\.|duckduckgo|apple\.com|waze|mappy|lebonbon|vogue|elle\.fr|figaro|lexpress|telerama|routard|tablethotels|booking\.com|hotels\.com|expedia|opentable|sevenrooms|resy|privateaser|wanderlog|restaurants-paris|mangeznous|restaurant\.michelin|ouifm|leparisien|20minutes|cntraveler|eater|theinfatuation|reddit|quandoo|guestonline/i;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function get(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 12000);
  try {
    const r = await fetch(url, { signal: ctrl.signal, headers: {
      "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
      "accept-language": "fr-FR,fr;q=0.9", accept: "text/html" } });
    return r.ok ? await r.text() : null;
  } catch { return null; } finally { clearTimeout(t); }
}

// Liens des résultats : DuckDuckGo (version HTML), sinon Bing.
async function results(q) {
  const ddg = await get(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}&kl=fr-fr`);
  let links = ddg ? [...ddg.matchAll(/class="result__a"[^>]*href="([^"]+)"/g)].map((m) => {
    const u = m[1].replace(/&amp;/g, "&");
    const real = u.match(/uddg=([^&]+)/);
    return real ? decodeURIComponent(real[1]) : u;
  }) : [];
  if (!links.length) {
    const bing = await get(`https://www.bing.com/search?q=${encodeURIComponent(q)}&setlang=fr&cc=FR`);
    links = bing ? [...bing.matchAll(/<li class="b_algo"[\s\S]*?<a[^>]+href="(https?:[^"]+)"/g)].map((m) => m[1].replace(/&amp;/g, "&")) : [];
  }
  return links.filter((u) => /^https?:/.test(u)).slice(0, 10);
}

const handleOf = (u) => {
  const m = u.match(/instagram\.com\/([A-Za-z0-9._]{2,30})\/?(?:[?#]|$)/);
  return m && !/^(p|reel|reels|explore|stories|accounts|tv)$/i.test(m[1]) ? m[1] : null;
};
// Le compte ou le site doit ressembler au nom du lieu.
const close = (a, name) => { const x = norm(a), n = norm(name); return n.length >= 3 && (x.includes(n) || (x.length >= 4 && n.includes(x))); };

let sites = 0, igs = 0, forks = 0, asked = 0, blank = 0;
for (const p of places) {
  if ((p.searched || 0) >= V || p.removed) continue;
  if (p.website && p.instagram && p.booking) { p.searched = V; continue; }
  if (asked++ >= MAX) break;
  const city = p.list === "villes" ? p.city || "" : "Paris";
  const links = await results(`${p.name} ${p.address ? p.address.replace(/,?\s*750\d\d Paris/, "") : ""} ${city} ${p.cat && !/^(Resto|Activité)$/.test(p.cat) ? p.cat : ""}`.replace(/\s+/g, " "));
  if (!links.length) { blank++; if (blank > 8 && blank === asked) { console.log("Moteurs de recherche indisponibles, arrêt."); break; } await sleep(2500); continue; }
  p.searched = V;
  if (!p.instagram) {
    const h = links.map(handleOf).find((x) => x && close(x, p.name));
    if (h) { p.instagram = h; igs++; }
  }
  if (!p.booking) {
    const fork = links.find((u) => /thefork\.(fr|com)\/restaurant\//.test(u));
    if (fork) { p.booking = fork.split("?")[0]; forks++; }
  }
  if (!p.website) {
    const site = links.find((u) => !NOT_SITE.test(new URL(u).host) && close(new URL(u).host.replace(/^www\./, "").split(".")[0], p.name));
    if (site) { p.website = new URL(site).origin; p.enriched = 0; sites++; }
  }
  await sleep(1800 + Math.random() * 1200);
}
await writeFile(FILE, JSON.stringify(places, null, 1));
const left = places.filter((p) => (p.searched || 0) < V && !(p.website && p.instagram && p.booking)).length;
console.log(`Recherche web : ${asked} lieux, ${sites} sites, ${igs} comptes Instagram, ${forks} pages TheFork (${left} restants)`);
