"use strict";
// Accueil, position, « au hasard », listes rapides et réglages.
// Chargé après app.js : il en reprend les outils ($, S, store, rowHtml, openSheet…).

const greeting = () => {
  const h = new Date().getHours();
  return h < 5 ? "Bonne nuit" : h < 12 ? "Bonjour" : h < 18 ? "Bon après-midi" : "Bonsoir";
};

// ---------- Thème ----------
const applyTheme = (t) => { if (t) document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme; };
applyTheme(store.get("theme", ""));

// ---------- Position ----------
const FRESH = 20 * 60 * 1000;
{ const last = store.get("me", null); if (last && Date.now() - last.t < FRESH) S.me = last; }
let locating = null;
function locateMe(force) {
  const last = store.get("me", null);
  if (!force && last && Date.now() - last.t < FRESH) { S.me = last; return Promise.resolve(last); }
  if (locating) return locating;
  locating = new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error("indisponible")); return; }
    navigator.geolocation.getCurrentPosition((pos) => {
      S.me = { lat: pos.coords.latitude, lng: pos.coords.longitude, t: Date.now() };
      store.set("me", S.me); resolve(S.me);
    }, (err) => { toast("Position indisponible : autorise-la dans les réglages du téléphone"); reject(err); },
    { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 });
  }).finally(() => { locating = null; });
  return locating;
}
// Si la position est déjà autorisée, on la rafraîchit sans rien demander.
navigator.permissions?.query({ name: "geolocation" }).then((st) => {
  if (st.state === "granted") locateMe(true).then(() => renderAll()).catch(() => {});
}).catch(() => {});

// ---------- Partager ----------
async function sharePlace(p) {
  const url = p.lat ? `https://maps.apple.com/?q=${enc(p.name)}&ll=${p.lat},${p.lng}` : `https://maps.apple.com/?q=${enc(`${p.name}, ${p.address || p.city || "Paris"}`)}`;
  const text = [p.name, p.cat, p.address].filter(Boolean).join(" · ");
  try {
    if (navigator.share) await navigator.share({ title: p.name, text, url });
    else { await navigator.clipboard.writeText(`${text}\n${url}`); toast("Lien copié"); }
  } catch { /* partage annulé */ }
}

// ---------- Petites cartes ----------
function cardHtml(p, sub) {
  const d = distLabel(p);
  return `<button class="pcard" data-open-place="${esc(p.id)}">
    ${thumbHtml(p, "pc-img")}
    ${p.tested ? `<span class="pc-badge" aria-label="Déjà testé">${CHECK_SVG}</span>` : p.want ? `<span class="pc-badge want">${HEART}</span>` : ""}
    <span class="pc-name">${esc(p.name)}</span>
    <span class="pc-sub">${esc(sub ?? p.cat ?? "")}${p.price ? ` · ${euros(p.price)}` : ""}${d ? ` · ${d}` : ""}</span>
  </button>`;
}
const carousel = (items, sub) => `<div class="carousel">${items.map((p) => cardHtml(p, sub ? sub(p) : undefined)).join("")}</div>`;
const placeSub = (p) => (p.list === "paris" ? `${p.cat} · ${arrLabel(p.arr)}` : p.list === "villes" ? `${p.cat} · ${p.city}` : p.cat);

// Tirage du jour : le même toute la journée, différent le lendemain.
function dailyPick(items, n) {
  const day = new Date().toISOString().slice(0, 10);
  const h = (s) => { let x = 0; for (const c of day + s) x = (x * 31 + c.charCodeAt(0)) | 0; return x; };
  return [...items].sort((a, b) => h(a.id) - h(b.id)).slice(0, n);
}

