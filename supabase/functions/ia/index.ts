// Good Food : fonction « ia » (Supabase Edge Function).
// Elle garde la clé Anthropic côté serveur (secret ANTHROPIC_API_KEY) : l'appli n'a plus besoin de clé.
// Sert à lire un lien ou une capture pour remplir une fiche, et à comprendre une « envie ».
const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "apikey, authorization, content-type, x-client-info",
  "access-control-allow-methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "content-type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST attendu" }, 405);
  try {
    const { prompt, images = [], web = true } = await req.json();
    // Garde-fous : un texte raisonnable, au plus 6 images.
    if (typeof prompt !== "string" || !prompt || prompt.length > 30000 || !Array.isArray(images) || images.length > 6) {
      return json({ error: "requête invalide" }, 400);
    }
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
      if (!r.ok) return json({ error: res?.error?.message || "erreur de l'IA", status: r.status }, 502);
      if (res.stop_reason !== "pause_turn") break;
      messages.push({ role: "assistant", content: res.content });
    }
    if (res.stop_reason === "refusal") return json({ error: "l'IA n'a pas pu lire ce contenu" }, 422);
    const text = res.content.filter((b: any) => b.type === "text").map((b: any) => b.text).join("");
    return json({ text });
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
