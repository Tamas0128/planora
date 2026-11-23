"""Kampány-leiratkozás: publikus (bejelentkezés nélküli) oldal a levelekben küldött
egyedi tokennel. A GET csak megerősítő oldalt mutat (a levélszkennerek automatikus
GET-jei ne iratkoztassanak le senkit), a leiratkozást a POST végzi."""

import html

from fastapi import APIRouter, Depends
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import Kommunikacio, KommunikacioTipus, Ugyfel
from app.services.audit import log_audit

router = APIRouter(prefix="/leiratkozas", tags=["leiratkozas"])


def _oldal(cim: str, torzs: str, status: int = 200) -> HTMLResponse:
    return HTMLResponse(
        f"""<!doctype html><html lang="hu"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>{html.escape(cim)}</title>
<style>body{{font-family:system-ui,sans-serif;max-width:32rem;margin:4rem auto;padding:0 1rem;color:#222}}
button{{padding:.6rem 1.2rem;font-size:1rem;cursor:pointer}}</style></head>
<body><h1>{html.escape(cim)}</h1>{torzs}<p><small>{html.escape(settings.cegnev)}</small></p></body></html>""",
        status_code=status,
    )


def _ugyfel(db: Session, token: str) -> Ugyfel | None:
    if not token or len(token) > 64:
        return None
    return db.query(Ugyfel).filter(Ugyfel.leiratkozasi_token == token).first()


@router.get("/{token}", response_class=HTMLResponse)
def megerosito_oldal(token: str, db: Session = Depends(get_db)):
    ugyfel = _ugyfel(db, token)
    if not ugyfel:
        return _oldal("Érvénytelen link", "<p>Ez a leiratkozási link nem érvényes.</p>", 404)
    if ugyfel.leiratkozott:
        return _oldal("Már leiratkoztál", "<p>Ezt a címet korábban leiratkoztattuk a kampányleveleinkről.</p>")
    return _oldal(
        "Leiratkozás",
        f"<p>Biztosan leiratkozol a(z) {html.escape(settings.cegnev)} kampányleveleiről?</p>"
        f'<form method="post" action=""><button type="submit">Igen, leiratkozom</button></form>',
    )


@router.post("/{token}", response_class=HTMLResponse)
def leiratkozas(token: str, db: Session = Depends(get_db)):
    ugyfel = _ugyfel(db, token)
    if not ugyfel:
        return _oldal("Érvénytelen link", "<p>Ez a leiratkozási link nem érvényes.</p>", 404)
    if not ugyfel.leiratkozott:
        ugyfel.leiratkozott = True
        db.add(
            Kommunikacio(
                ugyfel_id=ugyfel.id,
                tipus=KommunikacioTipus.MEGJEGYZES,
                tartalom="Leiratkozott a kampányokról (leiratkozó linkkel)",
            )
        )
        log_audit(db, None, "ugyfel", ugyfel.id, "leiratkozas", ugyfel.nev)
        db.commit()
    return _oldal("Leiratkoztál", "<p>Sikeresen leiratkoztál, a továbbiakban nem küldünk kampányleveleket.</p>")
