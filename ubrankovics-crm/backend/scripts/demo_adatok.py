"""Valósághű, kitalált demo-adatok az Ubrankovics CRM-hez (bemutatóhoz, képernyőképekhez).

Minden szereplő, cég, cím és elérhetőség KITALÁLT (az e-mail címek `.example` végződésűek).
A törzsadatokat (munkanemek, épülettípus-sablonok, belső munkatársak) a meglévő seed adja; a tételek és
ajánlatsorok neveit a `docs/csaladi_haz_munkatetel_katalogus.xlsx` munkatétel-katalógusból vettük, a
szerződés- és TIG-dokumentumok a `docs/szerz-tig` mappa mintáiból kerülnek fel a projektekhez.

Használat (a backend konténerben, a takarítás után):
    PYTHONPATH=/app python scripts/demo_adatok.py [--api http://127.0.0.1:8000/api] [--docs /demo-docs]
Idempotens óvatosságból: ha már van projekt, nem fut le (--force kapcsolóval igen).
"""

import argparse
import os
import sys
from datetime import date, timedelta

import httpx

ap = argparse.ArgumentParser()
ap.add_argument("--api", default="http://127.0.0.1:8000/api")
ap.add_argument("--docs", default="/demo-docs")
ap.add_argument("--user", default="admin")
ap.add_argument("--password", default=os.environ.get("ADMIN_PASSWORD") or "admin123")
ap.add_argument("--force", action="store_true")
args = ap.parse_args()

TODAY = date(2026, 11, 23)


def d(delta_days: int) -> str:
    return (TODAY + timedelta(days=delta_days)).isoformat()


client = httpx.Client(base_url=args.api, timeout=30)
r = client.post("/auth/login/json", json={"username": args.user, "password": args.password})
r.raise_for_status()
client.headers["Authorization"] = f"Bearer {r.json()['access_token']}"
ME = client.get("/auth/me").json()


def call(method: str, path: str, ok=(200, 201, 204), **kw):
    resp = client.request(method, path, **kw)
    if resp.status_code not in ok:
        print(f"HIBA {method} {path}: {resp.status_code} {resp.text[:300]}", file=sys.stderr)
        raise SystemExit(1)
    return resp.json() if resp.content else None


def post(path, body=None, **kw):
    return call("POST", path, json=body, **kw)


def patch(path, body):
    return call("PATCH", path, json=body)


if call("GET", "/projektek") and not args.force:
    print("Már vannak projektek — kihagyva (használd a --force kapcsolót).")
    raise SystemExit(0)

# ---------------------------------------------------------------- törzsadatok lekérdezése
munkanem = {m["kod"]: m["id"] for m in call("GET", "/munkanemek")}
szemely = {s["nev"]: s["id"] for s in call("GET", "/szemelyek")}
tipusok = {t["nev"]: t["id"] for t in call("GET", "/projekt-tipusok")}
KESZHAZ = tipusok["Könnyűszerkezetes, üzemben szerelt készház"]
GERENDAHAZ = tipusok["Boronafalas gerendaház"]

# ---------------------------------------------------------------- alvállalkozók (kitalált)
ALV = {}
for nev, kapcsolat in [
    ("Mecsek-Tető Zrt.", "Dr. Árpád Gyula vezérigazgató · +36 72 555 0142 · iroda@mecsektetozrt.example · 7621 Pécs, Szabadság u. 31. · adószám: 24817530-2-02"),
    ("Pannon-Villany Kft.", "Sebők Roland ügyvezető · +36 30 288 4410 · sebok.roland@pannonvillany.example · 8200 Veszprém, Kossuth L. u. 12."),
    ("Dráva Gépészet Bt.", "Hegedűs Tibor beltag · +36 20 913 7725 · hegedus@dravagepeszet.example · 7400 Kaposvár, Fő u. 54."),
    ("Zala-Beton Kft.", "Orbán Katalin ügyvezető · +36 92 311 908 · orban.katalin@zalabeton.example · 8900 Zalaegerszeg, Ipar u. 3."),
    ("Bakony Faipari Kft.", "Lengyel Dénes műszaki vezető · +36 88 450 216 · lengyel.denes@bakonyfa.example · 8420 Zirc, Rákóczi tér 6."),
    ("Balaton Nyílászáró Kft.", "Kövesdi Ágnes értékesítési vezető · +36 87 540 332 · kovesdi.agnes@balatonnyilaszaro.example · 8230 Balatonfüred, Zsigmond u. 9."),
]:
    ALV[nev] = post("/alvallalkozok", {"nev": nev, "kapcsolat": kapcsolat})["id"]
TETO = ALV["Mecsek-Tető Zrt."]

# ---------------------------------------------------------------- ügyfelek
def ugyfel(nev, tel, mail):
    return post("/ugyfelek", {"nev": nev, "telefon": tel, "email": mail})["id"]


U_KOVACS = ugyfel("Kovács Péter és Neményi Dóra", "+36 30 412 7788", "kovacs.dora@kovacscsalad.example")
U_BALOGH = ugyfel("Balogh Tamás és Balogh Eszter", "+36 70 335 1920", "balogh.tamas@balogh-otthon.example")
U_HORVATH = ugyfel("Horváth Éva", "+36 20 744 0613", "horvath.eva@szegedimail.example")
U_DUNAKANYAR = ugyfel("Dunakanyar Pihenő Kft.", "+36 26 398 450", "szilagyi.marta@dunakanyarpiheno.example")
U_TOTH = ugyfel("Tóth Gábor", "+36 30 559 2147", "toth.gabor@zalamail.example")

