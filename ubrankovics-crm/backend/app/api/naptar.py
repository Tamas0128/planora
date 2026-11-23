"""Naptár: feladat-határidők, projekt-átadások, ütemezett tételek, garancia-lejáratok
egy nézetben, és iCalendar (.ics) export külső naptáralkalmazásokhoz."""

from datetime import date, datetime, timedelta
from typing import Literal, Optional

from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.dependencies import get_current_user
from app.models import Feladat, Projekt, ProjektTetel, User
from app.models_projekt import Atvetel, AtvetelAllapot

router = APIRouter(prefix="/naptar", tags=["naptar"])

EsemenyTipus = Literal["feladat", "atadas", "tetel", "garancia"]


class NaptarEsemeny(BaseModel):
    kulcs: str
    tipus: EsemenyTipus
    cim: str
    kezdes: date
    vege: date  # inkluzív utolsó nap
    projekt_id: Optional[int] = None
    kesz: bool = False


def _esemenyek(db: Session, tol: date, ig: date, projekt_id: int | None = None) -> list[NaptarEsemeny]:
    out: list[NaptarEsemeny] = []

    q = db.query(Feladat).options(joinedload(Feladat.projekt)).filter(Feladat.hatarido >= tol, Feladat.hatarido <= ig)
    if projekt_id is not None:
        q = q.filter(Feladat.projekt_id == projekt_id)
    for f in q:
        out.append(NaptarEsemeny(kulcs=f"feladat-{f.id}", tipus="feladat", cim=f.cim, kezdes=f.hatarido, vege=f.hatarido, projekt_id=f.projekt_id, kesz=f.kesz))

    q = db.query(Projekt).filter(Projekt.delivery_date >= tol, Projekt.delivery_date <= ig)
    if projekt_id is not None:
        q = q.filter(Projekt.id == projekt_id)
    for p in q:
        out.append(NaptarEsemeny(kulcs=f"atadas-{p.id}", tipus="atadas", cim=f"Átadás: {p.projekt_nev}", kezdes=p.delivery_date, vege=p.delivery_date, projekt_id=p.id))

    q = (
        db.query(ProjektTetel)
        .options(joinedload(ProjektTetel.munkanem), joinedload(ProjektTetel.projekt))
        .filter(ProjektTetel.start_date.isnot(None), ProjektTetel.end_date.isnot(None))
        .filter(ProjektTetel.start_date <= ig, ProjektTetel.end_date >= tol)
    )
    if projekt_id is not None:
        q = q.filter(ProjektTetel.projekt_id == projekt_id)
    for t in q:
        nev = t.munkanem.nev if t.munkanem else "Tétel"
        out.append(
            NaptarEsemeny(
                kulcs=f"tetel-{t.id}",
                tipus="tetel",
                cim=f"{t.projekt.projekt_nev}: {nev}" if t.projekt else nev,
                kezdes=t.start_date,
                vege=t.end_date,
                projekt_id=t.projekt_id,
                kesz=t.kesz,
            )
        )

    q = db.query(Atvetel).filter(
        Atvetel.allapot == AtvetelAllapot.ALAIRT, Atvetel.garancia_lejar >= tol, Atvetel.garancia_lejar <= ig
    )
    if projekt_id is not None:
        q = q.filter(Atvetel.projekt_id == projekt_id)
    for a in q:
        p = db.query(Projekt).get(a.projekt_id)
        out.append(NaptarEsemeny(kulcs=f"garancia-{a.id}", tipus="garancia", cim=f"Garancia lejár: {p.projekt_nev if p else ''}", kezdes=a.garancia_lejar, vege=a.garancia_lejar, projekt_id=a.projekt_id))

    out.sort(key=lambda e: (e.kezdes, e.cim))
    return out


def _tartomany(tol: date | None, ig: date | None) -> tuple[date, date]:
    tol = tol or date.today().replace(day=1)
    ig = ig or tol + timedelta(days=62)
    return tol, ig


@router.get("", response_model=list[NaptarEsemeny])
def naptar(
    tol: date | None = None,
    ig: date | None = None,
    projekt_id: int | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    tol, ig = _tartomany(tol, ig)
    return _esemenyek(db, tol, ig, projekt_id)


def _esc(s: str) -> str:
    return s.replace("\\", "\\\\").replace(";", "\\;").replace(",", "\\,").replace("\n", "\\n")


def _ics(esemenyek: list[NaptarEsemeny]) -> str:
    stamp = datetime.utcnow().strftime("%Y%m%dT%H%M%SZ")
    lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Ubrankovics CRM//HU", "CALSCALE:GREGORIAN", "X-WR-CALNAME:Ubrankovics CRM"]
    for e in esemenyek:
        lines += [
            "BEGIN:VEVENT",
            f"UID:{e.kulcs}@ubrankovics-crm",
            f"DTSTAMP:{stamp}",
            f"DTSTART;VALUE=DATE:{e.kezdes.strftime('%Y%m%d')}",
            # az iCal egésznapos DTEND exkluzív
            f"DTEND;VALUE=DATE:{(e.vege + timedelta(days=1)).strftime('%Y%m%d')}",
            f"SUMMARY:{_esc(('✓ ' if e.kesz else '') + e.cim)}",
            "END:VEVENT",
        ]
    lines.append("END:VCALENDAR")
    return "\r\n".join(lines) + "\r\n"


@router.get("/export.ics")
def export_ics(
    tol: date | None = None,
    ig: date | None = None,
    projekt_id: int | None = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    tol = tol or date.today() - timedelta(days=30)
    ig = ig or date.today() + timedelta(days=365)
    return Response(
        _ics(_esemenyek(db, tol, ig, projekt_id)),
        media_type="text/calendar; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="ubrankovics-naptar.ics"'},
    )
