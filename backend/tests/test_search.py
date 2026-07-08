from tests.conftest import create_project, create_user, login


def test_search_matches_name_client_settlement_code(client, admin_headers):
    create_project(client, admin_headers, name="Zöld Ház", client_name="Kovács Béla", settlement="Győr", project_code="ZH-1")
    create_project(client, admin_headers, name="Kék Villa", client_name="Nagy Erika", settlement="Pécs", project_code="KV-1")

    by_name = client.get("/api/search?q=Zöld", headers=admin_headers).json()
    assert len(by_name) == 1 and by_name[0]["name"] == "Zöld Ház"

    by_client = client.get("/api/search?q=Erika", headers=admin_headers).json()
    assert len(by_client) == 1 and by_client[0]["name"] == "Kék Villa"

    by_settlement = client.get("/api/search?q=Győr", headers=admin_headers).json()
    assert len(by_settlement) == 1

    by_code = client.get("/api/search?q=KV-1", headers=admin_headers).json()
    assert len(by_code) == 1 and by_code[0]["name"] == "Kék Villa"


def test_search_scoped_to_own_projects_for_project_manager(client, admin_headers):
    create_project(client, admin_headers, name="Shared Match", project_code="SM-1")
    create_user(client, admin_headers, "pmsearch1", "project_manager")
    pm_headers = login(client, "pmsearch1")
    own = create_project(client, pm_headers, name="Shared Match Own", project_code="SM-2")

    resp = client.get("/api/search?q=Shared", headers=pm_headers).json()
    ids = {p["id"] for p in resp}
    assert ids == {own["id"]}


def test_search_no_match_returns_empty_list(client, admin_headers):
    create_project(client, admin_headers)
    resp = client.get("/api/search?q=zzz_no_match_zzz", headers=admin_headers)
    assert resp.status_code == 200
    assert resp.json() == []
