# Üzemeltetés: fájltárolás és mentés

## Fájltárolás
A feltöltött fájlok (projektdokumentumok, építési napló fotói, bankkivonatok, .docx sablonok) alapból **MinIO**-ban
(S3-kompatibilis tároló, `minio` szolgáltatás, bucket: `ubrankovics-docs`) vannak. Az adatbázis csak a fájl nevét tárolja.

- `STORAGE_BACKEND=s3` (alapértelmezett a `docker-compose.yml`-ben) vagy `local` (a `uploads_data` volume).
- Az alkalmazás kódja a `backend/app/services/storage.py` rétegen át éri el a tárolót, így a két háttér felcserélhető.
- Éles környezetben állítsd be a `MINIO_ROOT_USER` és `MINIO_ROOT_PASSWORD` változót (az alapérték `minioadmin`),
  és ne tedd ki a MinIO-t a nyilvános hálózatra (a compose nem publikálja a portját).
- Meglévő, helyi fájlok átmásolása: `PYTHONPATH=/app python scripts/fajlok_athelyezese_s3-ba.py` a backend konténerben.

## Mentés
A `backup` szolgáltatás naponta 02:30-kor (`BACKUP_HOUR`, `BACKUP_MINUTE`) a `backups_data` volume-ba ment:

- `db-<dátum>.sql.gz`: a teljes Postgres-adatbázis,
- `fajlok-<dátum>.tar.gz`: a tárolt fájlok.

A 14 napnál (`BACKUP_KEEP_DAYS`) régebbi mentéseket törli. Kézi mentés:
`docker compose exec backup python scripts/mentes.py`.

**Fontos:** a mentés ugyanazon a szerveren van, mint az adat. Éles környezetben másold a `backups_data` tartalmát másik
szerverre vagy külső tárhelyre is (például napi `rsync` vagy `rclone`), különben egy lemezhiba mindkettőt viszi.

## Visszaállítás
1. `gunzip -c db-<dátum>.sql.gz | docker compose exec -T postgres psql -U ubrankovics -d ubrankovics` üres adatbázisba.
2. A `fajlok-<dátum>.tar.gz` tartalmát töltsd vissza a bucketbe (például `mc mirror` vagy a `fajlok_athelyezese_s3-ba.py`
   mintájára, a kicsomagolt mappából).
