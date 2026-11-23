"""Címkék (szegmensek) + tömeges e-mail kampányok."""

import html
import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.dependencies import get_current_user
from app.models import Kommunikacio, KommunikacioTipus, Ugyfel, User
from app.models_ext import Cimke, Kampany, ugyfel_cimkek
from app.schemas import UserBrief  # noqa: F401
from app.schemas_crm import UgyfelResponse
from app.schemas_ext import CimkeCreate, CimkeResponse, KampanyCreate, KampanyResponse, UgyfelCimkePut
from app.services.audit import log_audit
from app.services.email import send_email

router = APIRouter(tags=["cimkek"])
logger = logging.getLogger("ubrankovics.kampany")


@router.get("/cimkek", response_model=list[CimkeResponse])
def list_cimkek(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    szamok = dict(
        db.query(ugyfel_cimkek.c.cimke_id, func.count(ugyfel_cimkek.c.ugyfel_id)).group_by(ugyfel_cimkek.c.cimke_id).all()
    )
    return [
        CimkeResponse(id=c.id, nev=c.nev, ugyfel_szam=szamok.get(c.id, 0))
        for c in db.query(Cimke).order_by(Cimke.nev).all()
    ]


@router.post("/cimkek", response_model=CimkeResponse, status_code=201)
def create_cimke(body: CimkeCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    nev = body.nev.strip()
    if not nev:
        raise HTTPException(status_code=400, detail="A címke neve kötelező")
    cimke = Cimke(nev=nev)
    db.add(cimke)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Ilyen címke már létezik")
    log_audit(db, user, "cimke", cimke.id, "letrehozas", nev)
    db.commit()
    return CimkeResponse(id=cimke.id, nev=cimke.nev, ugyfel_szam=0)


@router.delete("/cimkek/{cimke_id}", status_code=204)
def delete_cimke(cimke_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    cimke = db.query(Cimke).get(cimke_id)
    if not cimke:
        raise HTTPException(status_code=404, detail="Címke not found")
    log_audit(db, user, "cimke", cimke.id, "torles", cimke.nev)
    db.execute(ugyfel_cimkek.delete().where(ugyfel_cimkek.c.cimke_id == cimke_id))
    db.delete(cimke)
    db.commit()


@router.get("/cimkek/{cimke_id}/ugyfelek", response_model=list[UgyfelResponse])
def szegmens_ugyfelek(cimke_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    if not db.query(Cimke).get(cimke_id):
        raise HTTPException(status_code=404, detail="Címke not found")
    return (
        db.query(Ugyfel)
        .join(ugyfel_cimkek, ugyfel_cimkek.c.ugyfel_id == Ugyfel.id)
        .filter(ugyfel_cimkek.c.cimke_id == cimke_id)
        .order_by(Ugyfel.nev)
        .all()
    )


@router.get("/ugyfelek/{ugyfel_id}/cimkek", response_model=list[CimkeResponse])
def ugyfel_cimkei(ugyfel_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    rows = (
        db.query(Cimke)
        .join(ugyfel_cimkek, ugyfel_cimkek.c.cimke_id == Cimke.id)
        .filter(ugyfel_cimkek.c.ugyfel_id == ugyfel_id)
        .order_by(Cimke.nev)
        .all()
    )
    return [CimkeResponse(id=c.id, nev=c.nev) for c in rows]


@router.put("/ugyfelek/{ugyfel_id}/cimkek", response_model=list[CimkeResponse])
def set_ugyfel_cimkei(
    ugyfel_id: int,
    body: UgyfelCimkePut,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if not db.query(Ugyfel).get(ugyfel_id):
        raise HTTPException(status_code=404, detail="Ügyfél not found")
    ids = set(body.cimke_ids)
    letezo = {c.id for c in db.query(Cimke).filter(Cimke.id.in_(ids))} if ids else set()
    if letezo != ids:
        raise HTTPException(status_code=404, detail="Ismeretlen címke")
    db.execute(ugyfel_cimkek.delete().where(ugyfel_cimkek.c.ugyfel_id == ugyfel_id))
    for cid in ids:
        db.execute(ugyfel_cimkek.insert().values(ugyfel_id=ugyfel_id, cimke_id=cid))
    log_audit(db, user, "ugyfel", ugyfel_id, "cimkek", ",".join(str(i) for i in sorted(ids)))
    db.commit()
    return ugyfel_cimkei(ugyfel_id, db, user)


def _cimzettek(db: Session, cimke_id: int | None) -> list[Ugyfel]:
    q = db.query(Ugyfel).filter(Ugyfel.email.isnot(None), Ugyfel.email != "")
    if cimke_id is not None:
        q = q.join(ugyfel_cimkek, ugyfel_cimkek.c.ugyfel_id == Ugyfel.id).filter(ugyfel_cimkek.c.cimke_id == cimke_id)
    return q.order_by(Ugyfel.nev).all()


def _to_kampany(k: Kampany) -> KampanyResponse:
    return KampanyResponse(
        id=k.id,
        nev=k.nev,
        targy=k.targy,
        uzenet=k.uzenet,
        cimke_id=k.cimke_id,
        cimke_nev=k.cimke.nev if k.cimke else None,
        cimzettek_szama=k.cimzettek_szama,
        elkuldve_szama=k.elkuldve_szama,
        created_at=k.created_at,
    )


@router.get("/kampanyok", response_model=list[KampanyResponse])
def list_kampanyok(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return [
        _to_kampany(k)
        for k in db.query(Kampany).options(joinedload(Kampany.cimke)).order_by(Kampany.created_at.desc()).all()
    ]


@router.get("/kampanyok/cimzettek-szama")
def cimzettek_szama(cimke_id: int | None = None, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return {"darab": len(_cimzettek(db, cimke_id))}


@router.post("/kampanyok", response_model=KampanyResponse, status_code=201)
def send_kampany(body: KampanyCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Elküldi a levelet a szegmens (vagy minden e-mailes ügyfél) minden tagjának,
    és mindegyik ügyfél naplójába e-mail bejegyzést ír."""
    if body.cimke_id is not None and not db.query(Cimke).get(body.cimke_id):
        raise HTTPException(status_code=404, detail="Címke not found")
    cimzettek = _cimzettek(db, body.cimke_id)
    if not cimzettek:
        raise HTTPException(status_code=400, detail="Nincs e-mail címmel rendelkező címzett")
    sikeres = 0
    for u in cimzettek:
        torzs = html.escape(body.uzenet).replace("\n", "<br>")
        try:
            if send_email(u.email, body.targy, f"<p>Kedves {html.escape(u.nev)}!</p><p>{torzs}</p>"):
                sikeres += 1
                db.add(
                    Kommunikacio(
                        ugyfel_id=u.id,
                        tipus=KommunikacioTipus.EMAIL,
                        tartalom=f"Kampány: {body.nev} — {body.targy}",
                        user_id=user.id,
                    )
                )
        except Exception:  # egy hibás címzett ne állítsa meg a többit
            logger.exception("Kampány e-mail küldése sikertelen: ugyfel_id=%s", u.id)
    kampany = Kampany(
        nev=body.nev,
        targy=body.targy,
        uzenet=body.uzenet,
        cimke_id=body.cimke_id,
        cimzettek_szama=len(cimzettek),
        elkuldve_szama=sikeres,
        user_id=user.id,
    )
    db.add(kampany)
    db.flush()
    log_audit(db, user, "kampany", kampany.id, "kuldes", f"{sikeres}/{len(cimzettek)} elküldve")
    db.commit()
    return _to_kampany(db.query(Kampany).options(joinedload(Kampany.cimke)).get(kampany.id))
