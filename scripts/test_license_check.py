import pytest

from scripts.license_check import is_allowed


@pytest.mark.parametrize(
    ("expr", "ok"),
    [
        ("MIT", True),
        ("MIT License", True),
        ("(MIT OR GPL-3.0)", True),
        ("MIT AND GPL-3.0", False),
        ("GPL-3.0", False),
        ("AGPL-3.0-only", False),
        ("UNKNOWN", False),
        ("Apache Software License; BSD License", True),
        ("Mozilla Public License 2.0 (MPL 2.0)", True),
    ],
)
def test_is_allowed(expr: str, ok: bool) -> None:
    assert is_allowed(expr) is ok
