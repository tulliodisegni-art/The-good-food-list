// Fonction Supabase « notifications » : envoie les notifications programmées des applis (Jobello, Good Food…)
// et fabrique les fichiers « Ajouter au calendrier ». Aucune dépendance : tout est fait avec WebCrypto.
// Réglage à faire une fois dans Supabase : désactiver « Verify JWT » pour cette fonction (voir NOTIFICATIONS.md).
//
// Trois façons d'envoyer, selon le téléphone enregistré dans push_subs.sub :
// - navigateur (Web Push, VAPID) : comme avant ;
// - { type: "apns", token } : iPhone avec l'appli de l'App Store. Secrets Supabase : APNS_KEY (contenu du fichier .p8),
//   APNS_KEY_ID, APNS_TEAM_ID, APNS_TOPIC (identifiant de l'appli, ex. fr.officinadisegni.goodfood) ;
// - { type: "fcm", token } : Android avec l'appli de Google Play. Secret Supabase : FCM_SERVICE_ACCOUNT (le fichier JSON du compte de service Firebase).
// Tant qu'un secret manque, les téléphones concernés sont simplement sautés (rien ne casse).

const SB_URL = Deno.env.get("SUPABASE_URL") || "https://vvxkkqcmjrwytagbxdfg.supabase.co";
const SB_KEY = "sb_publishable_A-kJQIoJXxdXmjHF8iM40g_RP6myhMo"; // clé publique : les fonctions serveur sont protégées par le code secret
const CONTACT = "https://tulliodisegni-art.github.io/Jobello/";
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "content-type, x-cron", "Access-Control-Allow-Methods": "GET, POST, OPTIONS" };

const rpc = async (fn: string, args: Record<string, unknown>) => {
  const r = await fetch(`${SB_URL}/rest/v1/rpc/${fn}`, { method: "POST", headers: { apikey: SB_KEY, "Content-Type": "application/json" }, body: JSON.stringify(args) });
  if (!r.ok) throw new Error(`${fn} : ${r.status} ${await r.text()}`);
  const t = await r.text(); return t ? JSON.parse(t) : null;
};

type Item = { key: string; kind: string; title: string; body: string; url: string; subs: { endpoint: string; sub: { endpoint?: string; type?: string; token?: string; keys?: { p256dh: string; auth: string } } }[] };

async function envoyer(secret: string) {
  let keys = await rpc("push_server_keys", { p_secret: secret });
  if (!keys.public) { const k = await generateVapid(); keys = await rpc("push_server_keys", { p_secret: secret, p_public: k.publicKey, p_private: k.privateJwk }); }
  const items = await rpc("push_server_due", { p_secret: secret }) as Item[];
  const gone: string[] = []; let ok = 0, ko = 0, sautees = 0;
  for (const it of items) {
    const payload = JSON.stringify({ title: it.title, body: it.body || "", url: it.url || "./", tag: it.key });
    for (const s of it.subs) {
      try {
        const st = s.sub.type === "apns" ? await sendApns(s.sub.token!, it)
          : s.sub.type === "fcm" ? await sendFcm(s.sub.token!, it)
          : await sendPush(s.sub as { endpoint: string; keys: { p256dh: string; auth: string } }, payload, { publicKey: keys.public, privateJwk: keys.private, subject: CONTACT });
        if (st === 0) sautees++;
        else if (st === 404 || st === 410) gone.push(s.endpoint); else if (st >= 200 && st < 300) ok++; else { ko++; console.log("refus", st, s.endpoint.slice(0, 40)); }
      } catch (e) { ko++; console.log("erreur", String(e)); }
    }
  }
  if (gone.length) await rpc("push_server_gone", { p_secret: secret, p_endpoints: gone });
  return { notifications: items.length, envoyees: ok, echecs: ko, sautees, appareils_retires: gone.length };
}

