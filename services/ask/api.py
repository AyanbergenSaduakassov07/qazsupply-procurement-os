"""Ask (M3): a cited answer about one released report (spec C05, ADR 0008).

No tools: the server loads the report's kept findings (the only data the owner allows to leave,
ADR 0008 decision 5) into the prompt as escaped data. The model phrases an answer as JSON with
citations; `validate.check` drops any sentence whose numbers are not backed by what it cites.

Context budget per question (well under 8k input tokens): fixed instructions ~450 tokens,
report line ~60, at most MAX_FINDINGS finding lines ~45 tokens each, the last HISTORY_TURNS
turns cut to HISTORY_CHARS each, the question cut to QUESTION_CHARS. Output capped at
MAX_OUTPUT_TOKENS. Findings are referenced as F1..Fn (short, and never mangled by redaction).
"""

import json
import logging
from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal
from typing import Any, Literal, Protocol
from uuid import UUID

from services.analyze import api as analyze
from services.ask.validate import REPORT_REF, Figure, check
from services.gateway.db import UserConn
from services.llm import api as llm
from services.report import api as report

logger = logging.getLogger("ask")

PROMPT_VERSION = "v1"
MAX_FINDINGS = 60
HISTORY_TURNS = 4
HISTORY_CHARS = 400
QUESTION_CHARS = 500
MAX_OUTPUT_TOKENS = 700
LANGUAGES = {"kk": "Kazakh", "ru": "Russian", "en": "English"}


class Runner(Protocol):
    """The LLM gateway's `run` (services.llm.Gateway)."""

    def run(
        self,
        *,
        org_id: UUID,
        task: str,
        version: str,
        variables: dict[str, str],
        model: str,
        max_tokens: int,
    ) -> Any: ...


class AskDisabled(Exception):
    """The organization has not opted in to Ask (organizations.ask_enabled)."""


class NotReleased(Exception):
    """Ask only answers about released reports."""


@dataclass(frozen=True)
class Turn:
    role: Literal["user", "assistant"]
    text: str


@dataclass(frozen=True)
class Answer:
    answerable: bool
    sentences: list[dict[str, Any]]
    dropped: int
    numbers_total: int
    numbers_cited: int


def ask(
    conn: UserConn,
    org_id: UUID,
    report_id: UUID,
    question: str,
    history: list[Turn],
    *,
    runner: Runner,
    model: str,
    locale: str,
) -> Answer:
    enabled = conn.execute(
        "select ask_enabled from public.organizations where id = %s", (org_id,)
    ).fetchone()
    if not enabled or not enabled["ask_enabled"]:
        raise AskDisabled
    head = report.get_report(conn, org_id, report_id)
    if head is None:
        raise LookupError("report")
    if head["status"] not in ("released", "superseded"):
        raise NotReleased
    kept = [f for f in analyze.findings(conn, org_id, report_id) if f["decision"] != "reject"]
    return answer_from(
        head, kept, question, history, runner=runner, model=model, locale=locale, org_id=org_id
    )


def answer_from(
    head: dict[str, Any],
    findings: list[dict[str, Any]],
    question: str,
    history: list[Turn],
    *,
    runner: Runner,
    model: str,
    locale: str,
    org_id: UUID,
) -> Answer:
    """The DB-free core: build the context, ask the model, validate. Used by `ask` and evals."""
    kept = sorted(findings, key=lambda f: Decimal(f["saving_estimate"]), reverse=True)
    kept = kept[:MAX_FINDINGS]
    refs: dict[str, str] = {}  # F1 -> evidence id
    figures: dict[str, Figure] = {
        REPORT_REF: Figure(
            ref=REPORT_REF,
            amounts=(Decimal(head["total_saving"]),),
            counts=(len(kept),),
        )
    }
    lines = []
    for i, f in enumerate(kept, start=1):
        ref = f"F{i}"
        refs[ref] = str(f["evidence_id"]) if f["evidence_id"] else ""
        pct = int((Decimal(f["confidence"]) * 100).quantize(Decimal(1), rounding=ROUND_HALF_UP))
        names = tuple(n for n in (f["item_name"], f["supplier_name"]) if n)
        figures[ref] = Figure(
            ref=ref, amounts=(Decimal(f["saving_estimate"]),), percents=(pct,), names=names
        )
        lines.append(
            f"[{ref}] type={f['type']}; item={f['item_name'] or '-'}; "
            f"supplier={f['supplier_name'] or '-'}; saving_kzt={f['saving_estimate']}; "
            f"confidence={pct}%; method={f['method']}"
        )
    report_line = (
        f"[{REPORT_REF}] title={head['title']}; "
        f"period={head['period_start']}..{head['period_end']}; "
        f"total_saving_kzt={head['total_saving']}; findings={len(kept)}"
    )
    recent = history[-HISTORY_TURNS:]
    history_text = "\n".join(f"{t.role}: {t.text[:HISTORY_CHARS]}" for t in recent) or "-"

    result = runner.run(
        org_id=org_id,
        task="ask",
        version=PROMPT_VERSION,
        variables={
            "language": LANGUAGES.get(locale, "Russian"),
            "report": report_line,
            "findings": "\n".join(lines) or "-",
            "history": history_text,
            "question": question[:QUESTION_CHARS],
        },
        model=model,
        max_tokens=MAX_OUTPUT_TOKENS,
    )
    try:
        raw: object = json.loads(result.text)
    except (TypeError, ValueError):
        raw = None
    checked = check(raw, figures, instructions=llm.load_prompt("ask", PROMPT_VERSION).template)
    if checked.dropped:
        # Counts only: the dropped text may hold tenant data.
        logger.info("ask sentences dropped", extra={"dropped": checked.dropped})
    return Answer(
        answerable=checked.answerable,
        sentences=[
            {
                "text": s.text,
                "evidence_ids": [refs[r] for r in s.evidence_ids if refs.get(r)],
                "cites_report": REPORT_REF in s.evidence_ids,
            }
            for s in checked.sentences
        ],
        dropped=checked.dropped,
        numbers_total=checked.numbers_total,
        numbers_cited=checked.numbers_cited,
    )
