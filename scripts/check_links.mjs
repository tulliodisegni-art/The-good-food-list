// Vérifie chaque lien de réservation : il doit mener à la réservation d'une table de CE lieu.
// Les liens cassés, hors sujet (bons cadeaux, privatisation, vente à emporter) ou d'un autre resto sont retirés.
import { readFile, writeFile } from "node:fs/promises";

const FILE = new URL("../data/places.json", import.meta.url);
const places = JSON.parse(await readFile(FILE, "utf8"));
const V = 2; // version de la vérification

const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
  .replace(/\b(le|la|les|l|the|chez|restaurant|resto|paris|cafe|bar)\b/g, " ").replace(/[^a-z0-9]+/g, "");
const matches = (text, name) => { const n = norm(name), t = norm(text); return n.length >= 3 && (t.includes(n) || (n.length > 8 && t.includes(n.slice(0, 8)))); };

async function get(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 12000);
  try {
    const r = await fetch(url, { signal: ctrl.signal, redirect: "follow", headers: {
      "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
      "accept-language": "fr-FR,fr;q=0.9" } });
    const html = /html|json|text/.test(r.headers.get("content-type") || "") ? (await r.text()).slice(0, 800000) : "";
    return { status: r.status, url: r.url, html };
  } catch { return null; } finally { clearTimeout(t); }
}

