"""Runtime settings from the environment. No secrets have defaults."""

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    database_url: str
    supabase_url: str
    cors_origins: tuple[str, ...]

    @property
    def jwks_url(self) -> str:
        return f"{self.supabase_url.rstrip('/')}/auth/v1/.well-known/jwks.json"


def load() -> Settings:
    return Settings(
        # Local Supabase defaults (not secrets: published by `supabase status` for every install).
        database_url=os.environ.get(
            "DATABASE_URL", "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
        ),
        supabase_url=os.environ.get("SUPABASE_URL", "http://127.0.0.1:54321"),
        cors_origins=tuple(os.environ.get("CORS_ORIGINS", "http://localhost:3000").split(",")),
    )
