// Helper di interfaccia: escape, icone, toast, modali, formattazione.
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const I = (d, extra = "") => `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${d}</svg>`;
export const icon = {
  mail: I('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>'),
  phone: I('<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>'),
  pin: I('<path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>'),
  fax: I('<path d="M7 9V3h10v6"/><rect x="3" y="9" width="18" height="9" rx="2"/><path d="M7 14h10v7H7z"/>'),
  shield: I('<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/><path d="m9 12 2 2 4-4"/>'),
  gear: I('<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>'),
  building: I('<path d="M4 21V8l8-5 8 5v13"/><path d="M9 21v-6h6v6M8 11h.01M12 11h.01M16 11h.01"/>'),
  bike: I('<circle cx="6" cy="16" r="3.5"/><circle cx="18" cy="16" r="3.5"/><path d="M6 16l4-8h5l3 8M10 8 8 5H6M12 16l3-8"/>'),
  steel: I('<path d="M4 6h16M4 12h16M4 18h16"/><path d="M8 3v18M16 3v18" opacity=".4"/>'),
  home: I('<path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10"/>'),
  box: I('<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="m3 8 9 5 9-5M12 13v8"/>'),
  cert: I('<rect x="4" y="3" width="16" height="14" rx="2"/><path d="M8 8h8M8 12h5"/><path d="m9 17-1 4 4-2 4 2-1-4"/>'),
  doc: I('<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>'),
  bell: I('<path d="M6 17V11a6 6 0 1 1 12 0v6l2 2H4z"/><path d="M10 21h4"/>'),
  users: I('<circle cx="9" cy="8" r="3.5"/><path d="M2 20c0-4 3-6 7-6s7 2 7 6M17 5a3.5 3.5 0 0 1 0 7M22 20c0-3-1.5-5-4-5.7"/>'),
  list: I('<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>'),
  dash: I('<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>'),
  key: I('<circle cx="8" cy="15" r="4"/><path d="m11 12 9-9M17 6l3 3M15 8l2 2"/>'),
  out: I('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>'),
  card: I('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h4"/>'),
  clock: I('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  big: (d) => `<svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`,
};

export const fmtDate = (s) => {
  if (!s) return "-";
  const d = new Date(s.length === 10 ? s + "T12:00:00" : s);
  return isNaN(d) ? s : d.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" });
};
export const fmtDateTime = (s) => (s ? new Date(s).toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short" }) : "-");
export const fmtSize = (n) => (n > 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1024)) + " KB");
export const todayISO = () => { const d = new Date(); return new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };

export const LABEL = {
  role: { admin: "Amministratore di sistema", segreteria: "Segreteria", tecnico: "Tecnico di laboratorio" },
  settore: { meccanica: "Meccanica", edilizia: "Edilizia", cicli: "Cicli" },
  stato_ass: { ricevuta: "Ricevuta", in_prova: "In prova", completata: "Completata", consegnata: "Consegnata" },
  stato_cert: { in_lavorazione: "In lavorazione", pronto: "Pronto", consegnato: "Consegnato" },
  modello: { D_UFF_07: "D_UFF_07 · Materiali da costruzione DM 17/01/2018", D_UFF_08: "D_UFF_08 · Richiesta prove generica", D_UFF_09: "D_UFF_09 · Cicli (ISO 4210)", D_UFF_10: "D_UFF_10 · Centri di trasformazione", D_UFF_11: "D_UFF_11 · Controlli EN 1090" },
  consegna: { ritiro_a_mano: "Ritiro a mano", posta_ordinaria: "Posta ordinaria", pec: "Invio via PEC" },
};
export const chipFor = (kind, v) => {
  const map = { ricevuta: "", in_prova: "warn", completata: "ok", consegnata: "dark", in_lavorazione: "warn", pronto: "ok", consegnato: "dark" };
  return `<span class="chip ${map[v] || ""}">${esc((kind === "ass" ? LABEL.stato_ass : LABEL.stato_cert)[v] || v)}</span>`;
};

export function toast(msg, isErr = false) {
  const t = Object.assign(document.createElement("div"), { className: "toast" + (isErr ? " err" : ""), textContent: msg, role: "status" });
  document.body.append(t); setTimeout(() => t.remove(), isErr ? 6000 : 3500);
}

// Modale: restituisce { el, close }. Il contenuto è HTML già escapato dal chiamante.
export function modal(title, bodyHtml, footerHtml = "") {
  const bg = document.createElement("div");
  bg.className = "modal-bg";
  bg.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-label="${esc(title)}"><header><h2>${esc(title)}</h2><button class="btn light sm" data-close aria-label="Chiudi">✕</button></header><div class="body">${bodyHtml}</div>${footerHtml ? `<footer>${footerHtml}</footer>` : ""}</div>`;
  const close = () => { bg.remove(); document.removeEventListener("keydown", onKey); };
  const onKey = (e) => { if (e.key === "Escape") close(); };
  document.addEventListener("keydown", onKey);
  bg.addEventListener("mousedown", (e) => { if (e.target === bg) close(); });
  bg.addEventListener("click", (e) => { if (e.target.closest("[data-close]")) close(); });
  document.body.append(bg);
  const first = bg.querySelector("input, select, textarea"); if (first) first.focus();
  return { el: bg, close };
}

export const formData = (form) => {
  const o = {};
  for (const [k, v] of new FormData(form)) o[k] = v;
  form.querySelectorAll("input[type=checkbox]").forEach(c => { o[c.name] = c.checked; });
  return o;
};

export async function busy(btn, fn) {
  const old = btn.textContent; btn.disabled = true; btn.textContent = "Attendi…";
  try { return await fn(); } finally { btn.disabled = false; btn.textContent = old; }
}
