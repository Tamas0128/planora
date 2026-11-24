from pathlib import Path

import openpyxl
import pytest

ALAP = Path(__file__).parent / "fixtures" / "Ubrankovics_projekt_alap.xlsx"


def _fajl(tmp_path):
    wb = openpyxl.load_workbook(ALAP)
    p = wb["Projekt"]
    p["B3"], p["B5"], p["B6"], p["B7"], p["B8"] = "Teszt Ház", "Kádár Viktor", "+36 30 111", "k@example.com", "Csabdi"
    p["B12"] = 1000000
    t = wb["Tételek"]
    # 2. sor: Alapozás: alap, szerződve, kész
    t["C2"], t["E2"], t["L2"], t["O2"] = "Alap", "Ubrankovics", "igen", "igen"
    t["A3"], t["C3"], t["E3"], t["F3"], t["H3"], t["I3"] = "Egyedi Kapu", "Ajánlati", "Gyártó", "Hörmann", "igen", "folyamatban"
    t["A4"], t["C4"], t["D4"], t["T4"] = "Eclisse tolóajtó", "Pótmunka", "CR-1", 250000
    c = wb["Pótmunkák (CR)"]
    c["B2"], c["E2"], c["G2"] = "Teraszburkolat", "Elfogadva", 400000
    out = tmp_path / "t.xlsx"
    wb.save(out)
    return out


def test_import_elonezet_es_mentes(client, admin_headers, tmp_path):
    f = _fajl(tmp_path)
    def post(dry):
        return client.post(f"/api/projektek-import/excel?dry_run={'true' if dry else 'false'}", files={"file": ("a.xlsx", f.read_bytes())}, headers=admin_headers)
    r = post(True)
    assert r.status_code == 200, r.text
    assert r.json()["statisztika"]["tetelek"] >= 45 and r.json()["projekt_id"] is None
    assert not [p for p in client.get("/api/projektek", headers=admin_headers).json() if p["projekt_nev"] == "Teszt Ház"]
    r = post(False).json()
    pid = r["projekt_id"]
    assert pid
    t = client.get(f"/api/projektek/{pid}/tetelek", headers=admin_headers).json()
    assert len(t) >= 45
    assert any(x["potmunka"] and x["cr_azonosito"] == "CR-1" for x in t)
    o = client.get(f"/api/projektek/{pid}/szerzodes-osszkep", headers=admin_headers).json()
    assert float(o["alap_netto"]) == 1000000 and float(o["cr_elfogadott_netto"]) == 400000


def test_import_rossz_fajl(client, admin_headers):
    r = client.post("/api/projektek-import/excel", files={"file": ("a.xlsx", b"nem excel")}, headers=admin_headers)
    assert r.status_code == 422
