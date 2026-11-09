/* Good Food : horaires (« Ouvert · ferme à 23h »), lieux fermés définitivement, collections perso partageables
   et « À commander » sur les fiches. Chargé avant app.js : les fonctions ci-dessous n'utilisent les outils de l'appli
   (store, esc, S, openSheet…) qu'au moment où elles sont appelées. */
"use strict";

/* ---------- Horaires ---------- */
// p.oh = 7 jours, du lundi au dimanche : "12:00-14:30,19:00-22:30" ou "" (fermé). Rempli par OpenStreetMap ou le web.
const OH_DAYS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];
const ohMin = (t) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
const ohSpans = (s) => String(s || "").split(",").map((x) => x.trim().split("-")).filter((x) => x.length === 2 && x[0] && x[1])
  .map(([a, b]) => { const s0 = ohMin(a); let e = ohMin(b); if (e <= s0) e += 1440; return [s0, e]; });
const ohFmt = (m) => { m = ((m % 1440) + 1440) % 1440; const h = Math.floor(m / 60), mm = m % 60; return `${h}h${mm ? String(mm).padStart(2, "0") : ""}`; };
const ohDayTxt = (s) => (s ? ohSpans(s).map(([a, b]) => (a === 0 && b === 1440 ? "24h/24" : `${ohFmt(a)}–${ohFmt(b)}`)).join(", ") : "Fermé");
const hasOh = (p) => Array.isArray(p.oh) && p.oh.length === 7 && !p.hours;

// Ouvert en ce moment ? { open, txt } ou null si on ne connaît pas les horaires.
function openState(p, d = new Date()) {
  if (!hasOh(p)) return null;
  if (p.oh.every((x) => x === "00:00-24:00")) return { open: true, txt: "24h/24" };
  const day = (d.getDay() + 6) % 7, m = d.getHours() * 60 + d.getMinutes();
  // Créneaux du jour, plus ceux de la veille qui finissent après minuit.
  const cur = [...ohSpans(p.oh[day]), ...ohSpans(p.oh[(day + 6) % 7]).filter(([, b]) => b > 1440).map(([a, b]) => [a - 1440, b - 1440])];
  const now = cur.find(([a, b]) => m >= a && m < b);
  if (now) return { open: true, soon: now[1] - m <= 45, txt: `${now[1] - m <= 45 ? "ferme bientôt" : "ferme"} à ${ohFmt(now[1])}` };
  const later = ohSpans(p.oh[day]).filter(([a]) => a > m).sort((x, y) => x[0] - y[0])[0];
  if (later) return { open: false, txt: `ouvre à ${ohFmt(later[0])}` };
  for (let i = 1; i <= 7; i++) {
    const s = ohSpans(p.oh[(day + i) % 7]).sort((x, y) => x[0] - y[0])[0];
    if (s) return { open: false, txt: `ouvre ${i === 1 ? "demain" : OH_DAYS[(day + i) % 7]} à ${ohFmt(s[0])}` };
  }
  return { open: false, txt: "" };
}
// Ligne d'état en haut de la fiche.
function ohLine(p) {
  if (p.closed) return `<div class="oh-line gone"><i></i><b>Fermé définitivement</b></div>`;
  const st = openState(p);
  if (!st) return "";
  return `<div class="oh-line ${st.open ? (st.soon ? "soon" : "open") : "shut"}"><i></i><b>${st.open ? "Ouvert" : "Fermé"}</b>${st.txt ? ` · ${esc(st.txt)}` : ""}</div>`;
}
// Ligne « Horaires » des infos : aujourd'hui, et la semaine en touchant.
function ohRow(p) {
  if (!hasOh(p)) return infoRow("clock", "Horaires", p.hours, "");
  const day = (new Date().getDay() + 6) % 7;
  const src = p.ohSrc === "osm" ? "OpenStreetMap" : "recherche web";
  const when = p.ohAt ? ` le ${new Date(p.ohAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}` : "";
  return `<div class="info-row oh-row">${icon("clock")}<span class="info-label">Horaires</span>
    <details class="oh-week"><summary>Aujourd'hui : ${esc(ohDayTxt(p.oh[day]))}</summary>
    <ul>${OH_DAYS.map((d, i) => `<li class="${i === day ? "today" : ""}"><span>${d}</span><span>${esc(ohDayTxt(p.oh[i]))}</span></li>`).join("")}</ul>
    <small>D'après ${src}${when}. Les horaires peuvent changer (fériés, vacances).</small></details></div>`;
}
// Petite étiquette sur les cartes : seulement « Ouvert » (et « Fermé définitivement »), pour rester discret.
function ohTag(p) {
  if (p.closed) return '<span class="tag gone">Fermé définitivement</span>';
  const st = openState(p);
  return st && st.open ? '<span class="tag open">Ouvert</span>' : "";
}

