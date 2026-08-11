import os
import subprocess
import tempfile
from datetime import date
from decimal import Decimal
from io import BytesIO

from docxtpl import DocxTemplate

from app.models import BUILDING_TYPE_LABELS, Project
from app.models_crm import Contract, ContractStatus, Customer
from app.models_finance import (
    OwnCompany,
    Partner,
    SUBCONTRACTOR_CONTRACT_STATUS_LABELS,
    SubcontractorContract,
    TIG_STATUS_LABELS,
    Tig,
    VatType,
)
from app.services.finance import compute_gross

CONTRACT_STATUS_LABELS = {
    ContractStatus.DRAFT: "Tervezet",
    ContractStatus.ACTIVE: "Aktív",
    ContractStatus.EXPIRED: "Lejárt",
    ContractStatus.TERMINATED: "Felmondott",
    ContractStatus.ARCHIVED: "Archivált",
}


class PdfConversionError(Exception):
    """Raised when the LibreOffice headless conversion fails or times out."""


def _fmt_date(value: date | None) -> str:
    return value.strftime("%Y.%m.%d.") if value else ""


def _fmt_money(value: Decimal | None) -> str:
    return str(value) if value is not None else ""


def _sum_optional(*values: Decimal | None) -> Decimal | None:
    """None if every value is None (so an all-empty contract prints a blank
    merge field rather than "0"), otherwise the sum treating None as 0.
    """
    present = [v for v in values if v is not None]
    return sum(present, Decimal("0")) if present else None


def _project_fields(project: Project | None) -> dict:
    if project is None:
        return {
            "PROJEKT_NEV": "",
            "PROJEKT_ID": "",
            "HELYRAJZ_SZAM": "",
            "EPULET_TIPUS": "",
        }
    return {
        "PROJEKT_NEV": project.name,
        "PROJEKT_ID": project.project_code,
        "HELYRAJZ_SZAM": project.lot_number or "",
        "EPULET_TIPUS": BUILDING_TYPE_LABELS.get(project.building_type, ""),
    }


def _company_header_fields(
    prefix: str,
    *,
    name: str | None = None,
    szekhely: str | None = None,
    levelezesi_cim: str | None = None,
    adoszam: str | None = None,
    cegjegyzekszam: str | None = None,
    bankszamlaszam: str | None = None,
    kepviselo_nev: str | None = None,
    kepviselo_beosztas: str | None = None,
    kapcsolattarto_nev: str | None = None,
    kapcsolattarto_email: str | None = None,
    kapcsolattarto_telefon: str | None = None,
) -> dict:
    """The 11-field company-header merge-field shape shared by every party
    that can appear on a document (OwnCompany/Customer/Partner) — kept as
    one implementation so all three document families expose the same
    field set for a given role, rather than each context builder hand-
    rolling its own subset. Callers extract the source object's attributes
    themselves (OwnCompany/Customer/Partner don't share attribute names —
    e.g. registered_address vs billing_address, contact_email vs email —
    so there's nothing to duck-type here); calling with no kwargs at all
    returns an all-blank block for a missing/unlinked party.
    """
    return {
        f"{prefix}_CEGNEV": name or "",
        f"{prefix}_SZEKHELY": szekhely or "",
        f"{prefix}_LEVELEZESI_CIM": levelezesi_cim or "",
        f"{prefix}_ADOSZAM": adoszam or "",
        f"{prefix}_CEGJEGYZEKSZAM": cegjegyzekszam or "",
        f"{prefix}_BANKSZAMLASZAM": bankszamlaszam or "",
        f"{prefix}_KEPVISELO_NEV": kepviselo_nev or "",
        f"{prefix}_KEPVISELO_BEOSZTAS": kepviselo_beosztas or "",
        f"{prefix}_KAPCSOLATTARTO_NEV": kapcsolattarto_nev or "",
        f"{prefix}_KAPCSOLATTARTO_EMAIL": kapcsolattarto_email or "",
        f"{prefix}_KAPCSOLATTARTO_TELEFON": kapcsolattarto_telefon or "",
    }


