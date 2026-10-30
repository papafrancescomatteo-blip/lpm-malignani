// Portale staff: login (password o badge), dashboard, assegnazioni, certificati, documenti, utenti, log.
import { api, session, downloadAuth } from "./api.js";
import { $, $$, esc, icon, fmtDate, fmtDateTime, fmtSize, todayISO, LABEL, chipFor, toast, modal, formData, busy } from "./ui.js";

const MENU = [
  ["/staff", "Cruscotto", icon.dash, ["admin", "segreteria", "tecnico"]],
  ["/staff/assegnazioni", "Assegnazioni", icon.box, ["admin", "segreteria", "tecnico"]],
  ["/staff/certificati", "Certificati", icon.cert, ["admin", "segreteria"]],
  ["/staff/documenti", "Documenti", icon.doc, ["admin", "segreteria", "tecnico"]],
  ["/staff/avviso", "Avviso in home", icon.bell, ["admin", "segreteria"]],
  ["/staff/utenti", "Utenti e badge", icon.users, ["admin"]],
  ["/staff/log", "Registro attività", icon.list, ["admin"]],
  ["/staff/profilo", "Il mio profilo", icon.key, ["admin", "segreteria", "tecnico"]],
];
const can = (...roles) => roles.includes(session.user?.role);
const opts = (obj, sel) => Object.entries(obj).map(([k, v]) => `<option value="${k}" ${k === sel ? "selected" : ""}>${esc(v)}</option>`).join("");
const setPath = (o, path, v) => { const p = path.split("."); let c = o; p.slice(0, -1).forEach(k => { c = c[k] ??= {}; }); c[p.at(-1)] = v; };
const input = (name, label, v = "", extra = "") => `<div><label for="f_${name}">${label}</label><input id="f_${name}" name="${name}" value="${esc(v)}" ${extra}></div>`;

// ------------------------------------------------------------------ login
export function renderLogin(root) {
  root.innerHTML = `<div class="login-page"><div class="login-box">
    <div class="logo"><img src="/assets/shield.png" alt=""><div><b style="font:700 1.2rem var(--f-head)">Accesso staff</b><br><span class="muted" style="font-size:.85rem">Laboratorio Prove Materiali · Malignani</span></div></div>
    <div class="tabs" role="tablist"><button class="on" data-tab="pw" role="tab">Utente e password</button><button data-tab="badge" role="tab">Badge</button></div>
    <div id="err"></div>
    <form id="pwf" data-pane="pw"><div style="margin-bottom:14px"><label for="u">Utente</label><input id="u" name="username" autocomplete="username" required autofocus></div>
      <div style="margin-bottom:18px"><label for="p">Password</label><input id="p" name="password" type="password" autocomplete="current-password" required></div>
      <button class="btn primary" style="width:100%">Entra</button></form>
    <div data-pane="badge" hidden><div class="badge-zone" id="bz" tabindex="0">${icon.big('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h4"/>')}<p style="margin:10px 0 0"><b>Passa il badge sul lettore</b><br><span class="muted" style="font-size:.9rem">Il lettore invia il codice da solo. Se non succede, clicca qui.</span></p>
      <input id="bi" type="password" autocomplete="off" aria-label="Codice badge" style="position:absolute;opacity:0;pointer-events:none;width:1px"></div></div>
    <p style="text-align:center;margin:18px 0 0"><a href="#/" class="muted" style="font-size:.9rem">← Torna al sito</a></p></div></div>`;
  const err = (m) => { $("#err").innerHTML = m ? `<div class="alert err" role="alert">${esc(m)}</div>` : ""; };
  const done = (r) => { session.token = r.token; session.user = r.user; location.hash = "#/staff"; location.reload(); };
  const bi = $("#bi"), bz = $("#bz");
  const focusBadge = () => { bi.focus(); bz.classList.add("focus"); };
  bi.addEventListener("blur", () => bz.classList.remove("focus"));
  bz.addEventListener("click", focusBadge);
  $$(".tabs button").forEach(b => b.addEventListener("click", () => {
    $$(".tabs button").forEach(x => x.classList.toggle("on", x === b));
    $$("[data-pane]").forEach(p => { p.hidden = p.dataset.pane !== b.dataset.tab; });
    err(""); b.dataset.tab === "badge" ? focusBadge() : $("#u").focus();
  }));
  bi.addEventListener("keydown", async (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault(); const code = bi.value; bi.value = ""; if (code.length < 3) return;
    try { done(await api("/auth/badge", { method: "POST", body: { badge: code } })); } catch (x) { err(x.message); }
  });
  $("#pwf").addEventListener("submit", (e) => {
    e.preventDefault();
    busy(e.target.querySelector("button"), async () => {
      try { done(await api("/auth/login", { method: "POST", body: formData(e.target) })); } catch (x) { err(x.message); }
    });
  });
}

// ------------------------------------------------------------------ guscio dell'app
export async function renderApp(root, path) {
  if (!session.user) {
    try { session.user = await api("/auth/me"); } catch { session.token = null; return renderLogin(root); }
  }
  const items = MENU.filter(m => m[3].includes(session.user.role));
  const cur = items.find(m => m[0] === path) || items[0];
  root.innerHTML = `<div class="mnav"><b>LPM · Staff</b><button id="mb" aria-label="Menu">☰</button></div>
  <div class="app"><aside class="side" id="side"><a class="brand" href="#/"><img src="/assets/shield.png" alt=""><span><b>LPM Malignani</b><small>Area staff</small></span></a>
    ${items.map(m => `<a class="item ${m === cur ? "on" : ""}" href="#${m[0]}">${m[2]}<span>${m[1]}</span></a>`).join("")}
    <div class="me"><b>${esc(session.user.name)}</b><span>${LABEL.role[session.user.role]}</span><br><a href="#" id="lo" style="color:#f5a54a;display:inline-block;margin-top:8px">Esci</a></div></aside>
  <main class="main"><header><h1>${cur[1]}</h1><div id="actions"></div></header><div id="view"><p class="muted">Caricamento…</p></div></main></div>`;
  $("#mb").onclick = () => $("#side").classList.toggle("open");
  $("#lo").onclick = (e) => { e.preventDefault(); session.token = null; session.user = null; location.hash = "#/staff"; location.reload(); };
  const view = $("#view");
  try { await VIEWS[cur[0]](view, $("#actions")); }
  catch (e) { view.innerHTML = `<div class="alert err">${esc(e.message)}</div>`; }
}

