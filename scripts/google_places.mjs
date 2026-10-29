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
  "places.websiteUri", "places.googleMapsUri", "places.photos", "places.priceLevel",
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

// Un lot par passage (chaque jour) pour rester dans le quota gratuit mensuel de Google.
const MAX = +process.env.GOOGLE_PLACES_MAX || 120;
let n = 0, failed = 0, asked = 0;
for (const p of places) {
  if (p.gid || p.gChecked) continue;
  if (asked++ >= MAX) break;
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
    // Le niveau de prix Google remplace l'estimation, pas un budget choisi à la main.
    const lvl = { PRICE_LEVEL_INEXPENSIVE: 1, PRICE_LEVEL_MODERATE: 2, PRICE_LEVEL_EXPENSIVE: 3, PRICE_LEVEL_VERY_EXPENSIVE: 4 }[g.priceLevel];
    if (lvl && p.priceSrc !== "moi") { p.price = lvl; p.priceSrc = "google"; }
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
const left = places.filter((p) => !p.gid && !p.gChecked).length;
console.log(`${n} fiches complétées avec Google Places, ${left} restantes pour les prochains jours`);
