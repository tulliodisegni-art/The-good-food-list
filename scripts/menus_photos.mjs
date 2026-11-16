// Lit le site de chaque lieu pour trouver :
//  1. le vrai lien du menu (la page « Carte / Menu » du site, ou le PDF), vérifié : la page répond et ressemble à un menu ;
//  2. plusieurs photos du lieu et des plats, prises sur le site du lieu lui-même (galerie de la fiche).
// Rien n'est écrit dans data/ : tout va dans out/ (menus.json, photos.json, planches de vérification),
// relu à la main avant d'être recopié dans data/menus.json et data/photos.json.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";

const places = JSON.parse(await readFile(process.env.PLACES || new URL("../data/places.json", import.meta.url), "utf8"));
const ONLY = (process.env.ONLY || "").split(",").filter(Boolean); // listes à traiter (ex. "precieuses"), toutes par défaut
const LIMIT = +process.env.LIMIT || 0;
const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
  .replace(/\(.*?\)/g, " ").replace(/\b(le|la|les|l|the|chez|restaurant|resto|paris|cafe|bar)\b/g, " ").replace(/[^a-z0-9]+/g, "");
const decode = (s) => String(s || "").replace(/&amp;/g, "&").replace(/&#0?38;/g, "&").replace(/&#x2F;/gi, "/").replace(/&quot;/g, '"').replace(/&#39;|&#039;/g, "'").replace(/&nbsp;/g, " ");
const text = (h) => decode(String(h || "").replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();

async function get(url, ms = 15000, accept) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctrl.signal, redirect: "follow", headers: { "user-agent": UA, "accept-language": "fr-FR,fr;q=0.9,en;q=0.8,he;q=0.6", ...(accept ? { accept } : {}) } });
    return r;
  } catch { return null; } finally { clearTimeout(t); }
}
async function fetchPage(url) {
  const r = await get(url, 15000, "text/html,application/xhtml+xml,application/pdf;q=0.9,*/*;q=0.8");
  if (!r) return { status: 0, url };
  const type = r.headers.get("content-type") || "";
  if (/pdf/i.test(type) || /\.pdf($|\?)/i.test(r.url) && !/html/.test(type)) { try { r.body?.cancel(); } catch {} return { status: r.status, url: r.url, pdf: true, html: "" }; }
  if (/^image\//.test(type)) { try { r.body?.cancel(); } catch {} return { status: r.status, url: r.url, image: true, html: "" }; }
  let html = "";
  try { html = (await r.text()).slice(0, 1500000); } catch {}
  return { status: r.status, url: r.url, html };
}
// Sites faits en JavaScript ou protégés contre les robots : on ouvre la page dans un vrai navigateur (Chromium).
let browser = null, browserTried = false;
async function getBrowser() {
  if (browserTried) return browser;
  browserTried = true;
  try { const { chromium } = await import("playwright"); browser = await chromium.launch(); } catch (e) { console.log("navigateur indisponible", e.message); }
  return browser;
}
let rendering = 0;
async function renderPage(url) {
  const b = await getBrowser();
  if (!b) return null;
  while (rendering >= 4) await sleep(200);
  rendering++;
  const ctx = await b.newContext({ userAgent: UA, locale: "fr-FR", viewport: { width: 390, height: 844 }, isMobile: true });
  const pg = await ctx.newPage();
  try {
    const res = await pg.goto(url, { waitUntil: "domcontentloaded", timeout: 25000 });
    await pg.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
    // Fait défiler pour charger les images « paresseuses ».
    await pg.evaluate(async () => { for (let y = 0; y < 6; y++) { window.scrollBy(0, window.innerHeight); await new Promise((r) => setTimeout(r, 350)); } }).catch(() => {});
    // Ouvre le menu « burger » s'il existe : les liens de navigation y sont parfois ajoutés seulement à l'ouverture.
    await pg.evaluate(() => { const b = document.querySelector('[aria-label*="menu" i], .hamburger, .burger, .menu-toggle, button[class*="burger" i], button[class*="menu" i]'); if (b) b.click(); }).catch(() => {});
    await sleep(600);
    const html = await pg.content();
    return { status: res ? res.status() : 200, url: pg.url(), html, rendered: true };
  } catch { return null; } finally { await ctx.close().catch(() => {}); rendering--; }
}
const thin = (pg) => !pg.html || text(pg.html).length < 600 || (pg.html.match(/<a\b/gi) || []).length < 6;
async function page(url) {
  const pg = await fetchPage(url);
  if (pg.pdf || pg.image) return pg;
  if (!pg.status || [401, 403, 406, 429, 503].includes(pg.status) || (pg.status < 400 && thin(pg))) {
    const r = await renderPage(url);
    if (r && r.status < 400 && r.html) return r;
  }
  return pg;
}

/* ---------------- menu ---------------- */
const MENU_WORD = /(^|[^a-z])(menus?|cartes?|la-carte|lacarte|nos-cartes|food|foods|drinks?|dinner|diner|d[ée]jeuner|lunch|brunch|cocktails?|carte-des-vins|wine-list|vins|boissons|plats|our-menu|notre-carte|speisekarte|carta|menu-du-jour|ardoise|tafrit)([^a-z]|$)/i;
const MENU_TEXT = /^\s*(le |la |les |nos |notre |our |view |see |voir |d[ée]couvrir |consulter |the )?(la |le |notre |our )?(menus?|cartes?|carte & menus|cartes? (et|&) menus?|menus? (et|&) cartes?|food|food menu|food & drinks?|drinks?|dinner|d[îi]ner|d[ée]jeuner|lunch|brunch|cocktails?|carte des vins|wine list|vins|boissons|ardoise|à la carte|a la carte|menu du jour|carta|speisekarte|תפריט|תפריטים|תפריט אוכל)( [a-zàéèêë ]{0,20})?\s*$/i;
const NOT_MENU = /(^|[^a-z])(cadeau|gift|voucher|privati|private|[ée]v[ée]nement|seminaire|traiteur|catering|recrut|career|emploi|newsletter|fidelit|loyalty|boutique|e-?shop|livraison|deliver|ubereats|just-?eat|commande|reserv|r[ée]serv|booking|opentable|thefork|zenchef|sevenrooms|instagram|facebook|tiktok|linkedin|twitter|youtube|tripadvisor|mention|cookie|privacy|allerg|contact|nous-trouver|find-us|plan-d-acc|wp-admin)|(^|[^a-z])(events?|jobs?|presse?|press-kit|shop|store|order|book|resy|acces|access|itineraire|location|legal|cgv|terms|faq|login|account|cart|panier|wolt|gifts?)([^a-z]|$)|google\.[a-z.]+\/maps|maps\.google|goo\.gl\/maps|maps\.app|^javascript|#$/i;
const MENU_HOST = /issuu\.com|calameo\.com|flipsnack|canva\.(com|site)|drive\.google|docs\.google|dropbox|wixstatic\.com\/ugd|squarespace\.com\/.*\.pdf|website-files|menu|carte|qr|yumpu|readymag|flowpaper|heyzine|anyflip|fliphtml5|notion\.site|tablelist|mymenu|tabesto|sunday|obypay|innovorder|popmenu|bentobox|toasttab|menufy|tabit|my-menu|easymenu|mydigitalmenu|menulux/i;
const PRICE = /(\d{1,3}(?:[.,]\d{1,2})?\s?(?:€|eur\b|euros?\b|₪|nis\b|ils\b))|((?:€|\$|₪)\s?\d{1,3}(?:[.,]\d{1,2})?)|(\b\d{1,3}[.,]\d0?\b(?!\s?(?:km|h|min|%)))/gi;
const DISH = /entr[ée]es?|plats?\b|desserts?|starters?|mains?\b|appetizers?|antipasti|primi|secondi|dolci|small plates|to share|à partager|fromages?|cocktails?|vins? (au verre|rouges?|blancs?)|by the glass|sides?\b|garnitures?|raw bar|crudo|sushi|maki|ramen|pizzas?|pâtes|pasta|burgers?|salades?|salads?|tapas|ראשונות|עיקריות|קינוחים/gi;
function menuScore(html) {
  const t = text(html);
  const prices = (t.match(PRICE) || []).length;
  const dishes = new Set((t.match(DISH) || []).map((x) => x.toLowerCase())).size;
  return { prices, dishes, ok: (prices >= 6 && dishes >= 1) || (prices >= 3 && dishes >= 3) };
}
function anchors(html, base) {
  const out = [];
  for (const m of html.matchAll(/<a\b([^>]*)>([\s\S]{0,400}?)<\/a>/gi)) {
    const attrs = m[1];
    const href = (attrs.match(/\bhref\s*=\s*["']([^"']+)["']/i) || attrs.match(/\bhref\s*=\s*([^\s>]+)/i) || [])[1];
    if (!href) continue;
    let u; try { u = new URL(decode(href).trim(), base); } catch { continue; }
    if (!/^https?:$/.test(u.protocol)) continue;
    const label = text(m[2]) || decode((attrs.match(/\b(?:aria-label|title)\s*=\s*["']([^"']+)["']/i) || [])[1] || "") || decode((m[2].match(/\balt\s*=\s*["']([^"']+)["']/i) || [])[1] || "");
    out.push({ u, label: label.slice(0, 80) });
  }
  // Menus en iframe / embed / object (PDF intégré, liseuse).
  for (const m of html.matchAll(/<(?:iframe|embed|object)\b[^>]*(?:src|data)\s*=\s*["']([^"']+)["']/gi)) {
    try { const u = new URL(decode(m[1]), base); if (/\.pdf|issuu|calameo|flipsnack|heyzine|canva|drive\.google|docs\.google|yumpu|fliphtml5|anyflip/i.test(u.href)) out.push({ u, label: "menu (intégré)", embed: true }); } catch {}
  }
  return out;
}
const CITIES = ["paris", "london", "londres", "dubai", "doha", "riyadh", "abu-dhabi", "new-york", "nyc", "miami", "los-angeles", "las-vegas", "monaco", "monte-carlo", "cannes", "nice", "saint-tropez", "st-tropez", "courchevel", "megeve", "mykonos", "ibiza", "marbella", "madrid", "barcelona", "milan", "milano", "rome", "roma", "geneve", "geneva", "zurich", "bruxelles", "brussels", "amsterdam", "berlin", "lisbon", "lisbonne", "istanbul", "tel-aviv", "jerusalem", "marrakech", "casablanca", "beirut", "mexico", "tokyo", "hong-kong", "singapore", "bangkok", "lyon", "bordeaux", "marseille", "chicago", "boston", "washington", "toronto", "montreal", "sao-paulo", "lima", "bahrain", "kuwait", "cairo", "tunis", "athens", "athenes", "budapest", "prague", "vienna", "vienne", "munich", "frankfurt", "dublin", "edinburgh", "manchester", "brooklyn", "miami-beach", "dallas", "houston", "austin", "san-francisco", "seoul", "shanghai", "beijing", "sydney", "melbourne"];
const slug = (s) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z]+/g, "-").replace(/^-|-$/g, "");
const cityOf = (p) => (p.list === "villes" ? slug(p.city) : "paris");
function otherCity(u, p) {
  const segs = decodeURIComponent(u.pathname + " " + u.hostname).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").split(/[^a-z]+/).join("-");
  const mine = cityOf(p);
  return CITIES.some((c) => c !== mine && !(mine.startsWith("tel-aviv") && c === "tel-aviv") && !(mine === "new-york" && /^(nyc|brooklyn)$/.test(c)) && new RegExp(`(^|-)${c}(-|$)`).test(segs));
}
function rankMenu(a, home, p) {
  if (p && otherCity(a.u, p)) return 0;
  const href = a.u.href, path = decodeURIComponent(a.u.pathname + a.u.search).toLowerCase();
  const same = a.u.hostname.replace(/^www\./, "") === home.hostname.replace(/^www\./, "");
  if (NOT_MENU.test(href.replace(/[?#].*$/, "")) && !/menu|carte/i.test(path.split("/").pop() || "")) return 0;
  if (NOT_MENU.test(a.label) && !MENU_TEXT.test(a.label)) return 0;
  if (/carte[-_ ]?(cadeau|blanche|jaune|noire|fid|des? (lieux|accès))|voir la carte|sur la carte|map|champagne\/\d|produit|product/i.test(a.label + " " + path)) return 0;
  if (same && (a.u.pathname === home.pathname || a.u.pathname === "/") && !a.u.hash) return 0;
  let s = 0;
  if (a.embed) s += 6;
  if (MENU_TEXT.test(a.label)) s += 6;
  if (MENU_WORD.test(path.replace(/[_/.]/g, "-"))) s += 4;
  if (/\.pdf($|\?)/i.test(path) && (MENU_WORD.test(path) || MENU_TEXT.test(a.label) || /menu|carte|food|drink|vin|wine|brunch|lunch|dinner/i.test(path + a.label))) s += 5;
  if (!same && !MENU_HOST.test(a.u.hostname + a.u.pathname) && !/\.pdf/i.test(path)) s -= 4;
  if (a.u.hash && a.u.pathname === home.pathname) s -= 2;
  if (/dinner|d[îi]ner|soir|evening|food|la-carte|menu$|menus$|carte$|cartes$/i.test(path + " " + a.label)) s += 1;
  if (/vins?|wine|boissons|drinks|cocktail|dessert|kids|enfant|groupe|group|privat|traiteur|take|emporter|petit-dej|breakfast/i.test(path + " " + a.label)) s -= 1;
  return s;
}
async function findMenu(p, home) {
  const base = new URL(home.url);
  const cands = new Map();
  for (const a of anchors(home.html, base)) {
    const s = rankMenu(a, base, p);
    if (s >= 4) { const k = a.u.href.replace(/#.*$/, (h) => (a.u.pathname === base.pathname ? h : "")); if (!cands.has(k) || cands.get(k).s < s) cands.set(k, { ...a, s }); }
  }
  // Page unique (one-page) avec une section « menu » et des prix : on pointe sur la section.
  const homeScore = menuScore(home.html);
  const ranked = [...cands.entries()].sort((a, b) => b[1].s - a[1].s).slice(0, 6);
  for (const [href, a] of ranked) {
    if (a.u.pathname === base.pathname && a.u.hash) {
      if (homeScore.ok) return { menu: href, how: "section", score: homeScore };
      continue;
    }
    const pg = await page(href);
    if (!pg.status || pg.status >= 400) continue;
    if (pg.pdf) return { menu: pg.url === href ? href : pg.url, how: "pdf", label: a.label };
    if (pg.image) return { menu: href, how: "image", label: a.label };
    const back = new URL(pg.url);
    if (back.hostname.replace(/^www\./, "") === base.hostname.replace(/^www\./, "") && (back.pathname === "/" || back.pathname === base.pathname) && !a.u.hash) continue; // renvoie à l'accueil
    const sc = menuScore(pg.html);
    // Page « Nos cartes » qui ne fait que proposer des PDF : on prend la page (l'utilisateur choisit) sauf s'il n'y a qu'un PDF.
    const pdfs = anchors(pg.html, back).filter((x) => /\.pdf($|\?)/i.test(x.u.pathname) && !NOT_MENU.test(x.u.href) && !/cadeau|gift|privat|groupe|traiteur|allerg/i.test(x.u.href + x.label));
    const embeds = anchors(pg.html, back).filter((x) => x.embed);
    if (sc.ok) return { menu: pg.url, how: "page", label: a.label, score: sc };
    if (embeds.length) return { menu: pg.url, how: "page-liseuse", label: a.label, score: sc };
    if (pdfs.length === 1) return { menu: pdfs[0].u.href, how: "pdf-via-page", label: a.label };
    if (pdfs.length > 1) return { menu: pg.url, how: "page-pdfs", label: a.label, n: pdfs.length };
    // Page « menu » en JavaScript (prix non lisibles sans navigateur) : acceptée si le libellé et l'adresse disent clairement « menu ».
    if (a.s >= 10 && back.pathname !== "/" && MENU_WORD.test(back.pathname.replace(/[_/.]/g, "-"))) return { menu: pg.url, how: "page-faible", label: a.label, score: sc };
  }
  if (homeScore.ok && homeScore.prices >= 10) return { menu: home.url, how: "accueil-avec-prix", score: homeScore };
  return null;
}

/* ---------------- photos ---------------- */
const BAD_IMG = /logo|icon|favicon|sprite|placeholder|blank|spacer|loader|loading|avatar|badge|flag|arrow|btn|button|payment|visa|master|paypal|tripadvisor|michelin|gault|guide|label|award|trophy|qr[-_]?code|qrcode|signature|emoji|gravatar|pixel|tracking|cookie|banner-ad|(^|[^a-z])presse?([^a-z]|$)|newsletter|app-?store|google-?play|wechat|whatsapp|instagram|facebook|tiktok|twitter|linkedin|youtube|insta[-_]|social|footer|header-bg|pattern|texture|background-pattern|(^|[^a-z])map([^a-z]|$)|plan[-_]|carte[-_]?(cadeau|acces)|gift|voucher|team|equipe|chef-portrait|portrait|staff|careers|recrut|menu[-_]?pdf|cropped-.*-(32|180|192|270)x|-\d{2,3}x\d{2,3}\.(jpe?g|png|webp)$/i;
const IMG_EXT = /\.(jpe?g|png|webp|avif)(\?|$)|wixstatic\.com\/media|squarespace-cdn\.com|images\.prismic\.io|ctfassets\.net|cloudinary\.com|imgix\.net|website-files\.com|cdn\.shopify|storyblok|sanity\.io|googleusercontent|format=\d+w/i;
function bestFromSrcset(ss, base) {
  const items = ss.split(/,\s+(?=\S)/).map((x) => x.trim().split(/\s+/)).filter((x) => x[0]).map(([u, d]) => ({ u, w: d && /w$/.test(d) ? +d.slice(0, -1) : d && /x$/.test(d) ? +d.slice(0, -1) * 600 : 0 }));
  if (!items.length) return null;
  items.sort((a, b) => a.w - b.w);
  const pick = items.find((x) => x.w >= 1000) || items[items.length - 1];
  try { return new URL(decode(pick.u), base).href; } catch { return null; }
}
function images(html, base) {
  const out = [];
  const add = (u, how) => { if (!u || /^data:/.test(u)) return; try { const x = new URL(decode(u.trim()), base); if (/^https?:$/.test(x.protocol)) out.push({ u: x.href, how }); } catch {} };
  for (const prop of ["og:image:secure_url", "og:image", "twitter:image"]) {
    const m = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]*content=["']([^"']+)["']`, "i")) || html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']${prop}["']`, "i"));
    if (m) { add(m[1], "og"); break; }
  }
  for (const m of html.matchAll(/<(?:img|source)\b[^>]*>/gi)) {
    const tag = m[0];
    if (/\b(?:width|height)\s*=\s*["']?(\d{1,2})["'\s>]/i.test(tag)) continue; // icônes
    const ss = (tag.match(/\b(?:data-srcset|data-lazy-srcset|srcset)\s*=\s*["']([^"']+)["']/i) || [])[1];
    const best = ss ? bestFromSrcset(ss, base) : null;
    if (best) { add(best, "img"); continue; }
    const src = (tag.match(/\b(?:data-src|data-lazy-src|data-original|data-image|data-bg|src)\s*=\s*["']([^"']+)["']/i) || [])[1];
    const alt = (tag.match(/\balt\s*=\s*["']([^"']*)["']/i) || [])[1] || "";
    if (/logo|icon/i.test(alt)) continue;
    if (src) add(src, "img");
  }
  for (const m of html.matchAll(/background(?:-image)?\s*:\s*url\(\s*['"]?([^'")]+)['"]?\s*\)/gi)) add(m[1], "bg");
  for (const m of html.matchAll(/data-(?:bg|background|image-url|background-image)\s*=\s*["']([^"']+\.(?:jpe?g|png|webp)[^"']*)["']/gi)) add(m[1], "bg");
  return out;
}
// Même image en plusieurs tailles : on garde une seule adresse par image.
function key(u) {
  try {
    const x = new URL(u);
    let path = x.pathname.toLowerCase();
    if (/wixstatic/.test(x.hostname)) path = path.replace(/\/v1\/.*$/, "");
    path = path.replace(/-\d{2,4}x\d{2,4}(?=\.\w+$)/, "").replace(/-scaled(?=\.\w+$)/, "").replace(/@\dx/, "").replace(/\.(webp|avif)$/, ".jpg");
    return x.hostname.replace(/^www\./, "") + path;
  } catch { return u; }
}
function display(u) {
  // Taille raisonnable pour le téléphone quand le site la propose dans l'adresse.
  try {
    const x = new URL(u);
    if (/squarespace-cdn\.com/.test(x.hostname)) { x.search = "?format=1500w"; return x.href; }
    if (/wixstatic\.com/.test(x.hostname)) { const m = x.pathname.match(/^(\/media\/[^/]+)/); if (m) return `https://static.wixstatic.com${m[1]}/v1/fill/w_1200,h_900,al_c,q_80,enc_auto/photo.jpg`; }
    if (/cdn\.shopify\.com/.test(x.hostname)) { x.searchParams.set("width", "1200"); return x.href; }
    if (/images\.prismic\.io|imgix\.net/.test(x.hostname)) { x.searchParams.set("w", "1200"); x.searchParams.delete("h"); x.searchParams.set("auto", "format,compress"); return x.href; }
    if (/ctfassets\.net/.test(x.hostname)) { x.search = "?w=1200&q=80&fm=jpg"; return x.href; }
  } catch {}
  return u;
}
let nImg = 0;
async function probe(u) {
  const r = await get(u, 20000, "image/avif,image/webp,image/jpeg,image/png,*/*;q=0.5");
  if (!r || !r.ok || !/^image\/(jpe?g|png|webp|avif)/i.test(r.headers.get("content-type") || "")) { try { r?.body?.cancel(); } catch {} return null; }
  const len = +r.headers.get("content-length") || 0;
  if (len > 15e6) { try { r.body?.cancel(); } catch {} return null; }
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length < 15000) return null;
  const tmp = `/tmp/mp${++nImg}`;
  await writeFile(tmp, buf);
  try {
    const [w, h] = execFileSync("identify", ["-format", "%w %h\n", `${tmp}[0]`], { timeout: 20000 }).toString().trim().split("\n")[0].split(" ").map(Number);
    const thumb = `/tmp/mp${nImg}.jpg`;
    execFileSync("convert", [`${tmp}[0]`, "-auto-orient", "-resize", "360x270^", "-gravity", "center", "-extent", "360x270", "-quality", "70", thumb], { timeout: 30000 });
    // Empreinte (8x8 en gris) pour écarter les doublons à l'œil près.
    const px = execFileSync("convert", [`${tmp}[0]`, "-resize", "9x8!", "-colorspace", "gray", "-depth", "8", "gray:-"], { timeout: 20000 });
    let bits = "";
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) bits += px[y * 9 + x] > px[y * 9 + x + 1] ? "1" : "0";
    // Part de la photo occupée par une seule couleur (fond uni, texte sur fond) : écarte les visuels « affiche ».
    const hist = execFileSync("convert", [`${tmp}[0]`, "-resize", "64x64!", "+dither", "-colors", "8", "-format", "%c", "histogram:info:-"], { timeout: 20000 }).toString();
    const flat = Math.max(0, ...hist.split("\n").map((l) => +(l.match(/^\s*(\d+):/) || [])[1] || 0)) / 4096;
    return { w, h, bytes: buf.length, dhash: bits, thumb, flat };
  } catch { return null; }
}
const ham = (a, b) => { let d = 0; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) d++; return d; };

/* ---------------- lieux ---------------- */
const siteOf = (p) => p.website || (/^https?:/.test(p.menu || "") && !/google\.|instagram|facebook|\.pdf/i.test(p.menu) ? new URL(p.menu).origin + "/" : "");
const todo = places.filter((p) => !p.closed && (!ONLY.length || ONLY.includes(p.list)));
// Sites partagés par plusieurs lieux différents (groupes) : pas de menu ni de photos depuis l'accueil commun.
const byHost = {};
for (const p of places) { const s = siteOf(p); if (!s) continue; try { const u = new URL(s); const k = u.hostname.replace(/^www\./, ""); (byHost[k] ||= new Set()).add(norm(p.name).slice(0, 8)); } catch {} }
const shared = (u) => (byHost[u.hostname.replace(/^www\./, "")] || new Set()).size > 1;

await mkdir("out/thumbs", { recursive: true });
const menus = {}, photos = {}, report = [];
let done = 0;
const queue = LIMIT ? todo.slice(0, LIMIT) : [...todo];
const total = queue.length;
async function work(p) {
  const site = siteOf(p);
  const rec = { id: p.id, name: p.name, list: p.list, city: p.city || "", old: p.menu || "", site };
  report.push(rec);
  // Lien menu déjà présent et précis (vient de la note) : on vérifie qu'il répond toujours.
  const oldDeep = p.menu && !/google\./.test(p.menu) && (() => { try { const u = new URL(p.menu); return (u.pathname !== "/" && u.pathname !== "") || u.hash; } catch { return false; } })();
  if (!site) { rec.note = "pas de site"; }
  let home = null, u0 = null;
  if (site) {
    try { u0 = new URL(site); } catch {}
    if (u0) home = await page(u0.href);
    rec.homeStatus = home ? home.status : 0;
  }
  const grp = u0 && shared(u0) && (u0.pathname === "/" || u0.pathname === "");
  if (grp) rec.note = "site de groupe partagé";
  // Menu.
  let found = null;
  if (oldDeep) {
    const pg = await page(p.menu);
    const okOld = pg.status && pg.status < 400 && (pg.pdf || pg.image || (() => { const b = new URL(pg.url); return (b.pathname !== "/" || b.hash) && (MENU_WORD.test(decodeURIComponent(b.pathname + " " + p.menu).toLowerCase().replace(/[_/.]/g, "-")) || menuScore(pg.html).ok); })());
    if (okOld) found = { menu: p.menu, how: "deja-bon", status: pg.status, score: pg.html ? menuScore(pg.html) : null };
    else rec.oldBroken = pg.status || "injoignable";
  }
  if (!found && home && home.status && home.status < 400 && home.html && !grp) found = await findMenu(p, home);
  // Rien trouvé dans la page brute : on la rouvre dans le navigateur (liens ajoutés par JavaScript).
  if (!found && u0 && !grp && !(home && home.rendered)) {
    const r = await renderPage(home && home.url || u0.href);
    if (r && r.status < 400 && r.html) { home = r; rec.rendered = 1; found = await findMenu(p, r); }
  }
  if (found) { menus[p.id] = { menu: found.menu, how: found.how }; Object.assign(rec, { menu: found.menu, how: found.how, label: found.label || "", score: found.score || null }); }
  else { menus[p.id] = { menu: "", how: "google" }; rec.how = "google"; }
  // Photos : accueil + page menu + page galerie, sur le site du lieu seulement.
  if (process.env.MENUS_ONLY) { done++; console.log(`${done}/${total} ${p.list} · ${p.name} · menu: ${rec.how}${rec.menu ? " " + rec.menu : ""}`); return; }
  if (home && home.html && home.status < 400 && !grp) {
    const base = new URL(home.url);
    const pages = [home];
    const gal = anchors(home.html, base).find((a) => a.u.hostname === base.hostname && /galer|gallery|photos?\b|ambiance|le-lieu|the-space|espace|lieu|decouvrir|l-endroit|restaurant$|about|a-propos|notre-histoire|histoire|story|גלריה/i.test(a.u.pathname + " " + a.label) && !NOT_MENU.test(a.u.pathname));
    if (gal) { const g = await page(gal.u.href); if (g.html && g.status < 400) pages.push(g); }
    if (found && /^page/.test(found.how)) { const m = await page(found.menu); if (m.html && m.status < 400) pages.push(m); }
    const seen = new Set(), cands = [];
    for (const pg of pages) for (const im of images(pg.html, new URL(pg.url))) {
      const k = key(im.u);
      if (seen.has(k)) continue; seen.add(k);
      if (BAD_IMG.test(decodeURIComponent(im.u).replace(/^https?:\/\/[^/]+/, ""))) continue;
      if (!IMG_EXT.test(im.u)) continue;
      if (/cdninstagram|fbcdn|gstatic|googleapis|gravatar|wp-includes|ytimg|maps\.|tripadvisor|thefork|lafourchette|zenchef|sevenrooms|opentable|michelin/i.test(im.u)) continue;
      cands.push(im);
    }
    if (p.photo && !seen.has(key(p.photo))) cands.unshift({ u: p.photo, how: "actuelle" });
    const kept = [];
    for (const im of cands.slice(0, 30)) {
      if (kept.length >= 8) break;
      const show = display(im.u);
      let info = await probe(show);
      let url = show;
      if (!info && show !== im.u) { info = await probe(im.u); url = im.u; }
      if (!info) continue;
      const { w, h } = info;
      if (Math.min(w, h) < 380 || w < 560 || w / h > 2.8 || w / h < 0.5) continue;
      if (info.flat > 0.75) continue; // fond uni (affiche, texte, logo sur fond)
      if (kept.some((k) => ham(k.dhash, info.dhash) <= 12)) continue;
      const n = kept.length;
      const file = `out/thumbs/${p.id}-${n}.jpg`;
      execFileSync("cp", [info.thumb, file]);
      kept.push({ u: url, w, h, dhash: info.dhash, file, how: im.how });
    }
    if (kept.length) photos[p.id] = kept.map(({ u, w, h, file, how }) => ({ u, w, h, file, how }));
    rec.photos = kept.length;
  }
  done++;
  console.log(`${done}/${total} ${p.list} · ${p.name} · menu: ${rec.how}${rec.menu ? " " + rec.menu : ""} · photos: ${rec.photos || 0}`);
}
await Promise.all(Array.from({ length: 8 }, async () => {
  while (queue.length) {
    const p = queue.shift();
    let timer;
    try { await Promise.race([work(p), new Promise((_, rej) => { timer = setTimeout(() => rej(new Error("trop long")), 240000); })]); } catch (e) { console.log("échec", p.name, e.message); } finally { clearTimeout(timer); }
    if (done % 50 === 0) await save();
  }
}));
async function save() {
  await writeFile("out/menus.json", JSON.stringify(menus, null, 1));
  await writeFile("out/photos.json", JSON.stringify(photos, null, 1));
  await writeFile("out/report.json", JSON.stringify(report, null, 1));
}
await save();
if (browser) await browser.close().catch(() => {});

// Planches de vérification : une ligne par lieu (nom + vignettes numérotées), 12 lieux par planche.
const ids = Object.keys(photos);
const byList = ["precieuses", "paris", "sorties", "villes"];
ids.sort((a, b) => byList.indexOf(places.find((p) => p.id === a).list) - byList.indexOf(places.find((p) => p.id === b).list));
await mkdir("out/sheets", { recursive: true });
const font = "DejaVu-Sans";
for (let i = 0, s = 0; i < ids.length; i += 12, s++) {
  const rows = [];
  for (const id of ids.slice(i, i + 12)) {
    const p = places.find((x) => x.id === id);
    const tiles = photos[id].map((ph, n) => { const f = `/tmp/t-${id}-${n}.jpg`; execFileSync("convert", [ph.file, "-resize", "240x180", "-gravity", "NorthWest", "-fill", "yellow", "-undercolor", "#000a", "-pointsize", "22", "-annotate", "+4+2", String(n), f]); return f; });
    const lab = `/tmp/l-${id}.png`;
    execFileSync("convert", ["-size", "300x180", "xc:white", "-font", font, "-pointsize", "17", "-fill", "black", "-annotate", "+8+30", `${p.name}`.slice(0, 26), "-pointsize", "13", "-annotate", "+8+56", `${p.list} ${p.city || p.arr || ""} ${p.cat || ""}`.slice(0, 36), "-annotate", "+8+78", id.slice(0, 40), lab]);
    const row = `/tmp/r-${id}.jpg`;
    execFileSync("convert", [lab, ...tiles, "+append", "-background", "white", row]);
    rows.push(row);
  }
  execFileSync("convert", [...rows, "-background", "white", "-gravity", "North", "-splice", "0x4", "-append", "-quality", "70", `out/sheets/planche-${String(s).padStart(3, "0")}.jpg`]);
}
console.log(`menus: ${Object.values(menus).filter((m) => m.menu).length} liens trouvés / ${Object.keys(menus).length}; photos: ${ids.length} lieux`);
