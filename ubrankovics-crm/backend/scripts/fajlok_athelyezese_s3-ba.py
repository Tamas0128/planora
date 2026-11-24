"""A helyi `uploads` mappa meglévő fájljainak átmásolása az S3/MinIO tárolóba (egyszeri, biztonságosan újrafuttatható).

Használat (a backend konténerben, STORAGE_BACKEND=s3 mellett, a váltás előtt vagy után):
    PYTHONPATH=/app python scripts/fajlok_athelyezese_s3-ba.py
A helyi fájlokat NEM törli; az átmásolt fájlok után a mappa kézzel eltávolítható.
"""

import os

from app.config import settings
from app.services.storage import _s3

client = _s3()
db = 0
for nev in sorted(os.listdir(settings.upload_dir)) if os.path.isdir(settings.upload_dir) else []:
    path = os.path.join(settings.upload_dir, nev)
    if not os.path.isfile(path):
        continue
    with open(path, "rb") as fh:
        client.put_object(Bucket=settings.s3_bucket, Key=nev, Body=fh.read())
    db += 1
print(f"Átmásolva: {db} fájl a(z) {settings.s3_bucket} bucketbe.")
