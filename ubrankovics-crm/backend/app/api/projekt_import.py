from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import User
from app.services.audit import log_audit
from app.services.excel_import import ImportHiba, importal

router = APIRouter(tags=["projekt-import"])

MAX_MERET = 10 * 1024 * 1024


@router.post("/projektek-import/excel")
async def import_excel(
    dry_run: bool = True,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Projekt átvétele az alap-Excelből. dry_run=true: csak előnézet, semmi nem mentődik."""
    adat = await file.read()
    if len(adat) > MAX_MERET:
        raise HTTPException(status_code=413, detail="A fájl túl nagy (legfeljebb 10 MB).")
    try:
        eredmeny = importal(db, adat)
    except ImportHiba as exc:
        db.rollback()
        raise HTTPException(status_code=422, detail=str(exc))
    if dry_run:
        db.rollback()
        eredmeny["projekt_id"] = None
    else:
        log_audit(db, user, "projekt", eredmeny["projekt_id"], "excel_import", eredmeny["projekt_nev"])
        db.commit()
    eredmeny["dry_run"] = dry_run
    return eredmeny
