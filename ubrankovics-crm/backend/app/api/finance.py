from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.dependencies import get_current_user, require_roles
from app.models import Projekt, User, UserRole
from app.models_finance import (
    AlvallalkozoiSzamla,
    BankEgyenleg,
    Szerzodes,
    SzerzodesReszlet,
    TervezettBerkoltseg,
    Tig,
    UgyfelSzamla,
)
from app.schemas_finance import (
    AlvallalkozoiSzamlaCreate,
    AlvallalkozoiSzamlaResponse,
    AlvallalkozoiSzamlaUpdate,
    BankEgyenlegCreate,
    BankEgyenlegResponse,
    CashflowRollingResponse,
    SzerzodesCreate,
    SzerzodesReszletKiallitas,
    SzerzodesResponse,
    SzerzodesUpdate,
    TervezettBerkoltsegCreate,
    TervezettBerkoltsegResponse,
    TervezettBerkoltsegUpdate,
    TigCreate,
    TigResponse,
    TigUpdate,
    UgyfelSzamlaCreate,
    UgyfelSzamlaResponse,
    UgyfelSzamlaUpdate,
)
from app.services.afa import compute_afa
from app.services.cashflow import _bucket_start as cashflow_bucket_start
from app.services.cashflow import _next_bucket_start as cashflow_next_bucket_start
from app.services.cashflow import rolling_forecast

_PENZUGY = (UserRole.PENZUGY, UserRole.VEZETES)

projekt_router = APIRouter(prefix="/projektek/{projekt_id}", tags=["penzugy"])
router = APIRouter(tags=["penzugy"])


def _get_projekt_or_404(db: Session, projekt_id: int) -> Projekt:
    projekt = db.query(Projekt).get(projekt_id)
    if not projekt:
        raise HTTPException(status_code=404, detail="Projekt not found")
    return projekt


# --- TIG ----------------------------------------------------------------


@projekt_router.get("/tig", response_model=list[TigResponse])
def list_tig(projekt_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    _get_projekt_or_404(db, projekt_id)
    return (
        db.query(Tig)
        .options(joinedload(Tig.alvallalkozo))
        .filter(Tig.projekt_id == projekt_id)
        .order_by(Tig.datum.desc())
        .all()
    )


@projekt_router.post("/tig", response_model=TigResponse, status_code=201)
def create_tig(
    projekt_id: int,
    body: TigCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(*_PENZUGY)),
):
    _get_projekt_or_404(db, projekt_id)
    afa, brutto = compute_afa(Decimal(body.netto), body.afa_tipus)
    tig = Tig(projekt_id=projekt_id, afa=afa, brutto=brutto, **body.model_dump())
    db.add(tig)
    db.commit()
    db.refresh(tig)
    return tig


@projekt_router.patch("/tig/{tig_id}", response_model=TigResponse)
def update_tig(
    projekt_id: int,
    tig_id: int,
    body: TigUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(*_PENZUGY)),
):
    tig = db.query(Tig).filter(Tig.id == tig_id, Tig.projekt_id == projekt_id).first()
    if not tig:
        raise HTTPException(status_code=404, detail="TIG not found")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(tig, k, v)
    db.commit()
    db.refresh(tig)
    return tig


# --- Alvállalkozói számla -------------------------------------------------


@projekt_router.get("/alvallalkozoi-szamlak", response_model=list[AlvallalkozoiSzamlaResponse])
def list_alvallalkozoi_szamla(
    projekt_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)
):
    _get_projekt_or_404(db, projekt_id)
    return (
        db.query(AlvallalkozoiSzamla)
        .options(joinedload(AlvallalkozoiSzamla.alvallalkozo))
        .filter(AlvallalkozoiSzamla.projekt_id == projekt_id)
        .order_by(AlvallalkozoiSzamla.esedekesseg)
        .all()
    )


@projekt_router.post(
    "/alvallalkozoi-szamlak", response_model=AlvallalkozoiSzamlaResponse, status_code=201
)
def create_alvallalkozoi_szamla(
    projekt_id: int,
    body: AlvallalkozoiSzamlaCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(*_PENZUGY)),
):
    _get_projekt_or_404(db, projekt_id)
    afa, brutto = compute_afa(Decimal(body.netto), body.afa_tipus)
    szamla = AlvallalkozoiSzamla(projekt_id=projekt_id, afa=afa, brutto=brutto, **body.model_dump())
    db.add(szamla)
    db.commit()
    db.refresh(szamla)
    return szamla


