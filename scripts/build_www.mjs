// Prépare le dossier www/ que Capacitor met dans l'appli iPhone / Android :
// une copie des fichiers de l'appli web (sans les scripts, les notes ni les outils).
// Usage : node scripts/build_www.mjs   (puis « npx cap sync »)
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const out = join(root, "www");
rmSync(out, { recursive: true, force: true });
mkdirSync(out);

// Fichiers à la racine : la page, les scripts et les styles de l'appli.
const skip = new Set(["sw.js", "package.json", "package-lock.json", "capacitor.config.json"]);
for (const f of readdirSync(root)) {
  if (skip.has(f)) continue;
  if (/\.(html|js|css|webmanifest)$/.test(f)) cpSync(join(root, f), join(out, f));
}
for (const d of ["icons", "images", "vendor"]) cpSync(join(root, d), join(out, d), { recursive: true });

// La liste livrée avec l'appli (secours hors connexion ; l'appli prend la version à jour sur le site).
mkdirSync(join(out, "data"));
for (const f of ["places.json", "config.json"]) cpSync(join(root, "data", f), join(out, "data", f));

// Réglages propres à l'appli installée : notifications Android seulement si Firebase est configuré.
const fcm = existsSync(join(root, "android", "app", "google-services.json"));
const page = join(out, "index.html");
const html = readFileSync(page, "utf8");
const tag = '<script src="native.js"></script>';
if (!html.includes(tag)) throw new Error("index.html doit charger native.js");
writeFileSync(page, html.replace(tag, `<script>window.GF_NATIVE_CFG=${JSON.stringify({ fcm })};</script>${tag}`));

console.log(`www/ prêt (notifications Android : ${fcm ? "oui" : "non, pas de google-services.json"})`);
