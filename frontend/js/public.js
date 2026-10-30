// Sito pubblico. Ogni pagina restituisce { title, lead, html, init? }.
import { api } from "./api.js";
import { $, esc, icon, fmtDate, fmtSize, toast, busy } from "./ui.js";

const ADDRESS = "Viale Leonardo da Vinci 10, 33100 Udine";
export const HOURS = [
  ["Lunedì", "08:00 – 12:30", "14:30 – 16:30"], ["Martedì", "08:00 – 12:30", ""], ["Mercoledì", "08:00 – 12:30", "14:30 – 16:30"],
  ["Giovedì", "08:00 – 12:30", ""], ["Venerdì", "08:00 – 12:30", ""],
];

function romeNow() {
  const p = new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", weekday: "long", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date());
  const g = (t) => p.find(x => x.type === t)?.value;
  return { day: g("weekday"), min: (+g("hour")) * 60 + (+g("minute")) };
}
function openStatus() {
  const { day, min } = romeNow();
  const row = HOURS.find(h => h[0].toLowerCase() === day.toLowerCase());
  if (!row) return { open: false, day: null };
  const inRange = (r) => { if (!r) return false; const [a, b] = r.split("–").map(s => s.trim().split(":").reduce((h, m) => h * 60 + +m)); return min >= a && min < b; };
  return { open: inRange(row[1]) || inRange(row[2]), day: row[0] };
}

const curveSvg = `
<div class="curve" aria-label="Diagramma sforzo-deformazione di una prova di trazione">
  <div class="cap"><span>PROVA DI TRAZIONE · ISO 6892-1</span><span>σ–ε</span></div>
  <svg viewBox="0 0 400 250" role="img" aria-hidden="true">
    <g stroke="rgba(255,255,255,.18)" stroke-width="1"><path d="M40 220H385M40 220V15"/>${[70, 120, 170].map(y => `<path d="M40 ${y}H385" stroke-dasharray="3 6"/>`).join("")}</g>
    <path d="M385 220l-8-4v8zM40 15l-4 8h8z" fill="rgba(255,255,255,.4)"/>
    <path class="line" d="M40 220 L108 92 C118 78 124 86 134 82 C150 77 160 88 176 72 C220 40 262 34 290 40 C318 46 336 72 352 114" fill="none" stroke="#f28c28" stroke-width="3.5" stroke-linecap="round"/>
    <g class="pt" style="animation-delay:1.1s"><circle cx="108" cy="92" r="5" fill="#fff"/><text x="116" y="112" fill="#cfdcf2" font-family="IBM Plex Mono,monospace" font-size="11">Rp0,2</text></g>
    <g class="pt" style="animation-delay:2.2s"><circle cx="290" cy="40" r="5" fill="#fff"/><text x="256" y="28" fill="#cfdcf2" font-family="IBM Plex Mono,monospace" font-size="11">Rm</text></g>
    <g class="pt" style="animation-delay:3.2s"><circle cx="352" cy="114" r="5" fill="#fff"/><path d="m346 108 12 12m0-12-12 12" stroke="#f28c28" stroke-width="2"/><text x="318" y="140" fill="#cfdcf2" font-family="IBM Plex Mono,monospace" font-size="11">rottura</text></g>
    <text x="385" y="238" text-anchor="end" fill="#9fb6d9" font-family="IBM Plex Mono,monospace" font-size="10">ε  deformazione</text>
    <text x="48" y="24" fill="#9fb6d9" font-family="IBM Plex Mono,monospace" font-size="10">σ  sforzo</text>
  </svg>
</div>`;

const SETTORI = [
  { k: "meccanica", cls: "", ico: icon.steel, t: "Meccanica", d: "Prove su materiali metallici e componenti industriali.",
    l: ["Acciai per cemento armato", "Acciai per carpenteria", "Materiali metallici", "Analisi metallografiche", "Metrologia", "Failure analysis"] },
  { k: "edilizia", cls: "edi", ico: icon.building, t: "Edilizia", d: "Prove su calcestruzzi, laterizi, leganti e aggregati.",
    l: ["Calcestruzzi", "Laterizi", "Leganti", "Aggregati", "Elementi costruttivi"] },
  { k: "cicli", cls: "cicli", ico: icon.bike, t: "Cicli", d: "Prove di resistenza su componenti per biciclette (ISO 4210).",
    l: ["Componentistica", "Cicli interamente assemblati", "Prove speciali"] },
];

const pages = {};