# ---------------------------------------------------------------- projektek
def projekt(nev, ugyfel_id, cim, allapot, tipus, delivery, lat, lon, hrsz, szerepek, utemezes=True):
    p = post(
        "/projektek",
        {
            "projekt_nev": nev,
            "hrsz": hrsz,
            "allapot": allapot,
            "delivery_date": delivery,
            "projekt_tipus_id": tipus,
            "utemezes_aktiv": utemezes and tipus is not None,
            "ugyfelek": [{"ugyfel_id": ugyfel_id, "epitesi_cim": cim, "szerep": "megrendelő"}],
        },
    )
    patch(f"/projektek/{p['id']}", {"latitude": lat, "longitude": lon})
    for nev_, szerep in szerepek:
        post(f"/projektek/{p['id']}/szerepek", {"szemely_id": szemely[nev_], "szerep": szerep})
    return p["id"]


P_KOVACS = projekt("Kovács–Neményi boronafalas gerendaház, Pécs", U_KOVACS, "7634 Pécs, Hajnal utca 14.", "kivitelezes",
                   GERENDAHAZ, d(125), 46.0925, 18.2018, "Pécs 10234/7",
                   [("Novák Péter", "epitesvezeto"), ("Varga Erzsébet", "projektfelelos")])
P_BALOGH = projekt("Balogh készház, Balatonfüred", U_BALOGH, "8230 Balatonfüred, Kisfaludy utca 27.", "szerzodott",
                   KESZHAZ, d(220), 46.9588, 17.8890, "Balatonfüred 3381/2",
                   [("Bori István", "epitesvezeto"), ("Varga Erzsébet", "projektfelelos")])
P_HORVATH = projekt("Horváth tetőcsere és tetőtér-beépítés, Szeged", U_HORVATH, "6722 Szeged, Tisza Lajos körút 61.", "ajanlat",
                    None, d(150), 46.2530, 20.1480, "Szeged 1845/3", [("Jelencsics Áron", "projektfelelos")], utemezes=False)
P_DUNA = projekt("Dunakanyar Wellness vendégház-együttes, Visegrád", U_DUNAKANYAR, "2025 Visegrád, Fő utca 83.", "kivitelezes",
                 GERENDAHAZ, d(170), 47.7845, 18.9710, "Visegrád 412/1",
                 [("Nemes Péter", "epitesvezeto"), ("Ubrankovics Márton", "projektfelelos")])
P_TOTH = projekt("Tóth kerti faház és szauna, Zalaegerszeg", U_TOTH, "8900 Zalaegerszeg, Kaszaháza út 9.", "lezart",
                 KESZHAZ, d(-30), 46.8417, 16.8416, "Zalaegerszeg 7021/5",
                 [("Hajós Márió", "epitesvezeto"), ("Varga Erzsébet", "projektfelelos")], utemezes=False)

# ---------------------------------------------------------------- tételek
TETEL_PROJEKT = {}


def tetel(projekt_id, kod, info, szakasz, vallalas=None, alv=None, potmunka=None, duration=None, tig=None, kijelolt=None, szerep="epitesvezeto"):
    body = {
        "munkanem_id": munkanem[kod],
        "info": info,
        "szakasz": szakasz,
        "potmunka": potmunka is not None,
        "potmunka_osszeg": potmunka,
        "tig": tig,
        "duration_days": duration,
        "felelos_szerep": szerep,
    }
    if kijelolt:
        body["kijelolt_id"] = szemely[kijelolt]
    if vallalas:
        body["vallalasok"] = [{"tipus": vallalas, "alvallalkozo_id": alv}]
    tid = post(f"/projektek/{projekt_id}/tetelek", body)["id"]
    TETEL_PROJEKT[tid] = projekt_id
    return tid


def tp(tetel_id):
    return f"/projektek/{TETEL_PROJEKT[tetel_id]}/tetelek/{tetel_id}"


def spec(tetel_id, kulcs, ertek, csoport=None, me=None):
    post(f"{tp(tetel_id)}/specifikaciok", {"csoport": csoport, "kulcs": kulcs, "ertek": ertek, "mertekegyseg": me})


def esemeny(tetel_id, tipus, allapot, nap, megjegyzes=None):
    post(f"{tp(tetel_id)}/esemenyek", {"tipus": tipus, "allapot": allapot, "datum": d(nap), "megjegyzes": megjegyzes})


