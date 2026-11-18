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