pages["/"] = async () => {
  const a = await api("/public/avviso").catch(() => ({ attivo: false }));
  return {
    title: "Laboratorio Prove Materiali · ITI Malignani Udine", home: true,
    banner: a.attivo ? `<div class="banner" role="status"><div class="wrap"><b>${esc(a.titolo || "Informazioni al pubblico")}</b> ${esc(a.testo)}</div></div>` : "",
    html: `
<section class="hero"><div class="wrap">
  <div>
    <div class="eyebrow">Istituto Malignani · Udine</div>
    <h1>Prove sui materiali <em>autorizzate</em>, risultati di cui fidarsi.</h1>
    <p class="lead">Il laboratorio dell'Istituto Malignani verifica e qualifica acciai, calcestruzzi, aggregati e componenti per biciclette. Autorizzato dal Ministero delle Infrastrutture e dei Trasporti, certificato ISO 9001.</p>
    <div class="actions"><a class="btn primary" href="#/certificati">Verifica lo stato del certificato</a><a class="btn ghost" href="#/documenti">Modelli di richiesta prove</a></div>
  </div>
  ${curveSvg}
</div></section>
<div class="wrap"><div class="stats">
  <div><b>1976</b><span>prima autorizzazione ministeriale</span></div>
  <div><b>3</b><span>settori: meccanica, edilizia, cicli</span></div>
  <div><b>ISO 9001</b><span>certificato Bureau Veritas dal 2011</span></div>
  <div><b>L. 1086/71</b><span>controlli su materiali da costruzione (DM 17/01/2018)</span></div>
</div></div>
<section class="section"><div class="wrap">
  <div class="sec-head"><h2>Tre settori, un unico laboratorio</h2><p>Dall'acciaio per cemento armato al telaio di una mountain bike: scegli l'area di tuo interesse.</p></div>
  <div class="grid g3">${SETTORI.map(s => `
    <article class="card sector ${s.cls}"><div class="ico">${s.ico}</div><h3>${s.t}</h3><p class="muted">${s.d}</p>
    <ul>${s.l.map(x => `<li>${x}</li>`).join("")}</ul><a class="more" href="#/attrezzature">Vedi le attrezzature →</a></article>`).join("")}</div>
</div></section>
<section class="section dark"><div class="wrap">
  <div class="sec-head"><h2>Come richiedere una prova</h2><p style="color:#b4c6e4">Quattro passaggi, dal modulo al certificato.</p></div>
  <div class="steps">
    <div><h3>Scarica il modello</h3><p>Scegli il modello di richiesta prove adatto, compilalo e firmalo.</p></div>
    <div><h3>Consegna i campioni</h3><p>In laboratorio negli orari di apertura. I componenti per biciclette si inviano con corriere espresso, anche per il ritiro.</p></div>
    <div><h3>Ricevi le credenziali</h3><p>La segreteria registra la richiesta e ti scrive via email numero di verbale e chiave di ricerca.</p></div>
    <div><h3>Segui lo stato</h3><p>Controlla online l'avanzamento. A certificato pronto lo ritiri o lo ricevi in PDF con firma digitale.</p></div>
  </div>
  <p style="margin-top:34px"><a class="btn primary" href="#/documenti">Vai ai modelli</a> &nbsp; <a class="btn ghost" href="#/contatti">Orari e contatti</a></p>
</div></section>`,
  };
};

pages["/dove-siamo"] = () => ({
  title: "Dove siamo", lead: "Nel cuore di Udine, all'interno dell'Istituto Malignani.",
  html: `<section class="section"><div class="wrap split">
  <div><iframe class="map" title="Mappa del laboratorio" loading="lazy" referrerpolicy="no-referrer-when-downgrade"
    src="https://www.google.com/maps?q=${encodeURIComponent("Viale Leonardo da Vinci 10, 33100 Udine")}&output=embed"></iframe></div>
  <div class="card"><h2>Laboratorio Prove Materiali</h2>
    <div class="contact"><div class="ic">${icon.pin}</div><div><b>${ADDRESS}</b><br><span class="muted">I.I.S. A. Malignani</span></div></div>
    <div class="contact"><div class="ic">${icon.phone}</div><div><b>0432 46361</b><br><span class="muted">Centralino automatico: digitare 8</span></div></div>
    <p style="margin-top:18px"><a class="btn" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(ADDRESS)}">Indicazioni stradali</a></p>
    <p class="muted" style="font-size:.9rem">Per i componenti per biciclette e per il ritiro dei materiali sottoposti a prova usare il corriere espresso, concordando il ritiro con il laboratorio.</p>
  </div></div></section>`,
});

