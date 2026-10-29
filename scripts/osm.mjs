// Complète téléphones et sites web avec OpenStreetMap (données libres) :
// on cherche le resto du même nom à moins de 200 m de son adresse.
import { readFile, writeFile } from "node:fs/promises";

const FILE = new URL("../data/places.json", import.meta.url);
const places = JSON.parse(await readFile(FILE, "utf8"));

const QUERY = `[out:json][timeout:180];
area["name"="Paris"]["admin_level"="8"]->.a;
nwr(area.a)["amenity"~"^(restaurant|cafe|bar|pub|fast_food|ice_cream|nightclub|biergarten)$"]["name"];
out center tags;`;

let elements = [];
for (const host of ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"]) {
  try {
    const r = await fetch(host, { method: "POST", body: new URLSearchParams({ data: QUERY }), headers: { "user-agent": "GoodFoodList/1.0" } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    elements = (await r.json()).elements || [];
    break;
  } catch (e) { console.log(`OpenStreetMap indisponible (${host}) : ${e.message}`); }
}
if (!elements.length) process.exit(0);

const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
  .replace(/\b(le|la|les|l|the|chez|restaurant|resto|cafe|bar|paris)\b/g, " ").replace(/[^a-z0-9]+/g, " ").trim();
const dist = (a, b) => Math.hypot((a.lat - b.lat) * 111320, (a.lng - b.lng) * 111320 * Math.cos((a.lat * Math.PI) / 180));

const osm = elements.map((e) => ({
  n: norm(e.tags.name), lat: e.lat ?? e.center?.lat, lng: e.lon ?? e.center?.lon,
  phone: e.tags.phone || e.tags["contact:phone"], website: e.tags.website || e.tags["contact:website"],
})).filter((o) => o.n && o.lat);

function frPhone(raw) {
  let d = String(raw || "").split(/[;,]/)[0].replace(/[^\d+]/g, "");
  if (d.startsWith("0033")) d = "+33" + d.slice(4);
  if (/^\+33[1-9]\d{8}$/.test(d)) d = "0" + d.slice(3);
  return /^0[1-9]\d{8}$/.test(d) ? d.replace(/(\d{2})(?=\d)/g, "$1 ") : null;
}

let phones = 0, sites = 0;
for (const p of places) {
  if (!p.lat || (p.phone && p.website)) continue;
  const n = norm(p.name);
  if (n.length < 3) continue;
  const match = osm
    .filter((o) => (o.n === n || (n.length >= 5 && o.n.includes(n)) || (o.n.length >= 5 && n.includes(o.n))) && dist(o, p) < 200)
    .sort((a, b) => dist(a, p) - dist(b, p))[0];
  if (!match) continue;
  const tel = !p.phone && frPhone(match.phone);
  if (tel) { p.phone = tel; phones++; }
  if (!p.website && /^https?:\/\//.test(match.website || "")) { p.website = match.website; sites++; p.enriched = 0; }
}
await writeFile(FILE, JSON.stringify(places, null, 1));
console.log(`OpenStreetMap : ${phones} téléphones et ${sites} sites web ajoutés (${osm.length} lieux lus)`);