def _own_company_fields(prefix: str, own_company: OwnCompany | None) -> dict:
    if own_company is None:
        return _company_header_fields(prefix)
    return _company_header_fields(
        prefix,
        name=own_company.name,
        szekhely=own_company.registered_address,
        levelezesi_cim=own_company.mailing_address,
        adoszam=own_company.tax_number,
        cegjegyzekszam=own_company.company_registry_number,
        bankszamlaszam=own_company.bank_account_number,
        kepviselo_nev=own_company.representative_name,
        kepviselo_beosztas=own_company.representative_title,
        kapcsolattarto_nev=own_company.contact_name,
        kapcsolattarto_email=own_company.contact_email,
        kapcsolattarto_telefon=own_company.contact_phone,
    )


def _customer_fields(prefix: str, customer: Customer | None) -> dict:
    if customer is None:
        return _company_header_fields(prefix)
    return _company_header_fields(
        prefix,
        name=customer.name,
        szekhely=customer.billing_address,
        levelezesi_cim=customer.mailing_address,
        adoszam=customer.tax_number,
        cegjegyzekszam=customer.company_registry_number,
        bankszamlaszam=customer.bank_account_number,
        kepviselo_nev=customer.representative_name,
        kepviselo_beosztas=customer.representative_title,
        kapcsolattarto_nev=customer.contact_name,
        # Customer has no dedicated contact_email/contact_phone columns —
        # its own email/phone ARE the contact person's, same convention as
        # Partner (see models_finance.py's Partner.phone/email comment).
        kapcsolattarto_email=customer.email,
        kapcsolattarto_telefon=customer.phone,
    )


def _partner_fields(prefix: str, partner: Partner | None) -> dict:
    if partner is None:
        return _company_header_fields(prefix)
    return _company_header_fields(
        prefix,
        name=partner.name,
        szekhely=partner.billing_address,
        levelezesi_cim=partner.mailing_address,
        adoszam=partner.tax_number,
        cegjegyzekszam=partner.company_registry_number,
        bankszamlaszam=partner.bank_account_number,
        kepviselo_nev=partner.representative_name,
        kepviselo_beosztas=partner.representative_title,
        kapcsolattarto_nev=partner.contact_name,
        kapcsolattarto_email=partner.email,
        kapcsolattarto_telefon=partner.phone,
    )


def _activity_list(project: Project | None) -> list[dict]:
    if project is None:
        return []
    activities = sorted(
        (a for a in project.activities if a.is_active),
        key=lambda a: a.sort_order,
    )
    return [
        {
            "name": a.name,
            "start_date": _fmt_date(a.start_date),
            "end_date": _fmt_date(a.end_date),
        }
        for a in activities
    ]


def build_tig_context(project: Project, tig: Tig, delay_reason: str | None) -> dict:
    customer = project.customer
    sc_contract = tig.subcontractor_contract
    # No dedicated invoice_number merge field exists on Tig itself — pull the
    # first linked SubcontractorInvoice, if any (a TIG can have zero, one, or
    # several; "ha már ismert" in the spec implies best-effort, not a strict
    # 1:1 link).
    linked_invoice = tig.subcontractor_invoices[0] if tig.subcontractor_invoices else None

    # Full 11-field parity with the contract builders below (via the shared
    # _customer_fields/_partner_fields helpers) rather than a hand-rolled
    # 5-field subset — a TIG template can reference the same merge fields
    # (LEVELEZESI_CIM, CEGJEGYZEKSZAM, BANKSZAMLASZAM, ...) that work on
    # contract templates. project.client_name is the fallback company name
    # for a project with no CRM customer link — _customer_fields has no
    # equivalent since it only knows about a real Customer row.
    megrendelo_fields = _customer_fields("MEGRENDELO", customer)
    if not customer:
        megrendelo_fields["MEGRENDELO_CEGNEV"] = project.client_name or ""

    context = {
        **_project_fields(project),
        "UGYFEL_NEV": customer.name if customer else project.client_name,
        "TEVENYSEG_LISTA": _activity_list(project),
        "CSUSZAS_INDOKLAS": delay_reason or "",
        "TIG_PARTNER_NEV": tig.partner.name,
        "TIG_DATUM": _fmt_date(tig.date),
        "TIG_IDOSZAK_KEZDET": _fmt_date(tig.period_start),
        "TIG_IDOSZAK_VEGE": _fmt_date(tig.period_end),
        "TIG_OSSZEG_NETTO": str(tig.net_value),
        "TIG_OSSZEG_BRUTTO": str(tig.gross_value),
        # --- Dokumentum adatai ---
        "TIG_SZAM": f"TIG-{tig.id:04d}",
        "KAPCSOLODO_SZERZODES_SZAM": sc_contract.contract_number if sc_contract else "",
        "TIG_KELTE": _fmt_date(tig.date),
        # No separate "teljesítés dátuma" column on Tig — period_end is the
        # closest proxy (end of the certified performance period).
        "TELJESITES_DATUMA": _fmt_date(tig.period_end),
        "TIG_STATUSZ": TIG_STATUS_LABELS.get(tig.status, tig.status.value),
        # --- Megrendelő adatai ---
        **megrendelo_fields,
        # --- Vállalkozó / Alvállalkozó adatai ---
        **_partner_fields("VALLALKOZO", tig.partner),
        # --- Pénzügyi fejléc ---
        "TIG_OSSZEG_NETTO_TELJESITES": str(tig.net_value),
        "TIG_OSSZEG_BRUTTO_TELJESITES": str(tig.gross_value),
        "KAPCSOLODO_SZAMLA_SZAM": linked_invoice.invoice_number if linked_invoice else "",
    }
    return context


