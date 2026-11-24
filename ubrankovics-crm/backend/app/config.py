import logging
import warnings

from pydantic import model_validator
from pydantic_settings import BaseSettings

_log = logging.getLogger("ubrankovics.config")

_INSECURE_DEFAULTS = {
    "dev-secret-change-in-production",
    "change-me-in-production",
}


class Settings(BaseSettings):
    database_url: str = "postgresql://ubrankovics:ubrankovics@localhost:5433/ubrankovics"
    secret_key: str = "dev-secret-change-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60
    refresh_token_expire_days: int = 7
    admin_password: str = ""
    cors_origins: str = "http://localhost:3101"

    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = "noreply@ubrankovics.local"
    smtp_use_tls: bool = True
    cegnev: str = "Ubrankovics Kft."
    # A kampány-levelek leiratkozó linkjének alapja (a frontend /api proxyja a backendre mutat).
    public_base_url: str = "http://localhost:3101"
    # Napi e-mailes értesítő ütemező (óránként ellenőriz, felhasználónként naponta egyszer küld).
    email_digest_enabled: bool = True
    email_digest_hour: int = 8

    upload_dir: str = "/app/uploads"
    # Fájltárolás: "local" (upload_dir) vagy "s3" (MinIO / S3-kompatibilis).
    storage_backend: str = "local"
    s3_endpoint: str = "http://minio:9000"
    s3_access_key: str = "minioadmin"
    s3_secret_key: str = "minioadmin"
    s3_bucket: str = "ubrankovics-docs"

    @model_validator(mode="after")
    def _warn_insecure_defaults(self) -> "Settings":
        if self.secret_key in _INSECURE_DEFAULTS:
            warnings.warn(
                "SECRET_KEY is set to an insecure default — set SECRET_KEY in your environment before going to production.",
                stacklevel=2,
            )
        return self

    class Config:
        env_file = ".env"


settings = Settings()
