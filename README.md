# Laboratorio Prove Materiali · ITI Malignani (Udine)

Sito pubblico + portale staff. Un solo servizio: **FastAPI** (API) che serve anche il frontend statico (`frontend/`, HTML+JS senza build), con **MongoDB Atlas**.

## Cosa c'è
**Sito pubblico:** Home, Dove siamo, Attrezzature, Organizzazione, Documenti (i 21 documenti del vecchio sito sono caricati al primo avvio), Contatti con orari, Verifica certificato (numero di verbale + chiave di ricerca).

**Portale staff** (`/#/staff`, solo da lì; utente+password oppure **badge**, niente Google):

| Ruolo | Può fare |
|---|---|
| Amministratore di sistema | tutto, più utenti, badge e registro attività |
| Segreteria | registra le assegnazioni, **emette e invia i certificati**, pubblica documenti e l'avviso in home |
| Tecnico di laboratorio | vede le assegnazioni, aggiorna stato/prove eseguite/note, carica documenti interni |

**Assegnazioni** = materiali che arrivano in laboratorio. I campi vengono dai modelli D_UFF_07/08/09/10/11 (richiedente, azienda, committente, costruzione, campioni, DDT, verbale di prelievo, fatturazione, formato e consegna del rapporto, restituzione campioni…). Ogni assegnazione riceve il numero di verbale `AAAA/NNNN`.

**Emissione certificato:** la segreteria compila pochi campi (spesso precompilati dall'assegnazione) e indica l'email del richiedente. Il sistema genera la **chiave di ricerca** (`XXXXX-XXXXX`) e invia per email numero di verbale + chiave + link. Quando il certificato è «pronto» parte una seconda email (con il PDF firmato in allegato, se caricato). La chiave è salvata solo come hash: se si perde si usa «Reinvia credenziali» (genera una nuova chiave).

## Messa online (GitHub + Render + MongoDB Atlas)
1. **GitHub:** crea un repository e carica il contenuto di questa cartella.
2. **MongoDB Atlas:** nel cluster esistente va bene un nuovo database (`lpm_malignani`, si crea da solo). Copia la stringa di connessione (`mongodb+srv://utente:password@…`) e in *Network Access* consenti `0.0.0.0/0` (Render non ha IP fisso).
3. **Email (Brevo, gratis, 300/giorno):** crea un account su brevo.com → *Senders* → verifica l'indirizzo mittente → *SMTP & API* → crea una **API key**. (Si usa l'API HTTPS perché Render blocca le porte SMTP sul piano gratuito.) In alternativa Resend: `EMAIL_PROVIDER=resend`.
4. **Render:** *New → Blueprint* sul repository (legge `render.yaml`). Compila le variabili `sync: false`: `MONGODB_URI`, `PUBLIC_URL` (l'URL che Render assegna), `ADMIN_PASSWORD`, `BREVO_API_KEY`, `MAIL_FROM`.
5. Apri `https://…onrender.com/#/staff`, entra con `admin` e la password scelta, poi crea gli utenti di segreteria e tecnici da **Utenti e badge**.

Se non imposti `ADMIN_PASSWORD`, la password del primo accesso compare **una sola volta nei log** di Render.

## Badge
In *Utenti e badge* → modifica utente → clicca il campo «Badge» e passa la tessera sul lettore (il lettore «scrive» il codice e preme Invio). Al login, scheda **Badge**: basta passare la tessera. Il codice è salvato come hash.

## Sviluppo locale
```bash
cd backend && pip install -r requirements.txt
MONGODB_URI=mock uvicorn app.main:app --reload     # http://localhost:8000
python -m tests.test_core                           # test della logica (password, chiavi, email, modelli)
```
Con `MONGODB_URI=mock` il database è in memoria (si azzera a ogni riavvio) e le email vengono solo stampate in console.

## Da completare con materiale tuo
- **Foto delle attrezzature:** metti `settore-0.jpg` (meccanica), `settore-1.jpg` (edilizia), `settore-2.jpg` (bici) in `frontend/assets/img/`: compaiono da sole.
- **Documenti mancanti** rispetto al vecchio sito: Manuale della qualità, NTC 2018, Circolare esplicativa NTC → caricali da *Documenti* (spunta «Pubblica nella pagina Documenti»).
- **Avviso ferie:** il vecchio sito mostrava la chiusura 03/08–22/08/2026 (già passata): in home ora non c'è nessun avviso; si gestisce da *Avviso in home*.
- Il piano gratuito di Render «addormenta» il servizio dopo 15 minuti: la prima visita può metterci circa un minuto.
