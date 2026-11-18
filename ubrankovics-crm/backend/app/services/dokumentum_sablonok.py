"""Öt dokumentum-sablon (ajánlatkérés / ajánlat / megrendelés / szerződés /
TIG) — a felhasználó döntése szerint ÚJ, a tétel/munkanem-alapú modellre
szabott sablonok, nem a planorából átvett .docx-ek. Egyszerű, e-mail testbe
is beilleszthető HTML-t generálnak (nincs docx/LibreOffice-függőség),
a kiválasztott ProjektTetel sorok adataiból.
"""

from datetime import date
from html import escape

from app.config import settings
from app.models import DokumentumSablonTipus, Projekt, ProjektTetel

_SZAKASZ_LABEL = {
    "ajanlat": "Ajánlat",
    "szerzodes": "Szerződés",
    "beszerzes": "Beszerzés",
    "kivitelezes": "Kivitelezés",
    "kesz": "Kész",
}


def _tetel_table_html(tetelek: list[ProjektTetel]) -> str:
    rows = []
    for t in tetelek:
        specs = escape("; ".join(f"{s.kulcs}: {s.ertek}" for s in t.specifikaciok) or "—")
        potmunka = f"Igen ({t.potmunka_osszeg} Ft)" if t.potmunka and t.potmunka_osszeg else ("Igen" if t.potmunka else "Nem")
        rows.append(
            f"<tr>"
            f"<td style='padding:6px 10px;border:1px solid #ddd'>{escape(t.munkanem.nev)}</td>"
            f"<td style='padding:6px 10px;border:1px solid #ddd'>{escape(t.info or '—')}</td>"
            f"<td style='padding:6px 10px;border:1px solid #ddd'>{specs}</td>"
            f"<td style='padding:6px 10px;border:1px solid #ddd'>{potmunka}</td>"
            f"</tr>"
        )
    return (
        "<table style='border-collapse:collapse;width:100%;font-size:14px'>"
        "<thead><tr>"
        "<th style='padding:6px 10px;border:1px solid #ddd;text-align:left;background:#f3f1ea'>Munkanem</th>"
        "<th style='padding:6px 10px;border:1px solid #ddd;text-align:left;background:#f3f1ea'>Info</th>"
        "<th style='padding:6px 10px;border:1px solid #ddd;text-align:left;background:#f3f1ea'>Specifikáció</th>"
        "<th style='padding:6px 10px;border:1px solid #ddd;text-align:left;background:#f3f1ea'>Pótmunka</th>"
        "</tr></thead><tbody>" + "".join(rows) + "</tbody></table>"
    )


def _wrap(projekt: Projekt, cim: str, body_html: str) -> str:
    return (
        "<div style='font-family:Georgia,serif;color:#2b271f;max-width:700px'>"
        f"<h2 style='color:#485737'>{escape(settings.cegnev)}</h2>"
        f"<h3>{escape(cim)}</h3>"
        f"<p style='color:#6b6049'>Projekt: <strong>{escape(projekt.projekt_nev)}</strong>"
        f"{' · HRSZ: ' + escape(projekt.hrsz) if projekt.hrsz else ''} · Kelt: {date.today().isoformat()}</p>"
        f"{body_html}"
        "<p style='color:#6b6049;margin-top:24px'>Üdvözlettel,<br/>" + escape(settings.cegnev) + "</p>"
        "</div>"
    )


def render_ajanlatkeres(projekt: Projekt, tetelek: list[ProjektTetel], uzenet: str | None) -> tuple[str, str]:
    subject = f"Ajánlatkérés — {projekt.projekt_nev}"
    body = (
        "<p>Tisztelt Partnerünk! Az alábbi munkanemekre kérünk árajánlatot, "
        "kivitelezési időtartammal és anyagköltséggel együtt:</p>"
        + _tetel_table_html(tetelek)
        + (f"<p>{escape(uzenet)}</p>" if uzenet else "")
        + "<p>Kérjük, ajánlatát a visszaigazolt határidőre szíveskedjen megküldeni.</p>"
    )
    return subject, _wrap(projekt, "Ajánlatkérés", body)


def render_ajanlat(projekt: Projekt, tetelek: list[ProjektTetel], uzenet: str | None) -> tuple[str, str]:
    subject = f"Ajánlat — {projekt.projekt_nev}"
    body = (
        "<p>Tisztelt Ügyfelünk! Az alábbi munkanemekre adjuk ajánlatunkat:</p>"
        + _tetel_table_html(tetelek)
        + (f"<p>{escape(uzenet)}</p>" if uzenet else "")
        + "<p>Az ajánlat elfogadását írásban (e-mailben) kérjük visszaigazolni.</p>"
    )
    return subject, _wrap(projekt, "Ajánlat", body)


