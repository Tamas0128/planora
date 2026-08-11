"""One-off: uploads the docxtpl-ready legal templates (produced by
fill_legal_templates.py) through the admin /api/document-templates endpoint.

    docker compose exec backend python scripts/upload_legal_templates.py
"""

import os

import httpx

BASE_URL = "http://localhost:8000/api"
ADMIN_PASSWORD = os.environ["ADMIN_PASSWORD"]
IN_DIR = "/app/tmp_templates_filled"

# (filename, family, doc_subtype, currency, is_electronic, name)
UPLOADS = [
    ("Jogaszi_Ugyfel_Epitesi_Szerzodes_HUF.docx", "client_contract", "normal", "HUF", False, "Ügyfél építési szerződés (HUF)"),
    ("Jogaszi_Ugyfel_Epitesi_Szerzodes_EUR.docx", "client_contract", "normal", "EUR", False, "Ügyfél építési szerződés (EUR)"),
    ("Jogaszi_Alvallalkozoi_Szerzodes_HUF.docx", "subcontractor_contract", "normal", "HUF", False, "Alvállalkozói szerződés (HUF)"),
    ("Jogaszi_Alvallalkozoi_Szerzodes_HUF_Elektronikus.docx", "subcontractor_contract", "normal", "HUF", True, "Alvállalkozói szerződés (HUF, elektronikus)"),
    ("Jogaszi_Alvallalkozoi_Szerzodes_EUR.docx", "subcontractor_contract", "normal", "EUR", False, "Alvállalkozói szerződés (EUR)"),
    ("Jogaszi_Alvallalkozoi_Szerzodes_EUR_Elektronikus.docx", "subcontractor_contract", "normal", "EUR", True, "Alvállalkozói szerződés (EUR, elektronikus)"),
    ("TIG_papir_alapu.docx", "tig", "normal", None, False, "TIG — papír alapú"),
    ("TIG_elektronikus.docx", "tig", "normal", None, True, "TIG — elektronikus"),
    ("TIG_modositasi.docx", "tig", "helyesbito", None, False, "TIG — módosítási"),
    ("TIG_torlesi.docx", "tig", "torlesi", None, False, "TIG — törlési"),
    ("TIG_utolagos.docx", "tig", "utolagos", None, False, "TIG — utólagos"),
]


def main() -> None:
    with httpx.Client(timeout=30) as client:
        resp = client.post(
            f"{BASE_URL}/auth/login/json", json={"username": "admin", "password": ADMIN_PASSWORD}
        )
        resp.raise_for_status()
        headers = {"Authorization": f"Bearer {resp.json()['access_token']}"}

        for filename, family, doc_subtype, currency, is_electronic, name in UPLOADS:
            path = os.path.join(IN_DIR, filename)
            with open(path, "rb") as f:
                data = {
                    "family": family,
                    "doc_subtype": doc_subtype,
                    "is_electronic": str(is_electronic).lower(),
                    "name": name,
                }
                if currency:
                    data["currency"] = currency
                r = client.post(
                    f"{BASE_URL}/document-templates",
                    data=data,
                    files={"file": (filename, f, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")},
                    headers=headers,
                )
            if r.status_code != 200:
                print(f"FAILED {filename}: {r.status_code} {r.text}")
            else:
                print(f"OK {filename} -> template id {r.json()['id']}")


if __name__ == "__main__":
    main()
