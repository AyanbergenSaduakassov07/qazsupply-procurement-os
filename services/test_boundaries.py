"""Deep-module rule (ADR 0001): a module may use another module only through its public
`services.<module>.api`. Shared infrastructure allowed everywhere: `services.gateway.db`."""

import ast
from pathlib import Path

SERVICES = Path(__file__).parent
SHARED = {"services.gateway.db"}


def cross_module_violations(root: Path = SERVICES) -> list[str]:
    bad = []
    for path in root.rglob("*.py"):
        if path.name.startswith("test_"):
            continue
        own = path.relative_to(root).parts[0]
        for node in ast.walk(ast.parse(path.read_text(encoding="utf-8"))):
            names = (
                [a.name for a in node.names]
                if isinstance(node, ast.Import)
                else [node.module or ""]
                if isinstance(node, ast.ImportFrom)
                else []
            )
            for name in names:
                parts = name.split(".")
                if len(parts) < 2 or parts[0] != "services" or parts[1] == own or name in SHARED:
                    continue
                if own == "gateway" and len(parts) == 3 and parts[2] == "api":
                    continue  # the composition root wires public interfaces
                if len(parts) == 3 and parts[2] == "api":
                    continue
                if (
                    len(parts) == 2
                    and isinstance(node, ast.ImportFrom)
                    and {a.name for a in node.names} <= {"api"}
                ):
                    continue  # `from services.x import api`
                bad.append(f"{path.relative_to(root)}: imports {name}")
    return bad


def test_modules_talk_only_through_public_api() -> None:
    assert cross_module_violations() == []


def test_the_rule_catches_an_internal_import(tmp_path: Path) -> None:
    (tmp_path / "report").mkdir()
    (tmp_path / "report" / "x.py").write_text("from services.evidence.internal import secret\n")
    assert cross_module_violations(tmp_path) == ["report/x.py: imports services.evidence.internal"]