// ------------------------------------------------------------------ cruscotto
async function dashboard(view) {
  const d = await api("/staff/dashboard");
  const k = (n, l, c = "") => `<div class="kpi ${c}"><b>${n}</b><span>${l}</span></div>`;
  view.innerHTML = `<p class="muted">Buongiorno, <b>${esc(session.user.name)}</b>.</p>
  <div class="kpis">${k(d.mie_aperte, "assegnate a me, aperte", "o")}${k(d.assegnazioni.ricevuta, "materiali ricevuti")}${k(d.assegnazioni.in_prova, "in prova", "o")}
    ${can("admin", "segreteria") ? k(d.certificati.in_lavorazione, "certificati in lavorazione") + k(d.certificati.pronto, "pronti da consegnare", "g") : k(d.assegnazioni.completata, "completate", "g")}</div>
  <div class="grid g2"><div><h3>Ultime assegnazioni</h3>${assTable(d.recenti)}</div>
  <div><h3>Conservazione campioni in scadenza</h3><p class="muted" style="font-size:.9rem">I materiali si conservano 90 giorni dall'emissione, poi vengono smaltiti.</p>
  ${d.scadenze_conservazione.length ? assTable(d.scadenze_conservazione, true) : `<div class="table-wrap"><div class="empty">Nessuna scadenza nei prossimi 14 giorni.</div></div>`}</div></div>`;
  bindAssRows(view);
}

// ------------------------------------------------------------------ assegnazioni
function assTable(items, scad = false) {
  if (!items.length) return `<div class="table-wrap"><div class="empty">Nessuna assegnazione.</div></div>`;
  return `<div class="table-wrap"><table class="t"><thead><tr><th>Verbale</th><th>Materiali</th><th>Settore</th>${scad ? "<th>Scade</th>" : "<th>Arrivo</th>"}<th>Stato</th></tr></thead><tbody>
  ${items.map(a => `<tr class="click" data-ass="${a.id}"><td class="mono"><b>${esc(a.numero_verbale)}</b>${a.priorita === "urgente" ? ' <span class="chip bad">urgente</span>' : ""}</td>
  <td>${esc(a.materiali.slice(0, 70))}<br><span class="muted" style="font-size:.82rem">${esc(a.richiedente?.nome || "")}</span></td><td>${LABEL.settore[a.settore]}</td>
  <td>${fmtDate(scad ? a.conservazione_fino : a.data_arrivo)}</td><td>${chipFor("ass", a.stato)}</td></tr>`).join("")}</tbody></table></div>`;
}
const bindAssRows = (root) => $$("[data-ass]", root).forEach(r => r.addEventListener("click", () => assDetail(r.dataset.ass)));

async function assegnazioni(view, actions) {
  if (can("admin", "segreteria")) { actions.innerHTML = `<button class="btn primary" id="new">+ Nuova assegnazione</button>`; $("#new").onclick = () => assForm(); }
  view.innerHTML = `<div class="tools"><input id="q" type="search" placeholder="Cerca verbale, materiale, richiedente…" aria-label="Cerca">
    <select id="fs" aria-label="Stato"><option value="">Tutti gli stati</option>${opts(LABEL.stato_ass)}</select>
    <select id="fk" aria-label="Settore"><option value="">Tutti i settori</option>${opts(LABEL.settore)}</select>
    <label class="check" style="margin:0"><input type="checkbox" id="fm"> Solo le mie</label></div><div id="list"></div>`;
  let t;
  const load = async () => {
    const p = new URLSearchParams({ q: $("#q").value, stato: $("#fs").value, settore: $("#fk").value, mie: $("#fm").checked });
    $("#list").innerHTML = assTable(await api("/staff/assegnazioni?" + p)); bindAssRows($("#list"));
  };
  ["fs", "fk", "fm"].forEach(i => $("#" + i).addEventListener("change", load));
  $("#q").addEventListener("input", () => { clearTimeout(t); t = setTimeout(load, 250); });
  await load();
}

