"""Documenti del vecchio sito, caricati al primo avvio nella pagina Documenti."""
from pathlib import Path

SEED_DIR = Path(__file__).resolve().parents[1] / "seed_docs"

M = "Modelli di richiesta prove"
P = "Prove e prezzi"
A = "Autorizzazioni e qualità"
N = "Normativa e comunicazioni"

SEED_DOCS = [
    {"titolo": "Modello di richiesta prove DM 17-01-2018", "categoria": M,
     "files": ["D_UFF_07_ModelloDomanda_DM_17-01-18.docx", "D_UFF_07_ModelloDomanda_DM_17-01-18.pdf"]},
    {"titolo": "Modello di richiesta prove generico", "categoria": M,
     "files": ["D_UFF_08_Modello_Domanda_P2.docx", "D_UFF_08_Modello_Domanda_P2.pdf"]},
    {"titolo": "Modello di richiesta prove cicli", "categoria": M,
     "files": ["D_UFF_09_Modello_Domanda_P2_cicli.doc", "D_UFF_09_Modello_Domanda_P2_cicli.pdf"]},
    {"titolo": "Modello di richiesta prove DM 17-01-2018 Centri di trasformazione", "categoria": M,
     "files": ["D_UFF_10_Modello_Domanda_P3.docx", "D_UFF_10_Modello_Domanda_P3.pdf"]},
    {"titolo": "Modello di richiesta prove EN 1090", "categoria": M,
     "files": ["D_UFF_11_Modello_Domanda_P2_EN1090.docx", "D_UFF_11_Modello_Domanda_P2_EN1090.pdf"]},
    {"titolo": "Verbale di prelievo campioni calcestruzzo", "categoria": M, "files": ["Verbale_prelievo_cls.pdf"]},
    {"titolo": "Listino prezzi 2026", "categoria": P, "files": ["Listino_2026.pdf"]},
    {"titolo": "Elenco prove - Laboratorio di meccanica", "categoria": P, "files": ["Elenco_prove_lab_Mec.pdf"]},
    {"titolo": "Elenco prove - Laboratorio di edilizia", "categoria": P, "files": ["Elenco_prove_lab_Edi.pdf"]},
    {"titolo": "Elenco prove - Laboratorio cicli", "categoria": P, "files": ["Elenco_prove_lab_Bici.pdf"]},
    {"titolo": "Prima autorizzazione ministeriale (1976)", "categoria": A, "files": ["Prima_Autorizzazione_1976.pdf"]},
    {"titolo": "Autorizzazione ministeriale", "categoria": A, "files": ["Autorizzazione_MIMS_2022.pdf"]},
    {"titolo": "Nomina Direttore - Settembre 2024", "categoria": A, "files": ["Nomina_Direttore_Set24.pdf"]},
    {"titolo": "Politica per la qualità", "categoria": A, "files": ["Politica_per_la_Qualita.pdf"]},
    {"titolo": "Certificazione qualità ISO 9001", "categoria": A, "files": ["Certificato_9001_2018.pdf"]},
    {"titolo": "Regolamento del laboratorio", "categoria": A, "files": ["Regolamento_LPM.pdf"]},
    {"titolo": "Errata corrige libro NTC", "categoria": N, "files": ["Errata_corrige_libro_NTC.pdf"]},
    {"titolo": "Guida al controllo dei materiali da costruzione", "categoria": N, "files": ["Guida_Direz_Lavori.pdf"]},
    {"titolo": "Comunicazione sul prelievo di materiali in opera - Sentenze TAR Lazio 2022", "categoria": N,
     "files": ["Comunicazione_sentenze_TAR.pdf"]},
    {"titolo": "Comunicazione sull'assoggettabilità all'imposta di bollo sui certificati", "categoria": N,
     "files": ["Comunicazione_bolli.pdf"]},
    {"titolo": "Parere dell'Agenzia delle Entrate", "categoria": N, "files": ["Parere_AdE_bolli_sui_certificati.pdf"]},
]
