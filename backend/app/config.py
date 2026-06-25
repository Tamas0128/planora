from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql://planora:planora@localhost:5432/planora"
    secret_key: str = "dev-secret-change-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 480
    refresh_token_expire_days: int = 7
    s3_endpoint: str = "http://localhost:9000"
    s3_public_endpoint: str = "http://localhost:9000"
    s3_access_key: str = "minioadmin"
    s3_secret_key: str = "minioadmin"
    s3_bucket: str = "planora-docs"
    cors_origins: str = "http://localhost:3000,http://localhost"

    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = "noreply@planora.local"
    smtp_use_tls: bool = True
    daily_digest_hour: int = 7
    daily_digest_minute: int = 0

    class Config:
        env_file = ".env"


settings = Settings()