async function assForm(a = null) {
  const colleghi = await api("/staff/colleghi");
  const v = a || { modello: "D_UFF_08", settore: "edilizia", data_arrivo: todayISO(), priorita: "normale", richiedente: {}, azienda: {}, committente: {}, fatturazione: {}, campioni: [{}], copie: 1, formato_rapporto: "pdf_firmato", consegna: "ritiro_a_mano" };
  const r = v.richiedente || {}, az = v.azienda || {}, co = v.committente || {}, fa = v.fatturazione || {};
  const parte = (p, o) => `<div class="grid g2">${input(p + ".nome", "Nome / intestazione", o.nome)}${input(p + ".indirizzo", "Indirizzo", o.indirizzo)}${input(p + ".email", "Email", o.email, 'type="email"')}${input(p + ".pec", "PEC", o.pec)}${input(p + ".telefono", "Telefono", o.telefono)}</div>`;
  const rowC = (c = {}) => `<div class="rowline"><input data-f="sigla" placeholder="Sigla" value="${esc(c.sigla)}"><input data-f="descrizione" placeholder="Descrizione (es. barre Ø16 B450C)" value="${esc(c.descrizione)}"><input data-f="quantita" placeholder="Q.tà" value="${esc(c.quantita)}"><button type="button" class="btn danger sm" data-rm aria-label="Rimuovi">✕</button></div>`;
  const m = modal(a ? `Modifica ${a.numero_verbale}` : "Nuova assegnazione (materiali ricevuti)", `<form id="af">
    <fieldset><legend>Richiesta</legend><div class="grid g3">
      <div class="span2"><label for="f_modello">Modello di domanda</label><select id="f_modello" name="modello">${opts(LABEL.modello, v.modello)}</select></div>
      <div><label for="f_settore">Settore</label><select id="f_settore" name="settore">${opts(LABEL.settore, v.settore)}</select></div>
      ${input("data_arrivo", "Data di arrivo", v.data_arrivo, 'type="date" required')}
      <div><label for="f_priorita">Priorità</label><select id="f_priorita" name="priorita">${opts({ normale: "Normale", urgente: "Urgente" }, v.priorita)}</select></div>
      <div><label for="f_assegnato_a">Assegna a</label><select id="f_assegnato_a" name="assegnato_a"><option value="">— nessuno —</option>${colleghi.map(c => `<option value="${c.id}" ${c.id === v.assegnato_a ? "selected" : ""}>${esc(c.name)} (${LABEL.role[c.role]})</option>`).join("")}</select></div></div></fieldset>
    <fieldset><legend>Richiedente</legend>${parte("richiedente", r)}<div style="margin-top:12px">${input("qualita_richiedente", "In qualità di (direttore lavori, direttore tecnico, collaudatore…)", v.qualita_richiedente)}</div></fieldset>
    <fieldset><legend>Azienda / impresa</legend>${parte("azienda", az)}</fieldset>
    <fieldset><legend>Committente e costruzione</legend>${parte("committente", co)}<div class="grid g2" style="margin-top:12px">${input("costruzione", "Costruzione / lavori", v.costruzione)}${input("localita", "Località", v.localita)}</div></fieldset>
    <fieldset><legend>Materiali e prove</legend><div class="grid"><div><label for="f_materiali">Materiali o componenti (denominazione per il frontespizio del rapporto)</label><textarea id="f_materiali" name="materiali" required minlength="2">${esc(v.materiali)}</textarea></div>
      <div class="grid g2">${input("tipo_prove", "Tipo di prove", v.tipo_prove)}${input("norme", "Norme di riferimento", v.norme)}</div>
      <div><label>Campioni</label><div id="camps">${(v.campioni?.length ? v.campioni : [{}]).map(rowC).join("")}</div><button type="button" class="btn light sm" id="addc">+ campione</button></div>
      <div class="grid g3">${input("ddt", "Documento di trasporto", v.ddt)}${input("verbale_prelievo_n", "Verbale di prelievo n.", v.verbale_prelievo_n)}${input("verbale_prelievo_data", "del", v.verbale_prelievo_data, 'type="date"')}</div></div></fieldset>
    <fieldset><legend>Fatturazione</legend><div class="grid g3">
      <div><label for="f_fi">Intestatario fattura</label><select id="f_fi" name="fatturazione.intestatario">${opts({ richiedente: "Richiedente", azienda: "Azienda", committente: "Committente", impresa: "Impresa" }, fa.intestatario)}</select></div>
      ${input("fatturazione.partita_iva", "Partita IVA", fa.partita_iva)}${input("fatturazione.codice_fiscale", "Codice fiscale", fa.codice_fiscale)}
      ${input("fatturazione.email_fattura", "Email per la fattura", fa.email_fattura, 'type="email"')}<div class="span2">${input("fatturazione.pec_o_sdi", "PEC o codice univoco SDI", fa.pec_o_sdi)}</div></div></fieldset>
    <fieldset><legend>Rapporto di prova e consegna</legend><div class="grid g3">
      <div><label for="f_fr">Formato</label><select id="f_fr" name="formato_rapporto">${opts({ pdf_firmato: "PDF con firma digitale", cartaceo: "Cartaceo" }, v.formato_rapporto)}</select></div>
      ${input("copie", "Copie (se cartaceo)", v.copie ?? 1, 'type="number" min="0" max="20"')}
      <div><label for="f_co">Consegna</label><select id="f_co" name="consegna">${opts(LABEL.consegna, v.consegna)}</select></div>
      ${input("delega_consegna", "Delega alla consegna", v.delega_consegna)}${input("email_avviso", "Email per avviso / spedizione", v.email_avviso, 'type="email"')}
      <div style="align-self:end"><label class="check"><input type="checkbox" name="restituzione_campioni" ${v.restituzione_campioni ? "checked" : ""}> Restituzione dei campioni</label></div></div>
      <div style="margin-top:12px"><label for="f_note">Note</label><textarea id="f_note" name="note">${esc(v.note)}</textarea></div></fieldset></form>`,
    `<button class="btn light" data-close>Annulla</button><button class="btn primary" id="save">Salva</button>`);
  const camps = $("#camps", m.el);
  $("#addc", m.el).onclick = () => camps.insertAdjacentHTML("beforeend", rowC());
  camps.addEventListener("click", (e) => { if (e.target.closest("[data-rm]")) e.target.closest(".rowline").remove(); });
  $("#f_modello", m.el).addEventListener("change", (e) => { const s = { D_UFF_09: "cicli", D_UFF_07: "edilizia", D_UFF_10: "edilizia", D_UFF_11: "meccanica" }[e.target.value]; if (s) $("#f_settore", m.el).value = s; });
  $("#save", m.el).onclick = (e) => busy(e.target, async () => {
    const form = $("#af", m.el);
    if (!form.reportValidity()) return;
    const f = formData(form), body = {};
    Object.entries(f).forEach(([k, val]) => setPath(body, k, val));
    body.campioni = $$(".rowline", form).map(row => Object.fromEntries($$("[data-f]", row).map(i => [i.dataset.f, i.value]))).filter(c => c.sigla || c.descrizione);
    body.copie = +body.copie || 0; body.assegnato_a = body.assegnato_a || null;
    try {
      const saved = a ? await api("/staff/assegnazioni/" + a.id, { method: "PUT", body: { ...body, stato: a.stato } }) : await api("/staff/assegnazioni", { method: "POST", body });
      m.close(); toast(a ? "Assegnazione aggiornata" : `Registrata con verbale ${saved.numero_verbale}`); renderApp($("#app"), "/staff/assegnazioni");
    } catch (x) { toast(x.message, true); }
  });
}