const QUICK_ICONS = {
  near: '<circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="8"/><path d="M12 1v3M12 20v3M1 12h3M20 12h3"/>',
  random: '<rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="8" cy="8" r="1.3"/><circle cx="16" cy="16" r="1.3"/><circle cx="16" cy="8" r="1.3"/><circle cx="8" cy="16" r="1.3"/><circle cx="12" cy="12" r="1.3"/>',
  want: '<path d="M12 20.5s-7.5-4.6-9.2-9.4C1.7 7.8 3.9 4.5 7.3 4.5c2 0 3.6 1.1 4.7 2.7 1.1-1.6 2.7-2.7 4.7-2.7 3.4 0 5.6 3.3 4.5 6.6-1.7 4.8-9.2 9.4-9.2 9.4z"/>',
  add: '<rect x="3" y="5" width="18" height="15" rx="3"/><circle cx="9" cy="11" r="2"/><path d="m21 17-5-5-9 8"/>',
};
const qi = (k) => `<svg viewBox="0 0 24 24" aria-hidden="true">${QUICK_ICONS[k]}</svg>`;

// ---------- Accueil ----------
function renderHome() {
  const home = $("#home"), res = $("#homeResults");
  if (!home) return;
  const q = norm(S.q).trim();
  res.hidden = !q; home.hidden = !!q;
  if (q) { renderSearch(q); return; }

  const all = S.places.filter((p) => p.list !== "pending");
  const paris = all.filter((p) => p.list === "paris"), prec = all.filter((p) => p.list === "precieuses");
  const wants = all.filter((p) => p.want);
  const best = all.filter((p) => p.rating >= 4).sort((a, b) => b.rating - a.rating);
  const recent = store.get("custom", []).filter((p) => p.list !== "pending").sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    .map((c) => S.places.find((p) => p.id === c.id)).filter(Boolean).slice(0, 10);
  const near = S.me ? all.filter((p) => p.lat).map((p) => [p, distM(S.me, p)]).sort((a, b) => a[1] - b[1]).slice(0, 12).map(([p]) => p) : [];
  const tested = paris.filter((p) => p.tested).length;
  const pct = paris.length ? Math.round((tested / paris.length) * 100) : 0;

  // Envies : les types les plus présents dans ta liste de Paris, et trois univers des Précieuses.
  const cats = [...groupBy(paris, (p) => p.cat).entries()].sort((a, b) => b[1].length - a[1].length).slice(0, 10).map(([c]) => c);
  const moods = [
    ...cats.map((c) => `<button class="mood" data-mood="${esc(c)}" style="--mc:${catVar(c)}">${esc(c)}</button>`),
    `<button class="mood" data-price-go="1" style="--mc:var(--c-cafe)">Petit budget</button>`,
    `<button class="mood" data-price-go="4" style="--mc:var(--c-fun)">Grande occasion</button>`,
    `<button class="mood" data-univ-go="verre" style="--mc:var(--c-bar)">Un rooftop</button>`,
    `<button class="mood" data-univ-go="sortir" style="--mc:var(--c-orient)">Sortir ce soir</button>`,
    `<button class="mood" data-univ-go="activites" style="--mc:var(--c-fun)">Une activité</button>`,
  ].join("");

  const byArr = groupBy(paris, (p) => p.arr);
  const heat = Array.from({ length: 20 }, (_, i) => {
    const ps = byArr.get(i + 1) || [], t = ps.filter((p) => p.tested).length, f = ps.length ? t / ps.length : 0;
    return `<button class="heat" data-arr-go="${i + 1}" style="--f:${Math.round(f * 100)}%" aria-label="${arrLabel(i + 1)} : ${t} sur ${ps.length} testés">
      <span class="h-n">${arrHtml(i + 1)}</span><span class="h-c">${t}/${ps.length}</span></button>`;
  }).join("");

  const discover = dailyPick(prec.filter((p) => !p.tested && p.photo), 8);
  const discoverMore = discover.length < 8 ? dailyPick(prec.filter((p) => !p.tested && !p.photo), 8 - discover.length) : [];
  const parisPick = dailyPick(paris.filter((p) => !p.tested && p.photo), 8);

  const section = (title, sub, body, more = "") => `<section class="hsec"><div class="hsec-head"><div><h2>${title}</h2>${sub ? `<p>${sub}</p>` : ""}</div>${more}</div>${body}</section>`;

  home.innerHTML = `
    <div class="quick-grid">
      <button class="qtile" data-home="near">${qi("near")}<b>Près de moi</b><span>${S.me ? "Autour de toi" : "Active ta position"}</span></button>
      <button class="qtile" data-home="random">${qi("random")}<b>Au hasard</b><span>Laisse-toi surprendre</span></button>
      <button class="qtile" data-home="want">${qi("want")}<b>Mes envies</b><span>${wants.length ? `${wants.length} adresse${wants.length > 1 ? "s" : ""}` : "Touche le cœur d'une fiche"}</span></button>
      <a class="qtile" href="#ajouter">${qi("add")}<b>Ajouter</b><span>Capture, lien ou à la main</span></a>
    </div>

    ${section("Une envie de…", "", `<div class="moods">${moods}</div>`)}

    ${near.length ? section("Près de toi", "Les adresses les plus proches", carousel(near, placeSub), `<button class="more" data-home="near">Tout voir</button>`)
      : `<button class="locate-cta" data-home="locate">${qi("near")}<span><b>Voir ce qu'il y a autour de toi</b><small>Autorise ta position pour les distances et les adresses proches</small></span></button>`}

    ${wants.length ? section("Mes envies", "Les adresses où tu veux aller", carousel(wants, placeSub), `<button class="more" data-home="want">Tout voir</button>`) : ""}

    ${best.length ? section("Mes meilleures adresses", "Celles que tu as notées 4 ou 5 étoiles", carousel(best, placeSub)) : ""}

    ${parisPick.length ? section("À tester dans Paris", "Une sélection du jour parmi tes adresses pas encore testées", carousel(parisPick, placeSub)) : ""}

    ${section("Ton Paris", `${tested} adresses testées sur ${paris.length}`, `
      <div class="progress"><div class="bar"><span style="width:${pct}%"></span></div><b>${pct} %</b></div>
      <div class="heat-grid">${heat}</div>
      <p class="hint">Touche un arrondissement pour voir ses adresses.</p>`)}

    ${section("Les Précieuses du jour", "Adresses d'exception pas encore testées", carousel([...discover, ...discoverMore]))}

    ${recent.length ? section("Ajoutés récemment", "", carousel(recent, placeSub)) : ""}

    ${section("Ailleurs", "", `<div class="city-cards">${CITIES.map((c) => {
      const n = all.filter((p) => p.city === c.name).length;
      return `<button class="city-card" data-city-go="${esc(c.name)}" style="--uc:${c.color}"><b>${esc(c.name)}</b><span>${n ? `${n} adresse${n > 1 ? "s" : ""}` : "Bientôt"}</span></button>`;
    }).join("")}</div>`)}
  `;
}

// Recherche depuis l'accueil : dans toutes les listes à la fois.
function renderSearch(q) {
  const match = (p) => norm(`${p.name} ${p.address} ${p.cat} ${p.city || ""} ${p.arr ? arrLabel(p.arr) : ""} ${p.summary || ""} ${p.comment || ""}`).includes(q);
  const groups = [["paris", "Paris"], ["precieuses", "Précieuses"], ["villes", "Autres villes"]].map(([list, title]) => [title, S.places.filter((p) => p.list === list && match(p))]);
  const total = groups.reduce((n, [, ps]) => n + ps.length, 0);
  $("#homeResults").innerHTML = total ? groups.filter(([, ps]) => ps.length).map(([title, ps]) => `<section class="group"><div class="subhead">${title} <span class="sub-n">${ps.length}</span></div>
    <div class="rows">${ps.slice(0, 40).map((p) => rowHtml(p, esc(placeSub(p)))).join("")}</div></section>`).join("")
    : `<p class="none">Rien trouvé pour « ${esc(S.q)} ».</p>`;
}

// ---------- Panneaux (dans la fiche) ----------
function openPanel(html, cls = "") {
  const sheet = $("#sheet");
  current = null;
  sheet.innerHTML = `<div class="sheet-top"><span class="grab"></span><button class="close" data-close aria-label="Fermer"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button></div>
    <div class="panel ${cls}">${html}</div>`;
  sheet.hidden = false; $("#backdrop").hidden = false; sheet.scrollTop = 0;
}
function openListPanel(title, sub, items, meta) {
  openPanel(`<h2 class="panel-title">${title}</h2>${sub ? `<p class="panel-sub">${sub}</p>` : ""}
    ${items.length ? `<div class="rows">${items.map((p) => rowHtml(p, esc(meta ? meta(p) : placeSub(p)))).join("")}</div>` : `<p class="none">Rien pour l'instant.</p>`}`);
}
async function openNear() {
  try { await locateMe(); } catch { return; }
  renderAll();
  const items = S.places.filter((p) => p.lat && p.list !== "pending").map((p) => [p, distM(S.me, p)]).sort((a, b) => a[1] - b[1]).slice(0, 40).map(([p]) => p);
  openListPanel("Près de toi", "Les 40 adresses les plus proches, toutes listes confondues", items);
}

// ---------- Au hasard ----------
const PICK = store.get("pick", { list: "paris", todo: true, near: false, want: false, cat: "" });
let lastPick = null;
function pickPool() {
  return S.places.filter((p) => {
    if (p.list === "pending") return false;
    if (PICK.list !== "all" && p.list !== PICK.list) return false;
    if (PICK.todo && p.tested) return false;
    if (PICK.want && !p.want) return false;
    if (PICK.cat && p.cat !== PICK.cat) return false;
    if (PICK.near && !(S.me && p.lat && distM(S.me, p) < 1500)) return false;
    return true;
  });
}
function openPicker() {
  const cats = [...new Set(S.places.filter((p) => PICK.list === "all" || p.list === PICK.list).map((p) => p.cat))].sort((a, b) => a.localeCompare(b, "fr"));
  if (!cats.includes(PICK.cat)) PICK.cat = "";
  const toggle = (k, label) => `<button class="pill-toggle" data-pick-t="${k}" aria-pressed="${!!PICK[k]}">${label}</button>`;
  openPanel(`<h2 class="panel-title">Au hasard</h2><p class="panel-sub">Choisis tes envies, l'appli tire une adresse pour toi.</p>
    <div class="seg pick-seg">${[["paris", "Paris"], ["precieuses", "Précieuses"], ["all", "Tout"]].map(([k, l]) => `<button class="${PICK.list === k ? "on" : ""}" data-pick-list="${k}">${l}</button>`).join("")}</div>
    <div class="pick-opts">${toggle("todo", "Pas encore testé")}${toggle("near", "À moins de 1,5 km")}${toggle("want", "Mes envies")}</div>
    <select id="pickCat" class="pick-cat" aria-label="Type"><option value="">Tous les types</option>${cats.map((c) => `<option ${c === PICK.cat ? "selected" : ""}>${esc(c)}</option>`).join("")}</select>
    <div class="pick-result" id="pickResult"></div>
    <div class="pick-actions"><button class="btn primary" data-pick-go>Tirer une adresse</button></div>`, "picker");
  drawPick(false);
}
function drawPick(animate = true) {
  const pool = pickPool(), box = $("#pickResult");
  if (!box) return;
  if (!pool.length) { box.innerHTML = `<p class="none">Aucune adresse avec ces critères.</p>`; return; }
  const choose = () => { const c = pool.filter((p) => p !== lastPick); return (c.length ? c : pool)[Math.floor(Math.random() * (c.length || pool.length))]; };
  const show = (p, final) => {
    const d = S.me && p.lat ? `${fmtDist(distM(S.me, p))} de toi` : "";
    box.innerHTML = `<button class="pick-card ${final ? "final" : ""}" ${final ? `data-open-place="${esc(p.id)}"` : ""}>${thumbHtml(p, "pk-img")}
      <span class="pk-text"><span class="pk-name">${esc(p.name)}</span><span class="pk-sub">${esc(placeSub(p))}${d ? ` · ${d}` : ""}</span>
      ${final ? `<span class="pk-open">Voir la fiche →</span>` : ""}</span></button>`;
  };
  if (!animate) { box.innerHTML = `<p class="pick-count">${pool.length} adresse${pool.length > 1 ? "s" : ""} possible${pool.length > 1 ? "s" : ""}</p>`; return; }
  let i = 0;
  const spin = setInterval(() => {
    show(pool[Math.floor(Math.random() * pool.length)], false);
    if (++i >= 7) { clearInterval(spin); lastPick = choose(); show(lastPick, true); try { navigator.vibrate?.(15); } catch { /* */ } }
  }, 70);
}

// ---------- Réglages ----------
function openSettings() {
  const all = S.places.filter((p) => p.list !== "pending");
  const theme = store.get("theme", "");
  const stats = [
    [all.length, "adresses"], [all.filter((p) => p.tested).length, "testées"],
    [all.filter((p) => p.rating).length, "notées"], [all.filter((p) => p.want).length, "envies"],
  ];
  openPanel(`<h2 class="panel-title">Réglages</h2>
    <div class="stats">${stats.map(([n, l]) => `<div><b>${n}</b><span>${l}</span></div>`).join("")}</div>

    <section class="block"><h3>Apparence</h3>
      <div class="seg">${[["", "Auto"], ["light", "Clair"], ["dark", "Sombre"]].map(([k, l]) => `<button class="${theme === k ? "on" : ""}" data-theme-set="${k}">${l}</button>`).join("")}</div>
    </section>

    <section class="block"><h3>Ma position</h3>
      <p class="muted small">Sert aux distances, aux adresses proches et au tri « Près de moi ». Elle reste sur ce téléphone.</p>
      <button class="btn" data-home="locate">${S.me ? "Mettre à jour ma position" : "Activer ma position"}</button>
    </section>

    <section class="block"><h3>Sauvegarde</h3>
      <p class="muted small">Tes coches, notes, commentaires, envies et adresses ajoutées sont gardés sur ce téléphone. Exporte-les de temps en temps, ou pour les passer sur un autre appareil.</p>
      <div class="row-actions"><button class="btn primary" data-backup>Exporter mes notes</button>
        <label class="btn" for="restoreFile">Restaurer</label><input id="restoreFile" type="file" accept="application/json,.json" hidden></div>
    </section>

    <section class="block"><h3>Liste partagée</h3>
      <p class="muted small">Envoie le lien de l'appli à qui tu veux : chacun voit toutes les adresses et garde ses propres coches et notes. Avec ta clé de publication, ce que tu ajoutes arrive aussi chez eux quelques minutes plus tard.</p>
      <p class="muted small">Clé de publication ${store.get("ghToken", "") ? "<b>enregistrée sur ce téléphone</b>" : "pas encore ajoutée"}.</p>
      <div class="gh-key"><input id="ghToken" type="password" autocomplete="off" placeholder="github_pat_…"><button class="btn" data-gh-save>Enregistrer</button></div>
      <div class="row-actions"><button class="btn primary" data-share-app>Partager l'appli</button>
        ${store.get("ghToken", "") ? `<button class="btn ghost" data-gh-forget>Oublier la clé</button>` : ""}</div>
    </section>

    <section class="block"><h3>Lecture des captures par l'IA</h3>
      <p class="muted small">Clé ${store.get("aiKey", "") ? "enregistrée" : "pas encore ajoutée"}. Elle se règle dans l'onglet Ajouter.</p>
      <a class="btn" href="#ajouter" data-close-panel>Ouvrir Ajouter</a>
    </section>

    <p class="muted small credits">Cartes © OpenStreetMap, Protomaps, CARTO. Infos complétées depuis les sites des restaurants, OpenStreetMap et Google.</p>`, "settings");
}

function backup() {
  const data = { app: "good-food-list", v: 1, date: new Date().toISOString(), custom: store.get("custom", []), edits: store.get("edits", {}) };
  const blob = new Blob([JSON.stringify(data, null, 1)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = `good-food-list-${data.date.slice(0, 10)}.json`;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast("Sauvegarde téléchargée");
}
async function restore(file) {
  try {
    const data = JSON.parse(await file.text());
    if (data.app !== "good-food-list") throw new Error("format");
    store.set("custom", data.custom || []); store.set("edits", data.edits || {});
    rebuild(); renderAll(); openSettings(); toast("Notes restaurées");
  } catch { toast("Ce fichier n'est pas une sauvegarde de l'appli"); }
}

// ---------- Clics ----------
document.addEventListener("click", (e) => {
  const t = e.target;
  const place = t.closest("[data-open-place]");
  if (place) { openSheet(place.dataset.openPlace); return; }
  const h = t.closest("[data-home]");
  if (h) {
    const k = h.dataset.home;
    if (k === "near") openNear();
    if (k === "random") openPicker();
    if (k === "want") openListPanel("Mes envies", "Les adresses où tu veux aller", S.places.filter((p) => p.want));
    if (k === "locate") locateMe(true).then(() => { renderAll(); toast("Position mise à jour"); if (!$("#sheet").hidden && !current) openSettings(); }).catch(() => {});
    return;
  }
  const mood = t.closest("[data-mood]");
  if (mood) { S.cat.paris = mood.dataset.mood; S.arr = null; location.hash = "paris"; renderParis(); return; }
  const pr = t.closest("[data-price-go]");
  if (pr) {
    // Petit budget : la liste de Paris ; grande occasion : les Précieuses.
    const n = +pr.dataset.priceGo, list = n >= 4 ? "precieuses" : "paris";
    if (list === "paris") { S.cat.paris = null; S.arr = null; }
    location.hash = list; setPrice(list, n); return;
  }
  const univ = t.closest("[data-univ-go]");
  if (univ) { S.univ = univ.dataset.univGo; store.set("univ", S.univ); location.hash = "precieuses"; renderPrec(); return; }
  const arr = t.closest("[data-arr-go]");
  if (arr) { S.arr = +arr.dataset.arrGo; S.cat.paris = null; location.hash = "paris"; renderParis(); return; }
  const city = t.closest("[data-city-go]");
  if (city) { S.city = city.dataset.cityGo; location.hash = "villes"; renderVilles(); return; }
  if (t.closest("#openSettings")) { openSettings(); return; }
  if (t.closest("[data-close-panel]")) { closeSheet(); return; }
  const th = t.closest("[data-theme-set]");
  if (th) { store.set("theme", th.dataset.themeSet); applyTheme(th.dataset.themeSet); openSettings(); return; }
  if (t.closest("[data-backup]")) { backup(); return; }
  if (t.closest("[data-gh-save]")) {
    const k = $("#ghToken").value.trim();
    if (!/^(github_pat_|ghp_)\w{20,}$/.test(k)) { toast("Cette clé ne ressemble pas à une clé GitHub"); return; }
    checkToken(k); return;
  }
  if (t.closest("[data-gh-forget]")) { store.set("ghToken", ""); toast("Clé oubliée sur ce téléphone"); openSettings(); return; }
  if (t.closest("[data-share-app]")) { shareApp(); return; }
  const pl = t.closest("[data-pick-list]");
  if (pl) { PICK.list = pl.dataset.pickList; store.set("pick", PICK); openPicker(); return; }
  const pt = t.closest("[data-pick-t]");
  if (pt) {
    const k = pt.dataset.pickT; PICK[k] = !PICK[k]; store.set("pick", PICK);
    if (k === "near" && PICK.near && !S.me) locateMe().then(() => drawPick(false)).catch(() => { PICK.near = false; openPicker(); });
    pt.setAttribute("aria-pressed", PICK[k]); drawPick(false); return;
  }
  if (t.closest("[data-pick-go]")) { drawPick(true); return; }
});
document.addEventListener("change", (e) => {
  if (e.target.id === "pickCat") { PICK.cat = e.target.value; store.set("pick", PICK); drawPick(false); }
  if (e.target.id === "restoreFile" && e.target.files[0]) restore(e.target.files[0]);
});

// ---------- Liste partagée ----------
// Les adresses publiées vont dans data/ajouts.json du dépôt GitHub ; la mise en ligne
// les fusionne à la liste commune, que tout le monde reçoit au prochain chargement.
const REPO = "tulliodisegni-art/The-good-food-list";
const AJOUTS = `https://api.github.com/repos/${REPO}/contents/data/ajouts.json`;
const ghHead = (k) => ({ authorization: `Bearer ${k}`, accept: "application/vnd.github+json" });
const b64 = (txt) => { let s = ""; for (const b of new TextEncoder().encode(txt)) s += String.fromCharCode(b); return btoa(s); };
const unb64 = (data) => new TextDecoder().decode(Uint8Array.from(atob(data.replace(/\s/g, "")), (c) => c.charCodeAt(0)));

async function checkToken(k) {
  try {
    const r = await fetch(AJOUTS, { headers: ghHead(k) });
    if (r.status === 401) throw new Error("Clé refusée par GitHub");
    if (!r.ok && r.status !== 404) throw new Error(`GitHub répond ${r.status}`);
    store.set("ghToken", k); toast("Clé enregistrée : tes ajouts seront publiés pour tous"); openSettings();
  } catch (e) { toast(e.message || "GitHub injoignable"); }
}

async function shareApp() {
  const url = location.href.split("#")[0];
  const text = "Ma liste de bonnes adresses : ouvre le lien, puis Partager › Sur l'écran d'accueil.";
  try { if (navigator.share) { await navigator.share({ title: "The Good Food List", text, url }); return; } } catch { return; }
  try { await navigator.clipboard.writeText(url); toast("Lien copié"); } catch { prompt("Lien de l'appli", url); }
}

// Seules les infos de l'adresse partent : coches, notes, envies et commentaires restent sur ce téléphone.
const PERSONAL = ["tested", "rating", "comment", "want", "published", "createdAt", "mark"];
async function publishPlace(id, attempt = 0) {
  const k = store.get("ghToken", "");
  const local = store.get("custom", []).find((p) => p.id === id);
  if (!k || !local || local.list === "pending") return;
  const place = Object.fromEntries(Object.entries(local).filter(([key, v]) => !PERSONAL.includes(key) && v !== "" && v != null));
  place.addedAt = new Date().toISOString().slice(0, 10);
  try {
    const r = await fetch(`${AJOUTS}?ref=main&t=${Date.now()}`, { headers: ghHead(k), cache: "no-store" });
    if (r.status === 401) throw new Error("Clé de publication refusée : remets-en une dans Réglages");
    if (!r.ok && r.status !== 404) throw new Error(`GitHub répond ${r.status}`);
    const cur = r.ok ? await r.json() : null;
    const list = cur ? JSON.parse(unb64(cur.content)) : [];
    const i = list.findIndex((p) => p.id === id);
    if (i >= 0) list[i] = place; else list.push(place);
    const put = await fetch(AJOUTS, {
      method: "PUT", headers: { ...ghHead(k), "content-type": "application/json" },
      body: JSON.stringify({ message: `Ajout partagé : ${place.name}`, content: b64(JSON.stringify(list, null, 1) + "\n"), branch: "main", ...(cur ? { sha: cur.sha } : {}) }),
    });
    // Deux publications en même temps : on relit et on réessaie.
    if ((put.status === 409 || put.status === 422) && attempt < 2) return publishPlace(id, attempt + 1);
    if (!put.ok) throw new Error(`Publication refusée (${put.status})`);
    setEdit(id, { published: true });
    toast(`${place.name} publié pour tous`);
    if (current?.id === id) openSheet(id, true);
  } catch (e) { toast(e.message || "Publication impossible, réessaie depuis la fiche"); }
}
