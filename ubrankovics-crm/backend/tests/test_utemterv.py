def test_utemterv_lista(client, admin_headers):
    r = client.get("/api/utemterv", headers=admin_headers)
    assert r.status_code == 200 and isinstance(r.json(), list)


def test_projekt_penzmozgasok(client, admin_headers):
    p = client.post("/api/projektek", json={"projekt_nev": "Pénz teszt"}, headers=admin_headers).json()
    r = client.get(f"/api/projektek/{p['id']}/penzmozgasok?irany=bevetel", headers=admin_headers)
    assert r.status_code == 200 and r.json() == []
    assert client.get("/api/projektek/999999/penzmozgasok", headers=admin_headers).status_code == 404