// Widget de réservation intégré dans une page du site.
function widget(html) {
  const zc = html.match(/zenchef[\s\S]{0,400}?(?:rid=|data-restaurant=["']|restaurantId["':\s]+)(\d{3,})/i);
  if (zc) return `https://bookings.zenchef.com/results?rid=${zc[1]}`;
  const tf = html.match(/https?:\/\/(?:www\.)?thefork\.(?:fr|com)\/restaurant\/[a-z0-9-]+-r\d+/i);
  if (tf) return tf[0];
  const lf = html.match(/module\.lafourchette\.com\/[a-z_-]+\/module\/(\d+)/i);
  if (lf) return `https://module.lafourchette.com/fr_FR/module/${lf[1]}`;
  const sr = html.match(/https?:\/\/(?:www\.)?sevenrooms\.com\/(?:reservations|explore)\/[a-z0-9_-]+(?:\/[a-z0-9_-]+)?/i);
  if (sr) return sr[0];
  const ot = html.match(/https?:\/\/(?:www\.)?opentable\.[a-z.]+\/(?:r\/[a-z0-9-]+|restref\/client\/\?rid=\d+)[^"'\s<]*/i);
  if (ot) return ot[0].replace(/&amp;/g, "&");
  return null;
}

const BAD = /privati|voucher|gift|cadeau|carte-cadeau|giftcard|shop\.|boutique|click|collect|commande|order|delivery|livraison|privateaser|feverup|amazonaws|userdocs|commands\.zenchef|careers|recrut|job|traiteur|seminaire|evenement|events?\b/i;
let kept = 0, fixed = 0, dropped = 0;
// Lieux sans lien : le site peut contenir un module de réservation que la lecture précédente n'a pas vu.
let found = 0;
const sites = places.filter((p) => !p.booking && p.website && !p.bookingScan);
const q2 = [...sites];
await Promise.all(Array.from({ length: 6 }, async () => {
  while (q2.length) {
    const p = q2.shift();
    p.bookingScan = 1;
    const home = await get(p.website);
    if (!home || home.status >= 400) continue;
    let w = widget(home.html);
    if (!w) {
      const sub = [...home.html.matchAll(/<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]{0,160}?)<\/a>/gi)]
        .map(([, href, text]) => { try { return { u: new URL(href.replace(/&amp;/g, "&"), home.url), t: text.replace(/<[^>]+>/g, " ") }; } catch { return null; } })
        .find((x) => x && /^https?:$/.test(x.u.protocol) && /r[ée]serv|book/i.test(x.u.pathname + " " + x.t) && !BAD.test(x.u.href));
      if (sub) {
        if (sub.u.origin !== new URL(home.url).origin) w = /thefork|zenchef|sevenrooms|opentable|lafourchette/.test(sub.u.hostname) ? sub.u.href : null;
        else { const pg = await get(sub.u.href); w = pg && pg.status < 400 ? widget(pg.html) || sub.u.href : null; }
      }
    }
    if (w && !BAD.test(w)) { p.booking = w; p.bookingOk = 0; found++; }
  }
}));

const todo = places.filter((p) => p.booking && (p.bookingOk || 0) < V);
async function check(p) {
  const was = p.booking;
  let u;
  try { u = new URL(p.booking); } catch { delete p.booking; dropped++; return; }
  if (BAD.test(u.href)) { delete p.booking; dropped++; console.log(`retiré (hors sujet) ${p.name} : ${was}`); return; }
  // Zenchef : on garde l'identifiant du resto et on pointe sur la page de réservation.
  if (/zenchef/.test(u.hostname)) {
    const rid = u.search.match(/rid=(\d+)/) || u.pathname.match(/\/(\d{4,})/);
    if (rid) { p.booking = `https://bookings.zenchef.com/results?rid=${rid[1]}&lang=fr`; p.bookingOk = V; if (p.booking !== was) fixed++; else kept++; return; }
    delete p.booking; dropped++; return;
  }
  // TheFork, SevenRooms, OpenTable : le nom du lieu doit apparaître dans l'adresse ou la page.
  // Seules les pages TheFork trouvées par recherche web peuvent être celles d'un autre resto :
  // les modules de réservation lus sur le site du lieu (OpenTable, SevenRooms…) sont gardés.
  const platform = /thefork\.(fr|com)$/.test(u.hostname.replace(/^www\./, "")) && /^\/restaurant\//.test(u.pathname);
  const page = await get(u.href);
  // Pas de réponse (site lent, robot bloqué) : on garde le lien et on réessaiera.
  if (!page) { kept++; return; }
  if (page.status === 404 || page.status === 410) { delete p.booking; dropped++; console.log(`retiré (cassé ${page.status}) ${p.name} : ${was}`); return; }
  if (page.status >= 400) { kept++; return; }
  // Un lien vers un établissement d'une autre ville.
  if (p.list !== "villes" && /dubai|london|londres|new-?york|miami|marrakech|ibiza|mykonos|riyadh|doha|monaco|saint-tropez|courchevel|luxembourg|geneve|bruxelles/i.test(u.href)) {
    delete p.booking; dropped++; console.log(`retiré (autre ville) ${p.name} : ${was}`); return;
  }
  if (platform) {
    const title = (page.html.match(/<title>([^<]*)/i) || [])[1] || "";
    if (/module\.lafourchette/.test(u.hostname) || matches(u.pathname + " " + title, p.name)) { p.bookingOk = V; kept++; return; }
    if (page.status === 403 || page.status === 429) { if (matches(u.pathname, p.name)) { p.bookingOk = V; kept++; return; } }
    delete p.booking; dropped++; console.log(`retiré (autre lieu) ${p.name} : ${was}`); return;
  }
  // Page du site du resto : on préfère le module de réservation qu'elle contient.
  const w = widget(page.html);
  if (w) { p.booking = w; p.bookingOk = V; fixed++; return; }
  if (/r[ée]serv|book|booking|table/i.test(page.url + " " + page.html.slice(0, 200000).replace(/<[^>]+>/g, " ").slice(0, 60000))) { p.bookingOk = V; kept++; return; }
  delete p.booking; dropped++; console.log(`retiré (pas de réservation) ${p.name} : ${was}`);
}
const queue = [...todo];
await Promise.all(Array.from({ length: 6 }, async () => { while (queue.length) await check(queue.shift()); }));

await writeFile(FILE, JSON.stringify(places, null, 1));
console.log(`Réservation : ${kept} liens bons, ${fixed} corrigés, ${dropped} retirés, ${found} trouvés sur les sites`);
