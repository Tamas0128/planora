"""One-off local-dev helper: generates 3 minimal docxtpl-compatible .docx
placeholder templates (TIG, ügyfél szerződés, alvállalkozói szerződés) so
the Dynamic Document Generator module can be exercised end-to-end before
real templates exist. Not part of the app runtime — run manually inside the
backend container once docxtpl/python-docx are installed:

    docker compose exec backend python scripts/create_placeholder_templates.py

Writes the .docx files to /tmp/placeholder-templates/ inside the container;
upload them through the admin "Dokumentumsablonok" page (catch-all
building_type = leave blank, is_delay_variant = false) to make the generator
usable for manual testing.
"""

import os

from docx import Document

OUT_DIR = "/tmp/placeholder-templates"


def _base_doc(title: str) -> Document:
    doc = Document()
    doc.add_heading(title, level=1)
    doc.add_paragraph("Projekt: {{ PROJEKT_NEV }} ({{ PROJEKT_ID }})")
    doc.add_paragraph("Helyrajzi szám: {{ HELYRAJZ_SZAM }}")
    doc.add_paragraph("Épülettípus: {{ EPULET_TIPUS }}")
    return doc


def build_tig_template() -> Document:
    doc = _base_doc("Teljesítésigazolás (placeholder)")
    doc.add_paragraph("Megrendelő: {{ UGYFEL_NEV }}")
    doc.add_paragraph("Alvállalkozó: {{ TIG_PARTNER_NEV }}")
    doc.add_paragraph("Dátum: {{ TIG_DATUM }}")
    doc.add_paragraph("Elszámolási időszak: {{ TIG_IDOSZAK_KEZDET }} - {{ TIG_IDOSZAK_VEGE }}")
    doc.add_paragraph("Nettó összeg: {{ TIG_OSSZEG_NETTO }} Ft")
    doc.add_paragraph("Bruttó összeg: {{ TIG_OSSZEG_BRUTTO }} Ft")
    doc.add_paragraph("Csúszás indoklása: {{ CSUSZAS_INDOKLAS }}")
    doc.add_heading("Elvégzett tevékenységek", level=2)
    doc.add_paragraph(
        "{% for a in TEVENYSEG_LISTA %}{{ a.name }} ({{ a.start_date }} - {{ a.end_date }}); "
        "{% endfor %}"
    )
    return doc


def build_client_contract_template() -> Document:
    doc = _base_doc("Ügyfél szerződés (placeholder)")
    doc.add_paragraph("Szerződésszám: {{ SZERZODES_SZAM }}")
    doc.add_paragraph("Időtartam: {{ SZERZODES_KEZDETE }} - {{ SZERZODES_VEGE }}")
    doc.add_paragraph("Szerződéses érték: {{ SZERZODES_ERTEK }} Ft")
    doc.add_heading("Megrendelő adatai", level=2)
    doc.add_paragraph("Név: {{ UGYFEL_NEV }}")
    doc.add_paragraph("Adószám: {{ UGYFEL_ADOSZAM }}")
    doc.add_paragraph("Cím: {{ UGYFEL_CIM }}")
    doc.add_paragraph("Telefon: {{ UGYFEL_TELEFON }}")
    doc.add_paragraph("Email: {{ UGYFEL_EMAIL }}")
    return doc


def build_subcontractor_contract_template() -> Document:
    doc = _base_doc("Alvállalkozói szerződés (placeholder)")
    doc.add_paragraph("Szerződésszám: {{ SZERZODES_SZAM }}")
    doc.add_paragraph("A szerződés tárgya: {{ SZERZODES_TARGYA }}")
    doc.add_paragraph("Időtartam: {{ SZERZODES_KEZDETE }} - {{ SZERZODES_VEGE }}")
    doc.add_paragraph("Szerződéses érték: {{ SZERZODES_ERTEK }} Ft")
    doc.add_heading("Alvállalkozó adatai", level=2)
    doc.add_paragraph("Név: {{ PARTNER_NEV }}")
    doc.add_paragraph("Adószám: {{ PARTNER_ADOSZAM }}")
    doc.add_paragraph("Cím: {{ PARTNER_CIM }}")
    return doc


def main() -> None:
    os.makedirs(OUT_DIR, exist_ok=True)
    build_tig_template().save(os.path.join(OUT_DIR, "tig_normal_placeholder.docx"))
    build_client_contract_template().save(os.path.join(OUT_DIR, "ugyfel_szerzodes_placeholder.docx"))
    build_subcontractor_contract_template().save(
        os.path.join(OUT_DIR, "alvallalkozoi_szerzodes_placeholder.docx")
    )
    print(f"Placeholder templates written to {OUT_DIR}")


if __name__ == "__main__":
    main()
