// Complète téléphones, sites web, horaires et photos avec OpenStreetMap (données libres) :
// on cherche le resto du même nom à moins de 200 m de son adresse.
import { readFile, writeFile } from "node:fs/promises";
import { parseOsmHours } from "./oh.mjs";

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
  instagram: (e.tags["contact:instagram"] || "").replace(/^https?:\/\/(www\.)?instagram\.com\//, "").replace(/^@/, "").split(/[/?]/)[0],
})).filter((o) => o.n && o.lat);

function frPhone(raw) {
  let d = String(raw || "").split(/[;,]/)[0].replace(/[^\d+]/g, "");
  if (d.startsWith("0033")) d = "+33" + d.slice(4);
  if (/^\+33[1-9]\d{8}$/.test(d)) d = "0" + d.slice(3);
  return /^0[1-9]\d{8}$/.test(d) ? d.replace(/(\d{2})(?=\d)/g, "$1 ") : null;
}

const today = new Date().toISOString().slice(0, 10);
// Photo libre du lieu : lien direct vers une image, ou fichier de Wikimedia Commons.
function osmPhoto(o) {
  if (/^https?:\/\/\S+\.(jpe?g|png|webp)(\?\S*)?$/i.test(o.image || "")) return o.image;
  const f = String(o.commons || (/^File:/i.test(o.image || "") ? o.image : "")).replace(/^File:/i, "").trim();
  return /\.(jpe?g|png|webp)$/i.test(f) ? `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(f.replace(/ /g, "_"))}?width=1200` : "";
}

let phones = 0, sites = 0, hours = 0, photos = 0;
for (const p of places) {
  if (!p.lat) continue;
  const n = norm(p.name);
  if (n.length < 3) continue;
  const match = osm
    .filter((o) => (o.n === n || (n.length >= 5 && o.n.includes(n)) || (o.n.length >= 5 && n.includes(o.n))) && dist(o, p) < 200)
    .sort((a, b) => dist(a, p) - dist(b, p))[0];
  if (!match) continue;
  // Horaires : OpenStreetMap est rafraîchi à chaque passage ; ceux trouvés sur le web ne sont pas écrasés.
  const oh = parseOsmHours(match.hours);
  if (oh && (!p.oh || p.ohSrc === "osm")) {
    if (JSON.stringify(oh) !== JSON.stringify(p.oh)) hours++;
    p.oh = oh; p.ohSrc = "osm"; p.ohAt = today;
  }
  const img = !p.photo && osmPhoto(match);
  if (img) { p.photo = img; photos++; }
  if (p.phone && p.website && p.instagram) continue;
  const tel = !p.phone && frPhone(match.phone);
  if (tel) { p.phone = tel; phones++; }
  if (!p.instagram && /^[A-Za-z0-9._]{2,30}$/.test(match.instagram)) p.instagram = match.instagram;
  if (!p.website && /^https?:\/\//.test(match.website || "")) { p.website = match.website; sites++; p.enriched = 0; }
}
await writeFile(FILE, JSON.stringify(places, null, 1));
console.log(`OpenStreetMap : ${phones} téléphones, ${sites} sites web, ${hours} horaires et ${photos} photos ajoutés (${osm.length} lieux lus)`);
