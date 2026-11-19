import io
import re
from datetime import date
from urllib.parse import quote

import matplotlib
matplotlib.use("Agg")
# Type 3 (the default) drops glyphs for Hungarian ő/ű (o/u with double
# acute) when subsetting into the PDF; Type 42 embeds real TrueType
# outlines instead and renders them correctly.
matplotlib.rcParams["pdf.fonttype"] = 42
import matplotlib.dates as mdates
import matplotlib.pyplot as plt
from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.dependencies import get_current_user
from app.models import Projekt, ProjektTetel, User

router = APIRouter(tags=["gantt"])

SZAKASZ_COLORS = {
    "ajanlat": "#cbd5e1",
    "szerzodes": "#a5b4fc",
    "beszerzes": "#fbbf24",
    "kivitelezes": "#fb923c",
    "kesz": "#34d399",
}
SZAKASZ_LABELS_HU = {
    "ajanlat": "Ajánlat",
    "szerzodes": "Szerződés",
    "beszerzes": "Beszerzés",
    "kivitelezes": "Kivitelezés",
    "kesz": "Kész",
}


def _content_disposition(filename: str) -> str:
    # Magyar fájlnevek rendszeresen tartalmaznak ékezetes karaktereket
    # (pl. "Kész projekt.pdf"), amit a sima ASCII filename= paraméter nem
    # tud reprezentálni — ASCII-biztos fallback + RFC 6266 UTF-8 forma.
    ascii_fallback = re.sub(r'[^\x20-\x7e]', "_", filename).replace('"', "'")
    encoded = quote(filename, safe="")
    return f'attachment; filename="{ascii_fallback}"; filename*=UTF-8\'\'{encoded}'


def _pdf_response(fig, filename: str) -> Response:
    buf = io.BytesIO()
    fig.savefig(buf, format="pdf", bbox_inches="tight")
    plt.close(fig)
    buf.seek(0)
    return Response(
        content=buf.read(),
        media_type="application/pdf",
        headers={"Content-Disposition": _content_disposition(filename)},
    )


@router.get("/projektek/{projekt_id}/gantt.pdf")
def projekt_gantt(
    projekt_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    projekt = db.query(Projekt).get(projekt_id)
    if not projekt:
        raise HTTPException(status_code=404, detail="Projekt not found")

    tetelek = (
        db.query(ProjektTetel)
        .options(joinedload(ProjektTetel.munkanem))
        .filter(
            ProjektTetel.projekt_id == projekt_id,
            ProjektTetel.start_date.isnot(None),
            ProjektTetel.end_date.isnot(None),
        )
        .order_by(ProjektTetel.sorrend, ProjektTetel.id)
        .all()
    )
    if not tetelek:
        raise HTTPException(status_code=400, detail="Nincs ütemezett tétel")

    fig, ax = plt.subplots(figsize=(11.7, max(2.5, 0.4 * len(tetelek) + 1.5)))
    ordered = list(reversed(tetelek))
    for i, t in enumerate(ordered):
        start = mdates.date2num(t.start_date)
        end = mdates.date2num(t.end_date)
        ax.broken_barh(
            [(start, max(end - start, 0.3))], (i - 0.35, 0.7),
            facecolors=SZAKASZ_COLORS.get(t.szakasz.value, "#94a3b8"),
            edgecolor="white",
        )
    ax.set_yticks(range(len(ordered)))
    ax.set_yticklabels([t.munkanem.nev for t in ordered], fontsize=8)
    ax.xaxis_date()
    ax.xaxis.set_major_formatter(mdates.DateFormatter("%Y.%m.%d"))
    ax.xaxis.set_ticks_position("top")
    ax.xaxis.set_label_position("top")
    ax.tick_params(axis="x", labelbottom=False, labeltop=True)
    plt.setp(ax.get_xticklabels(), rotation=30, ha="left", rotation_mode="anchor")
    ax.axvline(mdates.date2num(date.today()), color="#2563eb", linestyle="--", linewidth=1)
    if projekt.delivery_date:
        ax.axvline(mdates.date2num(projekt.delivery_date), color="#dc2626", linestyle="--", linewidth=1)
    ax.set_title(f"{projekt.projekt_nev} – ütemterv", fontsize=11, fontweight="bold", pad=28)
    ax.set_ylim(-1, len(ordered))
    used_szakaszok = {t.szakasz.value for t in ordered}
    handles = [plt.Rectangle((0, 0), 1, 1, color=SZAKASZ_COLORS[s]) for s in SZAKASZ_LABELS_HU if s in used_szakaszok]
    labels = [SZAKASZ_LABELS_HU[s] for s in SZAKASZ_LABELS_HU if s in used_szakaszok]
    ax.legend(
        handles, labels, loc="upper center",
        bbox_to_anchor=(0.5, -0.12), ncol=5, fontsize=8, frameon=False,
    )
    ax.grid(axis="x", linestyle=":", alpha=0.4)
    fig.tight_layout()

    return _pdf_response(fig, f"{projekt.projekt_nev}_utemterv.pdf")