@projekt_router.patch(
    "/alvallalkozoi-szamlak/{szamla_id}", response_model=AlvallalkozoiSzamlaResponse
)
def update_alvallalkozoi_szamla(
    projekt_id: int,
    szamla_id: int,
    body: AlvallalkozoiSzamlaUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(*_PENZUGY)),
):
    szamla = (
        db.query(AlvallalkozoiSzamla)
        .filter(AlvallalkozoiSzamla.id == szamla_id, AlvallalkozoiSzamla.projekt_id == projekt_id)
        .first()
    )
    if not szamla:
        raise HTTPException(status_code=404, detail="Alvállalkozói számla not found")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(szamla, k, v)
    db.commit()
    db.refresh(szamla)
    return szamla


# --- Szerződés + részletek -------------------------------------------------


@projekt_router.get("/szerzodesek", response_model=list[SzerzodesResponse])
def list_szerzodesek(projekt_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    _get_projekt_or_404(db, projekt_id)
    return (
        db.query(Szerzodes)
        .options(joinedload(Szerzodes.ugyfel), joinedload(Szerzodes.reszletek))
        .filter(Szerzodes.projekt_id == projekt_id)
        .order_by(Szerzodes.kezdes.desc())
        .all()
    )


@projekt_router.post("/szerzodesek", response_model=SzerzodesResponse, status_code=201)
def create_szerzodes(
    projekt_id: int,
    body: SzerzodesCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(*_PENZUGY)),
):
    _get_projekt_or_404(db, projekt_id)
    data = body.model_dump(exclude={"reszletek"})
    szerzodes = Szerzodes(projekt_id=projekt_id, **data)
    for reszlet in body.reszletek:
        szerzodes.reszletek.append(SzerzodesReszlet(**reszlet.model_dump()))
    db.add(szerzodes)
    db.commit()
    db.refresh(szerzodes)
    return szerzodes


@projekt_router.patch("/szerzodesek/{szerzodes_id}", response_model=SzerzodesResponse)
def update_szerzodes(
    projekt_id: int,
    szerzodes_id: int,
    body: SzerzodesUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(*_PENZUGY)),
):
    szerzodes = (
        db.query(Szerzodes)
        .filter(Szerzodes.id == szerzodes_id, Szerzodes.projekt_id == projekt_id)
        .first()
    )
    if not szerzodes:
        raise HTTPException(status_code=404, detail="Szerződés not found")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(szerzodes, k, v)
    db.commit()
    db.refresh(szerzodes)
    return szerzodes


@projekt_router.post(
    "/szerzodesek/{szerzodes_id}/reszletek/{reszlet_id}/szamla-kiallitas",
    response_model=UgyfelSzamlaResponse,
    status_code=201,
)
def kiallit_szamla_reszletbol(
    projekt_id: int,
    szerzodes_id: int,
    reszlet_id: int,
    body: SzerzodesReszletKiallitas,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(*_PENZUGY)),
):
    """A tervezett rétegben lévő ütemezett részletből tényleges ügyfél-
    számlát állít ki — a részlet ettől a ponttól a "tényleges" rétegbe kerül
    (lásd SzerzodesReszlet.kiallitott_szamla_id docstring)."""
    szerzodes = (
        db.query(Szerzodes)
        .filter(Szerzodes.id == szerzodes_id, Szerzodes.projekt_id == projekt_id)
        .first()
    )
    if not szerzodes:
        raise HTTPException(status_code=404, detail="Szerződés not found")
    reszlet = (
        db.query(SzerzodesReszlet)
        .filter(SzerzodesReszlet.id == reszlet_id, SzerzodesReszlet.szerzodes_id == szerzodes_id)
        .first()
    )
    if not reszlet:
        raise HTTPException(status_code=404, detail="Szerződés részlet not found")
    if reszlet.kiallitott_szamla_id is not None:
        raise HTTPException(status_code=400, detail="Ehhez a részlethez már van kiállított számla")

    afa, brutto = compute_afa(Decimal(reszlet.osszeg), szerzodes.afa_tipus)
    szamla = UgyfelSzamla(
        projekt_id=projekt_id,
        ugyfel_id=szerzodes.ugyfel_id,
        szerzodes_id=szerzodes_id,
        szamlaszam=body.szamlaszam,
        kiallitas_datum=body.kiallitas_datum,
        teljesites_datum=body.teljesites_datum,
        esedekesseg=body.esedekesseg,
        netto=reszlet.osszeg,
        afa_tipus=szerzodes.afa_tipus,
        afa=afa,
        brutto=brutto,
    )
    db.add(szamla)
    db.flush()
    reszlet.kiallitott_szamla_id = szamla.id
    db.commit()
    db.refresh(szamla)
    return szamla


