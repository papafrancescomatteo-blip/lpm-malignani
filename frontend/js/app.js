// Router a hash: #/pagina?x=1  ·  sito pubblico e area staff nella stessa pagina.
import { session } from "./api.js";
import { loadPublic, NAV } from "./public.js";
import { renderApp, renderLogin } from "./staff.js";
import { esc, icon } from "./ui.js";

const root = document.getElementById("app");

function parseHash() {
  const raw = location.hash.slice(1) || "/";
  const [path, qs] = raw.split("?");
  return { path: path.replace(/\/+$/, "") || "/", query: Object.fromEntries(new URLSearchParams(qs || "")) };
}

const header = (active) => `<header class="top"><div class="wrap">
  <a class="brand" href="#/"><img src="/assets/shield.png" alt="Stemma Malignani"><span><b>Laboratorio Prove Materiali</b><small>ITI Malignani · Udine</small></span></a>
  <button class="burger" aria-label="Apri il menu" aria-expanded="false" id="burger">☰</button>
  <nav class="nav" id="nav" aria-label="Principale">${NAV.map(([p, l]) => `<a href="#${p}" class="${p === active ? "on" : ""}">${l}</a>`).join("")}<a class="cta" href="#/certificati">Verifica certificato</a></nav></div></header>`;

const footer = `<footer class="foot"><div class="wrap">
  <div><img class="banner" src="/assets/banner.png" alt="I.S.I.S. A. Malignani Udine"><p>Laboratorio autorizzato dal Ministero delle Infrastrutture e dei Trasporti (art. 59 DPR 380/2001). Sistema qualità certificato UNI EN ISO 9001:2015.</p></div>
  <div><h4>Contatti</h4><p>Viale Leonardo da Vinci 10<br>33100 Udine<br>Tel. 0432 46361 (digitare 8)<br><a href="mailto:laboratorio@malignani.ud.it">laboratorio@malignani.ud.it</a></p></div>
  <div><h4>Link</h4><p><a href="#/documenti">Documenti e modelli</a><br><a href="#/certificati">Verifica certificato</a><br><a href="https://www.malignani.ud.it" target="_blank" rel="noopener">Sito dell'Istituto</a><br><a href="#/staff">Accesso staff</a></p></div>
  <div class="copy"><span>© ${new Date().getFullYear()} Laboratorio Prove Materiali · I.I.S. «A. Malignani» Udine</span><span>Orari: lun–ven 8:00–12:30 · lun e mer anche 14:30–16:30</span></div></div></footer>`;

async function route() {
  const { path, query } = parseHash();
  window.scrollTo(0, 0);
  if (path.startsWith("/staff")) {
    document.title = "Area staff · LPM Malignani";
    return session.token ? renderApp(root, path) : renderLogin(root);
  }
  const page = await loadPublic(path, query);
  const p = page || { title: "Pagina non trovata", lead: "", html: `<section class="section"><div class="wrap"><div class="card"><h2>Pagina non trovata</h2><p><a class="btn" href="#/">Torna alla home</a></p></div></div></section>` };
  document.title = (p.home ? "" : p.title + " · ") + "Laboratorio Prove Materiali Malignani Udine";
  root.innerHTML = header(path) + (p.banner || "") + (p.home ? "" : `<div class="page-head"><div class="wrap"><h1>${esc(p.title)}</h1>${p.lead ? `<p>${esc(p.lead)}</p>` : ""}</div></div>`) + `<main>${p.html}</main>` + footer;
  const burger = document.getElementById("burger"), nav = document.getElementById("nav");
  burger.onclick = () => { const o = nav.classList.toggle("open"); burger.setAttribute("aria-expanded", o); };
  nav.onclick = () => nav.classList.remove("open");
  p.init?.();
}

window.addEventListener("hashchange", route);
route();