/* ---------- Fermé définitivement ---------- */
function closedBanner(p) {
  if (!p.closed) return "";
  const src = /^https?:/.test(p.closedSrc || "") ? ` <a href="${esc(p.closedSrc)}" target="_blank" rel="noopener">Voir la source</a>` : "";
  return `<div class="closed-banner"><b>Ce lieu semble fermé définitivement.</b>${src}
    <button class="link-btn" data-notclosed>Ce n'est pas fermé</button></div>`;
}

/* ---------- Collections perso ---------- */
// store « colls » : [{ id, name, ids: [...] }], suivies par le compte comme les envies.
const colls = () => store.get("colls", []);
const saveColls = (c) => store.set("colls", c);
const collOf = (id) => colls().find((c) => c.id === id);
function collLine(p) {
  const mine = colls().filter((c) => c.ids.includes(p.id));
  return `<div class="coll-line">${mine.map((c) => `<button class="coll-chip" data-coll-open="${esc(c.id)}">${esc(c.name)}</button>`).join("")}
    <button class="link-btn" data-coll-pick>${mine.length ? "Modifier" : "＋ Ajouter à une collection"}</button></div>
    <div class="coll-pick" id="collPick" hidden></div>`;
}
function collPickHtml(p) {
  const all = colls();
  return `${all.length ? `<div class="coll-opts">${all.map((c) => `<button class="coll-opt ${c.ids.includes(p.id) ? "on" : ""}" data-coll-toggle="${esc(c.id)}" aria-pressed="${c.ids.includes(p.id)}">${esc(c.name)}<small>${c.ids.length}</small></button>`).join("")}</div>` : ""}
    <form class="coll-new" id="collNew"><input name="n" maxlength="40" placeholder="Nouvelle collection : Date, Anniversaire…" autocomplete="off" enterkeyhint="done"><button class="btn" type="submit">Créer</button></form>`;
}
// Rangée de collections en haut de « Mes envies ».
function collRail() {
  const all = colls();
  return `${all.length ? `<h3 class="coll-h">Mes collections</h3>` : ""}<div class="coll-rail">${all.map((c) => `<button class="coll-card" data-coll-open="${esc(c.id)}"><b>${esc(c.name)}</b><small>${c.ids.length} adresse${c.ids.length > 1 ? "s" : ""}</small></button>`).join("")}
    ${all.length ? "" : `<p class="coll-hint">Range tes adresses en collections (Date, Anniversaire, Avec les parents…) depuis une fiche, puis envoie-les à un ami.</p>`}</div>`;
}
// Page d'une collection (la mienne, ou reçue par lien).
function collBody(L, head) {
  if (L.sharedColl) {
    const sc = L.sharedColl, items = sc.i.map((id) => S.places.find((p) => p.id === id)).filter(Boolean);
    return head(esc(sc.n), `<p class="coll-sub">Collection reçue · ${items.length} adresse${items.length > 1 ? "s" : ""}</p>
      <div class="coll-acts"><button class="btn primary" data-coll-save>Enregistrer dans mes collections</button></div>`)
      + `<div class="cards" style="margin-top:14px">${items.map((p) => gfCard(p)).join("") || `<p class="none">Ces adresses ne sont pas dans ta liste.</p>`}</div>`;
  }
  const c = collOf(L.coll);
  if (!c) return head("Collection") + `<p class="none">Cette collection n'existe plus.</p>`;
  const items = c.ids.map((id) => S.places.find((p) => p.id === id)).filter(Boolean);
  return head(esc(c.name), `<div class="coll-acts"><button class="btn" data-coll-share="${esc(c.id)}">${icon("share")}Envoyer</button>
      <button class="btn ghost" data-coll-rename="${esc(c.id)}">Renommer</button><button class="btn ghost danger" data-coll-del="${esc(c.id)}">Supprimer</button></div>`)
    + `<div class="cards" style="margin-top:14px">${items.map((p) => gfCard(p)).join("") || `<p class="none">Ajoute des adresses depuis leur fiche (bouton « Ajouter à une collection »).</p>`}</div>`;
}
// Lien de partage : le nom et la liste des adresses, lisibles par n'importe qui ayant l'appli.
const b64e = (s) => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const b64d = (s) => decodeURIComponent(escape(atob(s.replace(/-/g, "+").replace(/_/g, "/"))));
async function shareColl(c) {
  const ids = c.ids.filter((id) => S.base.some((p) => p.id === id)); // les adresses ajoutées sur ce téléphone seul ne voyagent pas
  const url = `${location.origin}${location.pathname}?collection=${b64e(JSON.stringify({ n: c.name, i: ids }))}`;
  const text = `${c.name} : ${ids.length} adresse${ids.length > 1 ? "s" : ""} sur Good Food`;
  try {
    if (navigator.share) await navigator.share({ title: c.name, text, url });
    else { await navigator.clipboard.writeText(`${text}\n${url}`); toast("Lien copié"); }
  } catch { /* partage annulé */ }
}
// Ouverture d'un lien ?collection=… : appelé au démarrage. Renvoie true si le lien a été pris en charge.
function collFromLink(qs) {
  const raw = qs.get("collection");
  if (!raw) return false;
  history.replaceState(null, "", location.pathname);
  try {
    const o = JSON.parse(b64d(raw));
    if (!o || typeof o.n !== "string" || !Array.isArray(o.i)) throw new Error();
    show("accueil");
    gfOpen({ sharedColl: { n: o.n.slice(0, 40), i: o.i.filter((x) => typeof x === "string").slice(0, 300) } });
  } catch { show("accueil"); toast("Lien de collection illisible"); }
  return true;
}

