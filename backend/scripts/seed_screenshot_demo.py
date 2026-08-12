"""One-off: enriches the local dev seed data with full-detail customers,
a subcontractor contract + TIG, more quotes/contracts (HUF and EUR), and
generates a document from every uploaded legal template — so there's real,
screenshot-worthy content across the CRM/finance/document-generator pages.

Run inside the backend container against its own API, local dev only:
    docker compose exec backend python scripts/seed_screenshot_demo.py
"""

import os
import sys
from datetime import date, timedelta

import httpx

BASE_URL = "http://localhost:8000/api"
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD")

if not ADMIN_PASSWORD:
    print("ADMIN_PASSWORD not set — aborting.")
    sys.exit(1)


def login(client: httpx.Client) -> dict:
    resp = client.post(
        f"{BASE_URL}/auth/login/json", json={"username": "admin", "password": ADMIN_PASSWORD}
    )
    resp.raise_for_status()
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


def main() -> None:
    with httpx.Client(timeout=30) as client:
        headers = login(client)
        today = date.today()

        # --- Enrich existing customer #1 (Balaton Ingatlan Kft.) with full data
        client.patch(
            f"{BASE_URL}/crm/customers/1",
            json={
                "billing_address": "6000 Kecskemét, Kossuth tér 5.",
                "tax_number": "23456789-2-03",
                "company_registry_number": "03-09-123456",
                "bank_account_number": "11773016-00000000-00000000",
                "representative_name": "Kovács Attila",
                "representative_title": "ügyvezető",
                "contact_name": "Szabó Renáta",
                "phone": "+36301112233",
                "email": "info@balatoningatlan.hu",
            },
            headers=headers,
        )

        # --- Enrich own company (Planora Kivitelező Kft.)
        client.patch(
            f"{BASE_URL}/finance/own-companies/1",
            json={
                "mailing_address": "1054 Budapest, Fő utca 1.",
                "company_registry_number": "01-09-987654",
                "bank_account_number": "10918001-00000000-00000000",
                "representative_title": "ügyvezető igazgató",
                "contact_email": "iroda@planora.hu",
                "contact_phone": "+36301234000",
            },
            headers=headers,
        )

        # --- Enrich partner (Villanyszer Bt.)
        client.patch(
            f"{BASE_URL}/finance/partners/1",
            json={
                "billing_address": "4025 Debrecen, Piac utca 22.",
                "company_registry_number": "09-06-011223",
                "bank_account_number": "11600006-00000000-00000000",
                "representative_name": "Villanyszer Károly",
                "representative_title": "tulajdonos",
            },
            headers=headers,
        )

        # --- Second own company + partner for variety
        oc2 = client.post(
            f"{BASE_URL}/finance/own-companies",
            json={
                "name": "Planora Tetőfedő Kft.",
                "registered_address": "2000 Szentendre, Fő tér 3.",
                "tax_number": "87651234-2-13",
            },
            headers=headers,
        ).json()
        print("Own company 2:", oc2["name"])

        partner2 = client.post(
            f"{BASE_URL}/finance/partners",
            json={
                "name": "Kőműves Trió Kft.",
                "tax_number": "34567890-2-06",
                "phone": "+36309876543",
                "contact_name": "Nagy Béla",
                "billing_address": "6720 Szeged, Dugonics tér 1.",
            },
            headers=headers,
        ).json()
        print("Partner 2:", partner2["name"])

        # --- Second full-detail company customer
        cust2 = client.post(
            f"{BASE_URL}/crm/customers",
            json={
                "type": "company",
                "name": "Zöldmező Beruházó Kft.",
                "owner_id": 1,
                "source": "referral",
                "phone": "+36201234567",
                "email": "kapcsolat@zoldmezo.hu",
                "tax_number": "12398765-2-42",
                "billing_address": "1118 Budapest, Rétköz utca 7.",
            },
            headers=headers,
        ).json()
        print("Customer 2:", cust2["name"])

        # --- EUR quote+contract for customer 2 (client_contract, EUR template)
        quote2 = client.post(
            f"{BASE_URL}/crm/quotes",
            json={
                "customer_id": cust2["id"],
                "value": "42000",
                "content_json": {
                    "items": [
                        {"description": "Alapozás és szerkezetépítés", "quantity": 1, "unit": "db", "unit_price": 28000},
                        {"description": "Tetőfedés és szigetelés", "quantity": 1, "unit": "db", "unit_price": 14000},
                    ]
                },
            },
            headers=headers,
        ).json()
        client.patch(f"{BASE_URL}/crm/quotes/{quote2['id']}/status", json={"status": "sent"}, headers=headers)
        client.patch(f"{BASE_URL}/crm/quotes/{quote2['id']}/status", json={"status": "accepted"}, headers=headers)
        contract2 = client.post(
            f"{BASE_URL}/crm/contracts",
            json={
                "customer_id": cust2["id"],
                "quote_id": quote2["id"],
                "own_company_id": 1,
                "contract_type": "Kivitelezés – kulcsrakész",
                "start_date": today.isoformat(),
                "end_date": (today + timedelta(days=300)).isoformat(),
                "effective_date": today.isoformat(),
                "value": "42000",
                "net_value_standard": "42000",
                "currency": "EUR",
                "payment_due_date": (today + timedelta(days=30)).isoformat(),
                "payment_method": "Utalás",
            },
            headers=headers,
        ).json()
        print("EUR contract:", contract2["contract_number"])

        # --- Second HUF contract on customer 1, with full financial header
        contract1b = client.post(
            f"{BASE_URL}/crm/contracts",
            json={
                "customer_id": 1,
                "own_company_id": 1,
                "contract_type": "Kivitelezés – szerkezet",
                "start_date": today.isoformat(),
                "end_date": (today + timedelta(days=200)).isoformat(),
                "effective_date": today.isoformat(),
                "net_value_standard": "15000000",
                "net_value_reduced": "2000000",
                "currency": "HUF",
                "payment_due_date": (today + timedelta(days=14)).isoformat(),
                "payment_method": "Készpénz és utalás",
            },
            headers=headers,
        ).json()
        print("HUF contract 2:", contract1b["contract_number"])

        # --- Subcontractor contract + TIG on project 1 (Zöldkert Családi Ház)
        sc_contract = client.post(
            f"{BASE_URL}/finance/projects/1/subcontractor-contracts",
            json={
                "partner_id": 1,
                "own_company_id": 1,
                "contract_type": "Villanyszerelés",
                "scope_of_work": "Teljes körű villanyszerelési munkák az 1. ütemben",
                "value": "3500000",
                "vat_type": "standard_27",
                "currency": "HUF",
                "payment_terms_days": 15,
                "payment_method": "Utalás",
                "start_date": today.isoformat(),
                "end_date": (today + timedelta(days=120)).isoformat(),
                "effective_date": today.isoformat(),
            },
            headers=headers,
        ).json()
        print("Subcontractor contract:", sc_contract["contract_number"])

        tig = client.post(
            f"{BASE_URL}/finance/projects/1/tigs",
            json={
                "partner_id": 1,
                "subcontractor_contract_id": sc_contract["id"],
                "date": today.isoformat(),
                "period_start": (today - timedelta(days=14)).isoformat(),
                "period_end": today.isoformat(),
                "net_value": "1200000",
                "vat_type": "standard_27",
                "note": "Földszinti vezetékezés és elosztószekrény kiépítése — 1. részteljesítés.",
            },
            headers=headers,
        ).json()
        print("TIG:", tig["id"])

        # --- Generate one document per uploaded template
        generations = [
            {"family": "client_contract", "source_id": contract1b["id"]},  # HUF
            {"family": "client_contract", "source_id": contract2["id"]},  # EUR
            {"family": "subcontractor_contract", "source_id": sc_contract["id"], "is_electronic": False},
            {"family": "subcontractor_contract", "source_id": sc_contract["id"], "is_electronic": True},
            {"family": "tig", "source_id": tig["id"], "doc_subtype": "normal", "is_electronic": False},
            {"family": "tig", "source_id": tig["id"], "doc_subtype": "normal", "is_electronic": True},
        ]
        for body in generations:
            r = client.post(f"{BASE_URL}/generated-documents", json=body, headers=headers)
            if r.status_code == 200:
                print(f"Generated {body['family']} (source {body['source_id']}) -> doc {r.json()['id']}")
            else:
                print(f"FAILED {body}: {r.status_code} {r.text}")

        print("\nDone.")


if __name__ == "__main__":
    main()
