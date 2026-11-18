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
