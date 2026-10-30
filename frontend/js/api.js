// Client API + sessione. Il token resta in sessionStorage (si perde chiudendo la scheda).
const KEY = "lpm_token";
let memToken = null;

export const session = {
  get token() { try { return sessionStorage.getItem(KEY) || memToken; } catch { return memToken; } },
  set token(v) { memToken = v; try { v ? sessionStorage.setItem(KEY, v) : sessionStorage.removeItem(KEY); } catch { /* storage non disponibile */ } },
  user: null,
};

export class ApiError extends Error {
  constructor(message, status) { super(message); this.status = status; }
}

export async function api(path, { method = "GET", body, form } = {}) {
  const headers = {};
  if (session.token) headers.Authorization = "Bearer " + session.token;
  let payload;
  if (form) payload = form;
  else if (body !== undefined) { headers["Content-Type"] = "application/json"; payload = JSON.stringify(body); }
  let res;
  try { res = await fetch("/api" + path, { method, headers, body: payload }); }
  catch { throw new ApiError("Impossibile contattare il server. Controlla la connessione.", 0); }
  if (res.status === 401 && session.token) {
    session.token = null; session.user = null;
    if (!location.hash.startsWith("#/staff")) location.hash = "#/staff";
    else location.reload();
  }
  if (!res.ok) {
    let msg = "Errore " + res.status;
    try {
      const j = await res.json();
      msg = typeof j.detail === "string" ? j.detail : Array.isArray(j.detail) ? j.detail.map(d => (d.loc || []).slice(1).join(".") + ": " + d.msg).join("; ") : msg;
    } catch { /* corpo non JSON */ }
    throw new ApiError(msg, res.status);
  }
  return res.status === 204 ? null : res.json();
}

// Scarica un file protetto (serve l'header Authorization, quindi niente link diretto).
export async function downloadAuth(path, filename) {
  const res = await fetch("/api" + path, { headers: { Authorization: "Bearer " + session.token } });
  if (!res.ok) throw new ApiError("Download non riuscito", res.status);
  const url = URL.createObjectURL(await res.blob());
  const a = Object.assign(document.createElement("a"), { href: url, download: filename });
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 5000);
}
