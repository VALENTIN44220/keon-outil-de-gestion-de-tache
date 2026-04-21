"""
Import B26 IT Budget — Feuille Opex → table it_budget_lines
Usage : python import_b26_budget.py
"""

import pandas as pd
import requests
import json
import sys

SUPABASE_URL = "https://yqdbuwidnwhgqimimzpm.supabase.co"
SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxZGJ1d2lkbndoZ3FpbWltenBtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDI2Mzk2NywiZXhwIjoyMDg5ODM5OTY3fQ.TNRfqzg4papOPvvGrnhWf2ttBDBQt0mYyBGwHbm0NBU"
EXCEL_PATH = "2026-01-26 Keon B26 final IT SKEON-B-PFO.xlsx"
TABLE = "it_budget_lines"
BATCH_SIZE = 50

HEADERS = {
    "apikey": SERVICE_ROLE_KEY,
    "Authorization": f"Bearer {SERVICE_ROLE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "resolution=merge-duplicates",  # upsert sur external_key
}


def build_records(df: pd.DataFrame) -> list[dict]:
    mois_cols = [c for c in df.columns if hasattr(c, "month")]
    records = []

    for _, row in df.iterrows():
        niveau2 = str(row["2e niveau"]).strip() if pd.notna(row["2e niveau"]) else None
        niveau3 = str(row["3e niveau"]).strip() if pd.notna(row["3e niveau"]) else None
        description = str(row["Description"]).strip() if pd.notna(row["Description"]) else None
        commentaire = str(row["Commentaires"]).strip() if pd.notna(row["Commentaires"]) else None
        if commentaire and commentaire.lower() in ("nan", "none", ""):
            commentaire = None

        for col in mois_cols:
            val = row[col]
            if not pd.notna(val):
                continue
            montant = round(float(val), 2)
            # On importe même les lignes à 0 pour avoir la structure complète
            ext_key = f"B26_OPEX_{niveau2}_{niveau3}_{description}_{col.month}".replace(" ", "_")[:100]

            records.append({
                "exercice": 2026,
                "version": "V1",
                "annee": 2026,
                "entite": "KEON",
                "categorie": niveau2,
                "sous_categorie": niveau3,
                "type_depense": "Opex",
                "nature_depense": None,
                "description": description,
                "mois_budget": col.month,
                "montant_budget": montant,
                "montant_budget_revise": None,
                "statut": "brouillon",
                "mode_saisie": "import",
                "commentaire": commentaire,
                "external_key": ext_key,
                "it_project_id": None,
            })

    return records


def upsert_batch(records: list[dict]) -> dict:
    url = f"{SUPABASE_URL}/rest/v1/{TABLE}"
    # Upsert sur external_key
    headers = {**HEADERS, "Prefer": "resolution=merge-duplicates,return=representation"}
    resp = requests.post(
        url,
        headers=headers,
        params={"on_conflict": "external_key"},
        data=json.dumps(records),
        timeout=30,
    )
    return resp


def main():
    print(f"Lecture du fichier : {EXCEL_PATH}")
    try:
        df = pd.read_excel(EXCEL_PATH, sheet_name="Opex", header=0)
    except FileNotFoundError:
        print(f"ERREUR : fichier '{EXCEL_PATH}' introuvable.")
        print("Placez le fichier Excel dans le même dossier que ce script.")
        sys.exit(1)

    records = build_records(df)
    print(f"Records préparés : {len(records)}")

    # Vérification connexion Supabase
    test = requests.get(
        f"{SUPABASE_URL}/rest/v1/{TABLE}?limit=1",
        headers=HEADERS,
        timeout=10,
    )
    if test.status_code not in (200, 206):
        print(f"ERREUR connexion Supabase : {test.status_code} — {test.text}")
        sys.exit(1)
    print("Connexion Supabase OK")

    # Vérifier si external_key a une contrainte unique (nécessaire pour upsert)
    # Si pas de contrainte, on fait DELETE + INSERT
    print("Suppression des imports B26 existants (external_key LIKE 'B26_OPEX_%')...")
    del_resp = requests.delete(
        f"{SUPABASE_URL}/rest/v1/{TABLE}",
        headers=HEADERS,
        params={"external_key": "like.B26_OPEX_%", "mode_saisie": "eq.import"},
        timeout=30,
    )
    if del_resp.status_code in (200, 204):
        print("Nettoyage OK")
    else:
        print(f"Avertissement nettoyage : {del_resp.status_code} — {del_resp.text[:200]}")

    # Insert par batch
    total_ok = 0
    errors = []

    for i in range(0, len(records), BATCH_SIZE):
        batch = records[i: i + BATCH_SIZE]
        resp = requests.post(
            f"{SUPABASE_URL}/rest/v1/{TABLE}",
            headers={**HEADERS, "Prefer": "return=minimal"},
            data=json.dumps(batch),
            timeout=30,
        )
        if resp.status_code in (200, 201):
            total_ok += len(batch)
            print(f"  Batch {i//BATCH_SIZE + 1} : {len(batch)} lignes OK")
        else:
            errors.append(f"Batch {i//BATCH_SIZE + 1} : {resp.status_code} — {resp.text[:300]}")
            print(f"  ERREUR batch {i//BATCH_SIZE + 1} : {resp.status_code}")
            print(f"  {resp.text[:300]}")

    print()
    print(f"Import terminé : {total_ok}/{len(records)} lignes insérées")

    if errors:
        print("\nERREURS :")
        for e in errors:
            print(f"  - {e}")
        sys.exit(1)
    else:
        print("Succès complet.")


if __name__ == "__main__":
    main()
