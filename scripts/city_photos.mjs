// Cherche des photos libres de droits (Wikimedia Commons) pour l'ambiance de chaque ville.
// Les candidates sont déposées sur la branche "photos" pour être choisies à la main.
import { writeFile, mkdir } from "node:fs/promises";
const Q = {
  paris: ["Paris café terrace street", "Paris Haussmann boulevard evening", "Paris bistro terrasse", "Montmartre street café"],
  newyork: ["New York street restaurant evening", "Manhattan skyline sunset", "Brooklyn brownstone street", "West Village street New York"],
  telaviv: ["Tel Aviv Rothschild Boulevard", "Tel Aviv beach promenade sunset", "Jaffa port restaurant", "Tel Aviv Bauhaus street"],
  jerusalem: ["Jerusalem Mahane Yehuda market night", "Jerusalem old city street", "Jerusalem stone street evening", "Jerusalem Mamilla"],
  nuit: ["Paris night street lights", "Paris restaurant night interior", "Paris Opera night"],
};
const api = (p) => `https://commons.wikimedia.org/w/api.php?format=json&origin=*&${p}`;
const UA = { "user-agent": "TheGoodFoodList/1.0 (github.com/tulliodisegni-art/The-good-food-list)" };
const credits = [];
for (const [city, qs] of Object.entries(Q)) {
  await mkdir(`photos/${city}`, { recursive: true });
  let n = 0; const seen = new Set();
  for (const q of qs) {
    const r = await fetch(api(`action=query&generator=search&gsrnamespace=6&gsrlimit=12&gsrsearch=${encodeURIComponent(q + " filetype:bitmap")}&prop=imageinfo&iiprop=url|size|extmetadata&iiurlwidth=1280`), { headers: UA });
    const pages = Object.values((await r.json()).query?.pages || {}).sort((a, b) => a.index - b.index);
    for (const p of pages) {
      const ii = p.imageinfo?.[0]; if (!ii || seen.has(p.title)) continue;
      if (ii.width < 1600 || ii.width < ii.height) continue; // paysage, bonne définition
      const lic = ii.extmetadata?.LicenseShortName?.value || "";
      if (!/CC BY|CC0|Public domain/i.test(lic) || /NC|ND/.test(lic)) continue;
      seen.add(p.title);
      const img = await fetch(ii.thumburl, { headers: UA });
      if (!img.ok) continue;
      n++; const file = `photos/${city}/${String(n).padStart(2, "0")}.jpg`;
      await writeFile(file, Buffer.from(await img.arrayBuffer()));
      const artist = (ii.extmetadata?.Artist?.value || "").replace(/<[^>]+>/g, "").trim();
      credits.push({ file, title: p.title, page: ii.descriptionurl, license: lic, artist });
      if (n >= 10) break;
    }
    if (n >= 10) break;
  }
  console.log(city, n);
}
await writeFile("photos/credits.json", JSON.stringify(credits, null, 1));
