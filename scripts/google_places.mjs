// Complète les fiches avec Google Places (photo, téléphone, horaires, note Google).
// Ne tourne que si le secret GOOGLE_PLACES_KEY est défini sur le dépôt.
import { readFile, writeFile } from "node:fs/promises";

const KEY = process.env.GOOGLE_PLACES_KEY;
if (!KEY) { console.log("Pas de clé Google Places : étape ignorée."); process.exit(0); }

const FILE = new URL("../data/places.json", import.meta.url);
const places = JSON.parse(await readFile(FILE, "utf8"));
const FIELDS = [
  "places.id", "places.displayName", "places.formattedAddress", "places.location", "places.nationalPhoneNumber",
  "places.regularOpeningHours.weekdayDescriptions", "places.rating", "places.userRatingCount",
  "places.websiteUri", "places.googleMapsUri", "places.photos",
].join(",");

async function search(p) {
  const city = p.city || "Paris";
  const r = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: { "content-type": "application/json", "X-Goog-Api-Key": KEY, "X-Goog-FieldMask": FIELDS },
    body: JSON.stringify({
      textQuery: `${p.name} ${p.address || city}`, languageCode: "fr", maxResultCount: 1,
      ...(p.lat ? { locationBias: { circle: { center: { latitude: p.lat, longitude: p.lng }, radius: 300 } } } : {}),
    }),
  });
  if (!r.ok) throw new Error(`Google Places ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return (await r.json()).places?.[0] || null;
}

async function photoUri(name) {
  const r = await fetch(`https://places.googleapis.com/v1/${name}/media?maxWidthPx=1000&skipHttpRedirect=true&key=${KEY}`);
  return r.ok ? (await r.json()).photoUri : null;
}

let n = 0, failed = 0;
for (const p of places) {
  if (p.gid || p.gChecked) continue;
  try {
    const g = await search(p);
    p.gChecked = true;
    if (!g) continue;
    p.gid = g.id;
    if (g.nationalPhoneNumber && !p.phone) p.phone = g.nationalPhoneNumber;
    if (g.regularOpeningHours?.weekdayDescriptions && !p.hours) p.hours = g.regularOpeningHours.weekdayDescriptions.join(" · ");
    if (g.rating) p.gRating = g.rating.toFixed(1).replace(".", ",");
    if (g.websiteUri && !p.website) p.website = g.websiteUri;
    if (g.googleMapsUri) p.gmaps = g.googleMapsUri;
    if (!p.address && g.formattedAddress) p.address = g.formattedAddress;
    if (!p.lat && g.location) { p.lat = g.location.latitude; p.lng = g.location.longitude; }
    // La photo Google passe devant celle du site, sauf si une photo a été choisie à la main.
    if (g.photos?.[0] && !p.photoManual) { const u = await photoUri(g.photos[0].name); if (u) p.photo = u; }
    n++;
  } catch (e) {
    failed++;
    console.log(`${p.name} : ${e.message}`);
    if (failed > 10) break;
  }
}
await writeFile(FILE, JSON.stringify(places, null, 1));
console.log(`${n} fiches complétées avec Google Places`);
