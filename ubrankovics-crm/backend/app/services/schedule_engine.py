"""Visszafelé ütemező (backward scheduling), a planora
`services/schedule_engine.py` mintájára, de Activity helyett közvetlenül a
ProjektTetel sorokon dolgozik — nincs külön sablon-katalógus, a már
felvett tételek a schedulázható egységek. Csak azoknál a projekteknél fut,
ahol `utemezes_aktiv=True` és van `delivery_date`.
"""

from datetime import date, timedelta

from sqlalchemy.orm import Session

from app.models import Projekt, ProjektTetel, TetelFuggoseg, TetelSzakasz


def is_workday(d: date) -> bool:
    return d.weekday() < 5


def subtract_workdays(end: date, days: int) -> date:
    if days <= 0:
        return end
    current = end
    remaining = days
    while remaining > 0:
        current -= timedelta(days=1)
        if is_workday(current):
            remaining -= 1
    return current


def add_workdays(start: date, days: int) -> date:
    if days <= 0:
        return start
    current = start
    remaining = days - 1
    while remaining > 0:
        current += timedelta(days=1)
        if is_workday(current):
            remaining -= 1
    return current


def recalculate_schedule(db: Session, projekt: Projekt) -> None:
    if not projekt.delivery_date:
        return

    tetelek = (
        db.query(ProjektTetel)
        .filter(ProjektTetel.projekt_id == projekt.id, ProjektTetel.duration_days.isnot(None))
        .order_by(ProjektTetel.sorrend, ProjektTetel.id)
        .all()
    )
    if not tetelek:
        projekt.completion_percent = 0
        return

    tetel_ids = [t.id for t in tetelek]
    all_deps = (
        db.query(TetelFuggoseg).filter(TetelFuggoseg.tetel_id.in_(tetel_ids)).all()
    )
    # successor_map[prerequisite_id] = {tetel_id, ...} tételek, amik erre várnak
    successor_map: dict[int, set[int]] = {tid: set() for tid in tetel_ids}
    for dep in all_deps:
        if dep.prerequisite_id in successor_map:
            successor_map[dep.prerequisite_id].add(dep.tetel_id)

    start_dates: dict[int, date] = {}
    slot = projekt.delivery_date

    # Visszafelé: utolsó tételtől az elsőig (id szerint csökkenő sorrendben),
    # mindegyik a lehető legkésőbb fejeződik be.
    for tetel in reversed(tetelek):
        succ_ids = successor_map.get(tetel.id, set())
        processed_succs = [sid for sid in succ_ids if sid in start_dates]
        if processed_succs:
            earliest_succ_start = min(start_dates[sid] for sid in processed_succs)
            tetel.end_date = subtract_workdays(earliest_succ_start, 1)
        else:
            tetel.end_date = slot

        tetel.start_date = subtract_workdays(tetel.end_date, tetel.duration_days - 1)
        tetel.prep_date = subtract_workdays(tetel.start_date, tetel.prep_days)
        # A terv dátumot csak első alkalommal rögzítjük — utána a projekt
        # csúszhat, de az eredeti ígéret nem írható felül némán.
        if tetel.terv_kezdes is None:
            tetel.terv_kezdes = tetel.start_date
        if tetel.terv_befejezes is None:
            tetel.terv_befejezes = tetel.end_date
        start_dates[tetel.id] = tetel.start_date
        slot = subtract_workdays(tetel.start_date, 1)

    done_count = sum(1 for t in tetelek if t.szakasz == TetelSzakasz.KESZ)
    projekt.completion_percent = round((done_count / len(tetelek)) * 100, 1)
    db.flush()
