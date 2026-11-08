// Good Food : fonction « ia » (Supabase Edge Function).
// Elle garde la clé de l'IA côté serveur (secret GEMINI_API_KEY, gratuit, ou ANTHROPIC_API_KEY) : l'appli n'a plus besoin de clé.
// Sert à lire un lien ou une capture pour remplir une fiche, et à comprendre une « envie ».
// Avec un « job », le résultat est aussi rangé dans la table « lectures » : si on quitte l'appli pendant la lecture,
// le travail continue et l'appli le récupère au retour.
const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "apikey, authorization, content-type, x-client-info",
  "access-control-allow-methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "content-type": "application/json" } });

async function get(url: string, ua: string, ms = 5000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { headers: { "user-agent": ua, "accept-language": "fr-FR,fr;q=0.9,en;q=0.8" }, redirect: "follow", signal: ctl.signal });
    return r.ok ? await r.text() : "";
  } catch { return ""; } finally { clearTimeout(t); }
}
const decode = (s: string) => s
  .replace(/&quot;/g, '"').replace(/&#039;|&#39;|&#x27;/g, "'").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d));
const meta = (html: string, prop: string) => {
  const m = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']*)["']`, "i"))
    || html.match(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${prop}["']`, "i"));
  return m ? decode(m[1]) : "";
};

// Récupère vite la légende d'une publication (Instagram, TikTok, Facebook, site) pour éviter une longue recherche web.
async function caption(link: string) {
  const bot = "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)";
  const out: string[] = [];
  const ig = link.match(/instagram\.com\/(?:[^/]+\/)?(p|reel|reels|tv)\/([\w-]+)/i);
  if (/tiktok\.com/i.test(link)) {
    const t = await get(`https://www.tiktok.com/oembed?url=${encodeURIComponent(link)}`, "Mozilla/5.0");
    try { const o = JSON.parse(t); if (o.title) out.push(`Compte : ${o.author_name || ""} (@${o.author_unique_id || ""})\n${o.title}`); } catch { /* rien */ }
  }
  const pages = ig
    ? [[`https://www.instagram.com/p/${ig[2]}/embed/captioned/`, "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)"], [`https://www.instagram.com/p/${ig[2]}/`, bot]]
    : out.length ? [] : [[link, bot]];
  const htmls = await Promise.all(pages.map(([u, ua]) => get(u, ua)));
  htmls.forEach((h) => {
    if (!h) return;
    const c = h.match(/class="Caption"[^>]*>([\s\S]*?)<div class="CaptionComments/);
    if (c) out.push(decode(c[1].replace(/<br\s*\/?>/g, "\n").replace(/<[^>]+>/g, " ")).replace(/[ \t]+/g, " ").trim());
    const d = [meta(h, "og:title"), meta(h, "og:description"), meta(h, "description")].filter(Boolean).join("\n");
    if (d && !/log ?in|connexion|se connecter/i.test(d.slice(0, 40))) out.push(d);
  });
  return [...new Set(out)].join("\n").slice(0, 4000);
}

async function gemini(key: string, prompt: string, images: string[], web: boolean) {
  const parts = [
    ...images.map((d) => ({ inline_data: { mime_type: "image/jpeg", data: String(d).replace(/^data:[^,]+,/, "") } })),
    { text: prompt },
  ];
  let last = "";
  // Le plus rapide d'abord (sans « réflexion »), puis d'autres modèles gratuits si quota atteint ou modèle retiré.
  const tries: [string, boolean, boolean][] = [
    ["gemini-2.5-flash", web, true], ["gemini-2.5-flash-lite", web, false], ["gemini-flash-latest", web, true],
    ["gemini-flash-lite-latest", web, false], ["gemini-2.5-flash-lite", false, false], ["gemini-flash-lite-latest", false, false],
  ];
  for (const [model, tools, fast] of tries) {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "x-goog-api-key": key, "content-type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        ...(tools ? { tools: [{ google_search: {} }, { url_context: {} }] } : {}),
        ...(fast ? { generationConfig: { thinkingConfig: { thinkingBudget: 0 } } } : {}),
      }),
    });
    const res = await r.json().catch(() => ({}));
    if (r.ok) return (res.candidates?.[0]?.content?.parts || []).map((p: any) => p.text || "").join("");
    last += `${tools ? "web" : "simple"} ${model} : ${res?.error?.message || `erreur ${r.status}`} | `;
    if (r.status === 401 || r.status === 403) throw new Error(last);
  }
  throw new Error(last);
}

async function claude(prompt: string, images: string[], web: boolean) {
  const content = [
    ...images.map((d: string) => ({
      type: "image",
      source: { type: "base64", media_type: "image/jpeg", data: String(d).replace(/^data:[^,]+,/, "") },
    })),
    { type: "text", text: prompt },
  ];
  const messages: unknown[] = [{ role: "user", content }];
  let res: any;
  // La recherche web peut demander plusieurs tours (pause_turn).
  for (let i = 0; i < 4; i++) {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": Deno.env.get("ANTHROPIC_API_KEY") ?? "",
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-opus-5-5",
        max_tokens: 8000,
        ...(web ? { tools: [
          { type: "web_search_20260209", name: "web_search", max_uses: 5 },
          { type: "web_fetch_20260209", name: "web_fetch", max_uses: 3 },
        ] } : {}),
        messages,
      }),
    });
    res = await r.json();
    if (!r.ok) throw Object.assign(new Error(res?.error?.message || "erreur de l'IA"), { status: r.status });
    if (res.stop_reason !== "pause_turn") break;
    messages.push({ role: "assistant", content: res.content });
  }
  if (res.stop_reason === "refusal") throw new Error("l'IA n'a pas pu lire ce contenu");
  return res.content.filter((b: any) => b.type === "text").map((b: any) => b.text).join("");
}

async function run(prompt: string, images: string[], web: boolean, link: string) {
  if (link) {
    const cap = await caption(link);
    if (cap) prompt += `\n\nLégende et infos récupérées automatiquement sur la publication (utilise-les en priorité, ne cherche sur le web que ce qui manque) :\n${cap}`;
  }
  const gkey = Deno.env.get("GEMINI_API_KEY");
  return gkey ? await gemini(gkey, prompt, images, web) : await claude(prompt, images, web);
}

async function save(job: string, text: string | null, error: string | null) {
  const url = Deno.env.get("SUPABASE_URL"), key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return;
  await fetch(`${url}/rest/v1/lectures`, {
    method: "POST",
    headers: { apikey: key, authorization: `Bearer ${key}`, "content-type": "application/json", prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({ id: job, text, error }),
  }).catch(() => {});
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST attendu" }, 405);
  try {
    const { prompt, images = [], web = true, link = "", job = "" } = await req.json();
    // Garde-fous : un texte raisonnable, au plus 6 images.
    if (typeof prompt !== "string" || !prompt || prompt.length > 30000 || !Array.isArray(images) || images.length > 6
      || typeof link !== "string" || link.length > 2000 || typeof job !== "string" || job.length > 64) {
      return json({ error: "requête invalide" }, 400);
    }
    const work = run(prompt, images, web, /^https?:\/\//.test(link) ? link : "");
    if (job) {
      // Le travail continue même si le téléphone coupe la connexion (appli quittée).
      const keep = work.then((t) => save(job, t, null), (e) => save(job, null, String(e?.message || e)));
      (globalThis as any).EdgeRuntime?.waitUntil?.(keep);
    }
    return json({ text: await work });
  } catch (e) {
    const st = (e as any)?.status;
    return json({ error: String((e as Error)?.message || e), ...(st ? { status: st } : {}) }, st ? 502 : 500);
  }
});