/* ---------- Web Push (RFC 8291 aes128gcm + VAPID RFC 8292), avec WebCrypto ---------- */
const te = new TextEncoder();
const b64u = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64u = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));
const cat = (...a: Uint8Array[]) => { const o = new Uint8Array(a.reduce((n, x) => n + x.length, 0)); let i = 0; for (const x of a) { o.set(x, i); i += x.length; } return o; };
const hkdf = async (salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, len: number) =>
  new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]), len * 8));

async function generateVapid() {
  const k = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  return { publicKey: b64u(new Uint8Array(await crypto.subtle.exportKey("raw", k.publicKey))), privateJwk: await crypto.subtle.exportKey("jwk", k.privateKey) };
}

async function encrypt(sub: { keys: { p256dh: string; auth: string } }, payload: Uint8Array) {
  const uaPub = unb64u(sub.keys.p256dh), auth = unb64u(sub.keys.auth);
  const as = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]) as CryptoKeyPair;
  const asPub = new Uint8Array(await crypto.subtle.exportKey("raw", as.publicKey));
  const ua = await crypto.subtle.importKey("raw", uaPub, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const secret = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: ua }, as.privateKey, 256));
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const ikm = await hkdf(auth, secret, cat(te.encode("WebPush: info\0"), uaPub, asPub), 32);
  const cek = await hkdf(salt, ikm, te.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, te.encode("Content-Encoding: nonce\0"), 12);
  const key = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, key, cat(payload, new Uint8Array([2]))));
  const head = new Uint8Array(21); head.set(salt, 0); new DataView(head.buffer).setUint32(16, 4096); head[20] = 65;
  return cat(head, asPub, ct);
}

async function vapid(endpoint: string, v: { publicKey: string; privateJwk: JsonWebKey; subject: string }) {
  const enc = (o: unknown) => b64u(te.encode(JSON.stringify(o)));
  const unsigned = enc({ typ: "JWT", alg: "ES256" }) + "." + enc({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: v.subject });
  const key = await crypto.subtle.importKey("jwk", v.privateJwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, te.encode(unsigned)));
  return `vapid t=${unsigned}.${b64u(sig)}, k=${v.publicKey}`;
}

async function sendPush(sub: { endpoint: string; keys: { p256dh: string; auth: string } }, text: string, v: { publicKey: string; privateJwk: JsonWebKey; subject: string }) {
  const body = await encrypt(sub, te.encode(text));
  const r = await fetch(sub.endpoint, { method: "POST", headers: { Authorization: await vapid(sub.endpoint, v), TTL: "86400", Urgency: "high", "Content-Encoding": "aes128gcm", "Content-Type": "application/octet-stream" }, body });
  await r.body?.cancel();
  return r.status;
}

/* ---------- Clés privées au format PEM (fichier .p8 d'Apple, compte de service Google) ---------- */
const pemToDer = (pem: string) => Uint8Array.from(atob(pem.replace(/-----[^-]+-----/g, "").replace(/\\n/g, "").replace(/\s/g, "")), (c) => c.charCodeAt(0));
const jwt = async (header: unknown, claims: unknown, key: CryptoKey, algo: AlgorithmIdentifier | EcdsaParams) => {
  const enc = (o: unknown) => b64u(te.encode(JSON.stringify(o)));
  const unsigned = enc(header) + "." + enc(claims);
  return unsigned + "." + b64u(new Uint8Array(await crypto.subtle.sign(algo, key, te.encode(unsigned))));
};

