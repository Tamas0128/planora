"""One-off seed script for the local dev stack — creates a handful of
realistic sample records (projects, CRM customers/quotes/contracts, a
partner and an own company) so the UI isn't empty while testing.

Run inside the backend container against its own API:
    docker compose exec backend python scripts/seed_dev_data.py

Never point this at the pilot stack — it's meant to stay empty for the
client demo.
"""

import os
import sys
from datetime import date, timedelta

import httpx

BASE_URL = "http://localhost:8000/api"
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD")

if not ADMIN_PASSWORD:
    print("ADMIN_PASSWORD not set in the backend container's environment — aborting.")
    sys.exit(1)


def login(client: httpx.Client) -> dict:
    resp = client.post(
        f"{BASE_URL}/auth/login/json",
        json={"username": "admin", "password": ADMIN_PASSWORD},
    )
    resp.raise_for_status()
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def create_user(client, headers, username, role, full_name):
    resp = client.post(
        f"{BASE_URL}/auth/users",
        json={
            "username": username,
            "email": f"{username}@example.com",
            "password": "TestPass123!",
            "full_name": full_name,
            "role": role,
        },
        headers=headers,
    )
    if resp.status_code == 200:
        return resp.json()
    # already exists from a previous run
    existing = client.get(f"{BASE_URL}/auth/users", headers=headers).json()
    return next(u for u in existing if u["username"] == username)


def create_project(client, headers, **fields):
    resp = client.post(f"{BASE_URL}/projects", json=fields, headers=headers)
    resp.raise_for_status()
    return resp.json()


def create_customer(client, headers, **fields):
    resp = client.post(f"{BASE_URL}/crm/customers", json=fields, headers=headers)
    resp.raise_for_status()
    return resp.json()


def create_quote(client, headers, customer_id, value):
    resp = client.post(
        f"{BASE_URL}/crm/quotes",
        json={
            "customer_id": customer_id,
            "value": value,
            "content_json": {
                "items": [
                    {"description": "Alapozás és szerkezetépítés", "quantity": 1, "unit": "db", "unit_price": float(value)}
                ]
            },
        },
        headers=headers,
    )
    resp.raise_for_status()
    return resp.json()


def create_contract(client, headers, **fields):
    resp = client.post(f"{BASE_URL}/crm/contracts", json=fields, headers=headers)
    resp.raise_for_status()
    return resp.json()


def create_own_company(client, headers, **fields):
    resp = client.post(f"{BASE_URL}/finance/own-companies", json=fields, headers=headers)
    resp.raise_for_status()
    return resp.json()


def create_partner(client, headers, **fields):
    resp = client.post(f"{BASE_URL}/finance/partners", json=fields, headers=headers)
    resp.raise_for_status()
    return resp.json()


def main():
    with httpx.Client(timeout=30) as client:
        headers = login(client)
        print("Logged in as admin.")

        pm = create_user(client, headers, "seed_pm", "project_manager", "Kovács Péter")
        sm = create_user(client, headers, "seed_sm", "site_manager", "Nagy István")
        print(f"Users ready: {pm['username']}, {sm['username']}")

        today = date.today()

        projects = [
            dict(
                name="Zöldkert Családi Ház",
                settlement="Szeged", address="Zöldkert utca 12.",
                client_name="Tóth Family Kft.", client_phone="+36301112233",
                floor_area_sqm=140, delivery_date=(today + timedelta(days=180)).isoformat(),
                status="foundation", project_manager_id=pm["id"], site_manager_id=sm["id"],
            ),
            dict(
                name="Napsugár Ikerház",
                settlement="Debrecen", address="Napsugár tér 4.",
                client_name="Kiss Anna", client_phone="+36309998877",
                floor_area_sqm=210, delivery_date=(today + timedelta(days=270)).isoformat(),
                status="structure", project_manager_id=pm["id"], site_manager_id=sm["id"],
            ),
            dict(
                name="Erdőszél Villa",
                settlement="Pécs", address="Erdőszél utca 8.",
                client_name="Varga Zoltán", client_phone="+36205554433",
                floor_area_sqm=320, delivery_date=(today + timedelta(days=60)).isoformat(),
                status="turnkey", project_manager_id=pm["id"], site_manager_id=sm["id"],
            ),
        ]
        for p in projects:
            created = create_project(client, headers, **p)
            print(f"Project created: {created['name']} ({created['project_code']})")

        customers = [
            dict(type="company", name="Balaton Ingatlan Kft.", owner_id=1, source="referral"),
            dict(type="person", name="Horváth Eszter", owner_id=1, source="website_seo"),
        ]
        created_customers = [create_customer(client, headers, **c) for c in customers]
        for c in created_customers:
            print(f"Customer created: {c['name']} ({c['customer_number']})")

        quote = create_quote(client, headers, created_customers[0]["id"], "18500000")
        client.patch(
            f"{BASE_URL}/crm/quotes/{quote['id']}/status",
            json={"status": "sent"}, headers=headers,
        )
        client.patch(
            f"{BASE_URL}/crm/quotes/{quote['id']}/status",
            json={"status": "accepted"}, headers=headers,
        )
        print(f"Quote created + accepted: {quote['quote_number']}")

        contract = create_contract(
            client, headers,
            customer_id=created_customers[0]["id"],
            quote_id=quote["id"],
            start_date=today.isoformat(),
            end_date=(today + timedelta(days=365)).isoformat(),
            value="18500000",
        )
        print(f"Contract created: {contract['contract_number']}")

        own_company = create_own_company(
            client, headers,
            name="Planora Kivitelező Kft.",
            registered_address="Budapest, Fő utca 1.",
            tax_number="12345678-2-42",
        )
        print(f"Own company created: {own_company['name']}")

        partner = create_partner(
            client, headers,
            name="Villanyszer Bt.",
            tax_number="87654321-1-13",
            phone="+36301234567",
            contact_name="Szabó Gábor",
        )
        print(f"Partner (subcontractor) created: {partner['name']}")

        print("\nSeed complete.")


if __name__ == "__main__":
    main()
