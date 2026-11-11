// Temporaire : vérifie la liste d'adresses de Tel-Aviv avec la fonction « ia » (recherche Google).
import { readFile, writeFile } from "node:fs/promises";
const list = JSON.parse(await readFile(new URL("./tlv_list.json", import.meta.url), "utf8"));
const conf = JSON.parse(await readFile(new URL("../data/config.json", import.meta.url), "utf8")).avis;
const out = [];
const PER = 3;
for (let i = 0; i < list.length; i += PER) {
  const batch = list.slice(i, i + PER).map(([cat, nom, indice]) => ({ nom, indice, categorie_utilisateur: cat }));
  const prompt = `Tu vérifies des adresses de restaurants, cafés et bars à TEL-AVIV / JAFFA (Israël), pour un guide. Pour chaque lieu, cherche sur le web (Google Maps, site officiel, Instagram, Time Out, Rest.co.il, Wolt…).
Règles strictes : vérifie que c'est bien CE lieu à Tel-Aviv/Jaffa. N'invente jamais : au moindre doute, laisse le champ vide et explique dans "doute".
Champs :
- "nom" : nom officiel.
- "statut" : "ouvert", "ferme_definitivement", "ferme_temporairement" ou "inconnu".
- "adresses" : liste des adresses à Tel-Aviv/Jaffa (rue + numéro, quartier). Si c'est une chaîne avec plusieurs adresses à Tel-Aviv, mets-les toutes.
- "telephone" : format +972.
- "site" : site officiel.  "instagram" : compte officiel sans @.
- "reservation" : lien direct de réservation en ligne (Tabit, Ontopo, site…) ou "".
- "resa" : "en_ligne", "telephone", "sans" (pas de réservation) ou "".
- "menu" : lien vers le menu ou "".
- "cuisine" : type de cuisine en français (Israélien, Italien, Café, Bar à cocktails, Street food…).
- "prix" : 1 (pas cher) à 4 (très chic).
- "kasher" : true / false / null.
- "resume" : 1 à 2 phrases en français : ce qu'il faut y goûter et l'ambiance.
- "doute" : ce qui n'est pas sûr.
Lieux :
${JSON.stringify(batch, null, 1)}
Réponds uniquement avec un tableau JSON, un objet par lieu, dans le même ordre : [{"nom_demande":"","nom":"","statut":"","adresses":[],"telephone":"","site":"","instagram":"","reservation":"","resa":"","menu":"","cuisine":"","prix":0,"kasher":null,"resume":"","doute":""}]`;
  for (let t = 0; t < 2; t++) {
    try {
      const r = await fetch(`${conf.url}/functions/v1/ia`, { method: "POST", headers: { apikey: conf.key, "content-type": "application/json" }, body: JSON.stringify({ prompt, web: true }) });
      const j = await r.json();
      const m = String(j.text || "").match(/\[[\s\S]*\]/);
      const arr = JSON.parse(m[0]);
      arr.forEach((x, k) => out.push({ demande: list[i + k], ...x }));
      console.log("ok", i);
      break;
    } catch (e) { console.log("erreur", i, e.message); if (t) list.slice(i, i + PER).forEach((d) => out.push({ demande: d, erreur: e.message })); }
  }
}
await writeFile(new URL("./tlv_result.json", import.meta.url), JSON.stringify(out, null, 1));