# P_KOVACS – gerendaház, épül
t1 = tetel(P_KOVACS, "ALAP-VIZSZIG", "Sávalap C25/30, vízszigetelés kétrétegű bitumenes lemezzel", "kesz", "alvallalkozo", ALV["Zala-Beton Kft."], duration=9)
spec(t1, "Betonminőség", "C25/30", "Alapozás"); spec(t1, "Alap mélysége", "90", "Alapozás", "cm")
esemeny(t1, "szerzodes", "kesz", -70); esemeny(t1, "munka_kesz", "kesz", -48, "Átvéve, geodéziai bemérés rendben")
t2 = tetel(P_KOVACS, "SZERKEPITES", "Boronafal 20 cm, 8×8 m alapterület, nútféderes bekötésekkel", "kivitelezes", "sajat", duration=21, kijelolt="Novák Péter")
spec(t2, "Falvastagság", "20", "Szerkezet", "cm"); spec(t2, "Fafaj", "Lucfenyő, kamrai szárított", "Szerkezet")
esemeny(t2, "anyag_megrendelve", "kesz", -52); esemeny(t2, "anyag_megerkezett", "kesz", -35); esemeny(t2, "munka_kesz", "folyamatban", -3)
t3 = tetel(P_KOVACS, "RACSOS-TETO", "Fogópáros fedélszék, 38° tetőhajlás, 190 m² tetősík", "kivitelezes", "alvallalkozo", TETO, duration=8, tig="TIG-1 elfogadva")
esemeny(t3, "szerzodes", "kesz", -30); esemeny(t3, "munka_kesz", "nyitott", 6)
t4 = tetel(P_KOVACS, "CSEREPEZES", "Antracit betoncserép, hófogóval", "szerzodes", "alvallalkozo", TETO, duration=6, potmunka=420000)
t5 = tetel(P_KOVACS, "KULTERI-NYZ", "3 rétegű üvegezésű fa-alu nyílászárók, 9 db", "beszerzes", "alvallalkozo", ALV["Balaton Nyílászáró Kft."], duration=3)
spec(t5, "Üvegezés Ug", "0,5", "Nyílászáró", "W/m²K")
t6 = tetel(P_KOVACS, "VILLANYSZERELES", "Teljes villanyhálózat, 3 fázis, okosotthon-előkészítés", "ajanlat", "alvallalkozo", ALV["Pannon-Villany Kft."], duration=7)
t7 = tetel(P_KOVACS, "BELSO-FABURKOLAT", "Fenyő lambéria a nappaliban és a hálóban", "ajanlat", "alvallalkozo", ALV["Bakony Faipari Kft."], duration=5)
r1 = post(f"{tp(t5)}/rendelesek", {"megnevezes": "Fa-alu ablak 120×140, 3 rétegű", "mennyiseg": 6, "mertekegyseg": "db", "szukseges_datum": d(28), "megjegyzes": "Antracit külső / fehér belső"})
post(f"{tp(t5)}/rendelesek", {"megnevezes": "Erkélyajtó 90×210, 3 rétegű", "mennyiseg": 2, "mertekegyseg": "db", "szukseges_datum": d(28)})
post(f"{tp(t2)}/rendelesek", {"megnevezes": "Boronafal gerenda 20×14, 6 m", "mennyiseg": 280, "mertekegyseg": "db", "szukseges_datum": d(-50)})

# P_BALOGH – készház, szerződött
b1 = tetel(P_BALOGH, "ALAP-VIZSZIG", "Vasbeton lemezalap 12×8 m", "szerzodes", "alvallalkozo", ALV["Zala-Beton Kft."], duration=8)
b2 = tetel(P_BALOGH, "SZERKEPITES", "Üzemben gyártott könnyűszerkezetes falelemek, 25 cm falvastagság", "szerzodes", "sajat", duration=14, kijelolt="Bori István")
spec(b2, "Falvastagság", "25", "Szerkezet", "cm"); spec(b2, "Hőszigetelés", "Kőzetgyapot 15 cm + 5 cm homlokzati", "Szerkezet")
b3 = tetel(P_BALOGH, "RACSOS-TETO", "Rácsos tetőszerkezet, 25° hajlás", "szerzodes", "alvallalkozo", TETO, duration=5)
b4 = tetel(P_BALOGH, "VIZSZERELES", "Víz- és csatorna alapvezetékek, 2 fürdő", "ajanlat", "alvallalkozo", ALV["Dráva Gépészet Bt."])
b5 = tetel(P_BALOGH, "FUTES-HUTES", "Levegő-víz hőszivattyú, padlófűtés", "ajanlat", "alvallalkozo", ALV["Dráva Gépészet Bt."])
esemeny(b2, "ajanlat_ugyfelnek", "kesz", -62); esemeny(b2, "ajanlat_alairva", "kesz", -41); esemeny(b2, "szerzodes", "kesz", -34)
esemeny(b3, "ajanlatkeres", "kesz", -55); esemeny(b3, "ajanlat_beerkezett", "kesz", -48)

# P_HORVATH – ajánlati fázis
h1 = tetel(P_HORVATH, "BADOGOZAS", "Teljes tetőbádogozás, lemez ereszcsatorna, 42 fm", "ajanlat", "alvallalkozo", TETO)
h2 = tetel(P_HORVATH, "CSEREPEZES", "Bontás és új cserépfedés, 140 m²", "ajanlat", "alvallalkozo", TETO)
h3 = tetel(P_HORVATH, "TETOSIK-ABLAK", "4 db tetősík ablak, 78×140", "ajanlat", "alvallalkozo", ALV["Balaton Nyílászáró Kft."])
h4 = tetel(P_HORVATH, "GIPSZKARTON", "Tetőtéri gipszkarton burkolás, 85 m²", "ajanlat", "sajat")
esemeny(h2, "ajanlatkeres", "kesz", -9); esemeny(h2, "ajanlat_beerkezett", "folyamatban", -2)

