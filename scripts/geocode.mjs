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
// Hors de France : OpenStreetMap (Nominatim), une requête par seconde.
const abroad = (p) => p.list === "villes" && p.city && p.city !== "Autour de Paris";
async function geocodeWorld(address, city) {
  const key = `w:${address}`;
  if (cache.has(key)) return cache.get(key);
  const q = address.toLowerCase().includes(city.toLowerCase().slice(0, 5)) ? address : `${address}, ${city}`;
  let res = null;
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`,
      { headers: { "user-agent": "TheGoodFoodList/1.0 (github.com/tulliodisegni-art/The-good-food-list)" } });
    const f = r.ok ? (await r.json())[0] : null;
    if (f) res = [+f.lat, +f.lon];
  } catch { /* réessayé au prochain passage */ }
  cache.set(key, res);
  await new Promise((r) => setTimeout(r, 1100));
  return res;
}

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
  // Une adresse sans numéro ni rue (juste un quartier ou une ville) placerait le pin au hasard.
  if (abroad(p) && !/\d/.test(p.address)) continue;
  const c = abroad(p) ? await geocodeWorld(p.address, p.city) : await geocode(p.address);
  if (c) { [p.lat, p.lng] = c.map((x) => Math.round(x * 1e6) / 1e6); found++; } else missing.push(`${p.name} (${p.address})`);
  await new Promise((r) => setTimeout(r, 40));
}
await writeFile(FILE, JSON.stringify(places, null, 1));
console.log(`${found} adresses géolocalisées, ${missing.length} introuvables`);
if (missing.length) console.log(missing.join("\n"));