def build_client_contract_context(contract: Contract, customer: Customer, project: Project | None) -> dict:
    # Two net buckets rather than one value+vat_type pair — a client contract
    # can mix 27% and 5% items (user, 2026-08-07). Gross is derived per
    # bucket via services/finance.py::compute_gross, then summed; neither sum
    # is stored on the model.
    gross_standard = compute_gross(contract.net_value_standard, VatType.STANDARD_27)
    gross_reduced = compute_gross(contract.net_value_reduced, VatType.REDUCED_5)
    total_net = _sum_optional(contract.net_value_standard, contract.net_value_reduced)
    total_gross = _sum_optional(gross_standard, gross_reduced)
    return {
        **_project_fields(project),
        "UGYFEL_NEV": customer.name,
        "UGYFEL_ADOSZAM": customer.tax_number or "",
        "UGYFEL_CIM": customer.billing_address or "",
        "UGYFEL_TELEFON": customer.phone or "",
        "UGYFEL_EMAIL": customer.email or "",
        "SZERZODES_SZAM": contract.contract_number,
        "SZERZODES_KEZDETE": _fmt_date(contract.start_date),
        "SZERZODES_VEGE": _fmt_date(contract.end_date),
        # Deliberately no SZERZODES_ERTEK key here: Contract.value is a
        # separate, independently-entered CRM sales-dashboard deal-size
        # figure (crm_sales_dashboard.py) that can disagree with the net/
        # gross figures below — exposing both under similarly-named merge
        # fields risks a document showing two different "contract value"
        # numbers. Use SZERZODES_ERTEK_NETTO/_BRUTTO instead.
        # --- Dokumentum adatai ---
        "SZERZODES_TIPUSA": contract.contract_type or "",
        # Contract (unlike SubcontractorContract) has no created_at column —
        # start_date is the closest stand-in for "kelte".
        "SZERZODES_KELTE": _fmt_date(contract.start_date),
        "HATALYBALEPES_DATUMA": _fmt_date(contract.effective_date),
        "SZERZODES_STATUSZ": CONTRACT_STATUS_LABELS.get(contract.status, contract.status.value),
        # --- Megrendelő (ügyfél) adatai ---
        **_customer_fields("MEGRENDELO", customer),
        # --- Vállalkozó adatai (mi) ---
        **_own_company_fields("VALLALKOZO", contract.own_company),
        # --- Pénzügyi fejléc ---
        "DEVIZANEM": contract.currency,
        "SZERZODES_ERTEK_NETTO_27": _fmt_money(contract.net_value_standard),
        "SZERZODES_ERTEK_NETTO_5": _fmt_money(contract.net_value_reduced),
        "SZERZODES_ERTEK_NETTO": _fmt_money(total_net),
        "SZERZODES_ERTEK_BRUTTO": _fmt_money(total_gross),
        # Renamed from FIZETESI_HATARIDO_NAP (2026-08-07): client contracts
        # now store an absolute due date, not a day count — templates that
        # still reference the old _NAP merge field need re-uploading with
        # this key instead. SubcontractorContract keeps _NAP (untouched).
        "FIZETESI_HATARIDO_DATUM": _fmt_date(contract.payment_due_date),
        "FIZETESI_MOD": contract.payment_method or "",
    }


