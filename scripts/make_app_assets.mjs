// Fabrique les images sources de l'appli iPhone / Android à partir de icons/logo.svg :
// assets/icon-only.png (1024 × 1024, sans transparence, exigé par Apple) et assets/splash*.png (écran de lancement).
// Puis « npm run icones » les décline dans toutes les tailles (dossiers ios/ et android/).
import sharp from "sharp";
import { mkdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const root = fileURLToPath(new URL("..", import.meta.url));
const BLEU = "#1d3b78";
const svg = readFileSync(join(root, "icons", "logo.svg"));
mkdirSync(join(root, "assets"), { recursive: true });

await sharp(svg, { density: 300 }).resize(1024, 1024).flatten({ background: BLEU }).png().toFile(join(root, "assets", "icon-only.png"));

const logo = await sharp(svg, { density: 300 }).resize(900, 900).png().toBuffer();
for (const name of ["splash.png", "splash-dark.png"]) {
  await sharp({ create: { width: 2732, height: 2732, channels: 3, background: BLEU } })
    .composite([{ input: logo, gravity: "center" }]).png().toFile(join(root, "assets", name));
}
console.log("assets/ prêt");
