"""Napi mentés: Postgres-dump + a feltöltött fájlok (S3/MinIO vagy helyi mappa) archívuma, régiek törlésével.

Használat (a backend konténerben):
    python scripts/mentes.py              # egyszeri mentés
    python scripts/mentes.py --loop       # naponta egyszer (alapból 02:30), a `backup` szolgáltatás így fut
Beállítások (környezeti változók): BACKUP_DIR (/backups), BACKUP_KEEP_DAYS (14), BACKUP_HOUR (2), BACKUP_MINUTE (30).
A mentések a `backups_data` volume-ba kerülnek; éles környezetben ezt külön helyre (más szerver / objektumtároló) is
át kell másolni, mert egy lemezhiba a mentést is viszi.
"""

import gzip
import io
import os
import shutil
import subprocess
import sys
import tarfile
import time
from datetime import datetime, timedelta
from urllib.parse import urlparse

from app.config import settings

BACKUP_DIR = os.environ.get("BACKUP_DIR", "/backups")
KEEP_DAYS = int(os.environ.get("BACKUP_KEEP_DAYS", "14"))


def dump_db(stamp: str) -> str:
    u = urlparse(settings.database_url)
    out = os.path.join(BACKUP_DIR, f"db-{stamp}.sql.gz")
    env = {**os.environ, "PGPASSWORD": u.password or ""}
    proc = subprocess.Popen(
        ["pg_dump", "-h", u.hostname or "localhost", "-p", str(u.port or 5432), "-U", u.username or "", "-d", u.path.lstrip("/"), "--no-owner"],
        stdout=subprocess.PIPE, env=env,
    )
    with gzip.open(out, "wb") as gz:
        shutil.copyfileobj(proc.stdout, gz)
    if proc.wait() != 0:
        os.remove(out)
        raise SystemExit("pg_dump sikertelen")
    return out


def dump_files(stamp: str) -> str | None:
    out = os.path.join(BACKUP_DIR, f"fajlok-{stamp}.tar.gz")
    if settings.storage_backend.lower() == "s3":
        from app.services.storage import _s3

        client = _s3()
        with tarfile.open(out, "w:gz") as tar:
            for page in client.get_paginator("list_objects_v2").paginate(Bucket=settings.s3_bucket):
                for obj in page.get("Contents", []):
                    data = client.get_object(Bucket=settings.s3_bucket, Key=obj["Key"])["Body"].read()
                    info = tarfile.TarInfo(obj["Key"])
                    info.size = len(data)
                    info.mtime = obj["LastModified"].timestamp()
                    tar.addfile(info, io.BytesIO(data))
        return out
    if os.path.isdir(settings.upload_dir):
        with tarfile.open(out, "w:gz") as tar:
            tar.add(settings.upload_dir, arcname=".")
        return out
    return None


def cleanup() -> None:
    limit = time.time() - KEEP_DAYS * 86400
    for name in os.listdir(BACKUP_DIR):
        path = os.path.join(BACKUP_DIR, name)
        if name.startswith(("db-", "fajlok-")) and os.path.getmtime(path) < limit:
            os.remove(path)


def run_once() -> None:
    os.makedirs(BACKUP_DIR, exist_ok=True)
    stamp = datetime.now().strftime("%Y-%m-%d_%H%M")
    db = dump_db(stamp)
    files = dump_files(stamp)
    cleanup()
    print(f"[mentes] kész: {os.path.basename(db)} ({os.path.getsize(db) // 1024} kB)"
          + (f", {os.path.basename(files)} ({os.path.getsize(files) // 1024} kB)" if files else ""), flush=True)


def seconds_until_next() -> float:
    hour, minute = int(os.environ.get("BACKUP_HOUR", "2")), int(os.environ.get("BACKUP_MINUTE", "30"))
    now = datetime.now()
    nxt = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
    if nxt <= now:
        nxt += timedelta(days=1)
    return (nxt - now).total_seconds()


if __name__ == "__main__":
    if "--loop" in sys.argv:
        while True:
            time.sleep(seconds_until_next())
            try:
                run_once()
            except Exception as exc:  # noqa: BLE001 — a ciklus ne álljon le egy hibától
                print(f"[mentes] HIBA: {exc}", file=sys.stderr, flush=True)
    else:
        run_once()
