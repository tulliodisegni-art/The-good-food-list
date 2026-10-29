"use strict";

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];

// ---------- Stockage local (sur le téléphone) ----------
const store = {
  get(key, fallback) {
    try { const v = localStorage.getItem("gfl." + key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem("gfl." + key, JSON.stringify(value)); } catch { /* stockage indisponible */ }
  },
};

// ---------- Outils ----------
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const norm = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const arrLabel = (n) => (n === 1 ? "1er" : `${n}e`);
const arrHtml = (n) => (n === 1 ? "1<sup>er</sup>" : `${n}<sup>e</sup>`);
const street = (a) => String(a || "").replace(/,?\s*750\d\d\s*Paris\s*$/i, "");
const enc = encodeURIComponent;
const uid = () => "u-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

const CAT_GROUPS = [
  ["bar", ["bar", "rooftop", "boire", "soirée", "festif", "cocktail"]],
  ["fr", ["français", "corse", "brasserie", "fondue", "resto"]],
  ["it", ["italien", "pizza"]],
  ["jp", ["japonais", "ramen", "sushi"]],
  ["asia", ["chinois", "coréen", "thaïlandais", "vietnamien", "cambodgien", "indonésien", "taïwanais", "philippin", "tibétain", "fusion", "indien", "asiatique"]],
  ["burger", ["burger", "américain"]],
  ["orient", ["oriental", "libanais", "israélien", "cacher", "grec", "iranien", "turc", "marocain", "russe", "polonais", "africain", "mexicain", "argentin", "colombien", "cubain", "espagnol", "tapas", "poisson"]],
  ["cafe", ["café", "brunch", "pâtisserie", "salon de thé", "crêperie", "vegan"]],
  ["fun", ["activité", "stand-up", "tester"]],
];
function catKey(cat) {
  const c = norm(cat);
  for (const [k, words] of CAT_GROUPS) if (words.some((w) => c.includes(norm(w)))) return k;
  return "other";
}
const catVar = (cat) => `var(--c-${catKey(cat)})`;

// ---------- Données ----------
const TESTED = new Set(["✅", "✔️", "✔"]);
const S = {
  base: [], places: [], view: "paris", group: store.get("group", "arr"),
  cat: { paris: null, precieuses: null }, fav: { paris: "", precieuses: "" }, q: "",
  arr: null, city: "New York", univ: store.get("univ", "table"), mapList: "paris", mapCat: "", geo: store.get("geo", {}),
};

function rebuild() {
  const custom = store.get("custom", []);
  const edits = store.get("edits", {});
  S.places = [...S.base, ...custom].map((p) => ({ ...p, ...(edits[p.id] || {}) }));
  for (const p of S.places) {
    // Dans les notes, ✅ et ✔️ veulent dire « déjà testé ».
    if (p.tested === undefined) p.tested = TESTED.has(p.mark);
    if (TESTED.has(p.mark)) p.mark = "";
    const g = p.address && S.geo[p.address];
    if (!p.lat && g) { p.lat = g[0]; p.lng = g[1]; }
  }
}

function setEdit(id, patch) {
  const custom = store.get("custom", []);
  const i = custom.findIndex((p) => p.id === id);
  if (i >= 0) { custom[i] = { ...custom[i], ...patch }; store.set("custom", custom); }
  else { const edits = store.get("edits", {}); edits[id] = { ...(edits[id] || {}), ...patch }; store.set("edits", edits); }
  rebuild();
}

// ---------- Listes ----------
function filtered(list) {
  const q = norm(S.q).trim();
  return S.places.filter((p) => {
    if (p.list !== list) return false;
    if (S.cat[list] && p.cat !== S.cat[list]) return false;
    if (list === "paris" && S.arr && p.arr !== S.arr) return false;
    if (S.fav[list] === "done" && !p.tested) return false;
    if (S.fav[list] === "todo" && p.tested) return false;
    if (q && !norm(`${p.name} ${p.address} ${p.cat} ${p.city || ""} ${p.arr ? arrLabel(p.arr) : ""}`).includes(q)) return false;
    return true;
  });
}

const CHECK_SVG = '<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="13"/><path d="M10.5 16.5l4 4 7.5-8.5"/></svg>';
function checkBtn(p) {
  return `<button class="check ${p.tested ? "on" : ""}" data-check="${esc(p.id)}" aria-pressed="${!!p.tested}" aria-label="${p.tested ? "Déjà testé" : "Marquer comme testé"}">${CHECK_SVG}</button>`;
}
function rowHtml(p, meta) {
  return `<div class="row ${p.tested ? "is-done" : ""}">
    <button class="row-main" data-id="${esc(p.id)}">
      <span class="row-name">${esc(p.name)}${p.rating ? ` <span class="row-rating">${STAR}${p.rating}</span>` : ""}</span>
      <span class="row-meta">${meta}</span>
    </button>${checkBtn(p)}
  </div>`;
}

function groupBy(items, keyFn) {
  const m = new Map();
  for (const p of items) { const k = keyFn(p); if (!m.has(k)) m.set(k, []); m.get(k).push(p); }
  return m;
}

function renderChips(list, el) {
  const counts = groupBy(S.places.filter((p) => p.list === list), (p) => p.cat);
  const cats = [...counts.entries()].sort((a, b) => b[1].length - a[1].length);
  const cur = S.cat[list];
  el.innerHTML = `<button class="chip ${cur ? "" : "on"}" data-cat="">Tout</button>` +
    cats.map(([c, arr]) => `<button class="chip ${cur === c ? "on" : ""}" data-cat="${esc(c)}"><span class="dot" style="background:${catVar(c)}"></span>${esc(c)} <span class="n">${arr.length}</span></button>`).join("");
}

function renderParis() {
  renderChips("paris", $("#chipsParis"));
  const items = filtered("paris");
  const el = $("#listParis");
  $("#groupArr").classList.toggle("on", S.group === "arr");
  $("#groupCat").classList.toggle("on", S.group === "cat");
  renderArrStrip();
  if (!items.length) { el.innerHTML = `<p class="none">Aucune adresse ne correspond.</p>`; return; }

  if (S.group === "arr") {
    const groups = groupBy(items, (p) => p.arr);
    const keys = [...groups.keys()].sort((a, b) => a - b);
    el.innerHTML = keys.map((arr) => {
      const list = groups.get(arr);
      const byCat = groupBy(list, (p) => p.cat);
      return `<section class="group" id="arr-${arr}">
        <div class="group-head"><span class="plaque"><span class="p-kick">Arrondt</span><span class="p-num">${arrHtml(arr)}</span></span>
          <div><h2>${arr === 1 ? "Premier" : arrLabel(arr) + " arrondissement"}</h2><span class="count">${list.length} adresse${list.length > 1 ? "s" : ""}</span></div></div>
        ${[...byCat.entries()].map(([cat, ps]) => `<div class="subhead"><span class="dot" style="background:${catVar(cat)}"></span>${esc(cat)}</div>
          <div class="rows">${ps.map((p) => rowHtml(p, esc(street(p.address)) || "Adresse à compléter")).join("")}</div>`).join("")}
      </section>`;
    }).join("");
  } else {
    const groups = groupBy(items, (p) => p.cat);
    const keys = [...groups.keys()].sort((a, b) => groups.get(b).length - groups.get(a).length);
    el.innerHTML = keys.map((cat) => {
      const ps = groups.get(cat).sort((a, b) => a.arr - b.arr);
      return `<section class="group"><div class="group-head"><span class="tag" style="--tc:${catVar(cat)}">${ps.length}</span><h2>${esc(cat)}</h2></div>
        <div class="rows">${ps.map((p) => rowHtml(p, `${p.arr ? arrLabel(p.arr) + " · " : ""}${esc(street(p.address))}`)).join("")}</div></section>`;
    }).join("");
  }
}

function renderArrStrip() {
  const all = S.places.filter((p) => p.list === "paris");
  const counts = groupBy(all, (p) => p.arr);
  const cell = (n, kick, num, count) => `<button class="mini ${S.arr === n ? "on" : ""}" data-arr="${n ?? ""}" aria-pressed="${S.arr === n}">
      <span class="mini-plaque"><span class="mk">${kick}</span><span class="mn">${num}</span></span><span class="mc">${count}</span></button>`;
  $("#arrStrip").innerHTML = cell(null, "Tout", "Paris", all.length) +
    Array.from({ length: 20 }, (_, i) => i + 1).map((n) => cell(n, "Arr.", arrHtml(n), counts.get(n)?.length || 0)).join("");
  const on = $("#arrStrip .mini.on");
  if (on) on.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
}

// Les Précieuses sont rangées en quatre univers, puis par catégorie.
const UNIVERSES = [
  { id: "table", name: "À table", sub: "Restaurants et brunchs", color: "var(--c-fr)", cats: ["Resto", "Resto festif", "Brunch"],
    labels: { "Resto": "Restaurants", "Resto festif": "Restaurants festifs", "Brunch": "Brunchs" } },
  { id: "verre", name: "Un verre", sub: "Rooftops, bars, cafés", color: "var(--c-bar)", cats: ["Rooftop", "Boire un verre", "Salon de thé", "Café"],
    labels: { "Rooftop": "Rooftops", "Boire un verre": "Bars", "Salon de thé": "Salons de thé", "Café": "Cafés" } },
  { id: "sortir", name: "Sortir", sub: "Soirées et stand-up", color: "var(--c-orient)", cats: ["Soirée", "Stand-up"],
    labels: { "Soirée": "Soirées", "Stand-up": "Stand-up et one man show" } },
  { id: "activites", name: "Activités", sub: "Ateliers, jeux, sorties", color: "var(--c-fun)", cats: ["Activité", "À tester"],
    labels: { "Activité": "Activités et ateliers", "À tester": "À tester" } },
];
const universeOf = (cat) => UNIVERSES.find((u) => u.cats.includes(cat)) || UNIVERSES[0];

function renderPrec() {
  const all = S.places.filter((p) => p.list === "precieuses");
  const cur = UNIVERSES.find((u) => u.id === S.univ) || UNIVERSES[0];
  $("#univPrec").innerHTML = UNIVERSES.map((u) => {
    const n = all.filter((p) => universeOf(p.cat) === u).length;
    return `<button class="univ ${u === cur ? "on" : ""}" data-univ="${u.id}" aria-pressed="${u === cur}" style="--uc:${u.color}">
      <span class="u-name">${u.name}</span><span class="u-sub">${u.sub}</span><span class="u-n">${n}</span></button>`;
  }).join("");
  const items = filtered("precieuses").filter((p) => universeOf(p.cat) === cur);
  const el = $("#listPrec");
  if (!items.length) { el.innerHTML = `<p class="none">Aucune adresse ne correspond.</p>`; return; }
  const groups = groupBy(items, (p) => p.cat);
  el.innerHTML = cur.cats.filter((c) => groups.has(c)).map((cat) => {
    const ps = groups.get(cat);
    return `<section class="group"><div class="subhead"><span class="dot" style="background:${cur.color}"></span>${esc(cur.labels[cat] || cat)} <span class="sub-n">${ps.length}</span></div>
      <div class="rows">${ps.map((p) => rowHtml(p, esc(p.address ? street(p.address).replace(/, 750(\d\d) Paris/, " · $1e") : p.note || "Adresse à retrouver"))).join("")}</div></section>`;
  }).join("");
}

// Autres villes : un onglet par ville, New York et Tel-Aviv pour commencer.
const CITIES = [
  { name: "New York", sub: "États-Unis", color: "var(--c-jp)" },
  { name: "Tel-Aviv", sub: "Israël", color: "var(--c-cafe)" },
];
function renderVilles() {
  const all = S.places.filter((p) => p.list === "villes");
  const names = [...CITIES.map((c) => c.name), ...new Set(all.map((p) => p.city).filter((c) => c && !CITIES.some((x) => x.name === c)))];
  if (!names.includes(S.city)) S.city = names[0];
  $("#cityTabs").innerHTML = names.map((n) => {
    const c = CITIES.find((x) => x.name === n) || { sub: "Ville", color: "var(--c-other)" };
    const count = all.filter((p) => p.city === n).length;
    return `<button class="univ ${n === S.city ? "on" : ""}" data-city="${esc(n)}" aria-pressed="${n === S.city}" style="--uc:${c.color}">
      <span class="u-name">${esc(n)}</span><span class="u-sub">${esc(c.sub)}</span><span class="u-n">${count}</span></button>`;
  }).join("");
  const items = filtered("villes").filter((p) => p.city === S.city);
  const el = $("#listVilles");
  if (!items.length) {
    el.innerHTML = `<div class="empty"><div class="empty-plaque"><span>${esc(S.city)}</span></div><h2>Pas encore d'adresses</h2>
      <p>Envoie à Claude tes liens Instagram de ${esc(S.city)} : chaque fiche sera remplie et rangée ici. Tu peux aussi en ajouter une à la main dans l'onglet Ajouter.</p></div>`;
    return;
  }
  const groups = groupBy(items, (p) => p.cat || "Autres");
  el.innerHTML = [...groups.entries()].map(([cat, ps]) => `<section class="group"><div class="subhead"><span class="dot" style="background:${catVar(cat)}"></span>${esc(cat)} <span class="sub-n">${ps.length}</span></div>
    <div class="rows">${ps.map((p) => rowHtml(p, esc(p.address || "Adresse à compléter"))).join("")}</div></section>`).join("");
}

function renderPending() {
  const pend = store.get("custom", []).filter((p) => p.list === "pending");
  $("#listPending").innerHTML = pend.length ? `<div class="subhead">À compléter (${pend.length})</div><div class="rows">${pend.map((p) => `
    <div class="row pend"><span class="row-name" style="font-weight:600;font-size:13.5px">${esc(p.source)}</span>
      <span class="row-side"><button class="btn" data-fill="${esc(p.id)}" style="padding:6px 10px">Remplir</button><button class="btn danger" data-del="${esc(p.id)}" style="padding:6px 10px" aria-label="Supprimer">✕</button></span>
      <span class="row-meta">Gardé le ${new Date(p.createdAt).toLocaleDateString("fr-FR")}</span></div>`).join("")}</div>` : "";
}

function renderAll() {
  renderParis(); renderPrec(); renderVilles(); renderPending(); fillCatOptions();
  if (map) refreshMarkers();
}

// ---------- Fiche ----------
const ICONS = {
  phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>',
  book: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18M8 15h3"/>',
  menu: '<path d="M7 3v8a2 2 0 0 0 4 0V3M9 11v10M17 3c-2 2-2 6 0 8v10"/>',
  web: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>',
  insta: '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  pencil: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13 7 4 4"/>',
};
const icon = (k) => `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true">${ICONS[k]}</svg>`;
const STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2.8 2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z"/></svg>';
const RATING_LABELS = ["", "Décevant", "Moyen", "Bien", "Très bon", "Exceptionnel"];

function linkFor(p) {
  const place = p.address || `${p.name}, ${p.city || "Paris"}`;
  const q = (extra) => `https://www.google.com/search?q=${enc(`${p.name} ${p.address || p.city || "Paris"} ${extra}`)}`;
  return {
    menu: p.menu || q("menu"),
    apple: `https://maps.apple.com/?daddr=${enc(place)}&dirflg=d`,
    gmaps: `https://www.google.com/maps/dir/?api=1&destination=${enc(`${p.name}, ${place}`)}`,
    waze: `https://waze.com/ul?${p.lat ? `ll=${p.lat},${p.lng}&` : `q=${enc(place)}&`}navigate=yes`,
    insta: p.source || q("instagram"),
    book: p.booking || q("réserver une table"),
    call: p.phone ? `tel:${p.phone.replace(/[^\d+]/g, "")}` : q("téléphone"),
  };
}

let current = null;
function openSheet(id, keepScroll) {
  const p = S.places.find((x) => x.id === id);
  if (!p) return;
  current = p;
  const L = linkFor(p);
  const custom = store.get("custom", []).some((c) => c.id === id);
  const sheet = $("#sheet");
  const prevScroll = sheet.scrollTop;
  const plaque = p.list === "paris" && p.arr
    ? `<span class="plaque"><span class="p-kick">Arrondt</span><span class="p-num">${arrHtml(p.arr)}</span></span>`
    : `<span class="plaque"><span class="p-kick">${p.list === "precieuses" ? "Précieuses" : esc(p.city || "Ville")}</span><span class="p-num" style="font-size:17px">${esc(p.cat || "")}</span></span>`;
  const r = p.rating || 0;
  sheet.innerHTML = `
    <div class="hero ${p.photo ? "photo" : ""}" style="--hc:${catVar(p.cat)}">
      <span class="grab"></span>
      ${p.photo ? `<img src="${esc(p.photo)}" alt="" referrerpolicy="no-referrer" onerror="this.remove();this.parentNode.classList.remove('photo')">` : `<span class="mono" aria-hidden="true">${esc(p.name.replace(/^(le|la|les|l'|the)\s*/i, "").charAt(0).toUpperCase())}</span>`}
      ${plaque}
      <button class="close" data-close aria-label="Fermer">×</button>
    </div>
    <div class="sheet-body">
      <div>
        <h2 id="sheetName">${esc(p.name)}</h2>
        <div class="sheet-sub"><span class="tag" style="--tc:${catVar(p.cat)}">${esc(p.cat || "Sans type")}</span>
          ${p.arr ? `<span>${arrLabel(p.arr)} arrondissement</span>` : ""}
          ${p.gRating ? `<span class="g-rating">${STAR}${esc(p.gRating)} Google</span>` : ""}</div>
      </div>

      <div class="quick">
        <a class="q" href="${esc(L.call)}" ${p.phone ? "" : 'target="_blank" rel="noopener"'}>${icon("phone")}<span>${p.phone ? "Appeler" : "Numéro"}</span></a>
        <a class="q" href="${esc(L.book)}" target="_blank" rel="noopener">${icon("book")}<span>Réserver</span></a>
        <a class="q" href="${esc(L.menu)}" target="_blank" rel="noopener">${icon("menu")}<span>Menu</span></a>
        <a class="q" href="${esc(L.insta)}" target="_blank" rel="noopener">${icon("insta")}<span>${p.source ? "Publication" : "Instagram"}</span></a>
      </div>

      <button class="tested-btn ${p.tested ? "on" : ""}" data-tested aria-pressed="${p.tested}">
        <span class="check big ${p.tested ? "on" : ""}">${CHECK_SVG}</span>
        <span class="tb-text"><strong>${p.tested ? "Déjà testé" : "Pas encore testé"}</strong>
        <small>${p.tested ? "Touche pour annuler" : "Touche quand tu y es allé"}</small></span>
      </button>

      <section class="block">
        <div class="block-head"><h3>Mon avis</h3><span class="rating-label">${r ? RATING_LABELS[r] : "Pas encore noté"}</span></div>
        <div class="stars" role="radiogroup" aria-label="Ma note">
          ${[1, 2, 3, 4, 5].map((n) => `<button class="star ${n <= r ? "on" : ""}" data-rate="${n}" role="radio" aria-checked="${n === r}" aria-label="${n} sur 5, ${RATING_LABELS[n]}">${STAR}</button>`).join("")}
        </div>
        <label class="sr" for="comment">Mon commentaire</label>
        <textarea id="comment" rows="3" placeholder="Mon commentaire : plats à reprendre, ambiance, avec qui y aller…">${esc(p.comment || "")}</textarea>
        <span class="saved" id="savedHint" hidden>Enregistré</span>
      </section>

      ${p.summary ? `<p class="summary">${esc(p.summary)}</p>` : ""}
      ${p.note ? `<p class="note">${esc(p.note)}</p>` : ""}

      <section class="block">
        <h3>Y aller</h3>
        ${p.address ? `<div class="addr"><span>${esc(p.address)}</span><button data-copy>Copier</button></div>` : `<p class="note">Adresse pas encore renseignée : les itinéraires cherchent le lieu par son nom.</p>`}
        <div class="nav-apps">
          <a class="nav-app apple" href="${esc(L.apple)}" target="_blank" rel="noopener"><span class="app-dot"></span>Plans</a>
          <a class="nav-app google" href="${esc(L.gmaps)}" target="_blank" rel="noopener"><span class="app-dot"></span>Google Maps</a>
          <a class="nav-app waze" href="${esc(L.waze)}" target="_blank" rel="noopener"><span class="app-dot"></span>Waze</a>
        </div>
      </section>

      <section class="block infos">
        <div class="block-head"><h3>Infos</h3><button class="link-btn" data-editinfo>${icon("pencil")}Compléter</button></div>
        ${infoRow("phone", "Téléphone", p.phone, p.phone ? L.call : "")}
        ${infoRow("clock", "Horaires", p.hours, "")}
        ${infoRow("book", "Réservation", p.booking ? "Lien de réservation" : "", p.booking)}
        ${infoRow("menu", "Menu", p.menu ? "Voir le menu" : "", p.menu)}
        ${infoRow("web", "Site web", p.website ? p.website.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "") : "", p.website)}
        <form class="edit-info" id="editInfo" hidden>
          ${editField("phone", "Téléphone", "tel", p.phone, "01 23 45 67 89")}
          ${editField("booking", "Lien de réservation", "url", p.booking, "https://www.thefork.fr/…")}
          ${editField("menu", "Lien du menu", "url", p.menu, "https://…")}
          ${editField("website", "Site web", "url", p.website, "https://…")}
          ${editField("hours", "Horaires", "text", p.hours, "Mar–Sam 12h–14h30, 19h–23h")}
          ${editField("photo", "Lien d'une photo", "url", p.photo, "https://…/photo.jpg")}
          ${editField("source", "Lien Instagram", "url", p.source, "https://www.instagram.com/…")}
          <div class="row-actions"><button class="btn primary" type="submit">Enregistrer</button><button class="btn ghost" type="button" data-canceledit>Annuler</button></div>
        </form>
      </section>

      ${p.mark ? `<p class="note">Marque de ta note d'origine : ${esc(p.mark)}</p>` : ""}
      ${custom ? `<div class="row-actions"><button class="btn" data-edit>Modifier</button><button class="btn danger" data-remove>Supprimer</button></div>` : ""}
    </div>`;
  sheet.hidden = false; $("#backdrop").hidden = false;
  sheet.scrollTop = keepScroll ? prevScroll : 0;
}
function infoRow(ic, label, value, href) {
  const v = value ? (href ? `<a href="${esc(href)}" ${href.startsWith("tel:") ? "" : 'target="_blank" rel="noopener"'}>${esc(value)}</a>` : `<span>${esc(value)}</span>`) : `<span class="empty-val">À compléter</span>`;
  return `<div class="info-row">${icon(ic)}<span class="info-label">${label}</span>${v}</div>`;
}
function editField(key, label, type, value, ph) {
  return `<label for="e-${key}">${label}</label><input id="e-${key}" name="${key}" type="${type}" value="${esc(value || "")}" placeholder="${esc(ph)}" ${type === "url" ? 'inputmode="url"' : ""}>`;
}
function closeSheet() { $("#sheet").hidden = true; $("#backdrop").hidden = true; current = null; }

let commentTimer;
$("#sheet").addEventListener("input", (e) => {
  if (e.target.id !== "comment" || !current) return;
  const id = current.id, text = e.target.value;
  clearTimeout(commentTimer);
  commentTimer = setTimeout(() => {
    setEdit(id, { comment: text }); current = S.places.find((x) => x.id === id);
    const h = $("#savedHint"); if (h) { h.hidden = false; setTimeout(() => (h.hidden = true), 1500); }
  }, 400);
});
$("#sheet").addEventListener("submit", (e) => {
  if (e.target.id !== "editInfo" || !current) return;
  e.preventDefault();
  // On ne garde que ce qui a changé, pour ne pas masquer les infos ajoutées plus tard.
  const patch = Object.fromEntries([...new FormData(e.target)].map(([k, v]) => [k, String(v).trim()]).filter(([k, v]) => v !== (current[k] || "")));
  setEdit(current.id, patch); renderAll(); openSheet(current.id, true); toast("Fiche mise à jour");
});

$("#sheet").addEventListener("click", async (e) => {
  const t = e.target.closest("button");
  if (!t || !current) return;
  if (t.hasAttribute("data-close")) return closeSheet();
  if (t.hasAttribute("data-copy")) {
    try { await navigator.clipboard.writeText(current.address); toast("Adresse copiée"); } catch { toast("Copie impossible, garde le doigt appuyé sur l'adresse"); }
    return;
  }
  if (t.dataset.rate) {
    const n = +t.dataset.rate;
    const next = current.rating === n ? 0 : n;
    setEdit(current.id, { rating: next }); renderAll(); openSheet(current.id, true);
    $$("#sheet .star.on").forEach((st, i) => { st.style.animationDelay = `${i * 40}ms`; st.classList.add("pop"); });
    return;
  }
  if (t.hasAttribute("data-editinfo")) { const f = $("#editInfo"); f.hidden = !f.hidden; if (!f.hidden) f.querySelector("input").focus(); return; }
  if (t.hasAttribute("data-canceledit")) { $("#editInfo").hidden = true; return; }
  if (t.hasAttribute("data-tested")) {
    const id = current.id;
    toggleTested(id, null);
    renderAll(); openSheet(id, true);
    $("#sheet .check.big")?.classList.add("pop");
    return;
  }
  if (t.hasAttribute("data-edit")) { const id = current.id; closeSheet(); editPlace(id); return; }
  if (t.hasAttribute("data-remove")) {
    if (t.dataset.confirm) {
      store.set("custom", store.get("custom", []).filter((c) => c.id !== current.id));
      rebuild(); closeSheet(); renderAll(); toast("Adresse supprimée");
    } else { t.dataset.confirm = "1"; t.textContent = "Confirmer la suppression"; }
  }
});
$("#backdrop").addEventListener("click", closeSheet);
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeSheet(); });

// Coche « déjà testé » : animée sur place, puis la liste se met à jour.
function toggleTested(id, btn) {
  const p = S.places.find((x) => x.id === id);
  if (!p) return;
  const now = !p.tested;
  setEdit(id, { tested: now });
  for (const b of $$(`.check[data-check="${CSS.escape(id)}"]`)) {
    b.classList.toggle("on", now); b.setAttribute("aria-pressed", now);
    b.closest(".row")?.classList.toggle("is-done", now);
  }
  if (btn) { btn.classList.remove("pop"); void btn.offsetWidth; btn.classList.add("pop"); }
  try { navigator.vibrate?.(12); } catch { /* pas de vibration */ }
  toast(now ? `${p.name} : testé` : `${p.name} : pas encore testé`);
  if (S.fav.paris || S.fav.precieuses) setTimeout(renderAll, 450);
  else if (map) refreshMarkers();
}
const headerBottom = () => $(".top").getBoundingClientRect().bottom;

let toastTimer;
function toast(msg) {
  const t = $("#toast"); t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => (t.hidden = true), 2600);
}

// ---------- Navigation ----------
const VIEWS = {
  paris: ["Paris intra-muros", "The Good Food List"],
  carte: ["Toutes les adresses", "La carte"],
  precieuses: ["Liste d'exception", "Les Précieuses"],
  villes: ["Hors de Paris", "Autres villes"],
  ajouter: ["Nouvelle adresse", "Ajouter"],
};
function show(view) {
  if (!VIEWS[view]) view = "paris";
  S.view = view;
  for (const v of $$(".view")) v.hidden = v.dataset.view !== view;
  for (const a of $$(".tabs a")) a.classList.toggle("on", a.dataset.tab === view);
  $("#viewKicker").textContent = VIEWS[view][0];
  $("#viewTitle").textContent = VIEWS[view][1];
  $("#searchWrap").hidden = view === "carte" || view === "ajouter";
  closeSheet();
  if (view === "carte") initMap();
  window.scrollTo(0, 0);
}
window.addEventListener("hashchange", () => show(location.hash.slice(1)));

$("#search").addEventListener("input", (e) => { S.q = e.target.value; renderParis(); renderPrec(); renderVilles(); });

document.addEventListener("click", (e) => {
  const chk = e.target.closest(".check[data-check]");
  if (chk) return toggleTested(chk.dataset.check, chk);
  const row = e.target.closest(".row-main[data-id]");
  if (row) return openSheet(row.dataset.id);
  const city = e.target.closest(".univ[data-city]");
  if (city) { S.city = city.dataset.city; renderVilles(); return; }
  const univ = e.target.closest(".univ[data-univ]");
  if (univ) { S.univ = univ.dataset.univ; store.set("univ", S.univ); renderPrec(); return; }
  const mini = e.target.closest(".mini[data-arr]");
  if (mini) {
    const n = +mini.dataset.arr || null;
    S.arr = S.arr === n ? null : n;
    renderParis();
    const top = $("#listParis").getBoundingClientRect().top + scrollY - headerBottom() - 70;
    if (scrollY > top) window.scrollTo({ top, behavior: "smooth" });
    return;
  }
  const chip = e.target.closest(".chip");
  if (chip) {
    const list = chip.parentNode.id === "chipsParis" ? "paris" : "precieuses";
    S.cat[list] = chip.dataset.cat || null;
    list === "paris" ? renderParis() : renderPrec();
    return;
  }
  const g = e.target.closest("[data-group]");
  if (g) { S.group = g.dataset.group; store.set("group", S.group); renderParis(); }
});
const FAV_STEPS = [["", "Tous les lieux"], ["done", "Déjà testés"], ["todo", "Pas encore testés"]];
for (const [btn, list] of [["#favParis", "paris"], ["#favPrec", "precieuses"]]) {
  $(btn).addEventListener("click", (e) => {
    const i = (FAV_STEPS.findIndex(([k]) => k === S.fav[list]) + 1) % FAV_STEPS.length;
    S.fav[list] = FAV_STEPS[i][0];
    e.currentTarget.textContent = FAV_STEPS[i][1];
    e.currentTarget.setAttribute("aria-pressed", i > 0);
    list === "paris" ? renderParis() : renderPrec();
  });
}

// ---------- Carte ----------
let map, cluster;
const markers = new Map();
function initMap() {
  const top = $(".top").getBoundingClientRect().bottom;
  document.documentElement.style.setProperty("--map-top", `${Math.round(top)}px`);
  if (map) { setTimeout(() => map.invalidateSize(), 50); return; }
  if (!window.L) { $("#geoStatus").hidden = false; $("#geoStatus").textContent = "Carte indisponible hors connexion"; return; }
  map = L.map("map", { zoomControl: false, attributionControl: true }).setView([48.8606, 2.3425], 13);
  // Fond de carte clair et lisible, même en mode sombre. S'il ne charge pas
  // (réseau, bloqueur de contenu), on passe à OpenStreetMap, puis à Esri.
  const BASEMAPS = [
    ["https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", { subdomains: "abcd", attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>' }],
    ["https://tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }],
    ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}", { attribution: "Tiles &copy; Esri" }],
  ];
  let base = 0, layer = null, loaded = false;
  const useBase = (i) => {
    if (layer) map.removeLayer(layer);
    base = i; loaded = false;
    const [url, opts] = BASEMAPS[i];
    let errors = 0;
    layer = L.tileLayer(url, { maxZoom: 19, ...opts }).addTo(map);
    layer.on("tileload", () => { loaded = true; });
    layer.on("tileerror", () => { if (!loaded && ++errors === 3 && base + 1 < BASEMAPS.length) useBase(base + 1); });
    setTimeout(() => { if (!loaded && base === i && base + 1 < BASEMAPS.length) useBase(base + 1); }, 5000);
  };
  useBase(0);
  setTimeout(() => map.invalidateSize(), 300);
  cluster = L.markerClusterGroup({ showCoverageOnHover: false, maxClusterRadius: 42, disableClusteringAtZoom: 16 });
  map.addLayer(cluster);
  map.on("popupopen", (e) => {
    const b = e.popup.getElement().querySelector("[data-open]");
    if (b) b.onclick = () => openSheet(b.dataset.open);
  });
  fillMapCats();
  refreshMarkers();
  geocodeMissing();
}

function fillMapCats() {
  const list = S.mapList;
  const cats = [...new Set(S.places.filter((p) => list === "all" ? p.list !== "pending" : p.list === list).map((p) => p.cat))].sort((a, b) => a.localeCompare(b, "fr"));
  if (!cats.includes(S.mapCat)) S.mapCat = "";
  $("#mapCat").innerHTML = `<option value="">Tous les types</option>` + cats.map((c) => `<option ${c === S.mapCat ? "selected" : ""}>${esc(c)}</option>`).join("");
}

function markerFor(p) {
  const icon = L.divIcon({ className: "", html: `<div class="pin ${p.tested ? "done" : ""} ${p.mark ? "star" : ""}" style="--pc:${catVar(p.cat)}"></div>`, iconSize: [20, 20], iconAnchor: [10, 10], popupAnchor: [0, -10] });
  const m = L.marker([p.lat, p.lng], { icon, title: p.name });
  m.bindPopup(`<div class="pop-name">${esc(p.name)}</div><div class="pop-meta">${esc(p.cat)}${p.arr ? " · " + arrLabel(p.arr) : ""} ${p.tested ? "· testé" : ""} ${esc(p.mark || "")}</div><button class="pop-btn" data-open="${esc(p.id)}">Voir la fiche</button>`);
  return m;
}

function refreshMarkers() {
  if (!map) return;
  cluster.clearLayers(); markers.clear();
  const ms = [];
  for (const p of S.places) {
    if (!p.lat || p.list === "pending") continue;
    if (S.mapList !== "all" && p.list !== S.mapList) continue;
    if (S.mapCat && p.cat !== S.mapCat) continue;
    const m = markerFor(p); markers.set(p.id, m); ms.push(m);
  }
  cluster.addLayers(ms);
}

$("#mapLists").addEventListener("click", (e) => {
  const b = e.target.closest("button"); if (!b) return;
  S.mapList = b.dataset.list;
  for (const x of $$("#mapLists button")) x.classList.toggle("on", x === b);
  fillMapCats(); refreshMarkers();
});
$("#mapCat").addEventListener("change", (e) => { S.mapCat = e.target.value; refreshMarkers(); });
$("#locate").addEventListener("click", () => {
  if (!map || !navigator.geolocation) return toast("Localisation indisponible");
  navigator.geolocation.getCurrentPosition((pos) => {
    const ll = [pos.coords.latitude, pos.coords.longitude];
    map.setView(ll, 16);
    L.circleMarker(ll, { radius: 8, color: "#fff", weight: 3, fillColor: "#2f6fed", fillOpacity: 1 }).addTo(map);
  }, () => toast("Autorise la localisation pour te situer"), { enableHighAccuracy: true, timeout: 10000 });
});

// Place les pins à partir des adresses (Base Adresse Nationale), une seule fois par adresse.
const GEOCODERS = [
  (q) => `https://data.geopf.fr/geocodage/search?q=${enc(q)}&limit=1`,
  (q) => `https://api-adresse.data.gouv.fr/search/?q=${enc(q)}&limit=1`,
];
async function geocodeOne(address) {
  for (const url of GEOCODERS) {
    try {
      const r = await fetch(url(address));
      if (!r.ok) continue;
      const f = (await r.json()).features?.[0];
      if (!f || f.properties.score < 0.45) return null;
      const [lng, lat] = f.geometry.coordinates;
      return [lat, lng];
    } catch { /* on essaie le service suivant */ }
  }
  return undefined;
}
let geocoding = false;
async function geocodeMissing() {
  if (geocoding) return;
  const todo = [...new Set(S.places.filter((p) => !p.lat && p.address && !(p.address in S.geo)).map((p) => p.address))];
  if (!todo.length) return;
  geocoding = true;
  const status = $("#geoStatus");
  let done = 0, failed = false;
  const tick = () => { status.hidden = false; status.textContent = `Placement des pins : ${done}/${todo.length}`; };
  tick();
  const worker = async () => {
    while (todo.length) {
      const a = todo.shift();
      const res = await geocodeOne(a);
      if (res === undefined) { failed = true; todo.length = 0; break; }
      S.geo[a] = res; done++;
      if (done % 20 === 0) { store.set("geo", S.geo); tick(); rebuild(); refreshMarkers(); }
    }
  };
  const total = todo.length;
  await Promise.all([worker(), worker(), worker(), worker()]);
  store.set("geo", S.geo); rebuild(); refreshMarkers();
  status.textContent = failed ? "Connexion faible, les pins manquants seront placés plus tard" : `${total} adresses placées sur la carte`;
  setTimeout(() => (status.hidden = true), 3500);
  geocoding = false;
}

// ---------- Ajout ----------
const fArr = $("#fArr");
fArr.innerHTML = `<option value="">—</option>` + Array.from({ length: 20 }, (_, i) => `<option value="${i + 1}">${arrLabel(i + 1)}</option>`).join("");
function fillCatOptions() {
  $("#catOptions").innerHTML = [...new Set(S.places.map((p) => p.cat).filter(Boolean))].sort((a, b) => a.localeCompare(b, "fr")).map((c) => `<option value="${esc(c)}">`).join("");
}
$("#fAddress").addEventListener("input", (e) => {
  const m = e.target.value.match(/750(\d\d)/);
  if (m) fArr.value = String(+m[1]);
});
$("#fList").addEventListener("change", (e) => {
  const v = e.target.value === "villes";
  $("#fCity").hidden = !v; $("#fCityLabel").hidden = !v;
});

$("#linkForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const url = $("#linkUrl").value.trim();
  if (!url) return;
  const custom = store.get("custom", []);
  custom.unshift({ id: uid(), list: "pending", name: "Lien à compléter", source: url, createdAt: Date.now() });
  store.set("custom", custom);
  $("#linkUrl").value = "";
  rebuild(); renderPending();
  toast("Lien gardé. Envoie-le aussi à Claude pour remplir la fiche.");
});
$("#listPending").addEventListener("click", (e) => {
  const del = e.target.closest("[data-del]"), fill = e.target.closest("[data-fill]");
  if (del) { store.set("custom", store.get("custom", []).filter((p) => p.id !== del.dataset.del)); rebuild(); renderPending(); }
  if (fill) {
    const p = store.get("custom", []).find((x) => x.id === fill.dataset.fill);
    resetForm(); $("#fSource").value = p.source; $("#fId").value = p.id; $("#fName").focus();
    $("#placeForm").scrollIntoView({ behavior: "smooth" });
  }
});

function resetForm() {
  $("#placeForm").reset(); $("#fId").value = "";
  $("#formTitle").textContent = "Ajouter à la main"; $("#fSubmit").textContent = "Ajouter"; $("#fCancel").hidden = true;
  $("#fCity").hidden = true; $("#fCityLabel").hidden = true;
}
function editPlace(id) {
  const p = store.get("custom", []).find((x) => x.id === id);
  if (!p) return;
  location.hash = "ajouter"; show("ajouter");
  $("#fId").value = p.id; $("#fName").value = p.name || ""; $("#fAddress").value = p.address || "";
  $("#fList").value = p.list; $("#fArr").value = p.arr || ""; $("#fCat").value = p.cat || "";
  $("#fCity").value = p.city || ""; $("#fMenu").value = p.menu || ""; $("#fSource").value = p.source || "";
  $("#fPhoto").value = p.photo || ""; $("#fSummary").value = p.summary || "";
  $("#fCity").hidden = p.list !== "villes"; $("#fCityLabel").hidden = p.list !== "villes";
  $("#formTitle").textContent = "Modifier l'adresse"; $("#fSubmit").textContent = "Enregistrer"; $("#fCancel").hidden = false;
  setTimeout(() => $("#placeForm").scrollIntoView({ behavior: "smooth" }), 50);
}
$("#fCancel").addEventListener("click", resetForm);
$("#placeForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const id = $("#fId").value || uid();
  const list = $("#fList").value;
  let address = $("#fAddress").value.trim();
  const arr = +$("#fArr").value || null;
  if (address && list === "paris" && arr && !/750\d\d/.test(address)) address += `, 750${String(arr).padStart(2, "0")} Paris`;
  const p = {
    id, list, name: $("#fName").value.trim(), address, arr: list === "villes" ? null : arr,
    cat: $("#fCat").value.trim() || "Restaurant", city: list === "villes" ? $("#fCity").value.trim() : undefined,
    menu: $("#fMenu").value.trim(), source: $("#fSource").value.trim(), photo: $("#fPhoto").value.trim(),
    summary: $("#fSummary").value.trim(), mark: "", createdAt: Date.now(),
  };
  if (list === "paris" && !p.arr) { toast("Choisis l'arrondissement"); return; }
  const custom = store.get("custom", []).filter((x) => x.id !== id);
  const prev = store.get("custom", []).find((x) => x.id === id);
  if (prev && prev.list !== "pending") { p.mark = prev.mark || ""; p.tested = !!prev.tested; p.createdAt = prev.createdAt; }
  custom.unshift(p);
  store.set("custom", custom);
  rebuild(); renderAll(); resetForm();
  if (map) geocodeMissing();
  toast(prev && prev.list !== "pending" ? "Adresse modifiée" : `${p.name} ajouté`);
  location.hash = list; show(list);
  setTimeout(() => openSheet(id), 60);
});

// ---------- Démarrage ----------
async function boot() {
  try {
    const r = await fetch("data/places.json", { cache: "no-cache" });
    S.base = await r.json();
  } catch {
    S.base = store.get("baseCache", []);
  }
  if (S.base.length) store.set("baseCache", S.base);
  rebuild();
  renderAll();
  show(location.hash.slice(1) || "paris");
  const setHead = () => document.documentElement.style.setProperty("--head-h", `${Math.round($(".top").offsetHeight)}px`);
  setHead(); addEventListener("resize", setHead);
}
boot();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}
