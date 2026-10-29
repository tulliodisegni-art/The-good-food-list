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
  me: null, // position du téléphone, quand elle a été demandée
  price: { paris: 0, precieuses: 0 },
};
// Budget par personne, de € à €€€€.
const PRICES = ["Tous les budgets", "€ Petit prix", "€€ Prix moyen", "€€€ Chic", "€€€€ Grande occasion"];
const PRICE_HINT = ["", "moins de 20 € par personne", "20 à 40 € par personne", "40 à 80 € par personne", "plus de 80 € par personne"];
const euros = (n) => (n ? "€".repeat(n) : "");

function rebuild() {
  // Une adresse publiée pour tous arrive dans la liste commune : sa copie locale s'efface.
  const ids = new Set(S.base.map((p) => p.id));
  let custom = store.get("custom", []);
  const edits = store.get("edits", {});
  if (custom.some((p) => ids.has(p.id))) {
    for (const p of custom.filter((c) => ids.has(c.id))) {
      const mine = Object.fromEntries(["tested", "rating", "comment", "want"].filter((k) => p[k] !== undefined).map((k) => [k, p[k]]));
      edits[p.id] = { ...mine, ...(edits[p.id] || {}) };
    }
    custom = custom.filter((p) => !ids.has(p.id));
    store.set("custom", custom); store.set("edits", edits);
  }
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
    if (p.list !== list && !(list === "precieuses" && p.prec)) return false;
    if (S.cat[list] && p.cat !== S.cat[list]) return false;
    if (list === "paris" && S.arr && p.arr !== S.arr) return false;
    if (S.fav[list] === "done" && !p.tested) return false;
    if (S.fav[list] === "todo" && p.tested) return false;
    if (S.fav[list] === "want" && !p.want) return false;
    if (S.price[list] && p.price !== S.price[list]) return false;
    if (q && !norm(`${p.name} ${p.address} ${p.cat} ${p.city || ""} ${p.arr ? arrLabel(p.arr) : ""}`).includes(q)) return false;
    return true;
  });
}

