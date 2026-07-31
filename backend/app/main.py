import logging
from contextlib import asynccontextmanager

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import activity_templates, auth, dashboard, documents, gantt, notifications, photos, projects, search, tasks
from app.api import (
    crm_communications,
    crm_contracts,
    crm_customers,
    crm_dashboard,
    crm_documents,
    crm_quotes,
    crm_relations,
    crm_search,
    crm_tasks,
)
from app.config import settings
from app.core.security import hash_password
from app.database import SessionLocal
from app.models import User, UserRole
import app.models_crm  # noqa: F401 — register CRM models on Base.metadata
from app.services.notifications import send_daily_digest
from app.services.schedule_engine import seed_activity_templates

logger = logging.getLogger("planora.scheduler")


def seed_admin():
    import secrets as _secrets

    db = SessionLocal()
    try:
        seed_activity_templates(db)
        admin = db.query(User).filter(User.username == "admin").first()
        password = settings.admin_password
        if not admin:
            if not password:
                password = _secrets.token_urlsafe(16)
                logger.warning(
                    "ADMIN_PASSWORD not set — generated random admin password: %s  "
                    "(set ADMIN_PASSWORD in your environment to control this)",
                    password,
                )
            admin = User(
                username="admin",
                email="admin@planora.local",
                full_name="Rendszergazda",
                hashed_password=hash_password(password),
                role=UserRole.ADMIN,
            )
            db.add(admin)
            db.commit()
        elif password:
            admin.hashed_password = hash_password(password)
            db.commit()
            logger.info("Admin password updated from ADMIN_PASSWORD env var.")
    finally:
        db.close()


def run_daily_digest_job():
    db = SessionLocal()
    try:
        sent = send_daily_digest(db)
        logger.info("Daily digest run: emails sent/logged for %d users", sent)
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Schema is managed by Alembic migrations (run via the container entrypoint),
    # not by Base.metadata.create_all.
    seed_admin()
    # Created fresh per startup (not module-level) so it always binds to the
    # currently running event loop instead of a stale one from a prior run.
    scheduler = AsyncIOScheduler()
    scheduler.add_job(
        run_daily_digest_job,
        CronTrigger(hour=settings.daily_digest_hour, minute=settings.daily_digest_minute),
        id="daily_digest",
        replace_existing=True,
    )
    scheduler.start()
    yield
    scheduler.shutdown(wait=False)


app = FastAPI(title="PLANora API", version="1.0.0", lifespan=lifespan)

origins = [o.strip() for o in settings.cors_origins.split(",")]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api")
app.include_router(projects.router, prefix="/api")
app.include_router(tasks.router, prefix="/api")
app.include_router(dashboard.router, prefix="/api")
app.include_router(documents.router, prefix="/api")
app.include_router(photos.router, prefix="/api")
app.include_router(notifications.router, prefix="/api")
app.include_router(activity_templates.router, prefix="/api")
app.include_router(gantt.router, prefix="/api")
app.include_router(search.router, prefix="/api")
app.include_router(crm_customers.router, prefix="/api")
app.include_router(crm_relations.router, prefix="/api")
app.include_router(crm_quotes.router, prefix="/api")
app.include_router(crm_contracts.router, prefix="/api")
app.include_router(crm_communications.router, prefix="/api")
app.include_router(crm_tasks.router, prefix="/api")
app.include_router(crm_documents.router, prefix="/api")
app.include_router(crm_dashboard.router, prefix="/api")
app.include_router(crm_search.router, prefix="/api")


@app.get("/api/health")
def health():
    return {"status": "ok"}