pages["/attrezzature"] = () => ({
  title: "Attrezzature", lead: "Macchine e strumenti dei tre settori del laboratorio.",
  html: `<section class="section"><div class="wrap">
  ${[
    { t: "Settore meccanico", ico: icon.steel, intro: "Macchine universali per prove di trazione", eq: [["A", "Galdabini da 600 kN"], ["B", "Rmu da 600 kN"], ["C", "Amsler da 100 kN"], ["D", "Zwick da 5 kN"], ["E", "Nuovissima macchina METRO.COM. da 1500 kN"]],
      prove: ["Trazione con rilevamento del carico di snervamento, del carico di rottura, dell'allungamento percentuale su barre di acciaio ad aderenza migliorata, su provette metalliche ricavate profilate", "Trazione su funi, trefoli, barre filettate", "Trazione di bulloni, viti", "Taglio su bulloni", "Piegamento su provette metalliche", "Flessione su piccole strutture", "Compressione su particolari metallici"],
      altri: [["Pendolo di Charpy da 300 J", "prove di resilienza da 20 fino a −60 °C"], ["Durometri", "prove di durezza Brinell, Vickers, Rockwell"], ["Quantometro", "analisi chimiche di leghe di ferro, rame, zinco"], ["Microscopio Leitz", "metallografie, analisi fratture, analisi difetti"], ["Misuratore di profili ECM", "per acciai ad aderenza migliorata"]] },
    { t: "Settore edile", ico: icon.building, intro: "Macchine per prova a compressione su calcestruzzi, laterizi e altro", eq: [["A", "Galdabini da 3.000 kN"], ["B", "Metrocom da 3.000 kN"], ["C", "Rmu da 250 kN"]],
      altri: [["Los Angeles", "resistenza alla frammentazione degli aggregati"], ["Micro Deval", "resistenza all'usura degli aggregati"]] },
    { t: "Settore bici", ico: icon.bike, intro: "Prove su elementi di biciclette (ruote, pedivelle, manubri, telaio ecc.) per verificare la resistenza a fatica sotto vari tipi di sollecitazioni, secondo ISO 4210.", eq: [] },
  ].map((s, i) => `
  <article class="card" style="margin-bottom:24px"><div class="split">
    <div><h2 style="display:flex;gap:12px;align-items:center"><span style="color:var(--blue)">${s.ico}</span>${s.t}</h2><p><b>${s.intro}</b></p>
      ${s.eq.length ? `<ul class="eq-list">${s.eq.map(([k, v]) => `<li><b>${k}</b><span>${v}</span></li>`).join("")}</ul>` : ""}
      ${s.prove ? `<h3 style="margin-top:20px">Per prove di</h3><ul class="muted">${s.prove.map(p => `<li>${p}</li>`).join("")}</ul>` : ""}
      ${s.altri ? `<ul class="eq-list" style="margin-top:12px">${s.altri.map(([a, b]) => `<li><span><b style="font-family:var(--f-body);color:var(--ink)">${a}</b> <span class="muted">· ${b}</span></span></li>`).join("")}</ul>` : ""}</div>
    <div class="eq-photo" data-photo="${i}" title="Foto del settore">${icon.big('<path d="M12 3v18M7 21h10M7 3h10M9 7h6M9 12h6"/>')}</div>
  </div></article>`).join("")}
  </div></section>`,
  init() { // se esistono foto in /assets/img/settore-N.jpg le mostra al posto dell'icona
    document.querySelectorAll("[data-photo]").forEach(el => {
      const img = new Image(); img.alt = ""; img.src = `/assets/img/settore-${el.dataset.photo}.jpg`;
      img.onload = () => { el.innerHTML = ""; el.append(img); };
    });
  },
});

