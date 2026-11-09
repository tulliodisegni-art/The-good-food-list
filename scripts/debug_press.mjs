import { readFile } from "node:fs/promises";
const places = JSON.parse(await readFile(new URL("../data/places.json", import.meta.url), "utf8"));
const conf = JSON.parse(await readFile(new URL("../data/config.json", import.meta.url), "utf8")).avis;
const batch = places.filter((p) => !p.photo && p.list !== "villes").slice(0, 6);
const items = batch.map((p) => ({ id: p.id, nom: p.name, type: p.cat || "", lieu: p.address || "Paris" }));
const prompt = `Pour chacun de ces lieux, cherche sur le web jusqu'à 3 pages consacrées à CE lieu précis avec une photo (article Le Fooding, Sortir à Paris, Time Out, Le Bonbon, TheFork, site officiel…). Donne l'URL exacte de la page. N'invente jamais d'URL.
Lieux :
${JSON.stringify(items, null, 1)}
Réponds uniquement avec un tableau JSON : [{"id": "", "pages": ["", ""]}]`;
const r = await fetch(`${conf.url}/functions/v1/ia`, { method: "POST", headers: { apikey: conf.key, "content-type": "application/json" }, body: JSON.stringify({ prompt, web: true }) });
const out = await r.json();
console.log(out.text || out);
const t = String(out.text || "");
const res = JSON.parse(t.slice(t.indexOf("["), t.lastIndexOf("]") + 1));
for (const x of res) for (const u of x.pages || []) {
  try {
    const p = await fetch(u, { redirect: "follow", headers: { "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15" }, signal: AbortSignal.timeout(12000) });
    const h = await p.text();
    console.log(p.status, p.url.slice(0, 100), "|", ((h.match(/<title[^>]*>([^<]*)/i) || [])[1] || "").slice(0, 80), "| og:", /og:image/i.test(h));
  } catch (e) { console.log("ERR", u.slice(0, 100), e.message); }
}
