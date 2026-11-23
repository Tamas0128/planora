"""Cím → koordináta feloldás az OpenStreetMap Nominatim szolgáltatással.

Csak a felhasználó kifejezett kérésére hívjuk (térkép nézet „Címek feloldása" gomb, vagy a
projekt oldalán), mert a cím külső szolgáltatónak kerül elküldésre. Hiba esetén None.
"""

import logging

import httpx

logger = logging.getLogger("ubrankovics.geocoding")

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"


def geocode_address(address: str) -> tuple[float, float] | None:
    try:
        resp = httpx.get(
            NOMINATIM_URL,
            params={"q": f"{address}, Magyarország", "format": "json", "limit": 1},
            headers={"User-Agent": "UbrankovicsCRM/1.0 (project map)"},
            timeout=6.0,
        )
        resp.raise_for_status()
        results = resp.json()
        if not results:
            return None
        return float(results[0]["lat"]), float(results[0]["lon"])
    except Exception:
        logger.info("Geocoding failed for %r", address, exc_info=True)
        return None
