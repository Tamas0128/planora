import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import (
    atvetel,
    audit,
    auth,
    cimkek,
    egyedi_mezok,
    elorejelzes,
    fiok,
    jegyek,
    leiratkozas,
    bankkivonat,
    dokumentumok,
    dokumentumok_email,
    erdeklodok,
    ertesitesek,
    kommunikacio,
    ugyfel_adatok,
    feladatok,
    finance,
    gantt,
    kereses,
    naplo,
    naptar,
    vevoi_ajanlat,
    projektek,
    riportok,
    tetelek,
    tipusok,
    torzsadatok,
    ugyfelek,
)
from app.config import settings
from app.database import SessionLocal
from app import models_finance  # noqa: F401 — register finance models on Base.metadata
from app import models_ext  # noqa: F401 — register CRM extension models
from app import models_projekt  # noqa: F401 — register project lifecycle models
from app import models_auth  # noqa: F401 — register auth models
from app.services.ertesitesek import digest_utemezo
from app.services.seed import (
    seed_admin,
    seed_munkanemek,
    seed_projekt_tipus_tetelek,
    seed_projekt_tipusok,
    seed_szemelyek,
    seed_torzsadatok,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Schema is managed by Alembic migrations (run via the container entrypoint),
    # not by Base.metadata.create_all.
    db = SessionLocal()
    try:
        seed_admin(db)
        seed_munkanemek(db)
        seed_torzsadatok(db)
        seed_szemelyek(db)
        seed_projekt_tipusok(db)
        seed_projekt_tipus_tetelek(db)
    finally:
        db.close()
    digest_task = asyncio.create_task(digest_utemezo(SessionLocal))
    try:
        yield
    finally:
        digest_task.cancel()


app = FastAPI(title="Ubrankovics CRM API", version="0.1.0", lifespan=lifespan)

origins = [o.strip() for o in settings.cors_origins.split(",")]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api")
app.include_router(fiok.router, prefix="/api")
app.include_router(ugyfel_adatok.router, prefix="/api")  # /ugyfelek/{id} elé kell
app.include_router(ugyfelek.router, prefix="/api")
app.include_router(projektek.router, prefix="/api")
app.include_router(tetelek.router, prefix="/api")
app.include_router(torzsadatok.router, prefix="/api")
app.include_router(tipusok.router, prefix="/api")
app.include_router(dokumentumok.router, prefix="/api")
app.include_router(dokumentumok_email.router, prefix="/api")
app.include_router(gantt.router, prefix="/api")
app.include_router(finance.projekt_router, prefix="/api")
app.include_router(finance.router, prefix="/api")
app.include_router(feladatok.router, prefix="/api")
app.include_router(riportok.router, prefix="/api")
app.include_router(kereses.router, prefix="/api")
app.include_router(bankkivonat.router, prefix="/api")
app.include_router(erdeklodok.router, prefix="/api")
app.include_router(kommunikacio.router, prefix="/api")
app.include_router(ertesitesek.router, prefix="/api")
app.include_router(audit.router, prefix="/api")
app.include_router(cimkek.router, prefix="/api")
app.include_router(egyedi_mezok.router, prefix="/api")
app.include_router(jegyek.router, prefix="/api")
app.include_router(leiratkozas.router, prefix="/api")
app.include_router(elorejelzes.router, prefix="/api")
app.include_router(atvetel.router, prefix="/api")
app.include_router(naplo.router, prefix="/api")
app.include_router(naptar.router, prefix="/api")
app.include_router(vevoi_ajanlat.router, prefix="/api")


@app.get("/api/health")
def health():
    return {"status": "ok"}