pages["/organizzazione"] = () => ({
  title: "Organizzazione", lead: "Chi dirige il laboratorio e su quali autorizzazioni si fonda.",
  html: `<section class="section"><div class="wrap split">
  <div>
    <h2>Direzione</h2>
    <div class="card" style="margin-bottom:16px"><div class="person"><div class="avatar">FD</div><div><b>Ing. Franco Di Plotti</b><br><span class="muted">Direttore del laboratorio · nulla osta STC del 09/2024</span></div></div></div>
    <div class="card"><div class="person"><div class="avatar" style="background:var(--blue)">MC</div><div><b>Ing. Michele Cantarutti</b><br><span class="muted">Vice-direttore del laboratorio</span></div></div></div>
    <p class="muted" style="margin-top:20px">Il laboratorio opera nell'ambito dell'I.I.S. «Arturo Malignani» secondo il proprio <a href="#/documenti">Regolamento</a>, con personale individuato annualmente e un sistema di gestione per la qualità.</p>
  </div>
  <div>
    <h2>Autorizzazioni e qualità</h2>
    <div class="timeline">
      <div><div class="yr">1976</div><b>Prima autorizzazione ministeriale</b><p class="muted">Art. 20 della legge 1086/71, per le prove sui materiali da costruzione.</p></div>
      <div><div class="yr">2011</div><b>Certificazione ISO 9001</b><p class="muted">Sistema qualità certificato da Bureau Veritas, oggi secondo UNI EN ISO 9001:2015 (n. IT241128).</p></div>
      <div><div class="yr">2022</div><b>Autorizzazione ministeriale vigente</b><p class="muted">Art. 59 DPR 380/2001 e DM 17/01/2018 (Norme tecniche per le costruzioni).</p></div>
      <div><div class="yr">2024</div><b>Nomina del direttore</b><p class="muted">Nulla osta del Servizio Tecnico Centrale del Consiglio Superiore dei Lavori Pubblici.</p></div>
    </div>
    <a class="btn light" href="#/documenti">Vedi i documenti</a>
  </div></div></section>`,
});

pages["/documenti"] = async () => {
  let docs = [], err = "";
  try { docs = await api("/public/documenti"); } catch (e) { err = e.message; }
  const cats = [...new Set(docs.map(d => d.categoria))];
  const row = (d) => `<div class="doc" data-t="${esc((d.titolo + " " + d.categoria).toLowerCase())}"><span class="t">${esc(d.titolo)}</span>
    <span class="fmt">${d.files.map(f => `<a class="${esc(f.formato)}" href="/api/public/documenti/${d.id}/file/${f.idx}" target="_blank" rel="noopener" title="Scarica ${esc(f.formato.toUpperCase())} (${fmtSize(f.size)})"></a>`).join("")}</span></div>`;
  return {
    title: "Documenti", lead: "Modelli di richiesta, listino, autorizzazioni e normativa.",
    html: `<section class="section"><div class="wrap">${err ? `<div class="alert err">${esc(err)}</div>` : ""}
    <div class="tools"><input id="q" type="search" placeholder="Cerca un documento…" aria-label="Cerca un documento" style="max-width:420px"></div>
    ${cats.map(c => `<div class="doc-cat"><h2>${esc(c)}</h2>${docs.filter(d => d.categoria === c).map(row).join("")}</div>`).join("")}
    <p id="none" class="empty" hidden>Nessun documento trovato.</p></div></section>`,
    init() {
      $("#q").addEventListener("input", (e) => {
        const q = e.target.value.trim().toLowerCase(); let n = 0;
        document.querySelectorAll(".doc").forEach(d => { const m = !q || d.dataset.t.includes(q); d.hidden = !m; n += m; });
        document.querySelectorAll(".doc-cat").forEach(c => { c.hidden = ![...c.querySelectorAll(".doc")].some(d => !d.hidden); });
        $("#none").hidden = n > 0;
      });
    },
  };
};

pages["/contatti"] = () => {
  const st = openStatus();
  return {
    title: "Contatti", lead: "Segreteria del laboratorio, orari di apertura al pubblico.",
    html: `<section class="section"><div class="wrap split">
    <div class="card"><h2>Scrivici o chiamaci</h2>
      <div class="contact"><div class="ic">${icon.mail}</div><div><span class="muted">Email</span><br><a href="mailto:laboratorio@malignani.ud.it"><b>laboratorio@malignani.ud.it</b></a></div></div>
      <div class="contact"><div class="ic">${icon.shield}</div><div><span class="muted">PEC</span><br><b>laboratorio.malignani@pec.it</b></div></div>
      <div class="contact"><div class="ic">${icon.phone}</div><div><span class="muted">Telefono</span><br><b>0432 46361</b> <span class="muted">(centralino automatico, digitare 8)</span></div></div>
      <div class="contact"><div class="ic">${icon.fax}</div><div><span class="muted">Fax</span><br><b>0432 545420</b></div></div>
      <div class="contact"><div class="ic">${icon.pin}</div><div><span class="muted">Sede</span><br><b>${ADDRESS}</b></div></div></div>
    <div class="card"><h2>Orario uffici</h2><p><span class="status-dot ${st.open ? "" : "off"}"></span><b>${st.open ? "Aperto adesso" : "Chiuso in questo momento"}</b></p>
      <table class="hours"><thead><tr><th>Giorno</th><th>Mattina</th><th>Pomeriggio</th></tr></thead><tbody>
      ${HOURS.map(h => `<tr class="${st.day === h[0] ? "today" : ""}"><td>${h[0]}</td><td>${h[1]}</td><td>${h[2] || "—"}</td></tr>`).join("")}</tbody></table>
      <p class="muted" style="margin-top:14px;font-size:.88rem">Orari dell'ufficio accettazione secondo il regolamento del laboratorio.</p></div>
    </div></section>`,
  };
};