# P_DUNA – nagy projekt
du1 = tetel(P_DUNA, "ALAP-VIZSZIG", "6 db vendégház-alap, közös szennyvíz- és vízvezeték", "kesz", "alvallalkozo", ALV["Zala-Beton Kft."], duration=18)
du2 = tetel(P_DUNA, "SZERKEPITES", "6 db boronafalas vendégház (á 48 m²), 24 cm faltest", "kivitelezes", "sajat", duration=60, kijelolt="Nemes Péter")
spec(du2, "Falvastagság", "24", "Szerkezet", "cm")
du3 = tetel(P_DUNA, "RACSOS-TETO", "6 db nyeregtető, rejtett ereszcsatornával", "kivitelezes", "alvallalkozo", TETO, duration=24, tig="TIG-1 elfogadva, TIG-2 folyamatban")
du4 = tetel(P_DUNA, "CSEREPEZES", "Cseréppel fedett tetők, 6 × 62 m²", "szerzodes", "alvallalkozo", TETO, duration=18, potmunka=1850000)
du5 = tetel(P_DUNA, "VILLANYSZERELES", "Vendégházak és közös terek villamos hálózata", "szerzodes", "alvallalkozo", ALV["Pannon-Villany Kft."], duration=20)
du6 = tetel(P_DUNA, "FUTES-HUTES", "Padlófűtés és hőszivattyúk, 6 egység", "beszerzes", "alvallalkozo", ALV["Dráva Gépészet Bt."], duration=22)
du7 = tetel(P_DUNA, "TERASZ-SZERK", "6 db fedett terasz, 14 m² / ház", "szerzodes", "sajat", duration=12)
du8 = tetel(P_DUNA, "BELSO-LEPCSO", "Galéria-lépcsők, tölgy, 6 db", "ajanlat", "alvallalkozo", ALV["Bakony Faipari Kft."])
for t_, tip, al, nap in [(du1, "munka_kesz", "kesz", -95), (du2, "anyag_megerkezett", "kesz", -60), (du3, "szerzodes", "kesz", -48)]:
    esemeny(t_, tip, al, nap)
post(f"{tp(du6)}/rendelesek", {"megnevezes": "Levegő-víz hőszivattyú 12 kW", "mennyiseg": 6, "mertekegyseg": "db", "szukseges_datum": d(40)})
post(f"{tp(du2)}/rendelesek", {"megnevezes": "Boronafal gerenda 24×14, 6 m", "mennyiseg": 1450, "mertekegyseg": "db", "szukseges_datum": d(-75)})

# P_TOTH – lezárt
to1 = tetel(P_TOTH, "SZERKEPITES", "Kerti faház 6×4 m, 12 cm falvastagság", "kesz", "sajat", duration=6)
to2 = tetel(P_TOTH, "CSEREPEZES", "Gyalult fenyő deszkaburkolat és bitumenes zsindely", "kesz", "alvallalkozo", TETO, duration=2)
to3 = tetel(P_TOTH, "KANDALLO", "Finn szauna kályha és szerelt kémény", "kesz", "alvallalkozo", ALV["Dráva Gépészet Bt."], duration=2)
for t_ in (to1, to2, to3):
    esemeny(t_, "munka_kesz", "kesz", -40)

