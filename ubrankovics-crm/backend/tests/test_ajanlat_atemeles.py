def _h(client, admin_headers):
    return admin_headers


def test_atemeles(client, admin_headers):
    p = client.post("/api/projektek", json={"projekt_nev": "Átemelés teszt"}, headers=admin_headers).json()
    mn = client.get("/api/munkanemek", headers=admin_headers).json()[0]
    a = client.post(
        f"/api/projektek/{p['id']}/ajanlatok",
        json={"cim": "Fürdő", "sorok": [{"megnevezes": "Csempe", "mennyiseg": 10, "egyseg": "m2", "egysegar": 5000}]},
        headers=admin_headers,
    ).json()
    v = a["verziok"][0]
    body = {"sorok": [{"sor_id": v["sorok"][0]["id"], "munkanem_id": mn["id"]}]}
    r = client.post(f"/api/ajanlat-verziok/{v['id']}/atemeles", json=body, headers=admin_headers)
    assert r.status_code == 200, r.text
    assert r.json() == {"uj_tetelek": 1, "uj_igenyek": 1, "kihagyva": 0}
    r2 = client.post(f"/api/ajanlat-verziok/{v['id']}/atemeles", json=body, headers=admin_headers).json()
    assert r2 == {"uj_tetelek": 0, "uj_igenyek": 0, "kihagyva": 1}
    t = client.get(f"/api/projektek/{p['id']}/tetelek", headers=admin_headers).json()
    rend = [x for x in t if x["munkanem_id"] == mn["id"]][0]["rendelesek"][0]
    assert float(rend["ugyfel_netto"]) == 50000.0


def test_szerzodes_osszkep(client, admin_headers):
    p = client.post("/api/projektek", json={"projekt_nev": "Összkép"}, headers=admin_headers).json()
    mk = lambda cim, cr, ar: client.post(
        f"/api/projektek/{p['id']}/ajanlatok",
        json={"cim": cim, "cr_azonosito": cr, "sorok": [{"megnevezes": "x", "mennyiseg": 1, "egysegar": ar}]},
        headers=admin_headers,
    ).json()
    alap = mk("Alap", None, 1000)
    cr1 = mk("Terasz", "CR-1", 200)
    mk("Világítás", "CR-2", 50)
    for a in (alap, cr1):
        client.patch(f"/api/ajanlat-verziok/{a['verziok'][0]['id']}/allapot", json={"allapot": "elfogadva"}, headers=admin_headers)
    o = client.get(f"/api/projektek/{p['id']}/szerzodes-osszkep", headers=admin_headers).json()
    assert float(o["alap_netto"]) == 1000 and float(o["cr_elfogadott_netto"]) == 200
    assert float(o["cr_fuggo_netto"]) == 50 and float(o["teljes_netto"]) == 1200
    assert [c["cr_azonosito"] for c in o["crk"]] == ["CR-1", "CR-2"]
