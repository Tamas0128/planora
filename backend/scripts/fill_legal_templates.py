"""One-off: turns the real legal .docx templates (blank underscore fields)
into docxtpl-ready templates by replacing each fillable blank with a
{{ MERGE_FIELD }} tag matching services/document_generation.py's context
builders. Run once against the raw files, output goes to a separate dir —
never overwrites the originals.

    docker compose exec backend python scripts/fill_legal_templates.py

Blanks with no backing data model field (payment-milestone table, kötbér
percentages, előleg, TIG módosítás/törlés indoklás + eredeti TIG azonosító,
real signature lines) are deliberately left untouched for manual completion —
see the session notes for the full list.
"""

import glob
import os
import re

from docx import Document
from docx.text.paragraph import Paragraph

IN_DIR = "/app/tmp_templates_inspect"
OUT_DIR = "/app/tmp_templates_filled"

_BLANK_RE = re.compile(r"_{3,}")


def _fill_blank_in_paragraph(paragraph: Paragraph, tag: str) -> bool:
    """Word often splits "Label: ____" across two runs (label run, then a
    separately-formatted underscore run) — find whichever run in this
    paragraph actually contains the underscore blank and replace just that
    substring, leaving the label (and any signature blanks later in the
    same paragraph) untouched. Only the first underscore run is touched.
    """
    for run in paragraph.runs:
        if _BLANK_RE.search(run.text):
            run.text = _BLANK_RE.sub(tag, run.text, count=1)
            return True
    return False


# --- Client contract (Jogaszi_Ugyfel_Epitesi_Szerzodes_*) -----------------
CLIENT_CONTRACT_LABELS = [
    ("Megrendelő neve:", "MEGRENDELO", "CEGNEV"),
    ("Székhelye / lakcíme:", None, "SZEKHELY"),
    ("Cégjegyzékszám:", None, "CEGJEGYZEKSZAM"),
    ("Adószám:", None, "ADOSZAM"),
    ("Bankszámlaszám:", None, "BANKSZAMLASZAM"),
    ("Képviselő:", None, "KEPVISELO_NEV"),
    ("Vállalkozó neve:", "VALLALKOZO", "CEGNEV"),
    ("Székhelye:", None, "SZEKHELY"),
    ("Cégjegyzékszám:", None, "CEGJEGYZEKSZAM"),
    ("Adószám:", None, "ADOSZAM"),
    ("Bankszámlaszám:", None, "BANKSZAMLASZAM"),
    ("Képviselő:", None, "KEPVISELO_NEV"),
]

# --- Subcontractor contract (Jogaszi_Alvallalkozoi_Szerzodes_*) -----------
SUBCONTRACTOR_CONTRACT_LABELS = [
    ("Fővállalkozó neve:", "MEGRENDELO", "CEGNEV"),
    ("Székhelye:", None, "SZEKHELY"),
    ("Adószáma:", None, "ADOSZAM"),
    ("Képviselője:", None, "KEPVISELO_NEV"),
    ("Alvállalkozó neve:", "ALVALLALKOZO", "CEGNEV"),
    ("Székhelye:", None, "SZEKHELY"),
    ("Adószáma:", None, "ADOSZAM"),
    ("Képviselője:", None, "KEPVISELO_NEV"),
]

TIG_COMMON = [
    ("Projekt neve", "{{ PROJEKT_NEV }}"),
    ("Projekt azonosító", "{{ PROJEKT_ID }}"),
    ("Szerződés száma", "{{ KAPCSOLODO_SZERZODES_SZAM }}"),
    ("Megrendelő", "{{ UGYFEL_NEV }}"),
    ("Vállalkozó / Alvállalkozó", "{{ TIG_PARTNER_NEV }}"),
    ("Teljesítési időszak", "{{ TIG_IDOSZAK_KEZDET }} – {{ TIG_IDOSZAK_VEGE }}"),
    ("Teljesítés dátuma", "{{ TELJESITES_DATUMA }}"),
    ("Kapcsolódó számla", "{{ KAPCSOLODO_SZAMLA_SZAM }}"),
    ("Igazolt összeg", "{{ TIG_OSSZEG_NETTO }} Ft nettó / {{ TIG_OSSZEG_BRUTTO }} Ft bruttó"),
    ("Megjegyzés", "{{ TIG_MEGJEGYZES }}"),
]


