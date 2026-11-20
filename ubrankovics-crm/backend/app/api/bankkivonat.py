"""Bankkivonat (xlsx) import: elemzés (csak olvasás + javaslat, nem ír
adatbázist) és jóváhagyás (a kijelölt tételek alapján fizetés rögzítése +
a kivonat csatolása dokumentumként az érintett projekt(ek)hez)."""

import json
import os
import uuid
from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.dependencies import get_current_user, require_roles
from app.models import Dokumentum, Projekt, User, UserRole
from app.models_finance import AlvallalkozoiSzamla, AlvallalkozoiSzamlaAllapot, UgyfelSzamla, UgyfelSzamlaAllapot
from app.schemas_crm import (
    BankkivonatElemzesValasz,
    BankkivonatJavaslat,
    BankkivonatJovahagyasValasz,
    BankkivonatJovahagyottTetel,
    BankkivonatSor,
)
from app.services.bankkivonat import BankkivonatParseError, find_match, parse_bankkivonat

router = APIRouter(prefix="/bankkivonat", tags=["bankkivonat"])

_PENZUGY = (UserRole.PENZUGY, UserRole.VEZETES)


def _to_javaslat(m) -> BankkivonatJavaslat:
    return BankkivonatJavaslat(
        forras_tipus=m.forras_tipus,
        forras_id=m.forras_id,
        projekt_id=m.projekt_id,
        projekt_nev=m.projekt_nev,
        partner_nev=m.partner_nev,
        szamlaszam=m.szamlaszam,
        hatralek=m.hatralek,
        biztos=m.biztos,
    )


@router.post("/elemzes", response_model=BankkivonatElemzesValasz)
async def elemzes(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(*_PENZUGY)),
):
    content = await file.read()
    try:
        parsed = parse_bankkivonat(content)
    except BankkivonatParseError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    sorok: list[BankkivonatSor] = []
    egyeztetett = 0
    for row in parsed:
        irany = "bevetel" if row.osszeg > 0 else "kiadas"
        javaslat, alternativak = find_match(db, irany, row.kozlemeny)
        if javaslat:
            egyeztetett += 1
        sorok.append(
            BankkivonatSor(
                sor=row.sor,
                datum=row.datum,
                osszeg=abs(row.osszeg),
                irany=irany,
                kozlemeny=row.kozlemeny,
                javaslat=_to_javaslat(javaslat) if javaslat else None,
                alternativak=[_to_javaslat(a) for a in alternativak],
            )
        )

    return BankkivonatElemzesValasz(sorok=sorok, sorok_szama=len(sorok), egyeztetett_szama=egyeztetett)


@router.post("/jovahagyas", response_model=BankkivonatJovahagyasValasz)
async def jovahagyas(
    file: UploadFile = File(...),
    jovahagyott_tetelek: str = Form(...),
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(*_PENZUGY)),
):
    try:
        tetelek_raw = json.loads(jovahagyott_tetelek)
        tetelek = [BankkivonatJovahagyottTetel(**t) for t in tetelek_raw]
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=f"Érvénytelen jovahagyott_tetelek: {exc}") from exc

    erintett_projektek: set[int] = set()

    for t in tetelek:
        if t.forras_tipus == "ugyfel_szamla":
            szamla = db.query(UgyfelSzamla).get(t.forras_id)
            if not szamla:
                continue
            szamla.fizetett_osszeg = (szamla.fizetett_osszeg or Decimal(0)) + t.osszeg
            if szamla.fizetett_osszeg >= szamla.brutto:
                szamla.fizetes_datum = t.datum
                szamla.allapot = UgyfelSzamlaAllapot.KIFIZETVE
            else:
                szamla.allapot = UgyfelSzamlaAllapot.RESZBEN_FIZETVE
            erintett_projektek.add(szamla.projekt_id)
        elif t.forras_tipus == "alvallalkozoi_szamla":
            szamla = db.query(AlvallalkozoiSzamla).get(t.forras_id)
            if not szamla:
                continue
            szamla.fizetett_osszeg = (szamla.fizetett_osszeg or Decimal(0)) + t.osszeg
            if szamla.fizetett_osszeg >= szamla.brutto:
                szamla.fizetes_datum = t.datum
                szamla.allapot = AlvallalkozoiSzamlaAllapot.KIFIZETVE
            erintett_projektek.add(szamla.projekt_id)
        else:
            raise HTTPException(status_code=400, detail=f"Ismeretlen forras_tipus: {t.forras_tipus}")

    content = await file.read()
    if erintett_projektek:
        os.makedirs(settings.upload_dir, exist_ok=True)
        ext = os.path.splitext(file.filename or "")[1].lower() or ".xlsx"
        for projekt_id in erintett_projektek:
            if not db.query(Projekt).get(projekt_id):
                continue
            stored_name = f"{uuid.uuid4()}{ext}"
            with open(os.path.join(settings.upload_dir, stored_name), "wb") as f:
                f.write(content)
            db.add(
                Dokumentum(
                    projekt_id=projekt_id,
                    tipus="bankkivonat",
                    utvonal=stored_name,
                    eredeti_nev=file.filename,
                    tartalom_tipus=file.content_type,
                    meret=len(content),
                    feltoltotte_id=user.id,
                    megjegyzes=f"Automatikusan csatolva a bankkivonat-egyeztetés során ({date.today().isoformat()}).",
                )
            )

    db.commit()

    return BankkivonatJovahagyasValasz(feldolgozott_szama=len(tetelek), erintett_projektek=sorted(erintett_projektek))
