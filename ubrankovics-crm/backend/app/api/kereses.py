from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import Alvallalkozo, Projekt, Szemely, Ugyfel, User

router = APIRouter(prefix="/kereses", tags=["kereses"])

_PER_TIPUS_LIMIT = 6


class KeresesResult(BaseModel):
    tipus: str  # "ugyfel" | "projekt" | "alvallalkozo" | "szemely"
    id: int
    cim: str
    alcim: str | None = None


@router.get("", response_model=list[KeresesResult])
def kereses(
    q: str = Query(..., min_length=1),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    like = f"%{q}%"
    results: list[KeresesResult] = []

    ugyfelek = db.query(Ugyfel).filter(Ugyfel.nev.ilike(like)).order_by(Ugyfel.nev).limit(_PER_TIPUS_LIMIT).all()
    results += [KeresesResult(tipus="ugyfel", id=u.id, cim=u.nev, alcim=u.telefon) for u in ugyfelek]

    projektek = (
        db.query(Projekt).filter(Projekt.projekt_nev.ilike(like)).order_by(Projekt.projekt_nev).limit(_PER_TIPUS_LIMIT).all()
    )
    results += [KeresesResult(tipus="projekt", id=p.id, cim=p.projekt_nev, alcim=p.hrsz) for p in projektek]

    alvallalkozok = (
        db.query(Alvallalkozo).filter(Alvallalkozo.nev.ilike(like)).order_by(Alvallalkozo.nev).limit(_PER_TIPUS_LIMIT).all()
    )
    results += [KeresesResult(tipus="alvallalkozo", id=a.id, cim=a.nev, alcim=a.kapcsolat) for a in alvallalkozok]

    szemelyek = db.query(Szemely).filter(Szemely.nev.ilike(like)).order_by(Szemely.nev).limit(_PER_TIPUS_LIMIT).all()
    results += [KeresesResult(tipus="szemely", id=s.id, cim=s.nev, alcim=s.telefon) for s in szemelyek]

    return results