const CHECK_SVG = '<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="13"/><path d="M10.5 16.5l4 4 7.5-8.5"/></svg>';
function checkBtn(p) {
  return `<button class="check ${p.tested ? "on" : ""}" data-check="${esc(p.id)}" aria-pressed="${!!p.tested}" aria-label="${p.tested ? "Déjà testé" : "Marquer comme testé"}">${CHECK_SVG}</button>`;
}
// Vignette : photo du lieu, sinon son initiale sur la couleur de son type.
function thumbHtml(p, cls = "rthumb") {
  const ini = esc(p.name.replace(/^(le|la|les|l'|the)\s*/i, "").charAt(0).toUpperCase());
  return `<span class="${cls}" style="--hc:${catVar(p.cat)}"><span>${ini}</span>${p.photo ? `<img src="${esc(p.photo)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : ""}</span>`;
}
const HEART = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.5s-7.5-4.6-9.2-9.4C1.7 7.8 3.9 4.5 7.3 4.5c2 0 3.6 1.1 4.7 2.7 1.1-1.6 2.7-2.7 4.7-2.7 3.4 0 5.6 3.3 4.5 6.6-1.7 4.8-9.2 9.4-9.2 9.4z"/></svg>';
function rowHtml(p, meta) {
  const d = distLabel(p);
  return `<div class="row ${p.tested ? "is-done" : ""}">
    <button class="row-main" data-id="${esc(p.id)}">${thumbHtml(p)}
      <span class="rtext"><span class="row-name">${esc(p.name)}${p.want ? `<span class="row-want" title="Envie d'y aller">${HEART}</span>` : ""}${p.rating ? ` <span class="row-rating">${STAR}${p.rating}</span>` : ""}</span>
      <span class="row-meta">${meta}${p.price ? ` <span class="row-price">· ${euros(p.price)}</span>` : ""}${d ? ` <span class="row-dist">· ${d}</span>` : ""}</span></span>
    </button>${checkBtn(p)}
  </div>`;
}

// ---------- Distances ----------
function distM(a, b) {
  if (!a || !b || !a.lat || !b.lat) return null;
  const k = Math.PI / 180, x = (b.lng - a.lng) * k * Math.cos(((a.lat + b.lat) / 2) * k), y = (b.lat - a.lat) * k;
  return Math.round(Math.hypot(x, y) * 6371000);
}
const fmtDist = (m) => (m == null ? "" : m < 950 ? `${Math.max(50, Math.round(m / 50) * 50)} m` : `${(m / 1000).toFixed(m < 9500 ? 1 : 0).replace(".", ",")} km`);
const walkMin = (m) => Math.max(1, Math.round((m * 1.3) / 80)); // 80 m/min, rues pas en ligne droite
const distLabel = (p) => (S.me && p.lat ? fmtDist(distM(S.me, p)) : "");

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
  $("#groupNear").classList.toggle("on", S.group === "near");
  renderArrStrip();
  if (!items.length) { el.innerHTML = `<p class="none">Aucune adresse ne correspond.</p>`; return; }

  if (S.group === "near") {
    if (!S.me) { el.innerHTML = `<p class="none">Recherche de ta position…</p>`; locateMe().then(renderParis, () => { S.group = "arr"; renderParis(); }); return; }
    const near = items.filter((p) => p.lat).sort((a, b) => distM(S.me, a) - distM(S.me, b)).slice(0, 80);
    el.innerHTML = `<section class="group"><div class="subhead">Les plus proches de toi</div>
      <div class="rows">${near.map((p) => rowHtml(p, `${p.arr ? arrLabel(p.arr) + " · " : ""}${esc(p.cat)}`)).join("")}</div></section>`;
    return;
  }
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
// Une adresse de Paris peut aussi être rangée dans les Précieuses (champ prec).
const precCat = (p) => (p.list === "precieuses" ? p.cat : p.prec);
const PREC_CATS = UNIVERSES.flatMap((u) => u.cats.map((c) => [c, `${u.name} · ${u.labels[c] || c}`]));
const universeOf = (cat) => UNIVERSES.find((u) => u.cats.includes(cat)) || UNIVERSES[0];

function renderPrec() {
  const all = S.places.filter((p) => p.list === "precieuses" || p.prec);
  const cur = UNIVERSES.find((u) => u.id === S.univ) || UNIVERSES[0];
  $("#univPrec").innerHTML = UNIVERSES.map((u) => {
    const n = all.filter((p) => universeOf(precCat(p)) === u).length;
    return `<button class="univ ${u === cur ? "on" : ""}" data-univ="${u.id}" aria-pressed="${u === cur}" style="--uc:${u.color}">
      <span class="u-name">${u.name}</span><span class="u-sub">${u.sub}</span><span class="u-n">${n}</span></button>`;
  }).join("");
  const items = filtered("precieuses").filter((p) => universeOf(precCat(p)) === cur);
  const el = $("#listPrec");
  if (!items.length) { el.innerHTML = `<p class="none">Aucune adresse ne correspond.</p>`; return; }
  const groups = groupBy(items, precCat);
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
  if (window.renderHome) renderHome();
  if (map) refreshMarkers();
}

// ---------- Fiche ----------
const ICONS = {
  gem: '<path d="M6 3h12l4 6-10 12L2 9z"/><path d="M2 9h20M12 21 8 9l4-6 4 6z"/>',
  phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>',
  book: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18M8 15h3"/>',
  menu: '<path d="M7 3v8a2 2 0 0 0 4 0V3M9 11v10M17 3c-2 2-2 6 0 8v10"/>',
  web: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>',
  insta: '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  pencil: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13 7 4 4"/>',
  share: '<path d="M12 3v12M7 8l5-5 5 5"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/>',
  walk: '<circle cx="13" cy="4.5" r="1.8"/><path d="M10 21l2.2-6.5L15 17v4M8 11l2.5-3.5 3 .5 2 3 2.5 1M12.2 14.5 11 9"/>',
  pin: '<path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/>',
};
const icon = (k) => `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true">${ICONS[k]}</svg>`;
const STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2.8 2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z"/></svg>';
const RATING_LABELS = ["", "Décevant", "Moyen", "Bien", "Très bon", "Exceptionnel"];

const igHandle = (p) => {
  const h = String(p.instagram || "").trim().replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/^@/, "").split(/[/?#]/)[0];
  return /^[A-Za-z0-9._]{2,30}$/.test(h) ? h : "";
};
function linkFor(p) {
  const place = p.address || `${p.name}, ${p.city || "Paris"}`;
  const q = (extra) => `https://www.google.com/search?q=${enc(`${p.name} ${p.address || p.city || "Paris"} ${extra}`)}`;
  // Fiche Google Maps du lieu : elle a les boutons Appeler et Réserver une table.
  const mapsPage = p.gmaps || `https://www.google.com/maps/search/?api=1&query=${enc(`${p.name}, ${place}`)}${p.gid ? `&query_place_id=${enc(p.gid)}` : ""}`;
  return {
    menu: p.menu || q("menu"),
    apple: `https://maps.apple.com/?daddr=${enc(place)}&dirflg=d`,
    gmaps: `https://www.google.com/maps/dir/?api=1&destination=${enc(`${p.name}, ${place}`)}`,
    waze: `https://waze.com/ul?${p.lat ? `ll=${p.lat},${p.lng}&` : `q=${enc(place)}&`}navigate=yes`,
    citymapper: p.lat ? `https://citymapper.com/directions?endcoord=${p.lat},${p.lng}&endname=${enc(p.name)}&endaddress=${enc(place)}`
      : `https://citymapper.com/directions?endaddress=${enc(place)}&endname=${enc(p.name)}`,
    uber: p.lat ? `https://m.uber.com/ul/?action=setPickup&pickup=my_location&dropoff[latitude]=${p.lat}&dropoff[longitude]=${p.lng}&dropoff[nickname]=${enc(p.name)}&dropoff[formatted_address]=${enc(place)}`
      : `https://m.uber.com/ul/?action=setPickup&pickup=my_location&dropoff[formatted_address]=${enc(place)}`,
    // Compte Instagram du resto (ouvre l'appli Instagram sur iPhone), sinon la publication gardée, sinon une recherche dans Instagram.
    insta: igHandle(p) ? `https://www.instagram.com/${igHandle(p)}/`
      : /instagram\.com/.test(p.source || "") ? p.source
      : `https://www.instagram.com/explore/search/keyword/?q=${enc(p.name)}`,
    book: p.booking || mapsPage,
    call: p.phone ? `tel:${p.phone.replace(/[^\d+]/g, "")}` : mapsPage,
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
    <div class="sheet-top"><span class="grab"></span>
      <button class="top-btn share-btn" data-share aria-label="Partager">${icon("share")}</button>
      <button class="close" data-close aria-label="Fermer"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button></div>
    <div class="hero ${p.photo ? "photo" : ""}" style="--hc:${catVar(p.cat)}">
      ${p.photo ? `<img src="${esc(p.photo)}" alt="" referrerpolicy="no-referrer" onerror="this.remove();this.parentNode.classList.remove('photo')">` : `<span class="mono" aria-hidden="true">${esc(p.name.replace(/^(le|la|les|l'|the)\s*/i, "").charAt(0).toUpperCase())}</span>`}
      ${plaque}
    </div>
    <div class="sheet-body">
      <div>
        <h2 id="sheetName">${esc(p.name)}</h2>
        <div class="sheet-sub"><span class="tag" style="--tc:${catVar(p.cat)}">${esc(p.cat || "Sans type")}</span>
          ${p.arr ? `<span>${arrLabel(p.arr)} arrondissement</span>` : ""}
          ${p.price ? `<span class="price-tag" title="${PRICE_HINT[p.price]}${p.priceSrc === "estim" ? " (estimation)" : ""}">${euros(p.price)}<i>${"€".repeat(4 - p.price)}</i></span>` : ""}
          ${p.gRating ? `<span class="g-rating">${STAR}${esc(p.gRating)} Google</span>` : ""}</div>
        <div class="class-line">${p.list === "precieuses" || p.prec ? `<span class="prec-badge">${icon("gem")}Précieuse</span>` : ""}
          <button class="link-btn" data-classify>${icon("pencil")}Changer le classement</button></div>
        ${classifyForm(p)}
        ${S.me && p.lat ? `<div class="dist-line">${icon("walk")}<span>À ${fmtDist(distM(S.me, p))} de toi · ${walkMin(distM(S.me, p))} min à pied</span></div>` : ""}
      </div>

      <div class="quick">
        <a class="q" href="${esc(L.call)}" ${p.phone ? "" : 'target="_blank" rel="noopener"'}>${icon("phone")}<span>Appeler</span></a>
        <a class="q" href="${esc(L.book)}" target="_blank" rel="noopener">${icon("book")}<span>Réserver</span></a>
        <a class="q" href="${esc(L.menu)}" target="_blank" rel="noopener">${icon("menu")}<span>Menu</span></a>
        <a class="q" href="${esc(L.insta)}" target="_blank" rel="noopener">${icon("insta")}<span>Instagram</span></a>
      </div>

      <div class="status-row">
        <button class="tested-btn ${p.tested ? "on" : ""}" data-tested aria-pressed="${p.tested}">
          <span class="check big ${p.tested ? "on" : ""}">${CHECK_SVG}</span>
          <span class="tb-text"><strong>${p.tested ? "Déjà testé" : "Pas encore testé"}</strong>
          <small>${p.tested ? "Touche pour annuler" : "Touche quand tu y es allé"}</small></span>
        </button>
        <button class="want-btn ${p.want ? "on" : ""}" data-want aria-pressed="${!!p.want}">${HEART}<span>${p.want ? "Envie !" : "Envie"}</span></button>
      </div>

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
          <a class="nav-app citymapper" href="${esc(L.citymapper)}" target="_blank" rel="noopener"><span class="app-dot"></span>Citymapper</a>
          <a class="nav-app uber" href="${esc(L.uber)}" target="_blank" rel="noopener"><span class="app-dot"></span>Uber</a>
        </div>
      </section>

      <section class="block infos">
        <div class="block-head"><h3>Infos</h3><button class="link-btn" data-editinfo>${icon("pencil")}Compléter</button></div>
        ${infoRow("phone", "Téléphone", p.phone, p.phone ? L.call : "")}
        ${infoRow("clock", "Horaires", p.hours, "")}
        ${infoRow("book", "Réservation", p.booking ? "Lien de réservation" : "", p.booking)}
        ${infoRow("menu", "Menu", p.menu ? "Voir le menu" : "", p.menu)}
        ${infoRow("insta", "Instagram", igHandle(p) ? "@" + igHandle(p) : "", igHandle(p) ? L.insta : "")}
        ${p.source && p.source !== L.insta ? infoRow("insta", "Publication", "Voir la publication", p.source) : ""}
        ${infoRow("web", "Site web", p.website ? p.website.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "") : "", p.website)}
        <form class="edit-info" id="editInfo" hidden>
          <label for="e-price">Budget</label><select id="e-price" name="price">${PRICES.map((l, i) => `<option value="${i}" ${(p.price || 0) === i ? "selected" : ""}>${i ? `${l} (${PRICE_HINT[i]})` : "Je ne sais pas"}</option>`).join("")}</select>
          ${editField("phone", "Téléphone", "tel", p.phone, "01 23 45 67 89")}
          ${editField("booking", "Lien de réservation", "url", p.booking, "https://www.thefork.fr/…")}
          ${editField("menu", "Lien du menu", "url", p.menu, "https://…")}
          ${editField("website", "Site web", "url", p.website, "https://…")}
          ${editField("hours", "Horaires", "text", p.hours, "Mar–Sam 12h–14h30, 19h–23h")}
          ${editField("photo", "Lien d'une photo", "url", p.photo, "https://…/photo.jpg")}
          ${editField("instagram", "Compte Instagram", "text", p.instagram, "@nomdurestaurant")}
          ${editField("source", "Lien d'une publication", "url", p.source, "https://www.instagram.com/reel/…")}
          <div class="row-actions"><button class="btn primary" type="submit">Enregistrer</button><button class="btn ghost" type="button" data-canceledit>Annuler</button></div>
        </form>
      </section>

      ${nearbyHtml(p)}

      ${p.mark ? `<p class="note">Marque de ta note d'origine : ${esc(p.mark)}</p>` : ""}
      ${custom && p.list !== "pending" && store.get("ghToken", "") ? (p.published
        ? `<p class="note">Publiée pour tous, elle apparaît chez chacun dans quelques minutes.</p>`
        : `<button class="btn primary wide" data-publish>Publier pour tous</button>`) : ""}
      ${custom ? `<div class="row-actions"><button class="btn" data-edit>Modifier</button><button class="btn danger" data-remove>Supprimer</button></div>` : ""}
    </div>`;
  sheet.hidden = false; $("#backdrop").hidden = false;
  sheet.scrollTop = keepScroll ? prevScroll : 0;
}
// Les adresses les plus proches de ce lieu, toutes listes confondues.
function nearbyHtml(p) {
  if (!p.lat) return "";
  const near = S.places.filter((o) => o.id !== p.id && o.lat && o.list !== "pending")
    .map((o) => [o, distM(p, o)]).filter(([, d]) => d < 1500).sort((a, b) => a[1] - b[1]).slice(0, 5);
  if (!near.length) return "";
  return `<section class="block"><h3>Juste à côté</h3><div class="near-list">${near.map(([o, d]) => `
    <button class="near" data-goto="${esc(o.id)}">${thumbHtml(o)}<span class="rtext"><span class="row-name">${esc(o.name)}</span>
      <span class="row-meta">${esc(o.cat || "")} · ${fmtDist(d)}${o.tested ? " · testé" : ""}</span></span></button>`).join("")}</div></section>`;
}
function infoRow(ic, label, value, href) {
  const v = value ? (href ? `<a href="${esc(href)}" ${href.startsWith("tel:") ? "" : 'target="_blank" rel="noopener"'}>${esc(value)}</a>` : `<span>${esc(value)}</span>`) : `<span class="empty-val">À compléter</span>`;
  return `<div class="info-row">${icon(ic)}<span class="info-label">${label}</span>${v}</div>`;
}
function classifyForm(p) {
  const cats = [...new Set(S.places.filter((x) => x.list !== "precieuses").map((x) => x.cat).filter(Boolean))].sort((a, b) => a.localeCompare(b, "fr"));
  const opt = (v, l, cur) => `<option value="${esc(v)}" ${v === cur ? "selected" : ""}>${esc(l)}</option>`;
  return `<form class="edit-info class-form" id="classForm" hidden>
    <label for="c-list">Liste</label>
    <select id="c-list" name="list">${opt("paris", "Paris", p.list)}${opt("precieuses", "Précieuses seulement", p.list)}${opt("villes", "Autre ville", p.list)}</select>
    <div data-for="paris" ${p.list !== "paris" ? "hidden" : ""}><label for="c-arr">Arrondissement</label>
      <select id="c-arr" name="arr">${opt("", "Choisir", "")}${Array.from({ length: 20 }, (_, i) => opt(String(i + 1), `${arrLabel(i + 1)} arrondissement`, String(p.arr || ""))).join("")}</select></div>
    <div data-for="villes" ${p.list !== "villes" ? "hidden" : ""}><label for="c-city">Ville</label><input id="c-city" name="city" value="${esc(p.city || "")}" placeholder="Ex. New York"></div>
    <label for="c-cat">Type</label>
    <input id="c-cat" name="cat" value="${esc(p.cat || "")}" list="c-cats" placeholder="Ex. Italien, Japonais…">
    <datalist id="c-cats">${(p.list === "precieuses" ? PREC_CATS.map(([c]) => c) : cats).map((c) => `<option value="${esc(c)}">`).join("")}</datalist>
    <div data-for="paris" ${p.list !== "paris" ? "hidden" : ""}><label for="c-prec">Aussi dans les Précieuses</label>
      <select id="c-prec" name="prec">${opt("", "Non", p.prec || "")}${PREC_CATS.map(([c, l]) => opt(c, l, p.prec || "")).join("")}</select></div>
    <div class="row-actions"><button class="btn primary" type="submit">Enregistrer</button><button class="btn ghost" type="button" data-cancelclass>Annuler</button></div>
  </form>`;
}
// Montre seulement les champs utiles à la liste choisie.
document.addEventListener("change", (e) => {
  if (e.target.id !== "c-list") return;
  const f = $("#classForm"), list = e.target.value;
  f.querySelectorAll("[data-for]").forEach((d) => (d.hidden = d.dataset.for !== list));
  $("#c-cats").innerHTML = (list === "precieuses" ? PREC_CATS.map(([c]) => c) : [...new Set(S.places.filter((x) => x.list === list).map((x) => x.cat))]).map((c) => `<option value="${esc(c)}">`).join("");
});
function editField(key, label, type, value, ph) {
  return `<label for="e-${key}">${label}</label><input id="e-${key}" name="${key}" type="${type}" value="${esc(value || "")}" placeholder="${esc(ph)}" ${type === "url" ? 'inputmode="url"' : ""}>`;
}
function closeSheet() {
  const sheet = $("#sheet");
  sheet.hidden = true; sheet.style.transform = ""; sheet.style.transition = "";
  $("#backdrop").hidden = true; $("#backdrop").style.opacity = ""; current = null;
}

// Glisser la fiche vers le bas pour la fermer (quand elle est déjà en haut de son contenu).
(() => {
  const sheet = $("#sheet"), back = $("#backdrop");
  let y0 = null, dy = 0, t0 = 0;
  const mobile = () => !matchMedia("(min-width: 1000px)").matches;
  sheet.addEventListener("scroll", () => sheet.classList.toggle("scrolled", sheet.scrollTop > 20), { passive: true });
  sheet.addEventListener("touchstart", (e) => {
    if (!mobile() || sheet.scrollTop > 0 || e.target.closest("textarea, input, select")) { y0 = null; return; }
    y0 = e.touches[0].clientY; dy = 0; t0 = Date.now(); sheet.style.transition = "none";
  }, { passive: true });
  sheet.addEventListener("touchmove", (e) => {
    if (y0 === null) return;
    dy = e.touches[0].clientY - y0;
    if (dy <= 0 || sheet.scrollTop > 0) { dy = 0; sheet.style.transform = ""; return; }
    e.preventDefault();
    sheet.style.transform = `translateY(${dy}px)`;
    back.style.opacity = String(Math.max(0.2, 1 - dy / 400));
  }, { passive: false });
  sheet.addEventListener("touchend", () => {
    if (y0 === null) return;
    y0 = null;
    const fast = dy > 40 && Date.now() - t0 < 250;
    sheet.style.transition = "transform .2s ease-out";
    if (dy > 120 || fast) {
      sheet.style.transform = "translateY(100%)";
      setTimeout(closeSheet, 190);
    } else {
      sheet.style.transform = ""; back.style.opacity = "";
    }
  });
})();

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
  if (e.target.id === "classForm" && current) {
    e.preventDefault();
    const f = e.target, list = f.list.value;
    const patch = { list, cat: f.cat.value.trim() || current.cat, arr: list === "paris" ? +f.arr.value || null : null,
      city: list === "villes" ? f.city.value.trim() : "", prec: list === "paris" ? f.prec.value : "" };
    if (list === "paris" && !patch.arr) { toast("Choisis l'arrondissement"); return; }
    if (list === "villes" && !patch.city) { toast("Indique la ville"); return; }
    for (const k of Object.keys(patch)) if ((patch[k] || "") === (current[k] || "")) delete patch[k];
    if (!Object.keys(patch).length) { f.hidden = true; return; }
    setEdit(current.id, patch); renderAll(); openSheet(current.id, true); toast("Classement mis à jour");
    shareFix(current.id, patch);
    return;
  }
  if (e.target.id !== "editInfo" || !current) return;
  e.preventDefault();
  // On ne garde que ce qui a changé, pour ne pas masquer les infos ajoutées plus tard.
  const patch = Object.fromEntries([...new FormData(e.target)].map(([k, v]) => [k, k === "price" ? +v : String(v).trim()]).filter(([k, v]) => v !== (current[k] || (k === "price" ? 0 : ""))));
  if ("price" in patch) patch.priceSrc = "moi";
  setEdit(current.id, patch); renderAll(); openSheet(current.id, true); toast("Fiche mise à jour");
  shareFix(current.id, patch);
});

$("#sheet").addEventListener("click", async (e) => {
  const t = e.target.closest("button");
  if (!t) return;
  if (t.hasAttribute("data-close")) return closeSheet();
  if (t.dataset.goto) { openSheet(t.dataset.goto); return; }
  if (!current) return;
  if (t.hasAttribute("data-want")) {
    const id = current.id, now = !current.want;
    setEdit(id, { want: now }); renderAll(); openSheet(id, true);
    $("#sheet .want-btn")?.classList.add("pop");
    toast(now ? "Ajouté à tes envies" : "Retiré de tes envies");
    return;
  }
  if (t.hasAttribute("data-share")) return sharePlace(current);
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
  if (t.hasAttribute("data-classify")) { const f = $("#classForm"); f.hidden = !f.hidden; return; }
  if (t.hasAttribute("data-cancelclass")) { $("#classForm").hidden = true; return; }
  if (t.hasAttribute("data-tested")) {
    const id = current.id;
    toggleTested(id, null);
    renderAll(); openSheet(id, true);
    $("#sheet .check.big")?.classList.add("pop");
    return;
  }
  if (t.hasAttribute("data-publish")) { publishPlace(current.id); return; }
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
  accueil: ["Bonjour", "The Good Food List"],
  paris: ["Paris intra-muros", "Paris"],
  carte: ["Toutes les adresses", "La carte"],
  precieuses: ["Liste d'exception", "Les Précieuses"],
  villes: ["Hors de Paris", "Autres villes"],
  ajouter: ["Nouvelle adresse", "Ajouter"],
};
function show(view) {
  if (!VIEWS[view]) view = "accueil";
  S.view = view;
  for (const v of $$(".view")) v.hidden = v.dataset.view !== view;
  for (const a of $$(".tabs a")) a.classList.toggle("on", a.dataset.tab === view);
  $("#viewKicker").textContent = view === "accueil" ? greeting() : VIEWS[view][0];
  $("#viewTitle").textContent = VIEWS[view][1];
  $("#searchWrap").hidden = view === "carte" || view === "ajouter";
  closeSheet();
  if (view === "carte") initMap();
  window.scrollTo(0, 0);
}
window.addEventListener("hashchange", () => show(location.hash.slice(1)));

$("#search").addEventListener("input", (e) => { S.q = e.target.value; renderParis(); renderPrec(); renderVilles(); if (window.renderHome) renderHome(); });

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
const FAV_STEPS = [["", "Tous les lieux"], ["done", "Déjà testés"], ["todo", "Pas encore testés"], ["want", "Mes envies"]];
for (const [btn, list] of [["#priceParis", "paris"], ["#pricePrec", "precieuses"]]) {
  $(btn).addEventListener("click", (e) => setPrice(list, (S.price[list] + 1) % PRICES.length));
}
function setPrice(list, n) {
  S.price[list] = n;
  const b = $(list === "paris" ? "#priceParis" : "#pricePrec");
  b.textContent = PRICES[n]; b.setAttribute("aria-pressed", n > 0);
  list === "paris" ? renderParis() : renderPrec();
}
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
  // Plan de Paris hébergé avec l'appli (même adresse que l'appli) : il s'affiche
  // même quand les serveurs de cartes extérieurs sont bloqués sur le téléphone.
  fetch("tiles/paris.pmtiles", { method: "HEAD" }).then((r) => {
    if (!r.ok || !window.protomapsL) return;
    map.createPane("plan").style.zIndex = 250;
    protomapsL.leafletLayer({ url: "tiles/paris.pmtiles", flavor: "light", lang: "fr", maxDataZoom: 15, pane: "plan",
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · <a href="https://protomaps.com">Protomaps</a>' }).addTo(map);
  }).catch(() => {});
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

function keepLink(url) {
  const custom = store.get("custom", []);
  custom.unshift({ id: uid(), list: "pending", name: "Lien à compléter", source: url, createdAt: Date.now() });
  store.set("custom", custom);
  rebuild(); renderPending();
}
$("#keepLink").addEventListener("click", () => {
  const url = $("#linkUrl").value.trim();
  if (!url) { toast("Colle d'abord un lien"); return; }
  keepLink(url); $("#linkUrl").value = "";
  toast("Lien gardé dans « À compléter »");
});

// ---------- Lecture par l'IA (Claude) ----------
// La clé reste dans le stockage du téléphone : elle n'est jamais dans le code publié.
const AI_MODEL = "claude-opus-5-5";
let aiImages = [], aiExtra = null;
function aiKeyState() {
  const has = !!store.get("aiKey", "");
  $("#aiKeyState").textContent = has ? "· enregistrée" : "· à ajouter";
  $("#aiKeyState").className = has ? "ok" : "warn";
  if (!has) $("#aiKeyBox").open = true;
}
aiKeyState();
$("#aiKeySave").addEventListener("click", () => {
  const k = $("#aiKey").value.trim();
  if (k && !/^sk-ant-/.test(k)) { toast("La clé commence par sk-ant-"); return; }
  store.set("aiKey", k); $("#aiKey").value = "";
  aiKeyState(); $("#aiKeyBox").open = !k;
  toast(k ? "Clé enregistrée sur ce téléphone" : "Clé supprimée");
});

// Réduit chaque capture (1568 px max) pour un envoi rapide et moins cher.
function shrink(file) {
  return new Promise((resolve, reject) => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      const k = Math.min(1, 1568 / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("image illisible")); };
    img.src = url;
  });
}
async function addImages(files) {
  for (const f of [...files].filter((f) => f.type.startsWith("image/")).slice(0, 6 - aiImages.length)) {
    try { aiImages.push(await shrink(f)); } catch { toast("Une image n'a pas pu être lue"); }
  }
  renderThumbs();
}
function renderThumbs() {
  $("#aiThumbs").innerHTML = aiImages.map((src, i) => `<span class="thumb"><img src="${src}" alt=""><button type="button" data-rm="${i}" aria-label="Retirer">✕</button></span>`).join("");
  $("#aiDrop").classList.toggle("has", aiImages.length > 0);
}
$("#aiFiles").addEventListener("change", (e) => { addImages(e.target.files); e.target.value = ""; });
$("#aiThumbs").addEventListener("click", (e) => {
  const b = e.target.closest("[data-rm]");
  if (b) { aiImages.splice(+b.dataset.rm, 1); renderThumbs(); }
});
const drop = $("#aiDrop");
["dragenter", "dragover"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("over"); }));
["dragleave", "drop"].forEach((ev) => drop.addEventListener(ev, () => drop.classList.remove("over")));
drop.addEventListener("drop", (e) => { e.preventDefault(); addImages(e.dataTransfer.files); });
document.addEventListener("paste", (e) => {
  if (S.view !== "ajouter") return;
  const files = [...(e.clipboardData?.files || [])];
  if (files.length) addImages(files);
});

function aiPrompt(link, text) {
  const cats = [...new Set(S.places.map((p) => p.cat).filter(Boolean))].sort().join(", ");
  return `Tu aides à remplir une fiche dans « The Good Food List », un carnet personnel d'adresses (restos, bars, sorties).
Les images sont des captures d'écran d'une publication (Instagram, TikTok, Facebook, site…).${link ? `\nLien de la publication : ${link}` : ""}${text ? `\nTexte de la légende :\n${text}` : ""}

Identifie le lieu présenté. Si l'adresse ou la ville n'apparaissent pas, cherche-les sur le web à partir du nom, du compte et des indices visibles. N'invente rien : laisse vide ce que tu ne trouves pas.

Choix de la liste :
- "paris" : restaurant ou adresse à manger dans Paris intra-muros (75001 à 75020).
- "precieuses" : lieu chic ou d'exception, rooftop, bar, soirée, salon de thé, activité, à Paris ou en Île-de-France.
- "villes" : tout lieu hors région parisienne (ex. New York, Tel-Aviv).
Types déjà utilisés (réutilise-en un si ça colle) : ${cats}.

Réponds uniquement avec un objet JSON, sans texte autour :
{"name": "", "address": "adresse complète avec code postal et ville", "list": "paris|precieuses|villes", "arr": 0, "city": "", "cat": "", "price": "budget par personne : 1 = moins de 20 €, 2 = 20 à 40 €, 3 = 40 à 80 €, 4 = plus de 80 €", "summary": "1 à 2 phrases en français : ce qu'il faut y goûter, l'ambiance", "menu": "lien du menu ou du site si trouvé", "phone": "", "website": "", "instagram": "compte Instagram du lieu, sans @", "booking": "lien direct de réservation (TheFork, Zenchef, page Réserver du site…) si trouvé", "doubt": "ce qui reste incertain, sinon vide"}
"arr" est le numéro d'arrondissement (1 à 20) pour Paris, sinon 0.`;
}

function aiError(e) {
  const st = e?.status;
  if (st === 401) return "Clé refusée : vérifie la clé de l'IA";
  if (st === 400 && /credit/i.test(e.message)) return "Plus de crédit sur le compte Anthropic";
  if (st === 429) return "Trop de demandes, réessaie dans une minute";
  if (st >= 500) return "Le service de l'IA est indisponible, réessaie";
  if (!navigator.onLine) return "Pas de connexion";
  return "La lecture a échoué : " + (e?.message || "erreur inconnue");
}

async function aiRead(link, text) {
  const { default: Anthropic } = await import("./vendor/anthropic/anthropic.mjs");
  const client = new Anthropic({ apiKey: store.get("aiKey", ""), dangerouslyAllowBrowser: true });
  const content = [
    ...aiImages.map((d) => ({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: d.split(",")[1] } })),
    { type: "text", text: aiPrompt(link, text) },
  ];
  const messages = [{ role: "user", content }];
  let res;
  // La recherche web peut demander plusieurs tours (pause_turn) : on relance jusqu'à la réponse finale.
  for (let i = 0; i < 4; i++) {
    res = await client.beta.messages.create({
      model: AI_MODEL, max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"], fallbacks: "default",
      output_config: { effort: "medium" },
      tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 4 }],
      messages,
    });
    if (res.stop_reason !== "pause_turn") break;
    messages.push({ role: "assistant", content: res.content });
  }
  if (res.stop_reason === "refusal") throw new Error("l'IA n'a pas pu lire ces images");
  const out = res.content.filter((b) => b.type === "text").map((b) => b.text).join("");
  const json = out.slice(out.indexOf("{"), out.lastIndexOf("}") + 1);
  try { return JSON.parse(json); } catch { throw new Error("réponse incomplète, réessaie"); }
}

function fillFromAi(r, link) {
  resetForm();
  const list = ["paris", "precieuses", "villes"].includes(r.list) ? r.list : "paris";
  $("#fName").value = r.name || ""; $("#fAddress").value = r.address || "";
  $("#fList").value = list;
  const zip = String(r.address || "").match(/750(\d\d)/);
  $("#fArr").value = r.arr >= 1 && r.arr <= 20 ? String(r.arr) : zip ? String(+zip[1]) : "";
  $("#fCat").value = r.cat || ""; $("#fCity").value = list === "villes" ? r.city || "" : "";
  $("#fCity").hidden = list !== "villes"; $("#fCityLabel").hidden = list !== "villes";
  $("#fMenu").value = /^https?:/.test(r.menu || "") ? r.menu : /^https?:/.test(r.website || "") ? r.website : "";
  $("#fSource").value = link || ""; $("#fSummary").value = r.summary || "";
  const url = (u) => (/^https?:/.test(u || "") ? u : "");
  if (r.price >= 1 && r.price <= 4) $("#fPrice").value = String(r.price);
  aiExtra = { phone: r.phone || "", website: url(r.website), booking: url(r.booking), instagram: igHandle({ instagram: r.instagram }) };
  $("#formTitle").textContent = "Vérifie la fiche";
  $("#fCancel").hidden = false;
}

$("#aiForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const link = $("#linkUrl").value.trim(), text = $("#aiText").value.trim();
  const status = $("#aiStatus"), go = $("#aiGo");
  if (!aiImages.length && !text) { toast(link ? "Ajoute une capture, ou garde juste le lien" : "Ajoute au moins une capture"); return; }
  if (!store.get("aiKey", "")) { $("#aiKeyBox").open = true; $("#aiKey").focus(); toast("Ajoute d'abord la clé de l'IA"); return; }
  go.disabled = true; go.classList.add("busy");
  status.hidden = false; status.className = "ai-status"; status.textContent = "Lecture des captures et recherche de l'adresse…";
  try {
    const r = await aiRead(link, text);
    if (!r.name) throw new Error("aucun lieu reconnu sur ces images");
    fillFromAi(r, link);
    status.className = "ai-status ok";
    status.textContent = r.doubt ? `Fiche remplie. À vérifier : ${r.doubt}` : "Fiche remplie, vérifie et touche Ajouter.";
    aiImages = []; renderThumbs(); $("#linkUrl").value = ""; $("#aiText").value = "";
    setTimeout(() => $("#placeForm").scrollIntoView({ behavior: "smooth" }), 80);
  } catch (err) {
    status.className = "ai-status err"; status.textContent = aiError(err);
  } finally {
    go.disabled = false; go.classList.remove("busy");
  }
});
$("#listPending").addEventListener("click", (e) => {
  const del = e.target.closest("[data-del]"), fill = e.target.closest("[data-fill]");
  if (del) { store.set("custom", store.get("custom", []).filter((p) => p.id !== del.dataset.del)); rebuild(); renderPending(); }
  if (fill) {
    const p = store.get("custom", []).find((x) => x.id === fill.dataset.fill);
    resetForm(); $("#fSource").value = p.source; $("#linkUrl").value = p.source; $("#fId").value = p.id; $("#fName").focus();
    $("#placeForm").scrollIntoView({ behavior: "smooth" });
  }
});

