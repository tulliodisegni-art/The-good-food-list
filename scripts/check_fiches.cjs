// Vérifie que TOUTES les fiches s'ouvrent sans erreur (lancé avant chaque mise en ligne).
// Sert l'appli en local, l'ouvre comme sur iPhone, ouvre chaque fiche une à une et échoue si l'une plante.
// Usage : node scripts/check_fiches.cjs   (PW=/chemin/vers/node_modules/playwright si besoin)
const http = require("http"), fs = require("fs"), path = require("path");
const { chromium, devices } = require(process.env.PW || "playwright");
const ROOT = path.resolve(__dirname, "..");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webmanifest": "application/manifest+json", ".woff2": "font/woff2" };
const server = http.createServer((req, res) => {
  let f = path.join(ROOT, decodeURIComponent(req.url.split("?")[0]));
  if (!f.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  if (f.endsWith("/")) f += "index.html";
  fs.readFile(f, (err, buf) => {
    if (err) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { "content-type": TYPES[path.extname(f)] || "application/octet-stream" }); res.end(buf);
  });
});
(async () => {
  await new Promise((r) => server.listen(0, r));
  const url = `http://localhost:${server.address().port}/`;
  const b = await chromium.launch();
  const ctx = await b.newContext({ ...devices["iPhone 13"] });
  await ctx.addInitScript(() => { localStorage.setItem("gate.goodfood.ok", "1"); });
  await ctx.route((u) => !u.href.startsWith(url), (r) => r.abort()); // pas besoin d'internet pour ce test
  const pg = await ctx.newPage();
  const errs = [];
  pg.on("pageerror", (e) => errs.push(e.message));
  await pg.goto(url, { waitUntil: "load" });
  await pg.waitForFunction(() => typeof S !== "undefined" && S.places && S.places.length > 0, null, { timeout: 30000 });
  await pg.waitForTimeout(1500);
  const res = await pg.evaluate(() => {
    const bad = [];
    for (const p of S.places) {
      try {
        openSheet(p.id);
        if ($("#sheet").hidden || !$("#sheetName")) throw new Error("fiche vide ou cachée");
        closeSheet();
      } catch (e) { bad.push(`${p.id} : ${e.message}`); }
    }
    return { n: S.places.length, bad };
  });
  // Et une vraie touche sur une ligne de la liste, comme sur le téléphone.
  const row = await pg.$("[data-id]");
  if (row) { await pg.evaluate(() => { const r = document.querySelector("[data-id]"); r.scrollIntoView(); r.click(); }); await pg.waitForTimeout(300);
    if (await pg.evaluate(() => $("#sheet").hidden)) res.bad.push("toucher une ligne de la liste n'ouvre pas la fiche"); }
  await b.close(); server.close();
  console.log(`${res.n} fiches ouvertes, ${res.bad.length} en erreur, ${errs.length} erreur(s) JavaScript.`);
  [...res.bad.slice(0, 30), ...errs.slice(0, 10)].forEach((l) => console.log("  ✗ " + l));
  process.exit(res.bad.length || errs.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
