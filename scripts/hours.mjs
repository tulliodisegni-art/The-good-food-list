// Horaires d'ouverture et lieux fermés définitivement, cherchés sur le web par l'IA (fonction « ia » de Supabase, gratuite).
// Complète ce qu'OpenStreetMap n'a pas (scripts/osm.mjs passe avant). Un petit lot par passage, pour rester dans le quota gratuit :
// chaque lieu est revu au plus une fois par mois, et ses horaires trouvés sur le web sont revérifiés tous les 4 mois.
// « Fermé définitivement » n'est noté que si l'IA donne une source ; dans l'appli, on peut retirer le badge d'un geste.
import { readFile, writeFile } from "node:fs/promises";
import { cleanWeek } from "./oh.mjs";

const FILE = new URL("../data/places.json", import.meta.url);
const places = JSON.parse(await readFile(FILE, "utf8"));
const conf = JSON.parse(await readFile(new URL("../data/config.json", import.meta.url), "utf8")).avis || {};
const MAX = +process.env.HOURS_MAX || 12; // appels à l'IA par passage
const PER = 5; // lieux par appel
const DAY = 86400000;
const today = new Date().toISOString().slice(0, 10);
const age = (d) => (d ? (Date.now() - Date.parse(d)) / DAY : Infinity);
if (!conf.url || !conf.key) { console.log("Horaires : fonction ia non configurée"); process.exit(0); }

// Les lieux sans horaires d'abord (restos de Paris en tête), puis ceux dont les horaires du web sont anciens.
const todo = places
  .filter((p) => p.list !== "pending" && p.name && age(p.ohTry) > 30 && (!p.oh || (p.ohSrc === "web" && age(p.ohAt) > 120)))
  .sort((a, b) => (!!a.oh - !!b.oh) || ((a.list === "villes") - (b.list === "villes")) || (age(b.ohTry) - age(a.ohTry)))
  .slice(0, MAX * PER);

async function ask(batch) {
  const items = batch.map((p) => ({
    id: p.id, nom: p.name, type: p.cat || "",
    lieu: p.list === "villes" ? p.city || "" : p.arr ? `Paris ${p.arr}e` : "Paris / Île-de-France",
    adresse: p.address || "", site: p.website || "", instagram: p.instagram || "",
  }));
  const prompt = `Pour chaque lieu ci-dessous (restaurants, bars, sorties), cherche sur le web ses horaires d'ouverture actuels et s'il est fermé définitivement.
Règles strictes :
- Vérifie que c'est bien CE lieu (même nom, même adresse ou arrondissement). Au moindre doute, laisse vide. N'invente jamais.
- "horaires" : 7 éléments, du lundi au dimanche. Chaque élément liste les créneaux au format 24 h "HH:MM-HH:MM", séparés par une virgule (ex. "12:00-14:30,19:00-22:30"). "" = fermé ce jour-là. Si l'heure de fermeture est après minuit, écris-la telle quelle (ex. "19:00-02:00"). Si tu ne trouves pas d'horaires fiables, renvoie [].
- "ferme_definitivement" : true UNIQUEMENT si une source récente dit clairement que le lieu a fermé pour de bon (Google « Fermé définitivement », article, annonce du lieu). Une fermeture pour congés ou travaux ne compte pas.
- "source" : le lien de la page qui prouve la fermeture définitive, sinon "".
Lieux :
${JSON.stringify(items, null, 1)}
Réponds uniquement avec un tableau JSON, un objet par lieu : [{"id": "", "horaires": [], "ferme_definitivement": false, "source": ""}]`;
  const r = await fetch(`${conf.url}/functions/v1/ia`, {
    method: "POST",
    headers: { apikey: conf.key, "content-type": "application/json" },
    body: JSON.stringify({ prompt, web: true }),
  });
  const out = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(out.error || `erreur ${r.status}`);
  const t = String(out.text || "");
  return JSON.parse(t.slice(t.indexOf("["), t.lastIndexOf("]") + 1));
}

let calls = 0, found = 0, closed = 0;
for (let i = 0; i < todo.length && calls < MAX; i += PER) {
  const batch = todo.slice(i, i + PER);
  calls++;
  let res;
  try { res = await ask(batch); } catch (e) { console.log(`Horaires : ${e.message}`); if (/quota|429|limit/i.test(e.message)) break; continue; }
  for (const p of batch) {
    p.ohTry = today;
    const r = (Array.isArray(res) ? res : []).find((x) => x && x.id === p.id);
    if (!r) continue;
    const week = cleanWeek(r.horaires);
    if (week && p.ohSrc !== "osm") { p.oh = week; p.ohSrc = "web"; p.ohAt = today; found++; }
    if (r.ferme_definitivement === true && /^https?:\/\//.test(r.source || "")) {
      if (!p.closed) closed++;
      p.closed = 1; p.closedSrc = r.source;
    } else if (r.ferme_definitivement === false && week && p.closed) { delete p.closed; delete p.closedSrc; }
  }
  await writeFile(FILE, JSON.stringify(places, null, 1));
}
console.log(`Horaires : ${found} trouvés, ${closed} lieux fermés définitivement (${calls} appels, ${todo.length} lieux en attente)`);