def render_megrendeles(projekt: Projekt, tetelek: list[ProjektTetel], uzenet: str | None) -> tuple[str, str]:
    subject = f"Megrendelés — {projekt.projekt_nev}"
    rendeles_rows = []
    for t in tetelek:
        for r in t.rendelesek:
            osszeg = f"{r.osszeg} Ft" if r.osszeg else "—"
            mennyiseg = escape(f"{r.mennyiseg} {r.mertekegyseg or ''}".strip()) if r.mennyiseg else "—"
            rendeles_rows.append(
                f"<tr><td style='padding:6px 10px;border:1px solid #ddd'>{escape(t.munkanem.nev)}</td>"
                f"<td style='padding:6px 10px;border:1px solid #ddd'>{escape(r.megnevezes)}</td>"
                f"<td style='padding:6px 10px;border:1px solid #ddd'>{mennyiseg}</td>"
                f"<td style='padding:6px 10px;border:1px solid #ddd'>{osszeg}</td></tr>"
            )
    rendeles_table = (
        "<table style='border-collapse:collapse;width:100%;font-size:14px;margin-top:12px'>"
        "<thead><tr>"
        "<th style='padding:6px 10px;border:1px solid #ddd;text-align:left;background:#f3f1ea'>Munkanem</th>"
        "<th style='padding:6px 10px;border:1px solid #ddd;text-align:left;background:#f3f1ea'>Megnevezés</th>"
        "<th style='padding:6px 10px;border:1px solid #ddd;text-align:left;background:#f3f1ea'>Mennyiség</th>"
        "<th style='padding:6px 10px;border:1px solid #ddd;text-align:left;background:#f3f1ea'>Összeg</th>"
        "</tr></thead><tbody>" + ("".join(rendeles_rows) or "<tr><td colspan=4 style='padding:6px 10px'>Nincs rögzített tétel.</td></tr>") + "</tbody></table>"
    )
    body = (
        "<p>Az alábbi tételeket rendeljük meg:</p>"
        + rendeles_table
        + (f"<p>{escape(uzenet)}</p>" if uzenet else "")
        + "<p>Kérjük a megrendelés visszaigazolását a várható szállítási/elvégzési határidővel.</p>"
    )
    return subject, _wrap(projekt, "Megrendelés", body)


def render_szerzodes(projekt: Projekt, tetelek: list[ProjektTetel], uzenet: str | None) -> tuple[str, str]:
    subject = f"Szerződés — {projekt.projekt_nev}"
    osszeg_sum = sum((t.potmunka_osszeg or 0) for t in tetelek)
    body = (
        "<p>A Felek az alábbi munkanemek elvégzésében állapodnak meg:</p>"
        + _tetel_table_html(tetelek)
        + (f"<p>Tételek pótmunka-összege összesen: <strong>{osszeg_sum} Ft</strong></p>" if osszeg_sum else "")
        + (f"<p>{escape(uzenet)}</p>" if uzenet else "")
        + "<p style='margin-top:32px'>Kelt, aláírás helye:</p>"
        + "<table style='width:100%;margin-top:40px'><tr>"
        + "<td style='width:50%'>_____________________<br/>Megrendelő</td>"
        + "<td style='width:50%'>_____________________<br/>" + escape(settings.cegnev) + "</td>"
        + "</tr></table>"
    )
    return subject, _wrap(projekt, "Szerződés", body)


def render_tig(projekt: Projekt, tetelek: list[ProjektTetel], uzenet: str | None) -> tuple[str, str]:
    subject = f"Teljesítésigazolás (TIG) — {projekt.projekt_nev}"
    rows = []
    for t in tetelek:
        kesz_datum = t.tenyleges_befejezes or t.end_date or "—"
        rows.append(
            f"<tr><td style='padding:6px 10px;border:1px solid #ddd'>{escape(t.munkanem.nev)}</td>"
            f"<td style='padding:6px 10px;border:1px solid #ddd'>{_SZAKASZ_LABEL.get(t.szakasz.value, t.szakasz.value)}</td>"
            f"<td style='padding:6px 10px;border:1px solid #ddd'>{kesz_datum}</td></tr>"
        )
    table = (
        "<table style='border-collapse:collapse;width:100%;font-size:14px'>"
        "<thead><tr>"
        "<th style='padding:6px 10px;border:1px solid #ddd;text-align:left;background:#f3f1ea'>Munkanem</th>"
        "<th style='padding:6px 10px;border:1px solid #ddd;text-align:left;background:#f3f1ea'>Szakasz</th>"
        "<th style='padding:6px 10px;border:1px solid #ddd;text-align:left;background:#f3f1ea'>Elkészülés dátuma</th>"
        "</tr></thead><tbody>" + "".join(rows) + "</tbody></table>"
    )
    body = (
        "<p>Igazoljuk, hogy az alábbi munkanemek a megjelölt dátumra elkészültek, "
        "és a teljesítést a Felek elfogadják:</p>"
        + table
        + (f"<p>{escape(uzenet)}</p>" if uzenet else "")
        + "<table style='width:100%;margin-top:40px'><tr>"
        + "<td style='width:50%'>_____________________<br/>Megrendelő</td>"
        + "<td style='width:50%'>_____________________<br/>" + escape(settings.cegnev) + "</td>"
        + "</tr></table>"
    )
    return subject, _wrap(projekt, "Teljesítésigazolás", body)


_RENDERERS = {
    DokumentumSablonTipus.AJANLATKERES: render_ajanlatkeres,
    DokumentumSablonTipus.AJANLAT: render_ajanlat,
    DokumentumSablonTipus.MEGRENDELES: render_megrendeles,
    DokumentumSablonTipus.SZERZODES: render_szerzodes,
    DokumentumSablonTipus.TIG: render_tig,
}


def render_sablon(
    tipus: DokumentumSablonTipus, projekt: Projekt, tetelek: list[ProjektTetel], uzenet: str | None = None
) -> tuple[str, str]:
    return _RENDERERS[tipus](projekt, tetelek, uzenet)