const STEPS = ["Registrato", "In lavorazione", "Pronto", "Consegnato"];
pages["/certificati"] = (query) => ({
  title: "Verifica certificato", lead: "Controlla lo stato di lavorazione con le credenziali ricevute per email.",
  html: `<section class="section"><div class="wrap verify">
  <form class="card" id="vf" autocomplete="off"><h2>Verifica dello stato del certificato</h2>
    <p class="muted">Inserisci il <b>numero di verbale</b> e la <b>chiave di ricerca</b> che ti abbiamo inviato via email al momento della registrazione.</p>
    <div class="grid g2"><div><label for="v">Numero di verbale</label><input id="v" name="v" class="keyin" placeholder="2026/0001" required maxlength="30" value="${esc(query.v || "")}"></div>
    <div><label for="k">Chiave di ricerca</label><input id="k" name="k" class="keyin" placeholder="XXXXX-XXXXX" required maxlength="30" value="${esc(query.k || "")}"></div></div>
    <p style="margin:18px 0 0"><button class="btn primary" type="submit">Verifica</button></p></form>
  <div id="res" aria-live="polite" style="margin-top:20px"></div></div></section>`,
  init() {
    const f = $("#vf"), res = $("#res");
    const run = async () => {
      res.innerHTML = "";
      try {
        const r = await api("/public/verifica", { method: "POST", body: { numero_verbale: f.v.value, chiave: f.k.value } });
        const cur = { in_lavorazione: 1, pronto: 2, consegnato: 3 }[r.stato];
        res.innerHTML = `<div class="card"><div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:center"><div><span class="muted">Verbale</span><h2 class="mono" style="margin:0">${esc(r.numero_verbale)}</h2></div>
          <span class="chip ${r.stato === "in_lavorazione" ? "warn" : r.stato === "pronto" ? "ok" : "dark"}" style="font-size:.95rem;padding:.35em 1em">${esc(r.stato_label)}</span></div>
          <div class="track">${STEPS.map((s, i) => `<div class="${i < cur || (cur >= 2 && i <= cur) ? "done" : ""} ${i === cur && cur === 1 ? "now" : ""}">${s}</div>`).join("")}</div>
          ${r.stato === "pronto" ? `<div class="alert ok">Il certificato è pronto: ${r.formato === "pdf_firmato" ? "lo hai ricevuto via email in PDF con firma digitale." : "puoi ritirarlo in laboratorio negli orari di apertura."}</div>` : ""}
          ${r.note ? `<div class="alert warn">${esc(r.note)}</div>` : ""}
          <dl class="kv"><dt>Settore</dt><dd>${esc(r.settore)}</dd><dt>Materiali</dt><dd>${esc(r.materiali)}</dd>${r.tipo_prove ? `<dt>Prove</dt><dd>${esc(r.tipo_prove)}</dd>` : ""}
          <dt>Registrato il</dt><dd>${fmtDate(r.data_registrazione)}</dd><dt>Ultimo aggiornamento</dt><dd>${fmtDate(r.data_aggiornamento)}</dd></dl></div>`;
        res.scrollIntoView({ behavior: "smooth", block: "nearest" });
      } catch (e) { res.innerHTML = `<div class="alert err">${esc(e.message)}</div>`; }
    };
    f.addEventListener("submit", (e) => { e.preventDefault(); busy(f.querySelector("button"), run); });
    if (query.v && query.k) run();
  },
});

export async function loadPublic(path, query) {
  const fn = pages[path];
  return fn ? await fn(query) : null;
}

export const NAV = [["/", "Home"], ["/dove-siamo", "Dove siamo"], ["/attrezzature", "Attrezzature"], ["/organizzazione", "Organizzazione"], ["/documenti", "Documenti"], ["/contatti", "Contatti"]];
