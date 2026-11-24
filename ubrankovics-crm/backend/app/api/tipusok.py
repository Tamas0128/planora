from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.dependencies import get_current_user
from app.models import ProjektTipus, ProjektTipusFazis, User
from app.schemas_crm import ProjektTipusResponse

router = APIRouter(prefix="/projekt-tipusok", tags=["projekt-tipusok"])


@router.get("", response_model=list[ProjektTipusResponse])
def list_projekt_tipusok(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return (
        db.query(ProjektTipus)
        .options(joinedload(ProjektTipus.fazisok).joinedload(ProjektTipusFazis.lepesek))
        .order_by(ProjektTipus.nev)
        .all()
    )


# --- Törzsadat › Ütemezés: a típus-sablon tételeinek alapidői ----------------------------------

from fastapi import HTTPException  # noqa: E402
from pydantic import BaseModel, Field  # noqa: E402

from app.models import ProjektTipusTetel  # noqa: E402


class SablonTetelOut(BaseModel):
    id: int
    munkanem_id: int
    munkanem_nev: str
    sorrend: int
    duration_days: int
    prep_days: int
    include_by_default: bool


class SablonTetelUpdate(BaseModel):
    duration_days: int | None = Field(default=None, ge=1, le=3650)
    prep_days: int | None = Field(default=None, ge=0, le=3650)
    include_by_default: bool | None = None


def _out(t: ProjektTipusTetel) -> SablonTetelOut:
    return SablonTetelOut(
        id=t.id, munkanem_id=t.munkanem_id, munkanem_nev=t.munkanem.nev, sorrend=t.sorrend,
        duration_days=t.duration_days, prep_days=t.prep_days, include_by_default=t.include_by_default,
    )


@router.get("/{tipus_id}/tetel-sablonok", response_model=list[SablonTetelOut])
def list_tetel_sablonok(tipus_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    if not db.query(ProjektTipus).get(tipus_id):
        raise HTTPException(status_code=404, detail="Projekttípus not found")
    rows = (
        db.query(ProjektTipusTetel)
        .options(joinedload(ProjektTipusTetel.munkanem))
        .filter(ProjektTipusTetel.projekt_tipus_id == tipus_id)
        .order_by(ProjektTipusTetel.sorrend, ProjektTipusTetel.id)
        .all()
    )
    return [_out(r) for r in rows]


@router.patch("/tetel-sablonok/{sablon_id}", response_model=SablonTetelOut)
def update_tetel_sablon(sablon_id: int, body: SablonTetelUpdate, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    t = db.query(ProjektTipusTetel).options(joinedload(ProjektTipusTetel.munkanem)).filter(ProjektTipusTetel.id == sablon_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Sablon-tétel not found")
    for k, v in body.model_dump(exclude_unset=True).items():
        if v is not None:
            setattr(t, k, v)
    db.commit()
    return _out(t)
