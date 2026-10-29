// Garde l'appli disponible hors connexion. Les données sont rafraîchies dès que le réseau répond.
const CACHE = "gfl-v17";
const SHELL = ["./", "index.html", "style.css", "app.js", "extras.js", "manifest.webmanifest", "data/places.json", "icons/icon-192.png", "vendor/leaflet/leaflet.js", "vendor/leaflet/leaflet.css", "vendor/markercluster/leaflet.markercluster.js", "vendor/markercluster/MarkerCluster.css", "vendor/markercluster/MarkerCluster.Default.css", "vendor/anthropic/anthropic.mjs", "vendor/protomaps/protomaps-leaflet.js"];

const TILES = "gfl-tiles-v1";
let trimming = false;
async function trim(c) {
  if (trimming) return; trimming = true;
  const keys = await c.keys();
  for (const k of keys.slice(0, Math.max(0, keys.length - 3000))) await c.delete(k);
  trimming = false;
}
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE && k !== TILES).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  // Le plan de Paris est lu par morceaux (requêtes Range) : on le laisse au navigateur.
  if (url.pathname.endsWith(".pmtiles")) return;
  // Fond de carte : gardé sur le téléphone, la carte s'affiche aussitôt les fois suivantes.
  if (/basemaps\.cartocdn\.com|tile\.openstreetmap\.org|arcgisonline\.com/.test(url.host)) {
    e.respondWith(caches.open(TILES).then((c) => c.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
      if (res.ok || res.type === "opaque") { c.put(e.request, res.clone()); trim(c); }
      return res;
    }))));
    return;
  }
  const sameOrigin = url.origin === location.origin;
  const isLib = /unpkg\.com|fonts\.(googleapis|gstatic)\.com/.test(url.host);
  if (!sameOrigin && !isLib) return;
  e.respondWith(
    fetch(e.request).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
      return res;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
