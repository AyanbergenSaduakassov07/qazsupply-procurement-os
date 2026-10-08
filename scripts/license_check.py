"""Fail CI when a dependency licence is outside the allowlist.

Usage: uv run python scripts/license_check.py
Reads `pnpm licenses list --json --prod` and `pip-licenses --format=json`.
"""

import json
import logging
import re
import subprocess  # noqa: S404 - fixed argv, no shell
import sys

ALLOWED = {
    "0BSD", "Apache-2.0", "BlueOak-1.0.0", "BSD-2-Clause", "BSD-3-Clause", "CC0-1.0",
    "CC-BY-4.0", "ISC", "MIT", "MIT-0", "MPL-2.0", "PostgreSQL", "PSF-2.0", "Python-2.0",
    "Unlicense",
}  # fmt: skip
# Classifier-style names pip-licenses reports, normalised to SPDX.
ALIASES = {
    "MIT License": "MIT",
    "BSD License": "BSD-3-Clause",
    "Apache Software License": "Apache-2.0",
    "Python Software Foundation License": "PSF-2.0",
    "ISC License (ISCL)": "ISC",
    "Mozilla Public License 2.0 (MPL 2.0)": "MPL-2.0",
}
# Reviewed exceptions: package -> reason. Keep this short and justified.
EXCEPTIONS: dict[str, str] = {}

log = logging.getLogger("license_check")


def is_allowed(expression: str) -> bool:
    """True when an SPDX-ish expression is satisfiable with allowed licences.

    `A OR B` needs one allowed side; `A AND B` (or `;`-joined lists) needs all.
    """
    expr = expression.strip()
    if expr.startswith("(") and expr.endswith(")"):
        expr = expr[1:-1]
    if " OR " in expr:
        return any(is_allowed(part) for part in expr.split(" OR "))
    parts = re.split(r" AND |;\s*", expr)
    return all(ALIASES.get(p.strip(), p.strip()) in ALLOWED for p in parts if p.strip())


def _run(argv: list[str]) -> str:
    return subprocess.run(argv, check=True, capture_output=True, text=True).stdout  # noqa: S603


def collect() -> dict[str, str]:
    found: dict[str, str] = {}
    for licence, pkgs in json.loads(_run(["pnpm", "licenses", "list", "--json", "--prod"])).items():
        for pkg in pkgs:
            found[f"npm:{pkg['name']}"] = licence
    for pkg in json.loads(_run(["uv", "run", "pip-licenses", "--format=json"])):
        found[f"py:{pkg['Name']}"] = pkg["License"]
    return found


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    bad = {
        name: lic
        for name, lic in collect().items()
        if not is_allowed(lic) and name.split(":", 1)[1] not in EXCEPTIONS
    }
    for name, lic in sorted(bad.items()):
        log.error("disallowed licence: %s (%s)", name, lic)
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