function resetForm() {
  $("#placeForm").reset(); $("#fId").value = ""; aiExtra = null;
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
  $("#fPhoto").value = p.photo || ""; $("#fSummary").value = p.summary || ""; $("#fPrice").value = p.price || "";
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
    price: +$("#fPrice").value || undefined,
  };
  if (list === "paris" && !p.arr) { toast("Choisis l'arrondissement"); return; }
  if (aiExtra) { if (aiExtra.phone) p.phone = aiExtra.phone; if (aiExtra.website) p.website = aiExtra.website; if (aiExtra.booking) p.booking = aiExtra.booking; if (aiExtra.instagram) p.instagram = aiExtra.instagram; }
  const custom = store.get("custom", []).filter((x) => x.id !== id);
  const prev = store.get("custom", []).find((x) => x.id === id);
  if (prev && prev.list !== "pending") { p.mark = prev.mark || ""; p.tested = !!prev.tested; p.createdAt = prev.createdAt; }
  custom.unshift(p);
  store.set("custom", custom);
  rebuild(); renderAll(); resetForm();
  if (map) geocodeMissing();
  toast(prev && prev.list !== "pending" ? "Adresse modifiée" : `${p.name} ajouté`);
  if (store.get("ghToken", "")) setTimeout(() => publishPlace(id), 1200);
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
  show(location.hash.slice(1) || "accueil");
  const setHead = () => document.documentElement.style.setProperty("--head-h", `${Math.round($(".top").offsetHeight)}px`);
  setHead(); addEventListener("resize", setHead);
}
boot();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}
