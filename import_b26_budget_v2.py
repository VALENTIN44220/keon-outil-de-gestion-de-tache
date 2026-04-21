"""
Import B26 IT Budget v2
- 1 ligne par description dans it_budget_lines (montant annuel)
- 12 entrées dans it_budget_line_months (ventilation mensuelle)
Usage : python import_b26_budget_v2.py
"""

import pandas as pd
import requests
import json
import sys

SUPABASE_URL = "https://yqdbuwidnwhgqimimzpm.supabase.co"
SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxZGJ1d2lkbndoZ3FpbWltenBtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDI2Mzk2NywiZXhwIjoyMDg5ODM5OTY3fQ.TNRfqzg4papOPvvGrnhWf2ttBDBQt0mYyBGwHbm0NBU"
EXCEL_PATH = "2026-01-26 Keon B26 final IT SKEON-B-PFO.xlsx"
BATCH_SIZE = 50

HEADERS = {
    "apikey": SERVICE_ROLE_KEY,
    "Authorization": f"Bearer {SERVICE_ROLE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation",
}

HEADERS_MINIMAL = {
    "apikey": SERVICE_ROLE_KEY,
    "Authorization": f"Bearer {SERVICE_ROLE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=minimal",
}


def supabase_delete(table: str, params: dict):
    resp = requests.delete(
        f"{SUPABASE_URL}/rest/v1/{table}",
        headers=HEADERS_MINIMAL,
        params=params,
        timeout=30,
    )
    return resp


def supabase_insert(table: str, records: list, minimal=True) -> requests.Response:
    headers = HEADERS_MINIMAL if minimal else HEADERS
    resp = requests.post(
        f"{SUPABASE_URL}/rest/v1/{table}",
        headers=headers,
        data=json.dumps(records),
        timeout=30,
    )
    return resp


def build_line_records(df: pd.DataFrame) -> list[dict]:
    """1 enregistrement par ligne du fichier Excel (description unique)."""
    mois_cols = [c for c in df.columns if hasattr(c, "month")]
    records = []

    for idx, row in df.iterrows():
        niveau2    = str(row["2e niveau"]).strip()   if pd.notna(row["2e niveau"])   else None
        niveau3    = str(row["3e niveau"]).strip()   if pd.notna(row["3e niveau"])   else None
        description= str(row["Description"]).strip() if pd.notna(row["Description"]) else None
        commentaire= str(row["Commentaires"]).strip()if pd.notna(row["Commentaires"])else None
        if commentaire in ("nan", "None", ""):
            commentaire = None

        # Montant mensuel de référence (colonne Total = tarif × nb)
        montant_mensuel = float(row["Total"]) if pd.notna(row["Total"]) else 0.0
        montant_mensuel = round(montant_mensuel, 2)

        # Total annuel = somme des colonnes mois
        montant_annuel = round(sum(
            float(row[c]) for c in mois_cols if pd.notna(row[c])
        ), 2)

        # external_key stable basée sur position + description
        ext_key = f"B26_OPEX_{niveau2}_{niveau3}_{description}_L{idx}".replace(" ", "_")[:120]

        records.append({
            "exercice":             2026,
            "version":              "V1",
            "annee":                2026,
            "entite":               "KEON",
            "categorie":            niveau2,
            "sous_categorie":       niveau3,
            "type_depense":         "Opex",
            "nature_depense":       None,
            "description":          description,
            "mois_budget":          None,          # annuel → pas de mois sur la ligne principale
            "montant_budget":       montant_mensuel,
            "montant_budget_revise":None,
            "montant_annuel":       montant_annuel,
            "statut":               "brouillon",
            "mode_saisie":          "import",
            "commentaire":          commentaire,
            "external_key":         ext_key,
            "it_project_id":        None,
            "_mois_data":           {          # champ temporaire, non envoyé à Supabase
                c.month: round(float(row[c]), 2) if pd.notna(row[c]) else 0.0
                for c in mois_cols
            },
        })

    return records


