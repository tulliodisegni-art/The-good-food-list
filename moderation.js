/* Cozy Spots : signaler un contenu, bloquer un membre, aide et confidentialité.
   Exigé par l'App Store (règle 1.2, contenus entre membres) et par Google Play. Tables : supabase/moderation.sql.
   Les contenus signalés sont masqués tout de suite sur ce téléphone ; le propriétaire est prévenu par notification. */
(function () {
  const SITE = (window.GATE_CFG && window.GATE_CFG.link) || "https://tulliodisegni-art.github.io/The-good-food-list/";
  const CONTACT = "contact@officinadisegni.fr";
  const PAGES = { confidentialite: SITE + "confidentialite.html", cgu: SITE + "cgu.html", suppression: SITE + "supprimer-compte.html" };
  const KEY = "gfl.signales";
  const get = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } };
  const set = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  const h = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const say = (m) => (typeof toast === "function" ? toast(m) : alert(m));
  const acc = () => (window.Account && window.Account.user ? window.Account : null);
  const redraw = () => { try { rebuild(); renderAll(); if (current && !document.getElementById("sheet").hidden) openSheet(current.id, true); } catch (e) {} };

  /* ---------- signaler ---------- */
  const isHidden = (kind, id) => get(KEY, []).includes(kind + ":" + id);
  async function report(kind, target, label, targetUser, hide) {
    const a = acc();
    if (!a) { location.href = `mailto:${CONTACT}?subject=${encodeURIComponent("Signalement Cozy Spots")}&body=${encodeURIComponent(`Contenu signalé : ${label || target}\nRaison : `)}`; return; }
    const reason = prompt(`Pourquoi signales-tu ${label ? "« " + label + " »" : "ce contenu"} ?\n(choquant, faux, spam, harcèlement, erreur sur la fiche…)`, "");
    if (reason === null) return;
    const { error } = await a.sb.from("gf_reports").insert({ kind, target: String(target).slice(0, 200), target_user: targetUser || null, label: String(label || "").slice(0, 200), reason: reason.trim().slice(0, 1000) });
    if (error) { say(`Signalement non envoyé : écris-nous à ${CONTACT}`); return; }
    if (hide) { const l = get(KEY, []); l.push(kind + ":" + target); set(KEY, l); redraw(); }
    say(hide ? "Merci, c'est signalé. Nous regardons sous 24 h, et ce contenu est masqué pour toi." : "Merci, c'est signalé. Nous regardons sous 24 h.");
  }

  /* ---------- bloquer ---------- */
  async function block(uid, name) {
    const a = acc(); if (!a || !uid) return;
    if (!confirm(`Bloquer ${name} ?\n\nVous ne vous suivrez plus : ${name} ne verra plus tes adresses, tu ne verras plus les siennes, et il ou elle ne pourra plus te demander de te suivre. Tu pourras le débloquer dans les Réglages.`)) return;
    const { error } = await a.sb.rpc("gf_block", { p_user: uid });
    if (error) { say(/liste de base/.test(error.message) ? "La liste de base ne peut pas être bloquée." : "Blocage impossible, réessaie avec du réseau."); return; }
    say(`${name} est bloqué`);
    if (window.Social && window.Social.reload) window.Social.reload();
    if (document.querySelector("[data-help]")) fillBlocked();
  }
  async function fillBlocked() {
    const box = document.querySelector("[data-blocked-list]"), a = acc(); if (!box || !a) return;
    const { data: rows, error } = await a.sb.from("gf_blocks").select("blocked");
    if (error) { box.innerHTML = ""; return; }
    if (!rows || !rows.length) { box.innerHTML = `<li><span class="muted small">Aucun membre bloqué.</span></li>`; return; }
    const ids = rows.map((r) => r.blocked);
    const { data: profs } = await a.sb.from("gf_profiles").select("user_id,handle,name").in("user_id", ids);
    const nom = (id) => { const p = (profs || []).find((x) => x.user_id === id); return p ? p.name || "@" + p.handle : "Membre"; };
    box.innerHTML = ids.map((id) => `<li><span>${h(nom(id))}</span><button class="btn ghost small" data-mod-unblock="${h(id)}">Débloquer</button></li>`).join("");
  }

  /* ---------- Réglages : aide, documents, IA, membres bloqués ---------- */
  function helpHtml() {
    const ai = get("gfl.aiOk", false);
    setTimeout(fillBlocked, 0);
    return `<section class="block" data-help><h3>Aide et confidentialité</h3>
      <p class="muted small">Une question, un problème, un contenu à signaler : <a href="mailto:${CONTACT}">${CONTACT}</a></p>
      <div class="row-actions"><a class="btn ghost small" href="${PAGES.confidentialite}" target="_blank" rel="noopener">Confidentialité</a>
        <a class="btn ghost small" href="${PAGES.cgu}" target="_blank" rel="noopener">Conditions d'utilisation</a></div>
      <h4>Lecture par l'IA</h4>
      <p class="muted small">${ai ? "Autorisée" : "Pas autorisée"} : pour remplir une fiche, tes captures, le lien et le texte sont envoyés à un service d'IA (Google Gemini ou Anthropic Claude). Rien ne part sans ton accord.</p>
      <div class="row-actions"><button class="btn small" data-mod-ai="${ai ? "0" : "1"}">${ai ? "Retirer mon accord" : "Autoriser"}</button></div>
      ${acc() ? `<h4>Membres bloqués</h4><ul class="social-list" data-blocked-list><li><span class="muted small">Chargement…</span></li></ul>` : ""}
    </section>`;
  }

  // Petits boutons « Signaler » et « Bloquer » glissés dans les fiches et les listes d'amis.
  const reportBtn = (kind, target, label, uid, hide) =>
    `<button class="linkish small mod-report" data-mod-report="${h(kind)}" data-target="${h(target)}" data-label="${h(label)}"${uid ? ` data-uid="${h(uid)}"` : ""}${hide ? " data-hide" : ""}>Signaler</button>`;
  const blockBtn = (uid, name) => `<button class="linkish small mod-block" data-mod-block="${h(uid)}" data-name="${h(name)}">Bloquer</button>`;

  const st = document.createElement("style");
  st.textContent = `.mod-report,.mod-block{opacity:.7;margin-left:6px}.mod-report:hover,.mod-block:hover{opacity:1}
.sheet-report{display:block;margin:14px auto 0;text-align:center}[data-help] h4{margin:12px 0 4px;font-size:.9rem}`;
  document.head.appendChild(st);

  document.addEventListener("click", (e) => {
    const r = e.target.closest("[data-mod-report]");
    if (r) { e.preventDefault(); e.stopPropagation(); report(r.dataset.modReport, r.dataset.target, r.dataset.label, r.dataset.uid, r.hasAttribute("data-hide")); return; }
    const b = e.target.closest("[data-mod-block]");
    if (b) { e.preventDefault(); e.stopPropagation(); block(b.dataset.modBlock, b.dataset.name || "ce membre"); return; }
    const u = e.target.closest("[data-mod-unblock]");
    if (u && acc()) { acc().sb.from("gf_blocks").delete().eq("blocker", acc().user.id).eq("blocked", u.dataset.modUnblock).then(() => { say("Membre débloqué"); fillBlocked(); }); return; }
    const ai = e.target.closest("[data-mod-ai]");
    if (ai) { set("gfl.aiOk", ai.dataset.modAi === "1"); say(ai.dataset.modAi === "1" ? "Lecture par l'IA autorisée" : "Accord retiré : plus rien n'est envoyé à l'IA"); if (typeof openSettings === "function") openSettings(); }
  }, true);

  window.Moderation = { CONTACT, PAGES, isHidden, report, block, reportBtn, blockBtn, helpHtml };
})();