# ---------------------------------------------------------------- készültség: a sablonból jött tételek haladása
def halad(projekt_id, arany):
    sajat = [t for t in call("GET", f"/projektek/{projekt_id}/tetelek") if t["id"] not in TETEL_PROJEKT and t.get("duration_days")]
    sajat.sort(key=lambda t: (t.get("sorrend") or 0, t["id"]))
    n = round(len(sajat) * arany)
    for t in sajat[:n]:
        patch(f"/projektek/{projekt_id}/tetelek/{t['id']}", {"szakasz": "kesz"})
    for t in sajat[n:n + max(1, len(sajat) // 8)]:
        patch(f"/projektek/{projekt_id}/tetelek/{t['id']}", {"szakasz": "kivitelezes"})


halad(P_KOVACS, 0.38)
halad(P_DUNA, 0.55)

# ---------------------------------------------------------------- szerződések, számlák, TIG
def szerzodes(projekt_id, ugyfel_id, szam, osszeg, kezd, vege, reszletek):
    sz = post(f"/projektek/{projekt_id}/szerzodesek", {
        "ugyfel_id": ugyfel_id, "szerzodesszam": szam, "osszeg": osszeg, "afa_tipus": "afa_27",
        "kezdes": kezd, "befejezes": vege, "megjegyzes": "Vállalkozási szerződés az Ubrankovics Kft. általános feltételei szerint.",
        "reszletek": [{"megnevezes": n, "osszeg": o, "esedekesseg": e} for n, o, e in reszletek]})
    patch(f"/projektek/{projekt_id}/szerzodesek/{sz['id']}", {"allapot": "aktiv"})
    return sz


def szamla_reszletbol(projekt_id, sz, idx, szam, kiall, fizet=None):
    resz = sz["reszletek"][idx]
    szl = post(f"/projektek/{projekt_id}/szerzodesek/{sz['id']}/reszletek/{resz['id']}/szamla-kiallitas",
               {"szamlaszam": szam, "kiallitas_datum": kiall, "teljesites_datum": kiall, "esedekesseg": (date.fromisoformat(kiall) + timedelta(days=8)).isoformat()})
    if fizet:
        patch(f"/projektek/{projekt_id}/ugyfel-szamlak/{szl['id']}", {"allapot": "kifizetve", "fizetes_datum": fizet})
    return szl


SZ_KOVACS = szerzodes(P_KOVACS, U_KOVACS, "UBR-2026/014", 38_500_000, d(-90), d(125), [
    ("1. részlet – előleg (30%)", 11_550_000, d(-85)), ("2. részlet – alapok és falazat (30%)", 11_550_000, d(-40)),
    ("3. részlet – tetőszerkezet (25%)", 9_625_000, d(12)), ("4. részlet – átadáskor (15%)", 5_775_000, d(125))])
szamla_reszletbol(P_KOVACS, SZ_KOVACS, 0, "UBR-2026-0148", d(-85), d(-80))
szamla_reszletbol(P_KOVACS, SZ_KOVACS, 1, "UBR-2026-0171", d(-40), d(-31))
SZ_BALOGH = szerzodes(P_BALOGH, U_BALOGH, "UBR-2026/021", 46_800_000, d(10), d(220), [
    ("1. részlet – előleg (20%)", 9_360_000, d(-30)), ("2. részlet – gyártás indításakor (40%)", 18_720_000, d(45)),
    ("3. részlet – szerelés után (30%)", 14_040_000, d(150)), ("4. részlet – átadáskor (10%)", 4_680_000, d(220))])
szamla_reszletbol(P_BALOGH, SZ_BALOGH, 0, "UBR-2026-0183", d(-30), d(-24))
SZ_DUNA = szerzodes(P_DUNA, U_DUNAKANYAR, "UBR-2026/009", 86_400_000, d(-120), d(170), [
    ("1. részlet – előleg (25%)", 21_600_000, d(-115)), ("2. részlet – alapok (20%)", 17_280_000, d(-70)),
    ("3. részlet – szerkezetek (25%)", 21_600_000, d(-15)), ("4. részlet – tető és gépészet (20%)", 17_280_000, d(60)),
    ("5. részlet – átadáskor (10%)", 8_640_000, d(170))])
szamla_reszletbol(P_DUNA, SZ_DUNA, 0, "UBR-2026-0109", d(-115), d(-108))
szamla_reszletbol(P_DUNA, SZ_DUNA, 1, "UBR-2026-0140", d(-70), d(-61))
szamla_reszletbol(P_DUNA, SZ_DUNA, 2, "UBR-2026-0184", d(-15))      # kiállítva, még nyitott
SZ_TOTH = szerzodes(P_TOTH, U_TOTH, "UBR-2026/005", 7_900_000, d(-110), d(-30), [
    ("1. részlet – előleg", 3_950_000, d(-105)), ("2. részlet – átadáskor", 3_950_000, d(-30))])
szamla_reszletbol(P_TOTH, SZ_TOTH, 0, "UBR-2026-0094", d(-105), d(-99))
szamla_reszletbol(P_TOTH, SZ_TOTH, 1, "UBR-2026-0165", d(-30), d(-22))
patch(f"/projektek/{P_TOTH}/szerzodesek/{SZ_TOTH['id']}", {"allapot": "teljesitett"})


def tig_es_szamla(projekt_id, alv, tig_datum, kezd, veg, netto, szamlaszam, esedekes, kifizetve=None):
    tg = post(f"/projektek/{projekt_id}/tig", {
        "alvallalkozo_id": alv, "datum": tig_datum, "idoszak_kezdet": kezd, "idoszak_veg": veg,
        "netto": netto, "afa_tipus": "afa_27", "megjegyzes": "Teljesítésigazolás a szerződés szerinti készültség alapján."})
    patch(f"/projektek/{projekt_id}/tig/{tg['id']}", {"allapot": "jovahagyva"})
    sz = post(f"/projektek/{projekt_id}/alvallalkozoi-szamlak", {
        "alvallalkozo_id": alv, "tig_id": tg["id"], "szamlaszam": szamlaszam, "teljesites_datum": veg,
        "kiallitas_datum": tig_datum, "esedekesseg": esedekes, "netto": netto, "afa_tipus": "afa_27"})
    if kifizetve:
        patch(f"/projektek/{projekt_id}/alvallalkozoi-szamlak/{sz['id']}", {"allapot": "kifizetve", "fizetes_datum": kifizetve})
    return tg


tig_es_szamla(P_KOVACS, ALV["Zala-Beton Kft."], d(-45), d(-70), d(-48), 3_200_000, "ZB-2026/0311", d(-15), d(-14))
tig_es_szamla(P_KOVACS, TETO, d(-4), d(-30), d(-5), 4_100_000, "MT-2026/1187", d(26))
tig_es_szamla(P_DUNA, ALV["Zala-Beton Kft."], d(-90), d(-118), d(-95), 9_400_000, "ZB-2026/0268", d(-60), d(-58))
tig_es_szamla(P_DUNA, TETO, d(-20), d(-48), d(-22), 12_650_000, "MT-2026/1102", d(10))
tig_es_szamla(P_DUNA, TETO, d(-2), d(-21), d(-3), 6_300_000, "MT-2026/1196", d(28))
tig_es_szamla(P_TOTH, TETO, d(-45), d(-50), d(-44), 640_000, "MT-2026/0988", d(-30), d(-29))
tig_es_szamla(P_TOTH, ALV["Dráva Gépészet Bt."], d(-42), d(-45), d(-41), 380_000, "DG-2026/0057", d(-28), d(-27))

# ---------------------------------------------------------------- vevői ajánlatok (katalógus-tételnevekkel)
a = post(f"/projektek/{P_HORVATH}/ajanlatok", {
    "cim": "Tetőcsere és tetőtér-beépítés – ajánlat", "ervenyes_ig": d(20),
    "megjegyzes": "Az árak nettó értékek. A tetőszerkezet felmérése után pontosítjuk.",
    "sorok": [
        {"megnevezes": "Meglévő tetőfedés és lécezés bontása", "mennyiseg": 140, "egyseg": "m²", "egysegar": 2900},
        {"megnevezes": "Fólia és ellenléc, tetőléc rögzítése", "mennyiseg": 140, "egyseg": "m²", "egysegar": 3400},
        {"megnevezes": "Betoncserép fedés, gerinc- és élcserép", "mennyiseg": 140, "egyseg": "m²", "egysegar": 11800},
        {"megnevezes": "Tetősík ablak beépítése bádogkötéssel", "mennyiseg": 4, "egyseg": "db", "egysegar": 168000},
        {"megnevezes": "Ereszcsatorna és lefolyó (lemez)", "mennyiseg": 42, "egyseg": "fm", "egysegar": 7400},
        {"megnevezes": "Tetőtéri gipszkarton burkolat, hőszigeteléssel", "mennyiseg": 85, "egyseg": "m²", "egysegar": 9600},
    ]})
post(f"/ajanlatok/{a['id']}/verziok", {
    "ervenyes_ig": d(30), "megjegyzes": "2. verzió: 5 cm-rel vastagabb tetőtéri szigetelés, ereszcsatorna cink-titán lemezből.",
    "sorok": [
        {"megnevezes": "Meglévő tetőfedés és lécezés bontása", "mennyiseg": 140, "egyseg": "m²", "egysegar": 2900},
        {"megnevezes": "Fólia és ellenléc, tetőléc rögzítése", "mennyiseg": 140, "egyseg": "m²", "egysegar": 3400},
        {"megnevezes": "Betoncserép fedés, gerinc- és élcserép", "mennyiseg": 140, "egyseg": "m²", "egysegar": 11800},
        {"megnevezes": "Tetősík ablak beépítése bádogkötéssel", "mennyiseg": 4, "egyseg": "db", "egysegar": 168000},
        {"megnevezes": "Ereszcsatorna és lefolyó (cink-titán)", "mennyiseg": 42, "egyseg": "fm", "egysegar": 9800},
        {"megnevezes": "Tetőtéri gipszkarton burkolat, 20 cm hőszigeteléssel", "mennyiseg": 85, "egyseg": "m²", "egysegar": 11400},
    ]})
a2 = post(f"/projektek/{P_BALOGH}/ajanlatok", {
    "cim": "Balogh készház – ajánlat", "ervenyes_ig": d(-20), "megjegyzes": "Aláírt, a szerződés alapja.",
    "sorok": [
        {"megnevezes": "Lemezalap kialakítása, vízszigeteléssel", "mennyiseg": 96, "egyseg": "m²", "egysegar": 38500},
        {"megnevezes": "Könnyűszerkezetes falelemek gyártása és szerelése", "mennyiseg": 168, "egyseg": "m²", "egysegar": 92000},
        {"megnevezes": "Rácsos tetőszerkezet és fedés", "mennyiseg": 118, "egyseg": "m²", "egysegar": 41500},
        {"megnevezes": "Gépészet és villamos hálózat", "mennyiseg": 1, "egyseg": "tétel", "egysegar": 9_850_000},
    ]})
patch(f"/ajanlat-verziok/{a2['verziok'][-1]['id']}/allapot", {"allapot": "elfogadva"})

# ---------------------------------------------------------------- építési napló
naplo = [
    (P_KOVACS, -6, "napos, 8 °C", 7, "Külső boronafal 3. sor, nyílászáró-kiváltók beépítése.", None),
    (P_KOVACS, -5, "felhős, 6 °C", 7, "Falszerkezet 4. sor, sarokbekötések. Gerenda-szállítmány hiánytalanul megérkezett.", None),
    (P_KOVACS, -4, "szitáló eső, 5 °C", 4, "Esős idő miatt rövidített műszak: födémgerendák előkészítése fedett helyen.", "Betakarás megtörtént."),
    (P_KOVACS, -3, "napos, 9 °C", 8, "Födémgerendák beemelése darúval, koszorú szerelése.", "Mecsek-Tető Zrt. szakembere helyszíni bejárást tartott."),
    (P_DUNA, -9, "napos, 7 °C", 14, "3. és 4. vendégház tetőszerkezet ácsolása.", None),
    (P_DUNA, -8, "szeles, 6 °C", 9, "Szél miatt a daruzás szünetelt, belső előkészítés zajlott.", "Daruzás szünetelt 11 órától."),
    (P_DUNA, -7, "napos, 8 °C", 14, "5. ház tetőszerkezet, 1–2. ház léc és fólia.", None),
    (P_DUNA, -2, "felhős, 4 °C", 12, "Mecsek-Tető Zrt. TIG-2 ellenőrző felmérés, 3. ház cserépfedés indul.", "Felmérési jegyzőkönyv a mappában."),
]
for pid, nap, ido, fo, munka, megj in naplo:
    post(f"/projektek/{pid}/naplo", {"datum": d(nap), "idojaras": ido, "letszam": fo, "munka": munka, "megjegyzes": megj})

# ---------------------------------------------------------------- átadás, garancia (lezárt projekt)
at = post(f"/projektek/{P_TOTH}/atvetelek", {
    "datum": d(-30), "atado_nev": "Hajós Márió", "atvevo_nev": "Tóth Gábor", "garancia_honap": 36,
    "hibak": "A szauna ajtó alsó élének beállítása kis hézag miatt javítandó.", "megjegyzes": "Kulcsok és üzemeltetési útmutató átadva."})
post(f"/atvetelek/{at['id']}/alairas", {})
post(f"/projektek/{P_TOTH}/garancia-hiba", {"targy": "Szauna ajtó záródása", "leiras": "Az ajtó alsó éle súrolja a küszöböt, nem csukódik rendesen."})

# ---------------------------------------------------------------- érdeklődők és interakciók
def erd(nev, tel, mail, forras, allapot, ertek, megj, lezaras):
    return post("/erdeklodok", {"nev": nev, "telefon": tel, "email": mail, "forras": forras, "allapot": allapot,
                                "becsult_ertek": ertek, "megjegyzes": megj, "varhato_lezaras": lezaras})["id"]


E1 = erd("Fehér Zoltán", "+36 30 771 2285", "feher.zoltan@sopronimail.example", "Weboldal", "targyalas", 32_000_000,
         "Soproni telken 100 m²-es boronafalas ház, tervekkel rendelkezik.", d(35))
E2 = erd("Mészáros Építő Kft.", "+36 1 477 3012", "info@meszarosepito.example", "Ajánlás", "ajanlat", 18_500_000,
         "Irodai faház 60 m², telephelyükre.", d(21))
E3 = erd("Molnár Ildikó", "+36 20 618 9034", "molnar.ildiko@kaposmail.example", "Kiállítás", "kapcsolatfelvetel", 6_400_000,
         "Garázs és előtető, még tájékozódik.", d(60))
E4 = erd("Gulyás Bence", "+36 70 442 6150", "gulyas.bence@debrecenimail.example", "Közösségi média", "uj", 12_000_000,
         "Panelcseréhez hasonló áron készházat nézne, Debrecen.", d(90))

KOMM = [
    # (ugyfel, erdeklodes, tipus, tartalom, nap)
    (U_KOVACS, None, "talalkozo", "Helyszíni bejárás a telken: tájolás, bejárat, szomszédos épületek egyeztetve. Megrendelő a boronafalat választotta.", -140),
    (U_KOVACS, None, "email", "Elküldtük a második ajánlatverziót a tetőtér-beépítéssel; a megrendelő a 38,5 millió Ft-os változatot fogadta el.", -100),
    (U_KOVACS, None, "hivas", "Dóra érdeklődött a falszerkezet ütemezéséről és a nyílászárók színéről (antracit).", -22),
    (U_KOVACS, None, "megjegyzes", "Pótmunka igény: a cserepek mellé hófogó és kéményseprő-járda. Ajánlat a következő bejáráskor.", -8),
    (U_BALOGH, None, "talalkozo", "Gyártóüzemi látogatás Balatonfüreden kívül, megnézték a falelemeket és a hőszivattyús minta-házat.", -85),
    (U_BALOGH, None, "email", "A szerződéstervezetet és az aláírandó ajánlatot elküldtük; aláírás visszaérkezett.", -41),
    (U_BALOGH, None, "hivas", "Eszter a konyhabútor-előkészítésről kérdezett (gépészeti pontok). Átadtuk a gépészeti terveket.", -12),
    (U_HORVATH, None, "hivas", "Telefonos érdeklődés tetőcserére; helyszíni felmérést egyeztettünk szerdára.", -14),
    (U_HORVATH, None, "talalkozo", "Felmérés a helyszínen, a tetőszerkezet jó állapotú, a szarufák megtarthatók.", -10),
    (U_HORVATH, None, "email", "Elküldtük az 1. ajánlatverziót; kérésére 2. verzió vastagabb szigeteléssel.", -3),
    (U_DUNAKANYAR, None, "talalkozo", "Projektindító megbeszélés Szilágyi Mártával és a gyártási partnerekkel; szállásadói engedély határidők egyeztetve.", -130),
    (U_DUNAKANYAR, None, "email", "Heti állapotjelentés a vendégházak készültségéről és az 5. részszámláról.", -9),
    (U_DUNAKANYAR, None, "hivas", "Márta a TIG-2 jóváhagyási menetéről érdeklődött; jóváhagyás a hétvégéig.", -2),
    (U_TOTH, None, "email", "Átadás-átvételi jegyzőkönyv és garanciajegy elküldve; a megrendelő elégedett.", -29),
    (U_TOTH, None, "hivas", "Szauna ajtó záródás miatti garanciális bejelentés rögzítve.", -5),
    (None, E1, "hivas", "Első hívás: 100 m²-es ház, tervekkel rendelkezik, Sopron mellett.", -12),
    (None, E1, "email", "Elküldtük a boronafalas és könnyűszerkezetes referencia-lapokat.", -9),
    (None, E1, "talalkozo", "Egyeztetés a telken; becsült nettó érték 32 millió Ft.", -4),
    (None, E2, "email", "Ajánlat az irodai faházra elküldve; döntés a mérnöki jóváhagyás után.", -6),
    (None, E3, "megjegyzes", "A kiállításon járt, katalógust vitt, két héten belül visszahívjuk.", -15),
]
for ugy, erd_id, tip, szoveg, nap in KOMM:
    post("/kommunikacio", {"ugyfel_id": ugy, "erdeklodes_id": erd_id, "tipus": tip, "tartalom": szoveg, "datum": f"{d(nap)}T10:30:00"})

# ---------------------------------------------------------------- feladatok
for cim, leiras, nap, pid in [
    ("Gerenda-szállítmány átvétele – Kovács ház", "Hiánytalan átvétel, fotók a naplóba.", 2, P_KOVACS),
    ("Pótmunka-ajánlat hófogóra és kéményseprő-járdára", "Kovács–Neményi, ajánlat a következő bejárásig.", 5, P_KOVACS),
    ("Nyílászáró-megrendelés véglegesítése", "Balaton Nyílászáró Kft., szín: antracit.", 9, P_KOVACS),
    ("Balogh készház – gyártási terv jóváhagyatása", "A megrendelő aláírása szükséges.", 6, P_BALOGH),
    ("Horváth ajánlat: 2. verzió utánkövetése", "Hívjuk fel az ajánlat lejárta előtt.", 8, P_HORVATH),
    ("Dunakanyar – TIG-2 aláírása és számla", "Mecsek-Tető Zrt. számla jóváhagyása.", 3, P_DUNA),
    ("Hőszivattyúk rendelése – Visegrád", "6 db, szállítási idő 5 hét.", 4, P_DUNA),
    ("Garanciális javítás – szauna ajtó", "Tóth Gábor, Zalaegerszeg, lehetőleg a héten.", 7, P_TOTH),
]:
    post("/feladatok", {"cim": cim, "leiras": leiras, "hatarido": d(nap), "projekt_id": pid, "felelos_id": ME["id"]})

# ---------------------------------------------------------------- dokumentumok az alap mintákból
def feltolt(pid, tipus, fajl, megj):
    path = os.path.join(args.docs, fajl)
    if not os.path.exists(path):
        print("kihagyva (nincs fájl):", path)
        return
    with open(path, "rb") as fh:
        resp = client.post(f"/projektek/{pid}/dokumentumok", data={"tipus": tipus, "megjegyzes": megj}, files={"file": (fajl, fh)})
    if resp.status_code != 201:
        print("Dokumentum hiba:", fajl, resp.status_code, resp.text[:200], file=sys.stderr)


for pid in (P_KOVACS, P_BALOGH, P_DUNA, P_TOTH):
    feltolt(pid, "szerzodes", "Jogaszi_Ugyfel_Epitesi_Szerzodes_HUF.docx", "Vállalkozási szerződés (HUF) – ügyfél")
for pid in (P_KOVACS, P_DUNA):
    feltolt(pid, "szerzodes", "Jogaszi_Alvallalkozoi_Szerzodes_HUF.docx", "Alvállalkozói szerződés (HUF) – Mecsek-Tető Zrt.")
    feltolt(pid, "egyeb", "TIG_papir_alapu.docx", "Teljesítésigazolás – papír alapú minta")
feltolt(P_HORVATH, "egyeb", "csaladi_haz_munkatetel_katalogus.xlsx", "Munkatétel-katalógus – az ajánlat alapja")
feltolt(P_BALOGH, "egyeb", "csaladi_haz_munkatetel_katalogus.xlsx", "Munkatétel-katalógus – költségvetési alap")

# ---------------------------------------------------------------- értékesítési célok
for ho, cel in [("2026-10", 22_000_000), ("2026-11", 26_000_000), ("2026-12", 30_000_000)]:
    call("PUT", "/elorejelzes/cel", json={"honap": ho, "osszeg": cel})

# ---------------------------------------------------------------- pénzügyi alapok
post("/cashflow/bankegyenleg", {"datum": d(-1), "egyenleg": 24_650_000})
for i, (honap, osszeg) in enumerate([(d(7), 2_850_000), (d(37), 2_850_000), (d(67), 2_950_000)]):
    post("/berkoltsegek", {"honap": date.fromisoformat(honap).replace(day=1).isoformat(), "osszeg": osszeg, "megjegyzes": "Belső munkatársak bére és járulékai"})

print("Kész. Projektek:", [p["projekt_nev"] for p in call("GET", "/projektek")])
