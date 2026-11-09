// Good Food : fonction « trafic » (Supabase Edge Function).
// Trafic en direct via TomTom (secret TOMTOM_API_KEY, offre gratuite). La clé reste ici, jamais dans l'appli.
//  - POST {from:{lat,lng}, to:{lat,lng}} → temps en voiture avec les bouchons du moment + itinéraire bis.
//  - GET ?z=&x=&y= → tuile de la carte du trafic (routes colorées selon les bouchons).
const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "apikey, authorization, content-type, x-client-info",
  "access-control-allow-methods": "GET, POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "content-type": "application/json" } });
const num = (v: unknown, min: number, max: number) => typeof v === "number" && isFinite(v) && v >= min && v <= max;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const key = Deno.env.get("TOMTOM_API_KEY");
  if (!key) return json({ error: "pas de clé trafic" }, 503);
  try {
    if (req.method === "GET") {
      const u = new URL(req.url);
      const z = +u.searchParams.get("z")!, x = +u.searchParams.get("x")!, y = +u.searchParams.get("y")!;
      if (![z, x, y].every(Number.isInteger) || z < 6 || z > 18 || x < 0 || y < 0 || x >= 2 ** z || y >= 2 ** z) return json({ error: "tuile invalide" }, 400);
      const r = await fetch(`https://api.tomtom.com/traffic/map/4/tile/flow/relative0/${z}/${x}/${y}.png?key=${key}&tileSize=256`);
      return new Response(r.body, { status: r.status, headers: { ...cors, "content-type": "image/png", "cache-control": "public, max-age=120" } });
    }
    if (req.method !== "POST") return json({ error: "méthode" }, 405);
    const { from, to } = await req.json();
    if (!from || !to || !num(from.lat, -90, 90) || !num(from.lng, -180, 180) || !num(to.lat, -90, 90) || !num(to.lng, -180, 180)) return json({ error: "requête invalide" }, 400);
    const r = await fetch(`https://api.tomtom.com/routing/1/calculateRoute/${from.lat},${from.lng}:${to.lat},${to.lng}/json?key=${key}&traffic=true&travelMode=car&maxAlternatives=1&computeTravelTimeFor=all&routeType=fastest&language=fr-FR`);
    const res = await r.json().catch(() => ({}));
    if (!r.ok) return json({ error: res?.detailedError?.message || res?.error?.description || `erreur ${r.status}` }, 502);
    const routes = (res.routes || []).map((rt: any) => ({
      min: rt.summary.travelTimeInSeconds / 60,
      free: (rt.summary.noTrafficTravelTimeInSeconds ?? rt.summary.travelTimeInSeconds) / 60,
      delay: (rt.summary.trafficDelayInSeconds || 0) / 60,
      km: rt.summary.lengthInMeters / 1000,
      geo: { type: "LineString", coordinates: rt.legs.flatMap((l: any) => l.points.map((p: any) => [p.longitude, p.latitude])) },
    }));
    return json({ routes });
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