/* ---------- iPhone : Apple Push Notification service (HTTP/2, jeton ES256 valable 1 h) ---------- */
let apnsJwt: { v: string; at: number } | null = null;
async function apnsToken() {
  if (apnsJwt && Date.now() - apnsJwt.at < 45 * 60e3) return apnsJwt.v;
  const key = await crypto.subtle.importKey("pkcs8", pemToDer(Deno.env.get("APNS_KEY")!), { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const v = await jwt({ alg: "ES256", kid: Deno.env.get("APNS_KEY_ID") }, { iss: Deno.env.get("APNS_TEAM_ID"), iat: Math.floor(Date.now() / 1000) }, key, { name: "ECDSA", hash: "SHA-256" });
  apnsJwt = { v, at: Date.now() }; return v;
}
async function sendApns(token: string, it: Item, host = Deno.env.get("APNS_HOST") || "api.push.apple.com"): Promise<number> {
  if (!Deno.env.get("APNS_KEY") || !Deno.env.get("APNS_KEY_ID") || !Deno.env.get("APNS_TEAM_ID") || !Deno.env.get("APNS_TOPIC")) return 0;
  const r = await fetch(`https://${host}/3/device/${token}`, {
    method: "POST",
    headers: { authorization: "bearer " + await apnsToken(), "apns-topic": Deno.env.get("APNS_TOPIC")!, "apns-push-type": "alert", "apns-priority": "10", "apns-collapse-id": it.key.slice(0, 64) },
    body: JSON.stringify({ aps: { alert: { title: it.title, body: it.body || "" }, sound: "default" }, url: it.url || "", kind: it.kind }),
  });
  const reason = r.ok ? "" : ((await r.json().catch(() => ({}))) as { reason?: string }).reason || "";
  if (!r.ok) await r.body?.cancel().catch(() => {});
  // Appli installée depuis Xcode (pas TestFlight ni l'App Store) : le jeton est celui du serveur de test d'Apple.
  if (reason === "BadDeviceToken" && host === "api.push.apple.com" && !Deno.env.get("APNS_HOST")) return sendApns(token, it, "api.sandbox.push.apple.com");
  if (reason === "BadDeviceToken" || reason === "Unregistered") return 410;
  return r.status;
}

/* ---------- Android : Firebase Cloud Messaging (API v1, jeton OAuth du compte de service) ---------- */
let fcmAuth: { v: string; until: number; project: string } | null = null;
async function fcmToken() {
  if (fcmAuth && Date.now() < fcmAuth.until) return fcmAuth;
  const sa = JSON.parse(Deno.env.get("FCM_SERVICE_ACCOUNT")!);
  const key = await crypto.subtle.importKey("pkcs8", pemToDer(sa.private_key), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const now = Math.floor(Date.now() / 1000);
  const assertion = await jwt({ alg: "RS256", typ: "JWT" }, { iss: sa.client_email, scope: "https://www.googleapis.com/auth/firebase.messaging", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 }, key, { name: "RSASSA-PKCS1-v1_5" });
  const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }) });
  const j = await r.json();
  if (!j.access_token) throw new Error("Firebase : " + JSON.stringify(j).slice(0, 200));
  fcmAuth = { v: j.access_token, until: Date.now() + 50 * 60e3, project: sa.project_id }; return fcmAuth;
}
async function sendFcm(token: string, it: Item): Promise<number> {
  if (!Deno.env.get("FCM_SERVICE_ACCOUNT")) return 0;
  const a = await fcmToken();
  const r = await fetch(`https://fcm.googleapis.com/v1/projects/${a.project}/messages:send`, {
    method: "POST", headers: { authorization: "Bearer " + a.v, "content-type": "application/json" },
    body: JSON.stringify({ message: { token, notification: { title: it.title, body: it.body || "" }, data: { url: it.url || "", kind: it.kind }, android: { priority: "high", collapse_key: it.key.slice(0, 64) } } }),
  });
  const err = r.ok ? "" : JSON.stringify(await r.json().catch(() => ({})));
  if (r.ok) await r.body?.cancel().catch(() => {});
  if (/UNREGISTERED|registration-token-not-registered/.test(err)) return 404;
  return r.status;
}