async function assDetail(id) {
  const a = await api("/staff/assegnazioni/" + id);
  const seg = can("admin", "segreteria");
  const parte = (p) => (p && p.nome ? `${esc(p.nome)}${p.indirizzo ? "<br><span class='muted'>" + esc(p.indirizzo) + "</span>" : ""}${p.email ? "<br><span class='muted'>" + esc(p.email) + "</span>" : ""}` : "—");
  const m = modal(`Verbale ${a.numero_verbale}`, `
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px">${chipFor("ass", a.stato)}<span class="chip">${LABEL.settore[a.settore]}</span><span class="chip">${a.modello.replaceAll("_", " ")}</span>${a.priorita === "urgente" ? '<span class="chip bad">urgente</span>' : ""}${a.restituzione_campioni ? '<span class="chip warn">restituire i campioni</span>' : ""}</div>
    <div class="card" style="margin-bottom:16px"><dl class="kv"><dt>Materiali</dt><dd>${esc(a.materiali)}</dd><dt>Prove richieste</dt><dd>${esc(a.tipo_prove || "—")}</dd><dt>Norme</dt><dd>${esc(a.norme || "—")}</dd>
      <dt>Arrivato il</dt><dd>${fmtDate(a.data_arrivo)}</dd><dt>Richiedente</dt><dd>${parte(a.richiedente)}${a.qualita_richiedente ? `<br><span class="muted">in qualità di ${esc(a.qualita_richiedente)}</span>` : ""}</dd>
      <dt>Azienda</dt><dd>${parte(a.azienda)}</dd><dt>Committente</dt><dd>${parte(a.committente)}</dd>${a.costruzione ? `<dt>Costruzione</dt><dd>${esc(a.costruzione)} ${esc(a.localita)}</dd>` : ""}
      ${a.ddt || a.verbale_prelievo_n ? `<dt>DDT / prelievo</dt><dd>${esc(a.ddt || "—")} · verbale prelievo ${esc(a.verbale_prelievo_n || "—")} ${a.verbale_prelievo_data ? "del " + fmtDate(a.verbale_prelievo_data) : ""}</dd>` : ""}
      <dt>Fatturazione</dt><dd>a ${esc(a.fatturazione?.intestatario)} · P.IVA ${esc(a.fatturazione?.partita_iva || "—")} · ${esc(a.fatturazione?.email_fattura || "—")}</dd>
      <dt>Rapporto</dt><dd>${a.formato_rapporto === "pdf_firmato" ? "PDF con firma digitale" : `Cartaceo (${a.copie} copie)`} · ${LABEL.consegna[a.consegna]}${a.delega_consegna ? " · delega: " + esc(a.delega_consegna) : ""}</dd>
      ${a.conservazione_fino ? `<dt>Conservazione fino al</dt><dd><b>${fmtDate(a.conservazione_fino)}</b></dd>` : ""}${a.note ? `<dt>Note</dt><dd>${esc(a.note)}</dd>` : ""}</dl></div>
    ${a.campioni?.length ? `<h3>Campioni (${a.campioni.length})</h3><div class="table-wrap" style="margin-bottom:16px"><table class="t"><tbody>${a.campioni.map(c => `<tr><td class="mono"><b>${esc(c.sigla)}</b></td><td>${esc(c.descrizione)}</td><td>${esc(c.quantita)}</td></tr>`).join("")}</tbody></table></div>` : ""}
    <fieldset><legend>Lavorazione</legend><div class="grid g2"><div><label for="d_st">Stato</label><select id="d_st">${opts(seg ? LABEL.stato_ass : { ricevuta: "Ricevuta", in_prova: "In prova", completata: "Completata" }, a.stato)}</select></div></div>
      <div style="margin-top:12px"><label for="d_pe">Prove eseguite</label><textarea id="d_pe">${esc(a.prove_eseguite)}</textarea></div><div style="margin-top:12px"><label for="d_nt">Note tecniche</label><textarea id="d_nt">${esc(a.note_tecniche)}</textarea></div>
      <p style="margin:12px 0 0"><button class="btn" id="dsave">Salva lavorazione</button></p></fieldset>
    ${a.certificato ? `<div class="alert ok">Certificato emesso: ${chipFor("cert", a.certificato.stato)} · inviato a <b>${esc(a.certificato.destinatario_email)}</b></div>` : ""}
    <h3>Documenti dell'assegnazione</h3>${docList(a.documenti)}
    <form id="up" class="card" style="margin-top:12px"><div class="grid g3"><div><label for="u_t">Titolo</label><input id="u_t" name="titolo" required placeholder="es. Rapporto di prova trazione"></div>
      <div><label for="u_f">File (max 10 MB)</label><input id="u_f" name="file" type="file" required></div><div style="align-self:end"><button class="btn light">Carica</button></div></div></form>
    <h3 style="margin-top:20px">Storico</h3><ul class="hist">${(a.storico || []).map(s => `<li><span>${chipFor("ass", s.stato)}</span><span class="muted">${esc(s.utente)} · ${fmtDateTime(s.data)}</span></li>`).join("")}</ul>`,
    `${seg ? `<button class="btn light" id="ed">Modifica dati</button>${!a.certificato ? `<button class="btn primary" id="em">Emetti certificato</button>` : ""}` : ""}<button class="btn" data-close>Chiudi</button>`);
  bindDocs(m.el, () => { m.close(); assDetail(id); });
  $("#dsave", m.el).onclick = (e) => busy(e.target, async () => {
    try { await api("/staff/assegnazioni/" + id, { method: "PUT", body: { stato: $("#d_st", m.el).value, prove_eseguite: $("#d_pe", m.el).value, note_tecniche: $("#d_nt", m.el).value } }); toast("Salvato"); m.close(); assDetail(id); }
    catch (x) { toast(x.message, true); }
  });
  $("#up", m.el).addEventListener("submit", (e) => { e.preventDefault(); uploadDoc(e.target, { assegnazione_id: id, categoria: "Assegnazione" }, () => { m.close(); assDetail(id); }); });
  if (seg) {
    $("#ed", m.el).onclick = () => { m.close(); assForm(a); };
    $("#em", m.el)?.addEventListener("click", () => { m.close(); certForm(a); });
  }
}

