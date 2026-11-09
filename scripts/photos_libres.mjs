// Photos libres de droits pour les fiches qui n'en ont toujours pas : Wikimedia Commons, photos prises à moins de 50 m
// du lieu dont le nom de fichier contient le nom du lieu (ex. « Le Train Bleu, Gare de Lyon.jpg »). Gratuit, sans clé.
// Chaque lieu n'est cherché qu'une fois tous les deux mois.
import { readFile, writeFile } from "node:fs/promises";

const FILE = new URL("../data/places.json", import.meta.url);
const places = JSON.parse(await readFile(FILE, "utf8"));
const UA = { "user-agent": "TheGoodFoodList/1.0 (github.com/tulliodisegni-art/The-good-food-list)" };
const today = new Date().toISOString().slice(0, 10);
const old = (d) => !d || Date.now() - Date.parse(d) > 60 * 86400000;
const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
  .replace(/\b(le|la|les|l|the|chez|restaurant|resto|cafe|bar|paris)\b/g, " ").replace(/[^a-z0-9]+/g, "");

let found = 0, tried = 0;
for (const p of places) {
  if (p.photo || !p.lat || !old(p.commonsTry)) continue;
  const n = norm(p.name.replace(/\(.*\)/, ""));
  if (n.length < 5) continue;
  tried++;
  p.commonsTry = today;
  try {
    const u = `https://commons.wikimedia.org/w/api.php?action=query&format=json&list=geosearch&gscoord=${p.lat}|${p.lng}&gsradius=50&gslimit=50&gsnamespace=6`;
    const r = await fetch(u, { headers: UA });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const files = ((await r.json()).query?.geosearch || []).map((g) => g.title.replace(/^File:/, ""))
      .filter((t) => /\.(jpe?g|png|webp)$/i.test(t) && norm(t).includes(n) && !/logo|map|plan|carte|menu|sign|enseigne/i.test(t));
    if (files.length) {
      p.photo = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(files[0].replace(/ /g, "_"))}?width=1200`;
      p.photoSrc = "commons"; found++;
    }
  } catch (e) { console.log(`Commons : ${e.message}`); break; }
  await new Promise((r) => setTimeout(r, 250));
}
await writeFile(FILE, JSON.stringify(places, null, 1));
console.log(`Photos libres (Wikimedia Commons) : ${found} trouvées sur ${tried} lieux cherchés`);
