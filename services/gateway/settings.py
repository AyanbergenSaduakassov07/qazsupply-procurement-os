"""Runtime settings from the environment. No secrets have defaults."""

import os
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[2]
LOCAL_HOSTS = {"127.0.0.1", "localhost", "::1"}
DEV_ASK_MODEL = "nvidia/nemotron-3-super-120b-a12b:free"


@dataclass(frozen=True)
class Settings:
    database_url: str
    supabase_url: str
    cors_origins: tuple[str, ...]
    # Ask (M3). `none` disables model calls; `openrouter` is the development provider (ADR 0008).
    llm_provider: str = "none"
    openrouter_api_key: str = ""
    ask_model: str = DEV_ASK_MODEL

    @property
    def jwks_url(self) -> str:
        return f"{self.supabase_url.rstrip('/')}/auth/v1/.well-known/jwks.json"

    @property
    def database_is_local(self) -> bool:
        return urlparse(self.database_url).hostname in LOCAL_HOSTS


def env_local(name: str, path: Path = ROOT / ".env.local") -> str:
    """A value from the process env, else from the repo's gitignored .env.local (KEY=VALUE)."""
    if os.environ.get(name):
        return os.environ[name]
    try:
        lines = path.read_text(encoding="utf-8").splitlines()
    except OSError:
        return ""
    for line in lines:
        key, sep, value = line.partition("=")
        if sep and key.strip() == name:
            return value.strip().strip('"').strip("'")
    return ""


def load() -> Settings:
    return Settings(
        # Local Supabase defaults (not secrets: published by `supabase status` for every install).
        database_url=os.environ.get(
            "DATABASE_URL", "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
        ),
        supabase_url=os.environ.get("SUPABASE_URL", "http://127.0.0.1:54321"),
        cors_origins=tuple(os.environ.get("CORS_ORIGINS", "http://localhost:3000").split(",")),
        llm_provider=env_local("LLM_PROVIDER") or "none",
        openrouter_api_key=env_local("OPENROUTER_API_KEY"),
        ask_model=env_local("ASK_MODEL")
        or ("scripted-local" if env_local("LLM_PROVIDER") == "scripted" else DEV_ASK_MODEL),
    )