// ------------------------------------------------------------------ documenti (elenco + upload condivisi)
function docList(docs) {
  if (!docs?.length) return `<p class="muted">Nessun documento.</p>`;
  return `<div class="table-wrap"><table class="t"><tbody>${docs.map(d => `<tr><td><b>${esc(d.titolo)}</b><br><span class="muted" style="font-size:.82rem">${esc(d.categoria)} · ${esc(d.creato_da)} · ${fmtDate(d.created)}</span></td><td>${d.pubblico ? '<span class="chip ok">pubblico</span>' : '<span class="chip">interno</span>'}</td>
    <td style="white-space:nowrap">${d.files.map(f => `<button class="btn light sm" data-dl="${d.id}/${f.idx}" data-name="${esc(f.filename)}">${esc(f.formato.toUpperCase())} · ${fmtSize(f.size)}</button>`).join(" ")} <button class="btn danger sm" data-del="${d.id}" aria-label="Elimina">✕</button></td></tr>`).join("")}</tbody></table></div>`;
}
function bindDocs(root, reload) {
  root.addEventListener("click", async (e) => {
    const dl = e.target.closest("[data-dl]"), del = e.target.closest("[data-del]");
    if (dl) { const [id, idx] = dl.dataset.dl.split("/"); try { await downloadAuth(`/staff/documenti/${id}/file/${idx}`, dl.dataset.name); } catch (x) { toast(x.message, true); } }
    if (del && confirm("Eliminare definitivamente il documento?")) { try { await api("/staff/documenti/" + del.dataset.del, { method: "DELETE" }); toast("Documento eliminato"); reload(); } catch (x) { toast(x.message, true); } }
  });
}
function uploadDoc(form, extra, done) {
  const fd = new FormData(form);
  Object.entries(extra).forEach(([k, v]) => fd.set(k, v));
  if (!fd.has("pubblico")) fd.set("pubblico", "false"); else fd.set("pubblico", "true");
  busy(form.querySelector("button"), async () => {
    try { await api("/staff/documenti", { method: "POST", form: fd }); toast("Documento caricato"); done(); } catch (x) { toast(x.message, true); }
  });
}

async function documenti(view) {
  const docs = await api("/staff/documenti");
  const cats = [...new Set(["Modelli di richiesta prove", "Prove e prezzi", "Autorizzazioni e qualità", "Normativa e comunicazioni", "Rapporti di prova", "Altro", ...docs.map(d => d.categoria)])];
  view.innerHTML = `<form id="up" class="card" style="margin-bottom:20px"><h3>Carica un documento</h3><div class="grid g4">
    <div class="span2"><label for="t">Titolo</label><input id="t" name="titolo" required></div>
    <div><label for="c">Categoria</label><input id="c" name="categoria" list="cl" value="Altro"><datalist id="cl">${cats.map(c => `<option value="${esc(c)}">`).join("")}</datalist></div>
    <div><label for="f">File (max 10 MB)</label><input id="f" name="file" type="file" required></div></div>
    <div style="display:flex;gap:18px;align-items:center;margin-top:14px">${can("admin", "segreteria") ? `<label class="check" style="margin:0"><input type="checkbox" name="pubblico"> Pubblica nella pagina Documenti del sito</label>` : `<span class="muted">Visibile solo allo staff</span>`}<button class="btn primary">Carica</button></div></form>${docList(docs)}`;
  $("#up").addEventListener("submit", (e) => { e.preventDefault(); uploadDoc(e.target, {}, () => renderApp($("#app"), "/staff/documenti")); });
  bindDocs(view, () => renderApp($("#app"), "/staff/documenti"));
}

// ------------------------------------------------------------------ certificati
async function certificati(view, actions) {
  actions.innerHTML = `<button class="btn primary" id="new">+ Emetti certificato</button>`; $("#new").onclick = () => certForm();
  view.innerHTML = `<div class="tools"><input id="q" type="search" placeholder="Cerca verbale, destinatario, materiale…" aria-label="Cerca"><select id="fs" aria-label="Stato"><option value="">Tutti gli stati</option>${opts(LABEL.stato_cert)}</select></div><div id="list"></div>`;
  let t;
  const load = async () => {
    const items = await api("/staff/certificati?" + new URLSearchParams({ q: $("#q").value, stato: $("#fs").value }));
    $("#list").innerHTML = items.length ? `<div class="table-wrap"><table class="t"><thead><tr><th>Verbale</th><th>Destinatario</th><th>Materiali</th><th>Settore</th><th>Emesso</th><th>Stato</th></tr></thead><tbody>
      ${items.map(c => `<tr class="click" data-c="${c.id}"><td class="mono"><b>${esc(c.numero_verbale)}</b></td><td>${esc(c.destinatario_nome)}<br><span class="muted" style="font-size:.82rem">${esc(c.destinatario_email)}</span></td><td>${esc(c.materiali.slice(0, 60))}</td><td>${LABEL.settore[c.settore]}</td><td>${fmtDate(c.created)}</td><td>${chipFor("cert", c.stato)}</td></tr>`).join("")}</tbody></table></div>` : `<div class="table-wrap"><div class="empty">Nessun certificato emesso.</div></div>`;
    $$("[data-c]", $("#list")).forEach(r => r.addEventListener("click", () => certDetail(r.dataset.c)));
  };
  $("#fs").addEventListener("change", load); $("#q").addEventListener("input", () => { clearTimeout(t); t = setTimeout(load, 250); });
  await load();
}

