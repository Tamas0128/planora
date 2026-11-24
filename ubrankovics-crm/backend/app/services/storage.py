"""Fájltárolás: helyi könyvtár (alapértelmezett) vagy S3-kompatibilis tároló (MinIO).

A kiválasztást a `STORAGE_BACKEND` beállítás adja (`local` | `s3`). A hívók csak a tárolt fájlnevet (kulcsot)
ismerik; a tartalom bájtként megy be és jön ki, így a két háttér felcserélhető.
"""

import os
import threading

from app.config import settings

_lock = threading.Lock()
_client = None
_bucket_ready = False


def _s3():
    global _client, _bucket_ready
    with _lock:
        if _client is None:
            import boto3
            from botocore.config import Config

            _client = boto3.client(
                "s3",
                endpoint_url=settings.s3_endpoint,
                aws_access_key_id=settings.s3_access_key,
                aws_secret_access_key=settings.s3_secret_key,
                region_name="us-east-1",
                config=Config(signature_version="s3v4", s3={"addressing_style": "path"}, retries={"max_attempts": 3}),
            )
        if not _bucket_ready:
            try:
                _client.head_bucket(Bucket=settings.s3_bucket)
            except Exception:  # noqa: BLE001 — nincs bucket: létrehozzuk
                _client.create_bucket(Bucket=settings.s3_bucket)
            _bucket_ready = True
        return _client


def _use_s3() -> bool:
    return settings.storage_backend.lower() == "s3"


def save(key: str, data: bytes, content_type: str | None = None) -> None:
    if _use_s3():
        extra = {"ContentType": content_type} if content_type else {}
        _s3().put_object(Bucket=settings.s3_bucket, Key=key, Body=data, **extra)
        return
    os.makedirs(settings.upload_dir, exist_ok=True)
    with open(os.path.join(settings.upload_dir, key), "wb") as fh:
        fh.write(data)


def read(key: str) -> bytes:
    """A fájl tartalma; ha nincs ilyen fájl, `FileNotFoundError`."""
    if _use_s3():
        try:
            return _s3().get_object(Bucket=settings.s3_bucket, Key=key)["Body"].read()
        except Exception as exc:  # noqa: BLE001
            code = getattr(exc, "response", {}).get("Error", {}).get("Code")
            if code in ("NoSuchKey", "404", "NotFound"):
                raise FileNotFoundError(key) from exc
            raise
    path = os.path.join(settings.upload_dir, key)
    if not os.path.isfile(path):
        raise FileNotFoundError(key)
    with open(path, "rb") as fh:
        return fh.read()


def exists(key: str) -> bool:
    try:
        read(key)
    except FileNotFoundError:
        return False
    return True


def delete(key: str) -> None:
    """Törli a fájlt; ha nincs, nem hiba."""
    if _use_s3():
        try:
            _s3().delete_object(Bucket=settings.s3_bucket, Key=key)
        except Exception:  # noqa: BLE001
            pass
        return
    try:
        os.remove(os.path.join(settings.upload_dir, key))
    except OSError:
        pass
