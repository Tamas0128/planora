"""Átadás-átvételi jegyzőkönyv és garanciális hibabejelentés."""

import calendar
from datetime import date, datetime
from html import escape

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import Projekt, ProjektUgyfel, User
from app.models_ext import Jegy
from app.models_projekt import Atvetel, AtvetelAllapot
from app.schemas_ext import JegyResponse
from app.schemas_projekt import (
    AtvetelCreate,
    AtvetelResponse,
    AtvetelUpdate,
    GaranciaHiba,
)
from app.services.audit import log_audit

router = APIRouter(tags=["atvetel"])


def _add_months(d: date, months: int) -> date:
    m = d.month - 1 + months
    year, month = d.year + m // 12, m % 12 + 1
    return date(year, month, min(d.day, calendar.monthrange(year, month)[1]))


def _resp(a: Atvetel) -> AtvetelResponse:
    r = AtvetelResponse.model_validate(a)
    r.garancia_aktiv = bool(a.garancia_lejar and a.garancia_lejar >= date.today())
    return r


def _projekt(db: Session, pid: int) -> Projekt:
    p = db.query(Projekt).get(pid)
    if not p:
        raise HTTPException(status_code=404, detail="Projekt not found")
    return p


def _atvetel(db: Session, aid: int) -> Atvetel:
    a = db.query(Atvetel).get(aid)
    if not a:
        raise HTTPException(status_code=404, detail="Átvétel not found")
    return a


@router.get("/projektek/{projekt_id}/atvetelek", response_model=list[AtvetelResponse])
def list_atvetelek(projekt_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    _projekt(db, projekt_id)
    rows = db.query(Atvetel).filter(Atvetel.projekt_id == projekt_id).order_by(Atvetel.datum.desc(), Atvetel.id.desc())
    return [_resp(a) for a in rows]


@router.post("/projektek/{projekt_id}/atvetelek", response_model=AtvetelResponse, status_code=201)
def create_atvetel(
    projekt_id: int,
    body: AtvetelCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _projekt(db, projekt_id)
    a = Atvetel(projekt_id=projekt_id, letrehozo_id=user.id, **body.model_dump())
    db.add(a)
    db.flush()
    log_audit(db, user, "atvetel", a.id, "letrehozas")
    db.commit()
    db.refresh(a)
    return _resp(a)


@router.patch("/atvetelek/{atvetel_id}", response_model=AtvetelResponse)
def update_atvetel(
    atvetel_id: int,
    body: AtvetelUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    a = _atvetel(db, atvetel_id)
    if a.allapot == AtvetelAllapot.ALAIRT:
        raise HTTPException(status_code=409, detail="Aláírt jegyzőkönyv nem módosítható")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(a, k, v)
    log_audit(db, user, "atvetel", a.id, "modositas")
    db.commit()
    return _resp(a)


@router.post("/atvetelek/{atvetel_id}/alairas", response_model=AtvetelResponse)
def alairas(atvetel_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    a = _atvetel(db, atvetel_id)
    if a.allapot == AtvetelAllapot.ALAIRT:
        raise HTTPException(status_code=409, detail="A jegyzőkönyv már alá van írva")
    a.allapot = AtvetelAllapot.ALAIRT
    a.alairva_at = datetime.utcnow()
    a.garancia_lejar = _add_months(a.datum, a.garancia_honap)
    log_audit(db, user, "atvetel", a.id, "alairas", f"garancia: {a.garancia_lejar}")
    db.commit()
    return _resp(a)


@router.delete("/atvetelek/{atvetel_id}", status_code=204)
def delete_atvetel(atvetel_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    a = _atvetel(db, atvetel_id)
    if a.allapot == AtvetelAllapot.ALAIRT:
        raise HTTPException(status_code=409, detail="Aláírt jegyzőkönyv nem törölhető")
    log_audit(db, user, "atvetel", a.id, "torles")
    db.delete(a)
    db.commit()


@router.get("/atvetelek/{atvetel_id}/jegyzokonyv", response_class=HTMLResponse)
def jegyzokonyv(atvetel_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    """Nyomtatható jegyzőkönyv (a böngészőből PDF-be menthető)."""
    a = _atvetel(db, atvetel_id)
    p = db.query(Projekt).get(a.projekt_id)

    def e(v: object) -> str:
        return escape(str(v)) if v not in (None, "") else "—"

    garancia = (
        f"{a.garancia_honap} hónap, lejár: {a.garancia_lejar}"
        if a.garancia_lejar
        else f"{a.garancia_honap} hónap (aláírással indul)"
    )
    html = f"""<!doctype html><html lang="hu"><head><meta charset="utf-8">
<title>Átadás-átvételi jegyzőkönyv</title>
<style>body{{font-family:Georgia,serif;max-width:720px;margin:2rem auto;color:#222}}
h1{{font-size:1.4rem}}td{{padding:.3rem .6rem;vertical-align:top}}td:first-child{{font-weight:bold;width:11rem}}
.alairas{{display:flex;gap:4rem;margin-top:4rem}}.alairas div{{flex:1;border-top:1px solid #000;padding-top:.3rem;text-align:center}}</style></head>
<body><h1>Átadás-átvételi jegyzőkönyv</h1>
<table><tr><td>Projekt</td><td>{e(p.projekt_nev if p else '')}</td></tr>
<tr><td>Dátum</td><td>{e(a.datum)}</td></tr>
<tr><td>Átadó</td><td>{e(a.atado_nev)}</td></tr>
<tr><td>Átvevő</td><td>{e(a.atvevo_nev)}</td></tr>
<tr><td>Feltárt hiányosságok</td><td>{e(a.hibak)}</td></tr>
<tr><td>Megjegyzés</td><td>{e(a.megjegyzes)}</td></tr>
<tr><td>Garancia</td><td>{e(garancia)}</td></tr></table>
<div class="alairas"><div>Átadó</div><div>Átvevő</div></div></body></html>"""
    return HTMLResponse(html)


@router.post("/projektek/{projekt_id}/garancia-hiba", response_model=JegyResponse, status_code=201)
def garancia_hiba(
    projekt_id: int,
    body: GaranciaHiba,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Garanciális hibabejelentés: jegyet nyit a projekt ügyfelének — csak érvényes garancia mellett."""
    _projekt(db, projekt_id)
    van_garancia = (
        db.query(Atvetel)
        .filter(
            Atvetel.projekt_id == projekt_id,
            Atvetel.allapot == AtvetelAllapot.ALAIRT,
            Atvetel.garancia_lejar >= date.today(),
        )
        .first()
    )
    if not van_garancia:
        raise HTTPException(status_code=409, detail="Nincs érvényes garancia ehhez a projekthez")
    link = db.query(ProjektUgyfel).filter(ProjektUgyfel.projekt_id == projekt_id).first()
    if not link:
        raise HTTPException(status_code=409, detail="A projekthez nincs ügyfél rendelve")
    jegy = Jegy(
        ugyfel_id=link.ugyfel_id,
        projekt_id=projekt_id,
        targy=f"Garanciális hiba: {body.targy}",
        leiras=body.leiras,
        letrehozo_id=user.id,
    )
    db.add(jegy)
    db.flush()
    log_audit(db, user, "jegy", jegy.id, "letrehozas", jegy.targy)
    db.commit()
    from app.api.jegyek import _query, _to_response

    return _to_response(_query(db).filter(Jegy.id == jegy.id).first())
