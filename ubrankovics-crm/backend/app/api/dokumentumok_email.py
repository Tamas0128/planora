from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.dependencies import get_current_user
from app.models import KikuldottEmail, Projekt, ProjektTetel, User
from app.schemas_crm import (
    EmailKuldesCreate,
    KikuldottEmailResponse,
    SablonElonezetRequest,
    SablonElonezetResponse,
)
from app.services.dokumentum_sablonok import render_sablon
from app.services.email import send_email

router = APIRouter(prefix="/projektek/{projekt_id}", tags=["dokumentum-sablonok"])


def _get_projekt_or_404(db: Session, projekt_id: int) -> Projekt:
    projekt = db.query(Projekt).get(projekt_id)
    if not projekt:
        raise HTTPException(status_code=404, detail="Projekt not found")
    return projekt


def _get_tetelek(db: Session, projekt_id: int, tetel_ids: list[int]) -> list[ProjektTetel]:
    ids = list(dict.fromkeys(tetel_ids))  # dedupe, megőrizve a kért sorrendet
    if not ids:
        raise HTTPException(status_code=422, detail="Legalább egy tételt ki kell választani")
    rows = (
        db.query(ProjektTetel)
        .options(
            joinedload(ProjektTetel.munkanem),
            joinedload(ProjektTetel.specifikaciok),
            joinedload(ProjektTetel.rendelesek),
        )
        .filter(ProjektTetel.projekt_id == projekt_id, ProjektTetel.id.in_(ids))
        .all()
    )
    by_id = {t.id: t for t in rows}
    missing = [i for i in ids if i not in by_id]
    if missing:
        raise HTTPException(status_code=404, detail=f"Tétel nem található ebben a projektben: {missing}")
    return [by_id[i] for i in ids]


@router.post("/sablon-elonezet", response_model=SablonElonezetResponse)
def sablon_elonezet(
    projekt_id: int,
    body: SablonElonezetRequest,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    projekt = _get_projekt_or_404(db, projekt_id)
    tetelek = _get_tetelek(db, projekt_id, body.tetel_ids)
    targy, html = render_sablon(body.tipus, projekt, tetelek, body.uzenet)
    return SablonElonezetResponse(targy=targy, html=html)


@router.post("/email", response_model=KikuldottEmailResponse, status_code=201)
def kuldes(
    projekt_id: int,
    body: EmailKuldesCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    projekt = _get_projekt_or_404(db, projekt_id)
    tetelek = _get_tetelek(db, projekt_id, body.tetel_ids)
    targy, html = render_sablon(body.tipus, projekt, tetelek, body.uzenet)
    vegso_targy = (body.targy or targy).strip()[:255]

    try:
        sent = send_email(str(body.cimzett), vegso_targy, html)
    except OSError as exc:  # smtplib.SMTPException is an OSError subclass
        raise HTTPException(status_code=502, detail=f"Az e-mail küldése sikertelen: {exc}") from exc
    if not sent:
        raise HTTPException(status_code=503, detail="Az e-mail küldés nincs beállítva (SMTP_HOST hiányzik)")

    # Csak sikeres átadás után naplózunk — a napló azt mutatja, ami tényleg elment.
    log = KikuldottEmail(
        projekt_id=projekt_id,
        tipus=body.tipus,
        cimzett=str(body.cimzett),
        targy=vegso_targy,
        tetel_ids=",".join(str(t.id) for t in tetelek),
        uzenet=body.uzenet,
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    return log


@router.get("/emailek", response_model=list[KikuldottEmailResponse])
def list_emailek(
    projekt_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    _get_projekt_or_404(db, projekt_id)
    return (
        db.query(KikuldottEmail)
        .filter(KikuldottEmail.projekt_id == projekt_id)
        .order_by(KikuldottEmail.elkuldve_at.desc())
        .all()
    )
