import logging

import httpx

from app.config import settings

logger = logging.getLogger("planora.geocoding")

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"


def geocode_address(settlement: str, address: str) -> tuple[float, float] | None:
    """Best-effort free-text geocoding via OpenStreetMap's Nominatim.

    Returns None on any failure (network error, no match, disabled) — callers
    treat a project without coordinates as simply not shown on the map view,
    never as an error.
    """
    if not settings.geocoding_enabled:
        return None
    try:
        resp = httpx.get(
            NOMINATIM_URL,
            params={"q": f"{address}, {settlement}, Magyarország", "format": "json", "limit": 1},
            headers={"User-Agent": "PLANora/1.0 (construction project scheduler)"},
            timeout=5.0,
        )
        resp.raise_for_status()
        results = resp.json()
        if not results:
            return None
        return float(results[0]["lat"]), float(results[0]["lon"])
    except Exception:
        logger.info("Geocoding failed for %r, %r", address, settlement, exc_info=True)
        return None


def geocode_project_in_background(project_id: int, settlement: str, address: str) -> None:
    coords = geocode_address(settlement, address)
    if not coords:
        return
    from app.database import SessionLocal
    from app.models import Project

    db = SessionLocal()
    try:
        project = db.query(Project).get(project_id)
        # Only fill in coordinates the user hasn't already set/edited in the
        # meantime — never overwrite a manually corrected pin.
        if project and project.latitude is None and project.longitude is None:
            project.latitude, project.longitude = coords
            db.commit()
    finally:
        db.close()
