def test_sablon_tetel_idotartam_szerkesztheto(client, admin_headers):
    tipusok = client.get("/api/projekt-tipusok", headers=admin_headers).json()
    assert tipusok
    sablonok = client.get(f"/api/projekt-tipusok/{tipusok[0]['id']}/tetel-sablonok", headers=admin_headers).json()
    assert sablonok
    r = client.patch(f"/api/projekt-tipusok/tetel-sablonok/{sablonok[0]['id']}", json={"duration_days": 9, "prep_days": 2}, headers=admin_headers)
    assert r.status_code == 200 and r.json()["duration_days"] == 9 and r.json()["prep_days"] == 2
    assert client.patch(f"/api/projekt-tipusok/tetel-sablonok/{sablonok[0]['id']}", json={"duration_days": 0}, headers=admin_headers).status_code == 422