# --- Ügyfél számla ----------------------------------------------------------


@projekt_router.get("/ugyfel-szamlak", response_model=list[UgyfelSzamlaResponse])
def list_ugyfel_szamla(projekt_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    _get_projekt_or_404(db, projekt_id)
    return (
        db.query(UgyfelSzamla)
        .options(joinedload(UgyfelSzamla.ugyfel))
        .filter(UgyfelSzamla.projekt_id == projekt_id)
        .order_by(UgyfelSzamla.esedekesseg)
        .all()
    )


@projekt_router.post("/ugyfel-szamlak", response_model=UgyfelSzamlaResponse, status_code=201)
def create_ugyfel_szamla(
    projekt_id: int,
    body: UgyfelSzamlaCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(*_PENZUGY)),
):
    _get_projekt_or_404(db, projekt_id)
    afa, brutto = compute_afa(Decimal(body.netto), body.afa_tipus)
    szamla = UgyfelSzamla(projekt_id=projekt_id, afa=afa, brutto=brutto, **body.model_dump())
    db.add(szamla)
    db.commit()
    db.refresh(szamla)
    return szamla


@projekt_router.patch("/ugyfel-szamlak/{szamla_id}", response_model=UgyfelSzamlaResponse)
def update_ugyfel_szamla(
    projekt_id: int,
    szamla_id: int,
    body: UgyfelSzamlaUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(*_PENZUGY)),
):
    szamla = (
        db.query(UgyfelSzamla)
        .filter(UgyfelSzamla.id == szamla_id, UgyfelSzamla.projekt_id == projekt_id)
        .first()
    )
    if not szamla:
        raise HTTPException(status_code=404, detail="Ügyfél számla not found")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(szamla, k, v)
    db.commit()
    db.refresh(szamla)
    return szamla


# --- Tervezett bérköltség (cégszintű) ---------------------------------------


@router.get("/berkoltsegek", response_model=list[TervezettBerkoltsegResponse])
def list_berkoltsegek(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return db.query(TervezettBerkoltseg).order_by(TervezettBerkoltseg.honap).all()


@router.post("/berkoltsegek", response_model=TervezettBerkoltsegResponse, status_code=201)
def create_berkoltseg(
    body: TervezettBerkoltsegCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(*_PENZUGY)),
):
    existing = db.query(TervezettBerkoltseg).filter(TervezettBerkoltseg.honap == body.honap).first()
    if existing:
        raise HTTPException(status_code=400, detail="Erre a hónapra már van rögzített bérköltség")
    b = TervezettBerkoltseg(**body.model_dump())
    db.add(b)
    db.commit()
    db.refresh(b)
    return b


@router.patch("/berkoltsegek/{berkoltseg_id}", response_model=TervezettBerkoltsegResponse)
def update_berkoltseg(
    berkoltseg_id: int,
    body: TervezettBerkoltsegUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(*_PENZUGY)),
):
    b = db.query(TervezettBerkoltseg).get(berkoltseg_id)
    if not b:
        raise HTTPException(status_code=404, detail="Bérköltség not found")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(b, k, v)
    db.commit()
    db.refresh(b)
    return b


# --- Bankegyenleg + gördülő cash-flow ---------------------------------------


