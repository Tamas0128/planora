"""Projekt átvétele az Ubrankovics alap-Excelből (docs/excel-sablon/Ubrankovics_projekt_alap.xlsx).

A feldolgozás egy tranzakcióban fut; előnézetnél (dry_run) a hívó visszagörgeti.
"""

import re
import unicodedata
from decimal import Decimal, InvalidOperation
from io import BytesIO

import openpyxl
from sqlalchemy.orm import Session

from app.models import (
    Alvallalkozo,
    Munkanem,
    MunkanemCsoport,
    Projekt,
    ProjektSzerep,
    ProjektSzerepTipus,
    ProjektTetel,
    ProjektTetelVallalas,
    ProjektUgyfel,
    Szemely,
    TetelEsemeny,
    TetelEsemenyAllapot,
    TetelEsemenyTipus,
    TetelSzakasz,
    Ugyfel,
    VallalasTipus,
)
from app.models_projekt import AjanlatAllapot, AjanlatSor, AjanlatVerzio, VevoiAjanlat


def _norm(s: str) -> str:
    s = unicodedata.normalize("NFKD", str(s or "")).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", " ", s).strip()


def _txt(v) -> str | None:
    if v is None:
        return None
    s = str(v).strip()
    return s or None


def _szam(v) -> Decimal | None:
    if v is None or str(v).strip() == "":
        return None
    try:
        return Decimal(str(v).replace(" ", "").replace("\xa0", "").replace(",", "."))
    except InvalidOperation:
        return None


def _datum(v):
    from datetime import date, datetime

    if isinstance(v, datetime):
        return v.date()
    if isinstance(v, date):
        return v
    s = _txt(v)
    if s:
        try:
            return date.fromisoformat(s[:10])
        except ValueError:
            return None
    return None


def _allapot(v) -> TetelEsemenyAllapot | None:
    s = _norm(v)
    if not s:
        return None
    if s in ("igen", "ok", "kesz"):
        return TetelEsemenyAllapot.KESZ
    if s in ("", "-", "nem"):
        return TetelEsemenyAllapot.NEM_RELEVANS
    return TetelEsemenyAllapot.FOLYAMATBAN


ESEMENY_OSZLOP = [
    ("ajanlatkeres", TetelEsemenyTipus.AJANLATKERES),
    ("ajanlat beerkezett", TetelEsemenyTipus.AJANLAT_BEERKEZETT),
    ("ajanlat ugyfelnek", TetelEsemenyTipus.AJANLAT_UGYFELNEK),
    ("ajanlatot ugyfel alairta", TetelEsemenyTipus.AJANLAT_ALAIRVA),
    ("szerzodtunk", TetelEsemenyTipus.SZERZODES),
    ("anyagot rendeltunk", TetelEsemenyTipus.ANYAG_MEGRENDELVE),
    ("megjott e", TetelEsemenyTipus.ANYAG_MEGERKEZETT),
    ("munka elvegezve", TetelEsemenyTipus.MUNKA_KESZ),
]

SZEREP = {
    "epitesvezeto": ProjektSzerepTipus.EPITESVEZETO,
    "projektfelelos": ProjektSzerepTipus.PROJEKTFELELOS,
    "gyartastervezo": ProjektSzerepTipus.GYARTASTERVEZO,
    "muszaki ellenor": ProjektSzerepTipus.MUSZAKI_ELLENOR,
    "epitesz tervezo": ProjektSzerepTipus.EPITESZ_TERVEZO,
}

CSOPORT = {
    "szerkezetkesz": MunkanemCsoport.SZERKEZET,
    "nyz arny parkany": MunkanemCsoport.NYILASZARO,
    "garazskapu": MunkanemCsoport.NYILASZARO,
    "kulso feluletek": MunkanemCsoport.KULSO_FELULET,
    "gepeszet": MunkanemCsoport.GEPESZET,
    "aljzat burkolas": MunkanemCsoport.ALJZAT,
}


class ImportHiba(Exception):
    pass


def _kulcs_ertek(ws) -> dict[str, str | None]:
    out = {}
    for row in ws.iter_rows(min_row=1, max_row=20, values_only=True):
        if row and row[0] and row[1] is not None:
            out[_norm(row[0])] = _txt(row[1])
    return out


