"""Projektek közötti összesített ütemterv (Gantt): projektenként a tételek időablakai."""

from datetime import date

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.dependencies import get_current_user
from app.models import Projekt, ProjektTetel, User

router = APIRouter(tags=["utemterv"])


class UtemSzakasz(BaseModel):
    tetel_id: int
    nev: str
    kezdes: date
    vege: date
    szakasz: str


class UtemProjekt(BaseModel):
    projekt_id: int
    projekt_nev: str
    allapot: str
    kezdes: date | None
    vege: date | None
    keso: bool
    szakaszok: list[UtemSzakasz]


@router.get("/utemterv", response_model=list[UtemProjekt])
def utemterv(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    ma = date.today()
    projektek = (
        db.query(Projekt)
        .options(joinedload(Projekt.tetelek).joinedload(ProjektTetel.munkanem))
        .filter(Projekt.utemezes_aktiv.is_(True))
        .order_by(Projekt.projekt_nev)
        .all()
    )
    out = []
    for p in projektek:
        sz = [
            UtemSzakasz(tetel_id=t.id, nev=t.munkanem.nev, kezdes=t.start_date, vege=t.end_date, szakasz=t.szakasz.value)
            for t in sorted(p.tetelek, key=lambda t: (t.start_date or date.max, t.id))
            if t.start_date and t.end_date
        ]
        if not sz:
            continue
        keso = any(s.vege < ma and s.szakasz != "kesz" for s in sz)
        out.append(
            UtemProjekt(
                projekt_id=p.id,
                projekt_nev=p.projekt_nev,
                allapot=p.allapot.value,
                kezdes=min(s.kezdes for s in sz),
                vege=max(s.vege for s in sz),
                keso=keso,
                szakaszok=sz,
            )
        )
    return out
