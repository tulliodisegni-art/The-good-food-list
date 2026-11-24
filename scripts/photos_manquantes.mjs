// Photos manquantes ou cassées.
//  1. Vérifie chaque photo déjà en place (vignette + galerie) comme le ferait un iPhone : l'adresse répond-elle
//     encore avec une vraie image ? Les liens morts vont dans out/cassees.json.
//  2. Pour les fiches qui n'ont plus aucune photo qui marche, ouvre la fiche Google Maps du lieu (page publique,
//     sans clé ni API payante) et relève ses photos, seulement si le lieu trouvé est bien le bon
//     (même endroit sur la carte, ou même nom tout près). Résultat : out/photos.json + planches à relire à l'œil.
// Rien n'est écrit dans data/ : tout est relu avant d'être recopié (scripts/apply_manquantes.py).
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { execFileSync } from "node:child_process";

const places = JSON.parse(await readFile(new URL("../data/places.json", import.meta.url), "utf8"));
const GAL = JSON.parse(await readFile(new URL("../data/photos.json", import.meta.url), "utf8"));
const LIMIT = +process.env.LIMIT || 0;
const SKIP_CHECK = !!process.env.SKIP_CHECK;
const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const DESK = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await mkdir("out/thumbs", { recursive: true });
await mkdir("out/debug", { recursive: true });

let browser = null;
async function getBrowser() {
  if (!browser) { const { chromium } = await import("playwright"); browser = await chromium.launch(); }
  return browser;
}

/* ---------------- 1. photos cassées ---------------- */
async function fetchImg(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 20000);
  try {
    const r = await fetch(url, { signal: ctrl.signal, redirect: "follow", headers: { "user-agent": UA, accept: "image/webp,image/avif,image/jpeg,image/png,image/*;q=0.8,*/*;q=0.5", "accept-language": "fr-FR,fr;q=0.9" } });
    const type = r.headers.get("content-type") || "";
    let size = 0;
    try { size = (await r.arrayBuffer()).byteLength; } catch {}
    return { status: r.status, type, size };
  } catch (e) { return { status: 0, err: String(e.cause?.code || e.name || e.message) }; } finally { clearTimeout(t); }
}
const isOk = (r) => r && r.status >= 200 && r.status < 400 && /^image\/|octet-stream|binary/i.test(r.type) && r.size > 1500;
// Deuxième essai dans un vrai navigateur (certains hébergeurs refusent les robots mais pas Safari).
async function browserImg(url) {
  const b = await getBrowser();
  const ctx = await b.newContext({ userAgent: UA, locale: "fr-FR" });
  const pg = await ctx.newPage();
  try {
    const res = await pg.goto(url, { waitUntil: "load", timeout: 25000 });
    if (!res) return { status: 0, err: "aucune réponse" };
    const type = res.headers()["content-type"] || "";
    let size = 0;
    try { size = (await res.body()).byteLength; } catch {}
    return { status: res.status(), type, size, browser: true };
  } catch (e) { return { status: 0, err: e.message.slice(0, 80), browser: true }; } finally { await ctx.close().catch(() => {}); }
}

const live = places.filter((p) => !p.closed && !p.removed);
const urls = new Map(); // url -> [ids]
for (const p of live) for (const u of [p.photo, ...(GAL[p.id] || [])]) if (u) urls.set(u, [...(urls.get(u) || []), p.id]);
const broken = {};
if (!SKIP_CHECK) {
  const q = [...urls.keys()];
  let n = 0;
  await Promise.all(Array.from({ length: 16 }, async () => {
    while (q.length) {
      const u = q.shift();
      let r = await fetchImg(u);
      if (!isOk(r) && r.status !== 404 && r.status !== 410) r = await browserImg(u);
      if (!isOk(r)) broken[u] = { ids: urls.get(u), ...r };
      if (++n % 200 === 0) console.log(`vérifiées ${n}/${urls.size}, cassées ${Object.keys(broken).length}`);
    }
  }));
  await writeFile("out/cassees.json", JSON.stringify(broken, null, 1));
  console.log(`photos vérifiées : ${urls.size}, cassées : ${Object.keys(broken).length}`);
}

/* ---------------- 2. Google Maps ---------------- */
const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
  .replace(/\(.*?\)/g, " ").replace(/\b(le|la|les|l|the|chez|restaurant|resto|paris|cafe|bar)\b/g, " ").replace(/[^a-z0-9֐-׿]+/g, "");