def importal(db: Session, fajl: bytes) -> dict:
    try:
        wb = openpyxl.load_workbook(BytesIO(fajl), data_only=True)
    except Exception as exc:  # hibás/nem xlsx fájl
        raise ImportHiba("Nem olvasható Excel-fájl.") from exc
    if "Tételek" not in wb.sheetnames or "Projekt" not in wb.sheetnames:
        raise ImportHiba("Hiányzik a Projekt vagy a Tételek lap. Az alap-sablont használja.")

    figy: list[str] = []
    stat = {"tetelek": 0, "esemenyek": 0, "uj_munkanem": 0, "cr": 0, "szerepek": 0, "kihagyva": {}}

    # ---- Projekt lap
    kv = _kulcs_ertek(wb["Projekt"])
    nev = kv.get("projekt neve") or kv.get("megrendelo")
    if not nev:
        raise ImportHiba("A Projekt lapon a projekt neve vagy a megrendelő kötelező.")
    projekt = Projekt(projekt_nev=nev, enaplo_iktatoszam=kv.get("e naplo iktatoszama"), utemezes_aktiv=True)
    db.add(projekt)
    db.flush()
    megrendelo = kv.get("megrendelo")
    if megrendelo:
        ugyfel = db.query(Ugyfel).filter(Ugyfel.nev == megrendelo).first()
        if not ugyfel:
            ugyfel = Ugyfel(nev=megrendelo, telefon=kv.get("megrendelo telefon"), email=kv.get("megrendelo e mail"))
            db.add(ugyfel)
            db.flush()
        db.add(ProjektUgyfel(projekt_id=projekt.id, ugyfel_id=ugyfel.id, epitesi_cim=kv.get("epitesi cim")))
    else:
        figy.append("Nincs megrendelő megadva: ügyfél nélkül jött létre a projekt.")

    # ---- Szerepkörök
    ws = wb["Projekt"]
    for row in ws.iter_rows(min_row=1, values_only=True):
        szerep = SZEREP.get(_norm(row[0])) if row and row[0] else None
        nev_sz = _txt(row[1]) if szerep and len(row) > 1 else None
        if szerep and nev_sz:
            sz = db.query(Szemely).filter(Szemely.nev == nev_sz).first()
            if not sz:
                elerhetoseg = _txt(row[2]) if len(row) > 2 else None
                email = next((p for p in re.split(r"[,; ]+", elerhetoseg or "") if "@" in p), None)
                tel = re.sub(r"[^\d+/ ]", "", (elerhetoseg or "").split("@")[0]).strip() or None
                sz = Szemely(nev=nev_sz, telefon=tel, email=email)
                db.add(sz)
                db.flush()
            db.add(ProjektSzerep(projekt_id=projekt.id, szemely_id=sz.id, szerep=szerep))
            stat["szerepek"] += 1

    # ---- Alapszerződés összege
    alap = _szam(kv.get("szerzodeses netto osszeg alap"))
    if alap:
        _ajanlat(db, projekt.id, "Alapszerződés", None, alap, AjanlatAllapot.ELFOGADVA)

    # ---- Munkanemek indexe
    munkanemek = {_norm(m.nev): m for m in db.query(Munkanem).all()}
    sorrend_max = db.query(Munkanem).count()

    # ---- Tételek lap
    ws = wb["Tételek"]
    fej = {}
    for idx, c in enumerate(next(ws.iter_rows(min_row=1, max_row=1, values_only=True))):
        if c:
            fej[_norm(c)] = idx
    if "megnevezes" not in fej:
        raise ImportHiba("A Tételek lapon hiányzik a Megnevezés oszlop.")

    def cella(row, kulcs):
        i = fej.get(kulcs)
        return row[i] if i is not None and i < len(row) else None

    sorrend = 0
    for row in ws.iter_rows(min_row=2, values_only=True):
        t_nev = _txt(cella(row, "megnevezes"))
        if not t_nev:
            continue
        sorrend += 1
        m = munkanemek.get(_norm(t_nev))
        if not m:
            m = next((x for k, x in munkanemek.items() if k and (k in _norm(t_nev) or _norm(t_nev) in k)), None) if len(_norm(t_nev)) > 4 else None
        if not m:
            sorrend_max += 1
            szakag = _norm(cella(row, "szakag"))
            m = Munkanem(
                kod=f"imp-{sorrend_max}-{_norm(t_nev).replace(' ', '-')[:30]}",
                nev=t_nev,
                csoport=CSOPORT.get(szakag, MunkanemCsoport.BELSO),
                sorrend=sorrend_max,
            )
            db.add(m)
            db.flush()
            munkanemek[_norm(t_nev)] = m
            stat["uj_munkanem"] += 1

        allapotok = {tip: _allapot(cella(row, kulcs)) for kulcs, tip in ESEMENY_OSZLOP}
        tipus = _norm(cella(row, "tipus"))
        szerzodve = allapotok[TetelEsemenyTipus.SZERZODES] == TetelEsemenyAllapot.KESZ
        potmunka = tipus.startswith("potmunka")
        if potmunka:
            szakasz = TetelSzakasz.AJANLAT
        elif tipus.startswith("alap") or (not tipus and szerzodve):
            szakasz = TetelSzakasz.SZERZODES
        else:
            szakasz = TetelSzakasz.AJANLAT
        elvegezve = allapotok[TetelEsemenyTipus.MUNKA_KESZ]
        if elvegezve == TetelEsemenyAllapot.KESZ:
            szakasz = TetelSzakasz.KESZ
        elif elvegezve == TetelEsemenyAllapot.FOLYAMATBAN:
            szakasz = TetelSzakasz.KIVITELEZES
        elif allapotok[TetelEsemenyTipus.ANYAG_MEGRENDELVE] == TetelEsemenyAllapot.KESZ and szakasz != TetelSzakasz.AJANLAT:
            szakasz = TetelSzakasz.BESZERZES

        info = _txt(cella(row, "info"))
        megj = _txt(cella(row, "megjegyzes"))
        vegrehajto = _norm(cella(row, "ubr alvall gyarto"))
        partner = _txt(cella(row, "partner neve"))
        if vegrehajto in ("gyarto", "beszallito") and partner:
            info = " · ".join(x for x in (info, f"{'Gyártó' if vegrehajto == 'gyarto' else 'Beszállító'}: {partner}") if x)
        tetel = ProjektTetel(
            projekt_id=projekt.id,
            munkanem_id=m.id,
            sorrend=sorrend,
            info=" · ".join(x for x in (info, megj) if x) or None,
            extra_megjegyzes=_txt(cella(row, "extra ami mas szakagat is befolyasol")),
            tig=_txt(cella(row, "tig")),
            potmunka=potmunka,
            cr_azonosito=_txt(cella(row, "cr azonosito")) if potmunka else None,
            potmunka_osszeg=_szam(cella(row, "ugyfelnek netto ft")) if potmunka else None,
            varhato_szoveg=_txt(cella(row, "kivitelezes varhato ideje")),
            duration_days=int(_szam(cella(row, "idotartam nap")) or 0) or None,
            szakasz=szakasz,
        )
        db.add(tetel)
        db.flush()
        for tip, al in allapotok.items():
            if al is not None:
                db.add(TetelEsemeny(tetel_id=tetel.id, tipus=tip, allapot=al))
                stat["esemenyek"] += 1
        if vegrehajto == "ubrankovics":
            db.add(ProjektTetelVallalas(tetel_id=tetel.id, tipus=VallalasTipus.SAJAT))
        elif vegrehajto == "ugyfel":
            db.add(ProjektTetelVallalas(tetel_id=tetel.id, tipus=VallalasTipus.UGYFEL))
        elif vegrehajto == "alvallalkozo":
            av = None
            if partner:
                av = db.query(Alvallalkozo).filter(Alvallalkozo.nev == partner).first()
                if not av:
                    av = Alvallalkozo(nev=partner)
                    db.add(av)
                    db.flush()
            db.add(ProjektTetelVallalas(tetel_id=tetel.id, tipus=VallalasTipus.ALVALLALKOZO, alvallalkozo_id=av.id if av else None))
        stat["tetelek"] += 1

    # ---- Pótmunkák (CR)
    if "Pótmunkák (CR)" in wb.sheetnames:
        ws = wb["Pótmunkák (CR)"]
        for row in ws.iter_rows(min_row=2, values_only=True):
            if not row or not _txt(row[1]):
                continue
            allapot = {"elkuldve": AjanlatAllapot.ELKULDVE, "elfogadva": AjanlatAllapot.ELFOGADVA, "elutasitva": AjanlatAllapot.ELUTASITVA}.get(_norm(row[4]), AjanlatAllapot.TERVEZET)
            _ajanlat(db, projekt.id, _txt(row[1]), _txt(row[0]), _szam(row[6]) or Decimal(0), allapot)
            stat["cr"] += 1

    # ---- amit az első verzió még nem vesz át
    for lap, oszlopok in (("Szakági specifikáció", (1, 2, 4)), ("Partnerek", (0,)), ("Dokumentumok", (0,)), ("Számlák", (1,))):
        if lap not in wb.sheetnames:
            continue
        n = sum(1 for r in wb[lap].iter_rows(min_row=2, values_only=True) if r and any(_txt(r[i]) for i in oszlopok if i < len(r)))
        if n:
            stat["kihagyva"][lap] = n
    if stat["kihagyva"]:
        figy.append("Ezeket a lapokat az átvétel még nem dolgozza fel (kihagyva): " + ", ".join(f"{k} ({v} sor)" for k, v in stat["kihagyva"].items()) + ".")
    if stat["tetelek"] == 0:
        figy.append("A Tételek lapon nincs kitöltött sor.")

    return {"projekt_id": projekt.id, "projekt_nev": projekt.projekt_nev, "statisztika": stat, "figyelmeztetesek": figy}


def _ajanlat(db: Session, projekt_id: int, cim: str, cr: str | None, netto: Decimal, allapot: AjanlatAllapot) -> None:
    a = VevoiAjanlat(projekt_id=projekt_id, cim=cim, cr_azonosito=cr)
    db.add(a)
    db.flush()
    v = AjanlatVerzio(ajanlat_id=a.id, verzio=1, allapot=allapot, netto_osszeg=netto)
    v.sorok = [AjanlatSor(sorrend=0, megnevezes=cim, mennyiseg=1, egysegar=netto)]
    db.add(v)
