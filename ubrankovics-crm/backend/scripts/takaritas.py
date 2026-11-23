"""Üzleti (tesztelésből maradt) adatok törlése, a törzsadatok és a felhasználói fiókok megtartásával.

Használat (a backend konténerben):
    python scripts/takaritas.py            # csak megmutatja, mit törölne
    python scripts/takaritas.py --apply    # tényleg töröl

Törli: projektek, ügyfelek, érdeklődések, alvállalkozók, feladatok, jegyek, címkék, kampányok, bankegyenlegek,
bérköltségek, egyedi mező-definíciók, értékesítési célok, auditnapló és minden, ami ezekhez tartozik (számlák, szerződések, napló, dokumentumok, ...), valamint az
"E2E" nevű belső személyeket és az "e2e" felhasználókat. Megtartja: admin és egyéb valódi felhasználók,
munkanemek, törzsadatok, épülettípus-sablonok, belső munkatársak, cégadatok.
A törlés a külső kulcsokat követi (a hivatkozó sorokat előbb törli).
"""

import sys

from sqlalchemy import delete, select, text
from sqlalchemy.sql.schema import Table

from app.database import Base, SessionLocal
import app.models  # noqa: F401
import app.models_auth  # noqa: F401
import app.models_ext  # noqa: F401
import app.models_finance  # noqa: F401
import app.models_projekt  # noqa: F401

APPLY = "--apply" in sys.argv


def children(table: Table):
    for t in Base.metadata.tables.values():
        for fk in t.foreign_keys:
            if fk.column.table is table:
                yield t, fk.parent, fk.column


def purge(db, table: Table, pk_col, ids: set, stats: dict, seen: set):
    """Törli a `table` megadott azonosítójú sorait és mindent, ami rájuk hivatkozik."""
    ids = set(ids)
    if not ids:
        return
    for child, fk_col, ref_col in children(table):
        sel = select(*child.primary_key.columns).where(fk_col.in_(ids))
        if child is table:
            sel = sel.where(~list(child.primary_key.columns)[0].in_(ids))
        rows = db.execute(sel).all()
        if not rows:
            continue
        if len(child.primary_key.columns) == 1:
            child_ids = {r[0] for r in rows}
            key = (child.name, frozenset(child_ids))
            if key in seen:
                continue
            seen.add(key)
            purge(db, child, list(child.primary_key.columns)[0], child_ids, stats, seen)
        else:
            res = db.execute(delete(child).where(fk_col.in_(ids)))
            stats[child.name] = stats.get(child.name, 0) + res.rowcount
    res = db.execute(delete(table).where(pk_col.in_(ids)))
    stats[table.name] = stats.get(table.name, 0) + res.rowcount


def main():
    db = SessionLocal()
    T = Base.metadata.tables
    stats: dict = {}
    seen: set = set()

    def all_ids(name):
        t = T[name]
        pk = list(t.primary_key.columns)[0]
        return t, pk, {r[0] for r in db.execute(select(pk))}

    roots = ["projektek", "ugyfelek", "alvallalkozok", "feladatok", "cimkek", "kampanyok", "bank_egyenlegek",
             "tervezett_berkoltsegek", "egyedi_mezok", "audit_naplo", "ertekesitesi_celok"]
    # táblanevek ellenőrzése, hogy elírás ne maradjon észrevétlen
    for name in list(roots):
        if name not in T:
            cand = [n for n in T if n.startswith(name[:6])]
            print("Nincs ilyen tábla:", name, "— hasonlók:", cand)
            roots.remove(name)
    for n in T:
        if n.startswith("erdekl"):
            roots.append(n)

    for name in roots:
        t, pk, ids = all_ids(name)
        purge(db, t, pk, ids, stats, seen)

    # E2E belső személyek és felhasználók
    szem = T["szemelyek"]
    ids = {r[0] for r in db.execute(select(szem.c.id).where(szem.c.nev.ilike("e2e%")))}
    purge(db, szem, szem.c.id, ids, stats, seen)
    usr = T["users"]
    ids = {r[0] for r in db.execute(select(usr.c.id).where(usr.c.username.ilike("e2e%")))}
    purge(db, usr, usr.c.id, ids, stats, seen)

    print(("TÖRÖLVE:" if APPLY else "DRY-RUN (ennyit törölne):"))
    for k, v in sorted(stats.items(), key=lambda kv: -kv[1]):
        print(f"  {k}: {v}")
    if APPLY:
        db.commit()
        print("Kész.")
    else:
        db.rollback()
        print("Semmi nem változott. Futtasd --apply kapcsolóval a törléshez.")


if __name__ == "__main__":
    main()
