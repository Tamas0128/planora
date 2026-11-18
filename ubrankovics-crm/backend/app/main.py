from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import auth, projektek, tetelek, torzsadatok, ugyfelek
from app.config import settings
from app.database import SessionLocal
from app.services.seed import seed_admin, seed_munkanemek, seed_szemelyek, seed_torzsadatok


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
    finally:
        db.close()
    yield


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
app.include_router(ugyfelek.router, prefix="/api")
app.include_router(projektek.router, prefix="/api")
app.include_router(tetelek.router, prefix="/api")
app.include_router(torzsadatok.router, prefix="/api")


@app.get("/api/health")
def health():
    return {"status": "ok"}