def _fill_party_blocks(doc: Document, label_sequence: list[tuple[str, str | None, str]]) -> None:
    seq = iter(label_sequence)
    label, prefix, suffix = next(seq)
    active_prefix = prefix
    for p in doc.paragraphs:
        head = p.text.split(":", 1)[0].strip() + ":"
        if head == label:
            if prefix:
                active_prefix = prefix
            tag = "{{ %s_%s }}" % (active_prefix, suffix)
            _fill_blank_in_paragraph(p, tag)
            nxt = next(seq, None)
            if nxt is None:
                break
            label, prefix, suffix = nxt


def _replace_run_substring(doc: Document, old: str, new: str) -> int:
    count = 0
    for p in doc.paragraphs:
        for run in p.runs:
            if old in run.text:
                run.text = run.text.replace(old, new)
                count += 1
    return count


def fill_client_contract(path: str, out_path: str) -> None:
    doc = Document(path)
    _fill_party_blocks(doc, CLIENT_CONTRACT_LABELS)
    is_eur = "EUR" in path
    money_old = "__________________ EUR." if is_eur else "__________________ Ft + ÁFA."
    money_new = "{{ SZERZODES_ERTEK_NETTO }} EUR." if is_eur else "{{ SZERZODES_ERTEK_NETTO }} Ft + ÁFA."
    _replace_run_substring(doc, money_old, money_new)
    _replace_run_substring(doc, "Kelt: __________________", "Kelt: {{ SZERZODES_KELTE }}")
    doc.save(out_path)


def fill_subcontractor_contract(path: str, out_path: str) -> None:
    doc = Document(path)
    _fill_party_blocks(doc, SUBCONTRACTOR_CONTRACT_LABELS)
    for p in doc.paragraphs:
        if p.text.startswith("Projekt megnevezése:"):
            _fill_blank_in_paragraph(p, "{{ PROJEKT_NEV }}")
        elif p.text.startswith("Projekt azonosító:"):
            _fill_blank_in_paragraph(p, "{{ PROJEKT_ID }}")
    is_eur = "EUR" in path
    money_old = "__________________ EUR." if is_eur else "__________________ Ft + ÁFA."
    money_new = "{{ SZERZODES_ERTEK_NETTO }} EUR." if is_eur else "{{ SZERZODES_ERTEK_NETTO }} Ft + ÁFA."
    _replace_run_substring(doc, money_old, money_new)
    _replace_run_substring(doc, "Kelt: __________________", "Kelt: {{ SZERZODES_KELTE }}")
    doc.save(out_path)


def fill_tig(path: str, out_path: str) -> None:
    doc = Document(path)
    for p in doc.paragraphs:
        for label, tag in TIG_COMMON:
            if p.text.startswith(label) and _BLANK_RE.search(p.text):
                _fill_blank_in_paragraph(p, tag)
                break
    if "elektronikus" in path:
        _replace_run_substring(doc, "Jóváhagyó neve: __________________", "Jóváhagyó neve: {{ GENERALO_NEV }}")
        _replace_run_substring(doc, "E-mail: __________________", "E-mail: {{ GENERALO_EMAIL }}")
    doc.save(out_path)


def main() -> None:
    os.makedirs(OUT_DIR, exist_ok=True)
    for path in sorted(glob.glob(f"{IN_DIR}/Jogaszi_Ugyfel_*.docx")):
        out = os.path.join(OUT_DIR, os.path.basename(path))
        fill_client_contract(path, out)
        print("client contract:", out)
    for path in sorted(glob.glob(f"{IN_DIR}/Jogaszi_Alvallalkozoi_*.docx")):
        out = os.path.join(OUT_DIR, os.path.basename(path))
        fill_subcontractor_contract(path, out)
        print("subcontractor contract:", out)
    for path in sorted(glob.glob(f"{IN_DIR}/TIG_*.docx")):
        out = os.path.join(OUT_DIR, os.path.basename(path))
        fill_tig(path, out)
        print("tig:", out)


if __name__ == "__main__":
    main()
