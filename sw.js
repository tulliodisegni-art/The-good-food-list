// Garde l'appli disponible hors connexion et l'ouvre tout de suite : les fichiers de l'appli viennent du téléphone
// et se mettent à jour en arrière-plan (la nouvelle version sert à l'ouverture suivante ; une nouvelle version du
// service worker recharge tout d'un coup). La liste des adresses, elle, est toujours redemandée au serveur.
const CACHE = "gfl-v58";
const SHELL = ["./", "index.html", "native.js", "style.css", "plus.js", "plus.css", "app.js", "extras.js", "social.js", "gate.js", "account.js", "vendor/supabase.js", "home.js", "home.css", "images/cities/paris.jpg", "images/cities/nuit.jpg", "manifest.webmanifest", "data/places.json", "icons/icon-192.png", "icons/favicon.svg", "vendor/leaflet/leaflet.js", "vendor/leaflet/leaflet.css", "vendor/markercluster/leaflet.markercluster.js", "vendor/markercluster/MarkerCluster.css", "vendor/markercluster/MarkerCluster.Default.css", "vendor/anthropic/anthropic.mjs", "vendor/protomaps/protomaps-leaflet.js"];

self.addEventListener("install", (e) => {
  // « reload » : on prend les fichiers sur le serveur, pas dans le cache du navigateur.
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: "reload" })))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE && k !== "gfl-tuiles").map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  // Le plan de Paris est lu par morceaux (requêtes Range) : on le laisse au navigateur.
  if (url.pathname.endsWith(".pmtiles")) return;
  // Fonds de carte : gardés sur le téléphone, la carte s'affiche tout de suite les fois suivantes.
  if (/basemaps\.cartocdn\.com|tile\.openstreetmap\.org|arcgisonline\.com/.test(url.host)) {
    e.respondWith(caches.open("gfl-tuiles").then((c) => c.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
      if (res.ok || res.type === "opaque") c.put(e.request, res.clone());
      return res;
    }))));
    return;
  }
  const sameOrigin = url.origin === location.origin;
  const isLib = /unpkg\.com|fonts\.(googleapis|gstatic)\.com/.test(url.host);
  if (!sameOrigin && !isLib) return;
  // « no-cache » : on redemande toujours au serveur si le fichier a changé (sinon le téléphone garde l'ancienne version 10 min).
  // (Une page ouverte depuis l'écran d'accueil ne peut pas être recopiée telle quelle : on la redemande par son adresse.)
  const req = () => (!sameOrigin ? e.request : e.request.mode === "navigate" ? new Request(url.href, { cache: "no-cache", credentials: "same-origin" }) : new Request(e.request, { cache: "no-cache" }));
  const net = () => fetch(req()).then((res) => {
    if (res.ok && !(e.request.mode === "navigate" && url.search)) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
    return res;
  });
  // Données (adresses, réglages) : le réseau d'abord, le cache seulement hors connexion.
  if (sameOrigin && url.pathname.includes("/data/")) {
    e.respondWith(net().catch(() => caches.match(e.request, { ignoreSearch: true })));
    return;
  }
  // Fichiers de l'appli et polices : tout de suite depuis le téléphone, mis à jour en arrière-plan.
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then((hit) => {
    const update = net();
    if (hit) { e.waitUntil(update.catch(() => {})); return hit; }
    return update;
  }).catch(() => net()));
});
