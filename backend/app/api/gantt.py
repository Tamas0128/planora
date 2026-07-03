import io
from datetime import date

import matplotlib
matplotlib.use("Agg")
# Type 3 (the default) drops glyphs for Hungarian ő/ű (o/u with double
# acute) when subsetting into the PDF; Type 42 embeds real TrueType
# outlines instead and renders them correctly.
matplotlib.rcParams["pdf.fonttype"] = 42
import matplotlib.dates as mdates
import matplotlib.pyplot as plt
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.orm import Session

from app.api.documents import _content_disposition
from app.api.projects import _can_view_project
from app.database import get_db
from app.dependencies import get_current_user
from app.models import Activity, Project, User

# No shared prefix: the multi-project endpoint deliberately lives under
# /reports rather than /projects/gantt.pdf, because Starlette matches routes
# structurally before FastAPI validates path-param types — "/projects/gantt.pdf"
# would otherwise be captured by projects.py's "/projects/{project_id}" route
# (with project_id="gantt.pdf") and 422 instead of falling through here.
router = APIRouter(tags=["gantt"])

STATUS_COLORS = {
    "pending": "#cbd5e1",
    "in_progress": "#fbbf24",
    "done": "#34d399",
    "blocked": "#f87171",
}
STATUS_LABELS_HU = {
    "pending": "Várakozik",
    "in_progress": "Folyamatban",
    "done": "Kész",
    "blocked": "Blokkolt",
}

_ACTIVITY_PALETTE = [*plt.get_cmap("tab20").colors, *plt.get_cmap("tab20b").colors]


def _real_activities(db: Session, project_ids: list[int]) -> dict[int, list[Activity]]:
    """Only actually-scheduled real activities — no prep tasks, no disabled ones."""
    activities = (
        db.query(Activity)
        .filter(
            Activity.project_id.in_(project_ids),
            Activity.is_active.is_(True),
            Activity.start_date.isnot(None),
            Activity.end_date.isnot(None),
        )
        .order_by(Activity.start_date)
        .all()
    )
    by_project: dict[int, list[Activity]] = {pid: [] for pid in project_ids}
    for a in activities:
        by_project[a.project_id].append(a)
    return by_project


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


@router.get("/projects/{project_id}/gantt.pdf")
def project_gantt(
    project_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project or not _can_view_project(user, project):
        raise HTTPException(status_code=404, detail="Project not found")

    activities = _real_activities(db, [project_id])[project_id]
    if not activities:
        raise HTTPException(status_code=400, detail="Nincs ütemezett tevékenység")

    fig, ax = plt.subplots(figsize=(11.7, max(2.5, 0.4 * len(activities) + 1.5)))
    ordered = list(reversed(activities))
    for i, a in enumerate(ordered):
        start = mdates.date2num(a.start_date)
        end = mdates.date2num(a.end_date)
        ax.broken_barh(
            [(start, max(end - start, 0.3))], (i - 0.35, 0.7),
            facecolors=STATUS_COLORS.get(a.status.value, "#94a3b8"),
            edgecolor="white",
        )
    ax.set_yticks(range(len(ordered)))
    ax.set_yticklabels([a.name for a in ordered], fontsize=8)
    ax.xaxis_date()
    ax.xaxis.set_major_formatter(mdates.DateFormatter("%Y.%m.%d"))
    fig.autofmt_xdate()
    ax.axvline(mdates.date2num(date.today()), color="#2563eb", linestyle="--", linewidth=1)
    ax.axvline(mdates.date2num(project.delivery_date), color="#dc2626", linestyle="--", linewidth=1)
    ax.set_title(f"{project.name} ({project.project_code}) – ütemterv", fontsize=11, fontweight="bold")
    ax.set_ylim(-1, len(ordered))
    handles = [plt.Rectangle((0, 0), 1, 1, color=c) for c in STATUS_COLORS.values()]
    ax.legend(
        handles, list(STATUS_LABELS_HU.values()), loc="upper center",
        bbox_to_anchor=(0.5, -0.12), ncol=4, fontsize=8, frameon=False,
    )
    ax.grid(axis="x", linestyle=":", alpha=0.4)
    fig.tight_layout()

    return _pdf_response(fig, f"{project.project_code}_gantt.pdf")


@router.get("/reports/multi-gantt.pdf")
def multi_project_gantt(
    ids: str = Query(..., description="Comma-separated project IDs"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    try:
        project_ids = [int(x) for x in ids.split(",") if x.strip()]
    except ValueError:
        raise HTTPException(status_code=400, detail="Érvénytelen id lista")
    if not project_ids:
        raise HTTPException(status_code=400, detail="Nincs kiválasztott projekt")

    projects = db.query(Project).filter(Project.id.in_(project_ids)).all()
    projects = [p for p in projects if _can_view_project(user, p)]
    if not projects:
        raise HTTPException(status_code=404, detail="Nincs megjeleníthető projekt")
    projects.sort(key=lambda p: p.delivery_date)

    by_project = _real_activities(db, [p.id for p in projects])
    activity_names = sorted({a.name for acts in by_project.values() for a in acts})
    color_map = {
        name: _ACTIVITY_PALETTE[i % len(_ACTIVITY_PALETTE)]
        for i, name in enumerate(activity_names)
    }

    fig, ax = plt.subplots(figsize=(11.7, max(2.5, 0.5 * len(projects) + 2)))
    ordered = list(reversed(projects))
    for i, project in enumerate(ordered):
        acts = by_project[project.id]
        segments = [
            (mdates.date2num(a.start_date), max(mdates.date2num(a.end_date) - mdates.date2num(a.start_date), 0.3))
            for a in acts
        ]
        colors = [color_map[a.name] for a in acts]
        if segments:
            ax.broken_barh(segments, (i - 0.35, 0.7), facecolors=colors, edgecolor="white", linewidth=0.5)

    ax.set_yticks(range(len(ordered)))
    ax.set_yticklabels([f"{p.name} ({p.project_code})" for p in ordered], fontsize=8)
    ax.xaxis_date()
    ax.xaxis.set_major_formatter(mdates.DateFormatter("%Y.%m.%d"))
    fig.autofmt_xdate()
    ax.axvline(mdates.date2num(date.today()), color="#2563eb", linestyle="--", linewidth=1)
    ax.set_title("Projektek ütemterve", fontsize=11, fontweight="bold")
    ax.set_ylim(-1, len(ordered))
    ax.grid(axis="x", linestyle=":", alpha=0.4)

    if 0 < len(activity_names) <= 26:
        handles = [plt.Rectangle((0, 0), 1, 1, color=color_map[n]) for n in activity_names]
        ax.legend(
            handles, activity_names, loc="upper center",
            bbox_to_anchor=(0.5, -0.15), ncol=4, fontsize=6.5, frameon=False,
        )
    fig.tight_layout()

    return _pdf_response(fig, "projektek_gantt.pdf")
