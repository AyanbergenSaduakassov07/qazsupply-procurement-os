from services.gateway.app import llm_provider
from services.gateway.settings import Settings
from services.llm.api import OpenRouterProvider, ScriptedProvider

LOCAL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
REMOTE = "postgresql://u:p@db.example.supabase.co:5432/postgres"


def test_no_provider_unless_chosen() -> None:
    assert llm_provider(Settings(LOCAL, "http://x", ())) is None


def test_development_providers_never_run_against_a_remote_database() -> None:
    for name in ("scripted", "openrouter"):
        assert llm_provider(Settings(REMOTE, "http://x", (), name, "key")) is None


def test_local_choices() -> None:
    assert isinstance(llm_provider(Settings(LOCAL, "x", (), "scripted")), ScriptedProvider)
    assert isinstance(llm_provider(Settings(LOCAL, "x", (), "openrouter", "k")), OpenRouterProvider)
    assert llm_provider(Settings(LOCAL, "x", (), "openrouter", "")) is None  # no key