/* ---------- Événements ---------- */
let orderTimer;
document.addEventListener("input", (e) => {
  if (e.target.id !== "toOrder" || !current) return;
  const id = current.id, v = e.target.value;
  clearTimeout(orderTimer);
  orderTimer = setTimeout(() => { setEdit(id, { toOrder: v.trim() }); current = S.places.find((x) => x.id === id); }, 400);
});
document.addEventListener("submit", (e) => {
  if (e.target.id !== "collNew" || !current) return;
  e.preventDefault();
  const name = e.target.n.value.trim();
  if (!name) return;
  const all = colls(), id = current.id;
  let c = all.find((x) => norm(x.name) === norm(name));
  if (!c) { c = { id: "c-" + Date.now().toString(36), name, ids: [] }; all.push(c); }
  if (!c.ids.includes(id)) c.ids.push(id);
  saveColls(all); openSheet(id, true); toast(`Ajouté à « ${name} »`);
});
document.addEventListener("click", (e) => {
  const b = e.target.closest && e.target.closest("button");
  if (!b) return;
  if (b.hasAttribute("data-coll-pick") && current) {
    const box = $("#collPick"); box.innerHTML = collPickHtml(current); box.hidden = !box.hidden;
    if (!box.hidden && !colls().length) box.querySelector("input").focus();
    return;
  }
  if (b.dataset.collToggle && current) {
    const all = colls(), c = all.find((x) => x.id === b.dataset.collToggle), id = current.id;
    if (!c) return;
    c.ids = c.ids.includes(id) ? c.ids.filter((x) => x !== id) : [...c.ids, id];
    saveColls(all); openSheet(id, true);
    const box = $("#collPick"); box.innerHTML = collPickHtml(current); box.hidden = false;
    return;
  }
  if (b.hasAttribute("data-notclosed") && current) { const id = current.id; setEdit(id, { closed: 0 }); renderAll(); openSheet(id, true); toast("Badge retiré"); return; }
  if (b.dataset.collOpen) { closeSheet(); if (S.view !== "accueil") location.hash = "accueil"; setTimeout(() => gfOpen({ coll: b.dataset.collOpen }), 0); return; }
  if (b.dataset.collShare) { const c = collOf(b.dataset.collShare); if (c) shareColl(c); return; }
  if (b.dataset.collRename) {
    const all = colls(), c = all.find((x) => x.id === b.dataset.collRename);
    const n = c && prompt("Nouveau nom de la collection", c.name);
    if (n && n.trim()) { c.name = n.trim().slice(0, 40); saveColls(all); renderHome(); }
    return;
  }
  if (b.dataset.collDel) {
    if (b.dataset.confirm) { saveColls(colls().filter((x) => x.id !== b.dataset.collDel)); gfOpen({ want: 1 }); toast("Collection supprimée"); }
    else { b.dataset.confirm = "1"; b.textContent = "Touche encore pour confirmer"; }
    return;
  }
  if (b.hasAttribute("data-coll-save") && GF.list?.sharedColl) {
    const sc = GF.list.sharedColl, all = colls();
    const c = { id: "c-" + Date.now().toString(36), name: all.some((x) => x.name === sc.n) ? `${sc.n} (reçue)` : sc.n, ids: sc.i.filter((id) => S.places.some((p) => p.id === id)) };
    all.push(c); saveColls(all); gfOpen({ coll: c.id }); toast("Collection enregistrée");
  }
});
// L'état « ouvert / fermé » change avec l'heure : on rafraîchit l'écran quand on revient dans l'appli.
let ohHiddenAt = 0;
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") { ohHiddenAt = Date.now(); return; }
  if (!S.places.length || Date.now() - ohHiddenAt < 120000) return;
  if (S.view === "accueil" && typeof renderHome === "function") renderHome();
  if (current && !$("#sheet").hidden) openSheet(current.id, true);
});