const words = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\(.*?\)/g, " ").split(/[^a-z0-9֐-׿]+/).filter((w) => w.length > 1 && !["le", "la", "les", "the", "de", "du", "des", "restaurant", "paris", "cafe", "bar", "and", "et"].includes(w));
function nameMatch(a, b) {
  const x = norm(a), y = norm(b);
  if (x.length >= 3 && y.length >= 3 && (x.includes(y) || y.includes(x))) return true;
  const A = new Set(words(a)), B = words(b);
  const common = B.filter((w) => A.has(w)).length;
  return common > 0 && common / Math.min(A.size || 1, B.length || 1) >= 0.5;
}
function km(a, b, c, d) {
  const R = 6371, r = Math.PI / 180;
  const x = Math.sin((c - a) * r / 2) ** 2 + Math.cos(a * r) * Math.cos(c * r) * Math.sin((d - b) * r / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}
const big = (u) => u.replace(/=w\d+-h\d+[^/?#]*$/, "=w1200-h900-k-no").replace(/=s\d+[^/?#]*$/, "=w1200-h900-k-no");

const photoless = (p) => ![p.photo, ...(GAL[p.id] || [])].some((u) => u && !broken[u]);
let todo = live.filter(photoless);
if (LIMIT) todo = todo.slice(0, LIMIT);
console.log(`fiches sans aucune photo qui marche : ${todo.length}`);

async function gmaps(p, k) {
  const b = await getBrowser();
  const ctx = await b.newContext({ userAgent: DESK, locale: "fr-FR", viewport: { width: 1280, height: 900 } });
  const pg = await ctx.newPage();
  const rec = { id: p.id, name: p.name };
  try {
    const where = p.address && !/^(paris|new york|tel.?aviv|j[ée]rusalem)$/i.test(p.address.trim()) ? p.address : `${p.city || "Paris"}`;
    const q = `${p.name.replace(/\(.*?\)/g, "")} ${where}`.replace(/\s+/g, " ").trim();
    await pg.goto(`https://www.google.com/maps/search/${encodeURIComponent(q)}?hl=fr`, { waitUntil: "domcontentloaded", timeout: 30000 });
    if (/consent\.google/.test(pg.url())) {
      await pg.locator('form[action*="consent"] button').last().click().catch(() => {});
      await pg.waitForLoadState("domcontentloaded").catch(() => {});
    }
    // Liste de résultats : on ouvre le premier.
    await pg.waitForSelector("h1.DUwDvf, a.hfpxzc", { timeout: 15000 }).catch(() => {});
    if (!(await pg.$("h1.DUwDvf")) && (await pg.$("a.hfpxzc"))) {
      await pg.locator("a.hfpxzc").first().click().catch(() => {});
      await pg.waitForSelector("h1.DUwDvf", { timeout: 12000 }).catch(() => {});
    }
    await sleep(2500);
    rec.title = (await pg.locator("h1.DUwDvf").first().textContent({ timeout: 3000 }).catch(() => "")) || "";
    rec.addr = ((await pg.locator('button[data-item-id="address"]').first().getAttribute("aria-label", { timeout: 2000 }).catch(() => "")) || "").replace(/^Adresse:\s*/i, "");
    const m = pg.url().match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/) || pg.url().match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (m) { rec.lat = +m[1]; rec.lng = +m[2]; }
    if (rec.lat && p.lat) rec.km = +km(p.lat, p.lng, rec.lat, rec.lng).toFixed(3);
    rec.match = nameMatch(p.name, rec.title);
    rec.closed = /définitivement fermé|permanently closed/i.test(await pg.locator('div[role="main"]').first().innerText({ timeout: 2000 }).catch(() => ""));
    const imgs = new Set();
    const grab = async () => {
      for (const s of await pg.$$eval('img[src*="googleusercontent.com"], [style*="googleusercontent.com"]', (els) => els.map((e) => e.getAttribute("src") || (e.getAttribute("style") || "").match(/url\(["']?([^"')]+)/)?.[1] || "")).catch(() => [])) {
        if (/googleusercontent\.com\/(p\/|gps-cs-s\/|geougc)/.test(s)) imgs.add(big(s));
      }
    };
    await grab();
    // Ouvre l'onglet des photos pour en avoir plusieurs (lieu + plats).
    const btn = pg.locator('button.aoRNLd, button[jsaction*="heroHeaderImage"]').first();
    if (await btn.count()) {
      await btn.click({ timeout: 4000 }).catch(() => {});
      await sleep(3000);
      await grab();
    }
    rec.photos = [...imgs].slice(0, 8);
    if (k < 6) await pg.screenshot({ path: `out/debug/${k}-${p.id.slice(0, 40)}.png` }).catch(() => {});
  } catch (e) { rec.err = e.message.slice(0, 120); } finally { await ctx.close().catch(() => {}); }
  return rec;
}

const found = [];
const queue = todo.map((p, k) => [p, k]);
let done = 0;
await Promise.all(Array.from({ length: 3 }, async () => {
  while (queue.length) {
    const [p, k] = queue.shift();
    const rec = await gmaps(p, k);
    // Le bon lieu : même endroit (moins de 250 m), ou même nom à moins de 3 km (ou sans position connue).
    rec.ok = !rec.closed && (rec.photos || []).length > 0 && ((rec.km != null && rec.km < 0.25) || (rec.match && (rec.km == null || rec.km < 3)));
    found.push(rec);
    console.log(`${++done}/${todo.length} ${p.name} → « ${rec.title || "?"} » ${rec.km ?? "?"} km ${rec.match ? "nom ok" : "nom ≠"} · ${(rec.photos || []).length} photos ${rec.ok ? "✓" : "✗"}${rec.err ? " " + rec.err : ""}`);
    await sleep(1500);
  }
}));
await writeFile("out/gmaps.json", JSON.stringify(found, null, 1));
if (browser) await browser.close().catch(() => {});

/* ---------------- vignettes + planches ---------------- */
const photos = {};
for (const rec of found.filter((r) => r.ok)) {
  const kept = [];
  for (const u of rec.photos) {
    if (kept.length >= 5) break;
    const tmp = `/tmp/g-${rec.id}-${kept.length}`;
    try {
      execFileSync("curl", ["-sL", "-m", "20", "-A", UA, "-o", tmp, u]);
      const [w, h] = execFileSync("identify", ["-format", "%w %h", `${tmp}[0]`], { timeout: 15000 }).toString().split(" ").map(Number);
      if (Math.min(w, h) < 300) continue;
      const file = `out/thumbs/${rec.id}-${kept.length}.jpg`;
      execFileSync("convert", [`${tmp}[0]`, "-auto-orient", "-resize", "240x180^", "-gravity", "center", "-extent", "240x180", "-quality", "70", file]);
      kept.push({ u, w, h, file });
    } catch {}
  }
  if (kept.length) photos[rec.id] = kept;
}
await writeFile("out/photos.json", JSON.stringify(photos, null, 1));
const ids = Object.keys(photos);
await mkdir("out/sheets", { recursive: true });
for (let i = 0, s = 0; i < ids.length; i += 10, s++) {
  const rows = [];
  for (const id of ids.slice(i, i + 10)) {
    const p = places.find((x) => x.id === id), rec = found.find((r) => r.id === id);
    const tiles = photos[id].map((ph, n) => { const f = `/tmp/t-${id}-${n}.jpg`; execFileSync("convert", [ph.file, "-gravity", "NorthWest", "-fill", "yellow", "-undercolor", "#000a", "-pointsize", "22", "-annotate", "+4+2", String(n), f]); return f; });
    const lab = `/tmp/l-${id}.png`;
    execFileSync("convert", ["-size", "330x180", "xc:white", "-font", "DejaVu-Sans", "-pointsize", "17", "-fill", "black", "-annotate", "+8+28", p.name.slice(0, 28),
      "-pointsize", "12", "-annotate", "+8+50", `${p.list} ${p.city || p.arr || ""} ${p.cat || ""}`.slice(0, 44),
      "-annotate", "+8+70", (p.address || "").slice(0, 46), "-fill", "#06c", "-annotate", "+8+96", `Maps : ${rec.title}`.slice(0, 46),
      "-annotate", "+8+116", (rec.addr || "").slice(0, 46), "-annotate", "+8+136", `${rec.km ?? "?"} km · ${rec.match ? "même nom" : "nom différent"}`, "-fill", "#888", "-annotate", "+8+160", id.slice(0, 46), lab]);
    const row = `/tmp/r-${id}.jpg`;
    execFileSync("convert", [lab, ...tiles, "+append", "-background", "white", row]);
    rows.push(row);
  }
  execFileSync("convert", [...rows, "-background", "white", "-gravity", "North", "-splice", "0x4", "-append", "-quality", "72", `out/sheets/planche-${String(s).padStart(3, "0")}.jpg`]);
}
console.log(`Google Maps : ${found.filter((r) => r.ok).length} lieux reconnus sur ${found.length}, ${ids.length} avec photos`);