def build_subcontractor_contract_context(contract: SubcontractorContract, partner: Partner, project: Project) -> dict:
    # contract.value is the NET figure (user, 2026-08-07) — gross is derived
    # via services/finance.py::compute_gross, not stored.
    gross_value = compute_gross(contract.value, contract.vat_type)
    return {
        **_project_fields(project),
        "PARTNER_NEV": partner.name,
        "PARTNER_ADOSZAM": partner.tax_number or "",
        "PARTNER_CIM": partner.billing_address or "",
        "SZERZODES_SZAM": contract.contract_number,
        "SZERZODES_TARGYA": contract.scope_of_work or "",
        "SZERZODES_KEZDETE": _fmt_date(contract.start_date),
        "SZERZODES_VEGE": _fmt_date(contract.end_date),
        "SZERZODES_ERTEK": _fmt_money(contract.value),  # net — see gross_value below
        # --- Dokumentum adatai ---
        "SZERZODES_TIPUSA": contract.contract_type or "",
        "SZERZODES_KELTE": _fmt_date(contract.created_at.date() if contract.created_at else None),
        "HATALYBALEPES_DATUMA": _fmt_date(contract.effective_date),
        "SZERZODES_STATUSZ": SUBCONTRACTOR_CONTRACT_STATUS_LABELS.get(contract.status, contract.status.value),
        # --- Megrendelő (fővállalkozó) adatai (mi) ---
        **_own_company_fields("MEGRENDELO", contract.own_company),
        # --- Alvállalkozó adatai ---
        **_partner_fields("ALVALLALKOZO", partner),
        # --- Pénzügyi fejléc ---
        "DEVIZANEM": contract.currency,
        "SZERZODES_ERTEK_NETTO": _fmt_money(contract.value),
        "SZERZODES_ERTEK_BRUTTO": _fmt_money(gross_value),
        "FIZETESI_HATARIDO_NAP": str(contract.payment_terms_days) if contract.payment_terms_days is not None else "",
        "FIZETESI_MOD": contract.payment_method or "",
    }


def render_docx(template_bytes: bytes, context: dict) -> bytes:
    doc = DocxTemplate(BytesIO(template_bytes))
    doc.render(context)
    out = BytesIO()
    doc.save(out)
    return out.getvalue()


def convert_to_pdf(docx_bytes: bytes, *, timeout: int = 60) -> bytes:
    """Shells out to headless LibreOffice — the only reliable way to get a
    Word-faithful PDF render of a docxtpl-produced .docx (WeasyPrint only
    converts HTML, not docx). Runs synchronously; callers on the request
    path should invoke this from a BackgroundTasks job, not inline.
    """
    with tempfile.TemporaryDirectory() as tmpdir:
        docx_path = os.path.join(tmpdir, "document.docx")
        with open(docx_path, "wb") as f:
            f.write(docx_bytes)
        # LibreOffice's user profile (config + lock file) defaults to a
        # fixed path shared by every soffice invocation under this
        # container's $HOME — two conversions running close together (e.g.
        # a PM generating a TIG right after a subcontractor contract) race
        # on that lock and the second one fails outright. Point each call at
        # its own throwaway profile dir (inside this call's own tmpdir, so
        # it's already unique) to make concurrent conversions independent.
        profile_dir = os.path.join(tmpdir, "lo_profile")
        try:
            subprocess.run(
                [
                    "soffice",
                    "--headless",
                    "--norestore",
                    f"-env:UserInstallation=file://{profile_dir}",
                    "--convert-to",
                    "pdf",
                    "--outdir",
                    tmpdir,
                    docx_path,
                ],
                check=True,
                timeout=timeout,
                capture_output=True,
            )
        except (subprocess.CalledProcessError, subprocess.TimeoutExpired) as exc:
            raise PdfConversionError(str(exc)) from exc
        pdf_path = os.path.join(tmpdir, "document.pdf")
        if not os.path.exists(pdf_path):
            raise PdfConversionError("LibreOffice did not produce a PDF output")
        with open(pdf_path, "rb") as f:
            return f.read()