async function certForm(a = null) {
  let pool = [];
  if (!a) pool = (await api("/staff/assegnazioni")).filter(x => !x.certificato_id);
  const pre = (x) => x ? { assegnazione_id: x.id, settore: x.settore, destinatario_nome: x.richiedente?.nome || "", destinatario_email: x.email_avviso || x.richiedente?.email || "", materiali: x.materiali, tipo_prove: x.tipo_prove, norme: x.norme, formato: x.formato_rapporto } : { settore: "edilizia", formato: "pdf_firmato" };
  let v = pre(a);
  const m = modal("Emetti certificato", `<div class="alert warn">Alla conferma il sistema genera <b>numero di verbale</b> e <b>chiave di ricerca</b> e li invia all'email indicata.</div>
    <form id="cf">${!a ? `<div style="margin-bottom:16px"><label for="f_as">Collega a un'assegnazione (consigliato)</label><select id="f_as" name="assegnazione_id"><option value="">— nessuna: certificato senza assegnazione —</option>${pool.map(x => `<option value="${x.id}">${esc(x.numero_verbale)} · ${esc(x.materiali.slice(0, 60))}</option>`).join("")}</select></div>` : `<input type="hidden" name="assegnazione_id" value="${a.id}"><p>Assegnazione <b class="mono">${esc(a.numero_verbale)}</b></p>`}
    <fieldset><legend>Destinatario</legend><div class="grid g2">${input("destinatario_nome", "Nome (richiedente o impresa)", v.destinatario_nome, "required")}${input("destinatario_email", "Email a cui inviare le credenziali", v.destinatario_email, 'type="email" required')}</div></fieldset>
    <fieldset><legend>Certificato</legend><div class="grid g2"><div class="span2"><label for="f_m">Materiali (come sul frontespizio)</label><textarea id="f_m" name="materiali" required>${esc(v.materiali)}</textarea></div>
      <div><label for="f_s">Settore</label><select id="f_s" name="settore">${opts(LABEL.settore, v.settore)}</select></div><div><label for="f_fo">Formato</label><select id="f_fo" name="formato">${opts({ pdf_firmato: "PDF con firma digitale", cartaceo: "Cartaceo" }, v.formato)}</select></div>
      ${input("tipo_prove", "Tipo di prove", v.tipo_prove)}${input("norme", "Norme", v.norme)}
      <div><label for="f_st">Stato iniziale</label><select id="f_st" name="stato">${opts(LABEL.stato_cert, "in_lavorazione")}</select></div></div>
      <div style="margin-top:12px"><label for="f_np">Nota visibile a chi verifica lo stato (facoltativa)</label><input id="f_np" name="note_pubbliche" maxlength="300"></div>
      <div style="margin-top:12px"><label for="f_ni">Nota interna (non visibile)</label><input id="f_ni" name="note_interne"></div></fieldset>
    <label class="check"><input type="checkbox" name="invia_email" checked> Invia subito l'email con le credenziali</label></form>`,
    `<button class="btn light" data-close>Annulla</button><button class="btn primary" id="go">Emetti e invia</button>`);
  const form = $("#cf", m.el);
  $("#f_as", m.el)?.addEventListener("change", (e) => { const x = pool.find(p => p.id === e.target.value); v = pre(x); Object.entries(v).forEach(([k, val]) => { if (form.elements[k] && k !== "assegnazione_id") form.elements[k].value = val; }); });
  $("#go", m.el).onclick = (e) => busy(e.target, async () => {
    if (!form.reportValidity()) return;
    const body = formData(form); body.assegnazione_id = body.assegnazione_id || null;
    try {
      const r = await api("/staff/certificati", { method: "POST", body }); m.close();
      const em = r.email;
      modal("Certificato emesso", `<div class="cred"><small>Numero di verbale</small><div class="n">${esc(r.certificato.numero_verbale)}</div><small>Chiave di ricerca</small><div class="k">${esc(r.chiave)}</div></div>
        ${!em ? `<div class="alert warn">Email non inviata (opzione disattivata). Comunica tu le credenziali al richiedente.</div>` : em.inviata ? `<div class="alert ok">Email inviata a <b>${esc(em.a)}</b>${em.provider === "console" ? " — <b>modalità di prova: nessuna email reale è partita</b> (configura EMAIL_PROVIDER)" : ""}.</div>` : `<div class="alert err">Invio email fallito: ${esc(em.errore)}.<br>Comunica le credenziali sopra al richiedente o usa «Reinvia credenziali» più tardi (genera una nuova chiave).</div>`}
        <p class="muted" style="font-size:.9rem">La chiave in chiaro è mostrata solo adesso e non è più recuperabile.</p>`,
        `<button class="btn" data-close>Ho capito</button>`).el.addEventListener("click", (ev) => { if (ev.target.closest("[data-close]")) renderApp($("#app"), "/staff/certificati"); });
    } catch (x) { toast(x.message, true); }
  });
}

