// Ajoute les coordonnées manquantes à data/places.json avant la mise en ligne.
// Les pins sont ainsi déjà placés à l'ouverture de l'appli.
import { readFile, writeFile } from "node:fs/promises";

const FILE = new URL("../data/places.json", import.meta.url);
const places = JSON.parse(await readFile(FILE, "utf8"));
const sources = [
  (q) => `https://data.geopf.fr/geocodage/search?q=${encodeURIComponent(q)}&limit=1`,
  (q) => `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(q)}&limit=1`,
];
const cache = new Map();

async function geocode(address) {
  if (cache.has(address)) return cache.get(address);
  for (const url of sources) {
    try {
      const r = await fetch(url(address));
      if (!r.ok) continue;
      const f = (await r.json()).features?.[0];
      const res = f && f.properties.score >= 0.45 ? [f.geometry.coordinates[1], f.geometry.coordinates[0]] : null;
      cache.set(address, res);
      return res;
    } catch { /* service suivant */ }
  }
  return null;
}

let found = 0, missing = [];
for (const p of places) {
  if (p.lat || !p.address) continue;
  const c = await geocode(p.address);
  if (c) { [p.lat, p.lng] = c.map((x) => Math.round(x * 1e6) / 1e6); found++; } else missing.push(`${p.name} (${p.address})`);
  await new Promise((r) => setTimeout(r, 40));
}
await writeFile(FILE, JSON.stringify(places, null, 1));
console.log(`${found} adresses géolocalisées, ${missing.length} introuvables`);
if (missing.length) console.log(missing.join("\n"));
