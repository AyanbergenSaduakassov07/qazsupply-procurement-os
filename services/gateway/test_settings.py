from pathlib import Path

import pytest

from services.gateway.settings import Settings, env_local


def test_env_wins_over_the_file_and_the_file_is_parsed(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    f = tmp_path / ".env.local"
    f.write_text('# comment\nOTHER=1\nQS_TEST_KEY="from-file"\n')
    monkeypatch.delenv("QS_TEST_KEY", raising=False)
    assert env_local("QS_TEST_KEY", f) == "from-file"
    monkeypatch.setenv("QS_TEST_KEY", "from-env")
    assert env_local("QS_TEST_KEY", f) == "from-env"
    assert env_local("QS_MISSING", tmp_path / "absent") == ""


@pytest.mark.parametrize(
    ("url", "local"),
    [
        ("postgresql://postgres:postgres@127.0.0.1:54322/postgres", True),
        ("postgresql://u:p@localhost/db", True),
        ("postgresql://u:p@db.example.supabase.co:5432/postgres", False),
    ],
)
def test_only_a_local_database_counts_as_synthetic(url: str, local: bool) -> None:
    assert Settings(url, "http://x", ()).database_is_local is local
