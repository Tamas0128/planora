"""Feltöltött .docx sablonok kitöltése (docxtpl / Jinja2 szintaxis: {{ projekt_nev }})."""

import io
from datetime import date

from docxtpl import DocxTemplate

from app.config import settings
from app.models import Projekt, ProjektTetel

# A felületen is megjelenő változólista: név → leírás.
VALTOZOK: list[tuple[str, str]] = [
    ("cegnev", "A cég neve"),
    ("datum", "Mai dátum (ÉÉÉÉ-HH-NN)"),
    ("projekt_nev", "A projekt neve"),
    ("hrsz", "Helyrajzi szám"),
    ("enaplo_iktatoszam", "E-napló iktatószám"),
    ("ugyfel_nev", "A projekt első ügyfelének neve"),
    ("ugyfel_telefon", "Az ügyfél telefonszáma"),
    ("ugyfel_email", "Az ügyfél e-mail címe"),
    ("epitesi_cim", "Az építés helyszíne"),
    ("uzenet", "A generáláskor megadott kiegészítő üzenet"),
    ("tetel_darab", "A kiválasztott tételek száma"),
    ("tetelek", "Tételek listája: ciklus {% for t in tetelek %} … {% endfor %}"),
    ("t.munkanem", "Tétel: munkanem neve"),
    ("t.info", "Tétel: info"),
    ("t.specifikacio", "Tétel: specifikációk (kulcs: érték; …)"),
    ("t.potmunka", "Tétel: pótmunka (Igen/Nem)"),
    ("t.potmunka_osszeg", "Tétel: pótmunka összege"),
    ("t.tig", "Tétel: TIG szám"),
    ("t.kezdes / t.befejezes", "Tétel: ütemezett kezdés / befejezés"),
]


def build_context(projekt: Projekt, tetelek: list[ProjektTetel], uzenet: str | None) -> dict:
    link = projekt.ugyfel_linkek[0] if projekt.ugyfel_linkek else None
    ugyfel = link.ugyfel if link else None
    return {
        "cegnev": settings.cegnev,
        "datum": date.today().isoformat(),
        "projekt_nev": projekt.projekt_nev,
        "hrsz": projekt.hrsz or "",
        "enaplo_iktatoszam": projekt.enaplo_iktatoszam or "",
        "ugyfel_nev": ugyfel.nev if ugyfel else "",
        "ugyfel_telefon": (ugyfel.telefon or "") if ugyfel else "",
        "ugyfel_email": (ugyfel.email or "") if ugyfel else "",
        "epitesi_cim": (link.epitesi_cim or "") if link else "",
        "uzenet": uzenet or "",
        "tetel_darab": len(tetelek),
        "tetelek": [
            {
                "munkanem": t.munkanem.nev if t.munkanem else "",
                "info": t.info or "",
                "specifikacio": "; ".join(f"{s.kulcs}: {s.ertek}" for s in t.specifikaciok),
                "potmunka": "Igen" if t.potmunka else "Nem",
                "potmunka_osszeg": str(t.potmunka_osszeg) if t.potmunka_osszeg is not None else "",
                "tig": t.tig or "",
                "kezdes": t.start_date.isoformat() if t.start_date else "",
                "befejezes": t.end_date.isoformat() if t.end_date else "",
            }
            for t in tetelek
        ],
    }


MINTA_CONTEXT = {
    "cegnev": "Minta Kft.",
    "datum": "2026-01-01",
    "projekt_nev": "Minta projekt",
    "hrsz": "1234/5",
    "enaplo_iktatoszam": "",
    "ugyfel_nev": "Minta Ügyfél",
    "ugyfel_telefon": "",
    "ugyfel_email": "",
    "epitesi_cim": "",
    "uzenet": "",
    "tetel_darab": 1,
    "tetelek": [
        {"munkanem": "Alapozás", "info": "", "specifikacio": "", "potmunka": "Nem", "potmunka_osszeg": "", "tig": "", "kezdes": "", "befejezes": ""}
    ],
}


def render_docx(source, context: dict) -> bytes:
    """A source fájlútvonal vagy bájtok; sablonhibánál kivételt dob (a hívó 400-ra fordítja)."""
    tpl = DocxTemplate(io.BytesIO(source) if isinstance(source, (bytes, bytearray)) else source)
    tpl.render(context)
    out = io.BytesIO()
    tpl.save(out)
    return out.getvalue()
