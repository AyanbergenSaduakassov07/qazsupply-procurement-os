"""Versioned prompt templates: services/llm/prompts/<task>/<version>.txt, identified by sha256.

Variables are untrusted data: redacted, escaped so they cannot close the <data> tag, and
substituted only into {{placeholders}} the template declares.
"""

import hashlib
import re
from dataclasses import dataclass
from pathlib import Path

PROMPTS_DIR = Path(__file__).parent / "prompts"
PLACEHOLDER = re.compile(r"\{\{(\w+)\}\}")


@dataclass(frozen=True)
class Prompt:
    task: str
    version: str
    template: str

    @property
    def sha256(self) -> str:
        return hashlib.sha256(self.template.encode()).hexdigest()

    @property
    def variables(self) -> set[str]:
        return set(PLACEHOLDER.findall(self.template))


def load(task: str, version: str, base: Path = PROMPTS_DIR) -> Prompt:
    if not re.fullmatch(r"[a-z_]+", task) or not re.fullmatch(r"v\d+", version):
        raise ValueError("task must be snake_case and version like v1")
    return Prompt(task, version, (base / task / f"{version}.txt").read_text(encoding="utf-8"))


def escape_data(value: str) -> str:
    return value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def render(prompt: Prompt, variables: dict[str, str]) -> str:
    missing, extra = prompt.variables - variables.keys(), variables.keys() - prompt.variables
    if missing or extra:
        raise ValueError(f"variables mismatch: missing={sorted(missing)} extra={sorted(extra)}")
    return PLACEHOLDER.sub(lambda m: escape_data(variables[m.group(1)]), prompt.template)
