"""ÁFA-számítás — mindkét oldalon (beszerzési ajánlat / ügyfélnek kiajánlott
ár) ugyanaz a logika, tételenként külön kulccsal, soha nem egyetlen globális
projekt-ÁFA-kulccsal (lásd a beszerzési spec "Beszerzési és ügyfélár, áfa
kezelése" pontját)."""

from decimal import ROUND_HALF_UP, Decimal

from app.models import VatTipus

_KULCSOK = {
    VatTipus.AFA_27: Decimal("0.27"),
    VatTipus.AFA_5: Decimal("0.05"),
    VatTipus.AFA_0: Decimal("0"),
    VatTipus.FORDITOTT: Decimal("0"),
}


def compute_afa(netto: Decimal, afa_tipus: VatTipus) -> tuple[Decimal, Decimal]:
    """(áfa, bruttó) — explicit kulcs-lista, nincs hallgatólagos else-ág,
    hogy egy jövőbeli új VatTipus ne essen csendben rossz számításba."""
    if afa_tipus not in _KULCSOK:
        raise ValueError(f"Ismeretlen ÁFA-típus: {afa_tipus}")
    kulcs = _KULCSOK[afa_tipus]
    afa = (netto * kulcs).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    brutto = (netto + afa).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    return afa, brutto
