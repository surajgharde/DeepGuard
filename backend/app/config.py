"""Environment-driven configuration.

Every path, URL and limit the app needs lives here so nothing is hardcoded at
the call sites. Values are read from the environment (or backend/.env) using the
DEEPGUARD_ prefix.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# backend/  (this file is backend/app/config.py)
BASE_DIR = Path(__file__).resolve().parents[1]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="DEEPGUARD_",
        env_file=BASE_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "DeepGuard API"
    pipeline: str = "mock"  # "mock" | "real"

    database_url: str = f"sqlite:///{(BASE_DIR / 'deepguard.db').as_posix()}"
    public_base_url: str = "http://localhost:8000"
    cors_origins: list[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]

    max_upload_mb: int = 100
    allowed_extensions: list[str] = [".mp4", ".avi", ".mov"]

    upload_dir: str = "uploads"
    output_dir: str = "outputs"

    seed_on_startup: bool = True

    # URL prefixes for the two static mounts (see app/main.py)
    outputs_url_path: str = "/static"
    uploads_url_path: str = "/media"

    @field_validator("cors_origins", "allowed_extensions", mode="before")
    @classmethod
    def _split_csv(cls, value: object) -> object:
        """Allow `A,B,C` in the env file as well as a JSON list."""
        if isinstance(value, str) and not value.strip().startswith("["):
            return [item.strip() for item in value.split(",") if item.strip()]
        return value

    @property
    def max_upload_bytes(self) -> int:
        return self.max_upload_mb * 1024 * 1024

    @property
    def uploads_path(self) -> Path:
        return self._resolve(self.upload_dir)

    @property
    def outputs_path(self) -> Path:
        return self._resolve(self.output_dir)

    def _resolve(self, raw: str) -> Path:
        path = Path(raw)
        return path if path.is_absolute() else (BASE_DIR / path)

    def outputs_url(self, relative: str) -> str:
        """Absolute URL for a file inside the outputs directory."""
        return f"{self.public_base_url.rstrip('/')}{self.outputs_url_path}/{relative.lstrip('/')}"

    def uploads_url(self, relative: str) -> str:
        """Absolute URL for a file inside the uploads directory."""
        return f"{self.public_base_url.rstrip('/')}{self.uploads_url_path}/{relative.lstrip('/')}"

    def ensure_dirs(self) -> None:
        self.uploads_path.mkdir(parents=True, exist_ok=True)
        self.outputs_path.mkdir(parents=True, exist_ok=True)


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