@router.get("/cashflow/bankegyenleg", response_model=list[BankEgyenlegResponse])
def list_bankegyenleg(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return db.query(BankEgyenleg).order_by(BankEgyenleg.datum.desc()).all()


@router.post("/cashflow/bankegyenleg", response_model=BankEgyenlegResponse, status_code=201)
def create_bankegyenleg(
    body: BankEgyenlegCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(*_PENZUGY)),
):
    existing = db.query(BankEgyenleg).filter(BankEgyenleg.datum == body.datum).first()
    if existing:
        existing.egyenleg = body.egyenleg
        existing.rogzitette_id = user.id
        db.commit()
        db.refresh(existing)
        return existing
    snap = BankEgyenleg(datum=body.datum, egyenleg=body.egyenleg, rogzitette_id=user.id)
    db.add(snap)
    db.commit()
    db.refresh(snap)
    return snap


def _cashflow_idoszak(bucket: str, horizon: int, tol: date | None, ig: date | None) -> tuple[date | None, int]:
    """Megadott időszakból (tól–ig) kiszámolja a kezdő napot és a bucketek számát."""
    if bucket not in ("het", "honap"):
        raise HTTPException(status_code=400, detail="bucket csak 'het' vagy 'honap' lehet")
    if ig is not None:
        kezdo = tol or date.today()
        if ig < kezdo:
            raise HTTPException(status_code=400, detail="Az időszak vége nem lehet a kezdete előtt")
        start = cashflow_bucket_start(kezdo, bucket)
        horizon = 0
        while start <= ig:
            horizon += 1
            start = cashflow_next_bucket_start(start, bucket)
    if not 1 <= horizon <= 104:
        raise HTTPException(status_code=400, detail="Az időszak 1 és 104 bucket közé essen")
    return tol, horizon


@router.get("/cashflow/rolling", response_model=CashflowRollingResponse)
def get_rolling_cashflow(
    bucket: str = "het",
    horizon: int = 13,
    projekt_id: int | None = None,
    tol: date | None = None,
    ig: date | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    kezdo, horizon = _cashflow_idoszak(bucket, horizon, tol, ig)
    summaries, _item_lists, nyito_datum = rolling_forecast(
        db, bucket_meret=bucket, horizont=horizon, projekt_id=projekt_id, today=kezdo
    )
    return CashflowRollingResponse(
        bucket_meret=bucket, horizont=horizon, nyito_egyenleg_datuma=nyito_datum, bucketek=summaries
    )


@router.get("/cashflow/rolling/items")
def get_rolling_cashflow_items(
    bucket: str = "het",
    horizon: int = 13,
    projekt_id: int | None = None,
    kezdo_datum: date | None = None,
    tol: date | None = None,
    ig: date | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Drill-down: egy adott bucket (kezdo_datum alapján azonosítva) tételei."""
    kezdo, horizon = _cashflow_idoszak(bucket, horizon, tol, ig)
    summaries, item_lists, _nyito_datum = rolling_forecast(
        db, bucket_meret=bucket, horizont=horizon, projekt_id=projekt_id, today=kezdo
    )
    if kezdo_datum is None:
        return item_lists[0] if item_lists else []
    for summary, items in zip(summaries, item_lists):
        if summary.kezdo_datum == kezdo_datum:
            return items
    raise HTTPException(status_code=404, detail="Nincs ilyen kezdő dátumú bucket a horizonton")


@router.get("/projektek/{projekt_id}/penzmozgasok")
def projekt_penzmozgasok(
    projekt_id: int,
    irany: str | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Egy projekt bevételi és kiadási tételei egy listában (az elmúlt 12 hónaptól 24 hónapra előre),
    a Projekt › Bevétel / Kiadás fülek forrása. irany: 'bevetel' vagy 'kiadas', üresen mindkettő."""
    from datetime import timedelta

    if not db.query(Projekt).get(projekt_id):
        raise HTTPException(status_code=404, detail="Projekt not found")
    tol = date.today() - timedelta(days=365)
    _summ, listak, _nyito = rolling_forecast(db, bucket_meret="honap", horizont=36, projekt_id=projekt_id, today=tol)
    out = [i for lista in listak for i in lista]
    if irany:
        out = [i for i in out if str(getattr(i, "irany", "")).lower().startswith(irany[:4].lower())]
    return sorted(out, key=lambda i: i.esedekesseg)