def insert_lines_and_months(line_records: list[dict]):
    """Insère les lignes et récupère les IDs pour insérer les mois."""

    # Sépare les données mois (non envoyées à Supabase)
    months_by_ext_key = {}
    clean_records = []
    for r in line_records:
        mois_data = r.pop("_mois_data")
        months_by_ext_key[r["external_key"]] = mois_data
        clean_records.append(r)

    # Insert lignes par batch, récupère les IDs
    print(f"\n--- Insertion it_budget_lines ({len(clean_records)} lignes) ---")
    inserted_lines = []

    for i in range(0, len(clean_records), BATCH_SIZE):
        batch = clean_records[i: i + BATCH_SIZE]
        resp = requests.post(
            f"{SUPABASE_URL}/rest/v1/it_budget_lines",
            headers=HEADERS,
            data=json.dumps(batch),
            timeout=30,
        )
        if resp.status_code in (200, 201):
            data = resp.json()
            inserted_lines.extend(data)
            print(f"  Batch {i//BATCH_SIZE + 1} : {len(data)} lignes OK")
        else:
            print(f"  ERREUR batch {i//BATCH_SIZE + 1} : {resp.status_code}")
            print(f"  {resp.text[:400]}")
            sys.exit(1)

    print(f"Total lignes insérées : {len(inserted_lines)}")

    # Construire les enregistrements mensuels
    month_records = []
    for line in inserted_lines:
        ext_key   = line["external_key"]
        line_id   = line["id"]
        mois_data = months_by_ext_key.get(ext_key, {})

        for mois_num, montant in mois_data.items():
            month_records.append({
                "budget_line_id":       line_id,
                "mois":                 mois_num,
                "montant_budget":       montant,
                "montant_budget_revise":None,
                "ref_commande_divalto": None,
                "ref_facture_divalto":  None,
                "statut_rapprochement": "non_rapproche",
                "pdf_url":              None,
                "commentaire":          None,
            })

    # Insert ventilation mensuelle
    print(f"\n--- Insertion it_budget_line_months ({len(month_records)} entrées) ---")
    months_ok = 0

    for i in range(0, len(month_records), BATCH_SIZE):
        batch = month_records[i: i + BATCH_SIZE]
        resp = supabase_insert("it_budget_line_months", batch, minimal=True)
        if resp.status_code in (200, 201):
            months_ok += len(batch)
            print(f"  Batch {i//BATCH_SIZE + 1} : {len(batch)} mois OK")
        else:
            print(f"  ERREUR batch {i//BATCH_SIZE + 1} : {resp.status_code}")
            print(f"  {resp.text[:400]}")
            sys.exit(1)

    print(f"Total mois insérés : {months_ok}")
    return len(inserted_lines), months_ok


def main():
    print(f"Lecture du fichier : {EXCEL_PATH}")
    try:
        df = pd.read_excel(EXCEL_PATH, sheet_name="Opex", header=0)
    except FileNotFoundError:
        print(f"ERREUR : fichier '{EXCEL_PATH}' introuvable.")
        sys.exit(1)

    print(f"Lignes Excel : {len(df)}")

    # Vérification connexion
    test = requests.get(
        f"{SUPABASE_URL}/rest/v1/it_budget_lines?limit=1",
        headers=HEADERS_MINIMAL,
        timeout=10,
    )
    if test.status_code not in (200, 206):
        print(f"ERREUR connexion Supabase : {test.status_code}")
        sys.exit(1)
    print("Connexion Supabase OK")

    # Nettoyage imports B26 existants
    print("\nNettoyage des imports B26 existants...")

    # Récupérer les IDs des lignes B26 pour supprimer les mois en cascade
    get_resp = requests.get(
        f"{SUPABASE_URL}/rest/v1/it_budget_lines",
        headers=HEADERS,
        params={
            "external_key": "like.B26_OPEX_%",
            "mode_saisie":  "eq.import",
            "select":       "id",
        },
        timeout=30,
    )
    if get_resp.status_code == 200:
        existing = get_resp.json()
        print(f"  {len(existing)} lignes B26 existantes trouvées")
    else:
        existing = []

    # Suppression en cascade (ON DELETE CASCADE gère les mois automatiquement)
    del_resp = supabase_delete(
        "it_budget_lines",
        {"external_key": "like.B26_OPEX_%", "mode_saisie": "eq.import"},
    )
    if del_resp.status_code in (200, 204):
        print("  Nettoyage OK (cascade sur it_budget_line_months)")
    else:
        print(f"  Avertissement nettoyage : {del_resp.status_code} — {del_resp.text[:200]}")

    # Construction et insertion
    line_records = build_line_records(df)
    nb_lines, nb_months = insert_lines_and_months(line_records)

    print(f"\n{'='*50}")
    print(f"Import B26 terminé avec succès")
    print(f"  Lignes budgétaires : {nb_lines}")
    print(f"  Ventilation mois   : {nb_months}")
    print(f"  Ratio              : {nb_months // nb_lines if nb_lines else 0} mois/ligne")


if __name__ == "__main__":
    main()