/* ---------- Fichier calendrier (.ics) : l'iPhone propose « Ajouter au calendrier » ---------- */
const icsEsc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const fold = (l: string) => { const out: string[] = []; let s = l; while (new TextEncoder().encode(s).length > 74) { let n = 74; while (new TextEncoder().encode(s.slice(0, n)).length > 74) n--; out.push(s.slice(0, n)); s = " " + s.slice(n); } out.push(s); return out.join("\r\n"); };
function calendrier(q: URLSearchParams) {
  const date = (q.get("date") || "").replace(/\D/g, "").slice(0, 8), heure = (q.get("heure") || "").replace(/\D/g, "").slice(0, 4);
  if (date.length !== 8) return new Response("date manquante", { status: 400, headers: CORS });
  const duree = Math.min(600, Math.max(15, Number(q.get("duree")) || 60));
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
  let debut: string, fin: string;
  if (heure.length === 4) {
    const d = new Date(Date.UTC(+date.slice(0, 4), +date.slice(4, 6) - 1, +date.slice(6, 8), +heure.slice(0, 2), +heure.slice(2, 4)));
    const f = new Date(d.getTime() + duree * 60000), p = (n: number) => String(n).padStart(2, "0");
    debut = `DTSTART;TZID=Europe/Paris:${date}T${heure}00`;
    fin = `DTEND;TZID=Europe/Paris:${f.getUTCFullYear()}${p(f.getUTCMonth() + 1)}${p(f.getUTCDate())}T${p(f.getUTCHours())}${p(f.getUTCMinutes())}00`;
  } else {
    const d = new Date(Date.UTC(+date.slice(0, 4), +date.slice(4, 6) - 1, +date.slice(6, 8) + 1)), p = (n: number) => String(n).padStart(2, "0");
    debut = `DTSTART;VALUE=DATE:${date}`; fin = `DTEND;VALUE=DATE:${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}`;
  }
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Jobello//Entretiens//FR", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    "BEGIN:VTIMEZONE", "TZID:Europe/Paris",
    "BEGIN:DAYLIGHT", "TZOFFSETFROM:+0100", "TZOFFSETTO:+0200", "TZNAME:CEST", "DTSTART:19700329T020000", "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU", "END:DAYLIGHT",
    "BEGIN:STANDARD", "TZOFFSETFROM:+0200", "TZOFFSETTO:+0100", "TZNAME:CET", "DTSTART:19701025T030000", "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU", "END:STANDARD",
    "END:VTIMEZONE",
    "BEGIN:VEVENT", `UID:${(q.get("id") || crypto.randomUUID()).replace(/[^\w-]/g, "")}-${date}${heure}@jobello`, `DTSTAMP:${stamp}`, debut, fin,
    `SUMMARY:${icsEsc(q.get("titre") || "Entretien")}`];
  if (q.get("lieu")) lines.push(`LOCATION:${icsEsc(q.get("lieu")!)}`);
  if (q.get("notes")) lines.push(`DESCRIPTION:${icsEsc(q.get("notes")!)}`);
  if (q.get("lien")) lines.push(`URL:${icsEsc(q.get("lien")!)}`);
  if (heure.length === 4) lines.push("BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:Entretien dans 1 heure", "TRIGGER:-PT1H", "END:VALARM");
  lines.push("END:VEVENT", "END:VCALENDAR");
  return new Response(lines.map(fold).join("\r\n") + "\r\n", { headers: { ...CORS, "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": `inline; filename="entretien.ics"` } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  const q = new URL(req.url).searchParams;
  if (req.method === "GET" && q.has("ics")) return calendrier(q);
  if (req.method === "GET") return Response.json({ ok: true, service: "notifications" }, { headers: CORS });
  const secret = req.headers.get("x-cron") || "";
  if (!secret) return new Response("non autorisé", { status: 401, headers: CORS });
  try { return Response.json(await envoyer(secret), { headers: CORS }); }
  catch (e) { console.log(String(e)); return Response.json({ erreur: String(e) }, { status: 500, headers: CORS }); }
});