async function certDetail(id) {
  const c = await api("/staff/certificati/" + id);
  const m = modal(`Certificato ${c.numero_verbale}`, `
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px">${chipFor("cert", c.stato)}<span class="chip">${LABEL.settore[c.settore]}</span><span class="chip">${c.formato === "pdf_firmato" ? "PDF firmato" : "Cartaceo"}</span></div>
    <div class="card" style="margin-bottom:16px"><dl class="kv"><dt>Destinatario</dt><dd>${esc(c.destinatario_nome)}<br><span class="muted">${esc(c.destinatario_email)}</span></dd><dt>Materiali</dt><dd>${esc(c.materiali)}</dd><dt>Prove / norme</dt><dd>${esc(c.tipo_prove || "—")} · ${esc(c.norme || "—")}</dd>
      <dt>Emesso il</dt><dd>${fmtDateTime(c.created)} da ${esc(c.creato_da)}</dd>${c.note_pubbliche ? `<dt>Nota pubblica</dt><dd>${esc(c.note_pubbliche)}</dd>` : ""}${c.note_interne ? `<dt>Nota interna</dt><dd>${esc(c.note_interne)}</dd>` : ""}</dl></div>
    <fieldset><legend>Avanzamento</legend><div class="grid g2"><div><label for="s_n">Nota pubblica (facoltativa)</label><input id="s_n" value="${esc(c.note_pubbliche)}" maxlength="300"></div><div style="align-self:end"><label class="check"><input type="checkbox" id="s_e" checked> Avvisa il cliente via email quando diventa «pronto»</label></div></div>
      <p style="margin:14px 0 0;display:flex;gap:8px;flex-wrap:wrap">${c.stato === "in_lavorazione" ? `<button class="btn primary" data-st="pronto">Segna come pronto</button>` : ""}${c.stato === "pronto" ? `<button class="btn primary" data-st="consegnato">Segna come consegnato</button>` : ""}${c.stato !== "in_lavorazione" ? `<button class="btn light" data-st="in_lavorazione">Riporta in lavorazione</button>` : ""}<button class="btn light" data-st="${c.stato}">Salva solo la nota</button></p>
      ${c.formato === "pdf_firmato" ? `<p class="muted" style="font-size:.88rem;margin:12px 0 0">Per allegare il PDF firmato all'email «pronto», caricalo qui sotto con categoria <b>Certificato firmato</b> <u>prima</u> di segnare come pronto.</p>` : ""}</fieldset>
    <fieldset><legend>Credenziali</legend><div class="grid g2">${input("re", "Reinvia a (lascia vuoto per l'email di origine)", "", 'type="email" placeholder="' + esc(c.destinatario_email) + '"')}<div style="align-self:end"><button class="btn light" id="rs">Reinvia credenziali (nuova chiave)</button></div></div></fieldset>
    <h3>Documenti</h3>${docList(c.documenti)}
    <form id="up" class="card" style="margin-top:12px"><div class="grid g3"><div><label for="u_t">Titolo</label><input id="u_t" name="titolo" required value="Certificato ${esc(c.numero_verbale)}"></div><div><label for="u_f">File</label><input id="u_f" name="file" type="file" required></div><div style="align-self:end"><button class="btn light">Carica certificato firmato</button></div></div></form>
    <h3 style="margin-top:20px">Email inviate</h3>${c.email_log?.length ? `<ul class="hist">${c.email_log.map(e => `<li><span>${e.tipo} → ${esc(e.a)}</span><span class="${e.inviata ? "" : "muted"}">${e.inviata ? "✔ inviata" : "✖ " + esc(e.errore || "")} · ${fmtDateTime(e.quando)}</span></li>`).join("")}</ul>` : `<p class="muted">Nessuna.</p>`}
    <h3 style="margin-top:20px">Storico</h3><ul class="hist">${(c.storico || []).map(s => `<li>${chipFor("cert", s.stato)}<span class="muted">${esc(s.utente)} · ${fmtDateTime(s.data)}</span></li>`).join("")}</ul>`,
    `<button class="btn" data-close>Chiudi</button>`);
  bindDocs(m.el, () => { m.close(); certDetail(id); });
  $("#up", m.el).addEventListener("submit", (e) => { e.preventDefault(); uploadDoc(e.target, { certificato_id: id, categoria: "Certificato firmato" }, () => { m.close(); certDetail(id); }); });
  $$("[data-st]", m.el).forEach(b => b.addEventListener("click", () => busy(b, async () => {
    try {
      const r = await api(`/staff/certificati/${id}/stato`, { method: "POST", body: { stato: b.dataset.st, note_pubbliche: $("#s_n", m.el).value, invia_email: $("#s_e", m.el).checked } });
      toast(r.email ? (r.email.inviata ? "Aggiornato ed email inviata" : "Aggiornato, ma email NON inviata: " + r.email.errore) : "Aggiornato", r.email && !r.email.inviata);
      m.close(); certDetail(id);
    } catch (x) { toast(x.message, true); }
  })));
  $("#rs", m.el).onclick = (e) => { if (!confirm("Verrà generata una nuova chiave e quella vecchia smetterà di funzionare. Continuare?")) return;
    busy(e.target, async () => { try {
      const r = await api(`/staff/certificati/${id}/reinvia`, { method: "POST", body: { destinatario_email: $("#f_re", m.el).value || null } }); m.close();
      modal("Nuova chiave generata", `<div class="cred"><small>Numero di verbale</small><div class="n">${esc(c.numero_verbale)}</div><small>Nuova chiave di ricerca</small><div class="k">${esc(r.chiave)}</div></div>
        <div class="alert ${r.email.inviata ? "ok" : "err"}">${r.email.inviata ? "Email inviata a " + esc(r.email.a) : "Invio fallito: " + esc(r.email.errore)}</div>`, `<button class="btn" data-close>Chiudi</button>`);
    } catch (x) { toast(x.message, true); } }); };
}

// ------------------------------------------------------------------ avviso, utenti, log, profilo
async function avviso(view) {
  const a = await api("/public/avviso");
  view.innerHTML = `<form id="af" class="card" style="max-width:680px"><p class="muted">Compare in cima alla home del sito (per esempio chiusura per ferie).</p>
    <label class="check" style="margin-bottom:14px"><input type="checkbox" name="attivo" ${a.attivo ? "checked" : ""}> Mostra l'avviso sul sito</label>
    <div style="margin-bottom:14px"><label for="t">Titolo</label><input id="t" name="titolo" value="${esc(a.titolo)}" maxlength="120" placeholder="Chiusura per ferie"></div>
    <div style="margin-bottom:14px"><label for="x">Testo</label><textarea id="x" name="testo" maxlength="800" placeholder="Il laboratorio resterà chiuso dal … al …">${esc(a.testo)}</textarea></div><button class="btn primary">Salva</button></form>`;
  $("#af").addEventListener("submit", (e) => { e.preventDefault(); busy(e.target.querySelector("button"), async () => { try { await api("/staff/avviso", { method: "PUT", body: formData(e.target) }); toast("Avviso salvato"); } catch (x) { toast(x.message, true); } }); });
}

async function utenti(view, actions) {
  actions.innerHTML = `<button class="btn primary" id="new">+ Nuovo utente</button>`; $("#new").onclick = () => userForm();
  const users = await api("/staff/utenti");
  view.innerHTML = `<div class="table-wrap"><table class="t"><thead><tr><th>Utente</th><th>Nome</th><th>Ruolo</th><th>Badge</th><th>Stato</th></tr></thead><tbody>
    ${users.map(u => `<tr class="click" data-u="${u.id}"><td class="mono">${esc(u.username)}</td><td>${esc(u.name)}<br><span class="muted" style="font-size:.82rem">${esc(u.email)}</span></td><td>${LABEL.role[u.role]}</td><td>${u.ha_badge ? '<span class="chip ok">assegnato</span>' : '<span class="chip">no</span>'}</td><td>${u.active ? '<span class="chip ok">attivo</span>' : '<span class="chip bad">disattivato</span>'}</td></tr>`).join("")}</tbody></table></div>`;
  $$("[data-u]", view).forEach(r => r.addEventListener("click", () => userForm(users.find(u => u.id === r.dataset.u))));
}
function userForm(u = null) {
  const m = modal(u ? "Modifica " + u.username : "Nuovo utente", `<form id="uf"><div class="grid g2">
    ${input("username", "Nome utente", u?.username, u ? "disabled" : 'required minlength="3" autocomplete="off"')}${input("name", "Nome e cognome", u?.name, "required")}${input("email", "Email", u?.email, 'type="email"')}
    <div><label for="f_role">Ruolo</label><select id="f_role" name="role">${opts(LABEL.role, u?.role || "tecnico")}</select></div>
    ${input("password", u ? "Nuova password (vuoto = invariata)" : "Password (min. 8 caratteri)", "", `type="password" minlength="8" autocomplete="new-password" ${u ? "" : "required"}`)}
    <div><label for="f_badge">Badge</label><input id="f_badge" name="badge" type="password" autocomplete="off" placeholder="${u?.ha_badge ? "già assegnato — passa un badge per sostituirlo" : "clicca qui e passa il badge sul lettore"}"></div></div>
    ${u?.ha_badge ? `<label class="check" style="margin-top:12px"><input type="checkbox" name="rimuovi_badge"> Rimuovi il badge assegnato</label>` : ""}
    <label class="check" style="margin-top:12px"><input type="checkbox" name="active" ${u?.active ?? true ? "checked" : ""}> Utente attivo</label>
    <p class="muted" style="font-size:.88rem">Ruoli: <b>amministratore</b> gestisce tutto; <b>segreteria</b> registra i materiali, emette e invia i certificati; <b>tecnico</b> aggiorna le lavorazioni e carica i documenti.</p></form>`,
    `<button class="btn light" data-close>Annulla</button><button class="btn primary" id="sv">Salva</button>`);
  $("#f_badge", m.el).addEventListener("keydown", (e) => { if (e.key === "Enter") e.preventDefault(); }); // il lettore invia Invio: non inviare il form
  $("#sv", m.el).onclick = (e) => busy(e.target, async () => {
    const form = $("#uf", m.el); if (!form.reportValidity()) return;
    const f = formData(form), body = { username: u?.username || f.username, name: f.name, email: f.email, role: f.role, active: f.active };
    if (f.password) body.password = f.password;
    if (f.badge) body.badge = f.badge; else if (f.rimuovi_badge) body.badge = "";
    try { await api(u ? "/staff/utenti/" + u.id : "/staff/utenti", { method: u ? "PUT" : "POST", body }); m.close(); toast("Utente salvato"); renderApp($("#app"), "/staff/utenti"); }
    catch (x) { toast(x.message, true); }
  });
}

async function logView(view) {
  const items = await api("/staff/log?limit=300");
  view.innerHTML = `<div class="table-wrap"><table class="t"><thead><tr><th>Quando</th><th>Utente</th><th>Azione</th><th>Dettaglio</th></tr></thead><tbody>${items.map(l => `<tr><td style="white-space:nowrap">${fmtDateTime(l.quando)}</td><td class="mono">${esc(l.utente)}</td><td>${esc(l.azione)}</td><td class="muted">${esc(l.dettaglio)}</td></tr>`).join("")}</tbody></table></div>`;
}

function profilo(view) {
  view.innerHTML = `<div class="card" style="max-width:520px"><p><b>${esc(session.user.name)}</b><br><span class="muted">${LABEL.role[session.user.role]} · ${esc(session.user.username)}</span></p>
  <form id="pf"><h3>Cambia password</h3><div style="margin-bottom:12px"><label for="o">Password attuale</label><input id="o" name="vecchia" type="password" required autocomplete="current-password"></div>
  <div style="margin-bottom:16px"><label for="n">Nuova password (min. 8 caratteri)</label><input id="n" name="nuova" type="password" required minlength="8" autocomplete="new-password"></div><button class="btn primary">Cambia password</button></form></div>`;
  $("#pf").addEventListener("submit", (e) => { e.preventDefault(); busy(e.target.querySelector("button"), async () => { try { await api("/auth/password", { method: "POST", body: formData(e.target) }); toast("Password cambiata"); e.target.reset(); } catch (x) { toast(x.message, true); } }); });
}

const VIEWS = {
  "/staff": dashboard, "/staff/assegnazioni": assegnazioni, "/staff/certificati": certificati, "/staff/documenti": documenti,
  "/staff/avviso": avviso, "/staff/utenti": utenti, "/staff/log": logView, "/staff/profilo": profilo,
};
