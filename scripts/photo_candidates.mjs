// Prépare la vérification des photos à la main.
// 1. Pour chaque fiche sans photo : recherche web du lieu, ouverture des pages qui parlent de CE lieu
//    (même nom dans le titre ou l'adresse de la page) et récupération de leur image de partage.
// 2. Télécharge aussi, en petit, les photos déjà présentes, pour repérer celles qui ne correspondent pas.
// Tout est déposé dans cand/ (index.json + vignettes) ; rien n'est modifié dans data/places.json.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { execFileSync } from "node:child_process";

const places = JSON.parse(await readFile(new URL("../data/places.json", import.meta.url), "utf8"));
const ONLY = process.env.ONLY || "all"; // "missing", "current" ou "all"
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
  .replace(/\b(le|la|les|l|the|chez|restaurant|resto|paris)\b/g, " ").replace(/[^a-z0-9]+/g, "");
const SKIP = /google\.|instagram\.|facebook\.|tiktok\.|youtube\.|pinterest\.|twitter\.|x\.com|linkedin\.|bing\.|duckduckgo|wikipedia|apple\.com|waze|mappy/i;

async function get(url, ms = 12000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctrl.signal, redirect: "follow", headers: { "user-agent": UA, "accept-language": "fr-FR,fr;q=0.9,en;q=0.8" } });
    return r;
  } catch { return null; } finally { clearTimeout(t); }
}
async function html(url) {
  const r = await get(url);
  if (!r || !r.ok || !/html/.test(r.headers.get("content-type") || "")) return null;
  try { return { text: (await r.text()).slice(0, 500000), url: r.url }; } catch { return null; }
}
async function results(q) {
  const ddg = await html(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`);
  let links = ddg ? [...ddg.text.matchAll(/class="result__a"[^>]*href="([^"]+)"/g)].map((m) => {
    const u = m[1].replace(/&amp;/g, "&");
    const real = u.match(/uddg=([^&]+)/);
    return real ? decodeURIComponent(real[1]) : u;
  }) : [];
  if (!links.length) {
    const bing = await html(`https://www.bing.com/search?q=${encodeURIComponent(q)}`);
    links = bing ? [...bing.text.matchAll(/<li class="b_algo"[\s\S]*?<a[^>]+href="(https?:[^"]+)"/g)].map((m) => m[1].replace(/&amp;/g, "&")) : [];
  }
  return [...new Set(links.filter((u) => /^https?:/.test(u) && !SKIP.test(u)))].slice(0, 10);
}
function meta(h, prop) {
  const m = h.match(new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]*content=["']([^"']+)["']`, "i"))
    || h.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']${prop}["']`, "i"));
  return m ? m[1].replace(/&amp;/g, "&") : "";
}
const ogImage = (h) => meta(h, "og:image:secure_url") || meta(h, "og:image") || meta(h, "twitter:image") || meta(h, "twitter:image:src");

let nImg = 0;
async function thumb(url, file) {
  const r = await get(url, 15000);
  if (!r || !r.ok || !/^image\//.test(r.headers.get("content-type") || "")) return null;
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length < 8000) return null;
  const tmp = `/tmp/img${++nImg}`;
  await writeFile(tmp, buf);
  try {
    const [w, h] = execFileSync("identify", ["-format", "%w %h\n", `${tmp}[0]`]).toString().trim().split("\n")[0].split(" ").map(Number);
    execFileSync("convert", [`${tmp}[0]`, "-resize", "420x420>", "-quality", "72", file]);
    return { w, h, bytes: buf.length };
  } catch { return null; }
}

const out = [];
await mkdir("cand", { recursive: true });
const where = (p) => p.list === "villes" ? p.city || "" : p.arr ? "Paris" : (p.city || "Paris");

// Photos actuelles.
if (ONLY !== "missing") {
  const cur = places.filter((p) => p.photo && !p.removed);
  for (let i = 0; i < cur.length; i += 10) {
    await Promise.all(cur.slice(i, i + 10).map(async (p) => {
      const f = `cand/cur-${p.id}.jpg`;
      const t = await thumb(p.photo, f);
      out.push({ kind: "cur", id: p.id, name: p.name, where: where(p), photo: p.photo, file: t ? f : "", ...(t || {}) });
    }));
  }
  console.log(`${cur.length} photos actuelles téléchargées`);
}

// Candidates pour les fiches sans photo.
if (ONLY !== "current") {
  const miss = places.filter((p) => !p.photo && !p.removed && !p.closed);
  let n = 0;
  for (const p of miss) {
    n++;
    const name = p.name.replace(/\(.*?\)/g, "").trim();
    const nn = norm(name);
    const street = (p.address || "").replace(/,?\s*\d{5}.*$/, "").replace(/^\d+\s*(bis|ter)?\s*/i, "");
    const q = `${name} ${p.list === "villes" ? p.city || "" : "Paris"} ${street}`.replace(/\s+/g, " ").trim();
    const links = await results(q);
    const cands = [];
    for (const u of links.slice(0, 8)) {
      if (cands.length >= 4) break;
      const page = await html(u);
      if (!page) continue;
      const title = (page.text.match(/<title[^>]*>([^<]*)/i) || [])[1] || "";
      const h1 = ((page.text.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || [])[1] || "").replace(/<[^>]+>/g, " ");
      const head = norm(`${title} ${meta(page.text, "og:title")} ${h1}`);
      const slug = norm(decodeURIComponent(new URL(page.url).pathname + " " + new URL(page.url).hostname));
      if (nn.length < 3 || !(head.includes(nn) || slug.includes(nn))) continue;
      let img = ogImage(page.text);
      if (!img) continue;
      try { img = new URL(img, page.url).href; } catch { continue; }
      if (cands.some((c) => c.img === img)) continue;
      const f = `cand/new-${p.id}-${cands.length}.jpg`;
      const t = await thumb(img, f);
      if (!t || t.w < 300) continue;
      cands.push({ page: page.url, title: title.trim().slice(0, 140), img, file: f, ...t });
    }
    out.push({ kind: "new", id: p.id, name: p.name, where: where(p), address: p.address || "", q, links, cands });
    console.log(`${n}/${miss.length} ${p.name} : ${cands.length} candidates (${links.length} résultats)`);
    if (n % 20 === 0) await writeFile("cand/index.json", JSON.stringify(out, null, 1));
    await sleep(1500 + Math.random() * 1500);
  }
}
await writeFile("cand/index.json", JSON.stringify(out, null, 1));
