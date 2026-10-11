"""Ask route (M3): one cited answer about one released report. Thin handler over services.ask."""

import logging
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field, StringConstraints

from services.ask import api as ask
from services.gateway.db import Database
from services.gateway.deps import OrgConn
from services.llm.api import Gateway, LlmBlocked, PostgresLedger, ProviderError

router = APIRouter(tags=["ask"])
logger = logging.getLogger("gateway")
Text = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=500)]


class AskTurn(BaseModel):
    role: Literal["user", "assistant"]
    text: Annotated[str, StringConstraints(max_length=2000)]


class AskRequest(BaseModel):
    question: Text
    locale: Literal["kk", "ru", "en"] = "ru"
    history: list[AskTurn] = Field(default_factory=list, max_length=8)


class AskSentence(BaseModel):
    text: str
    evidence_ids: list[UUID]
    cites_report: bool


class AskAnswer(BaseModel):
    answerable: bool
    sentences: list[AskSentence]
    dropped: int


@router.post("/orgs/{org_id}/reports/{report_id}/ask")
def ask_report(
    org_id: UUID, report_id: UUID, body: AskRequest, conn: OrgConn, request: Request
) -> AskAnswer:
    provider = request.app.state.llm_provider
    if provider is None:
        raise HTTPException(503, {"code": "ask_unavailable"})
    db: Database = request.app.state.db
    error: Exception | None = None
    answer: ask.Answer | None = None
    # The ledger commits on its own connection even when the call fails (budget, kill switch).
    with db.service() as svc:
        try:
            answer = ask.ask(
                conn,
                org_id,
                report_id,
                body.question,
                [ask.Turn(t.role, t.text) for t in body.history],
                runner=Gateway(provider, PostgresLedger(svc)),
                model=request.app.state.ask_model,
                locale=body.locale,
            )
        except Exception as e:  # noqa: BLE001 - re-raised as an HTTP error below
            error = e
    if isinstance(error, ask.AskDisabled):
        raise HTTPException(409, {"code": "ask_disabled"})
    if isinstance(error, ask.NotReleased):
        raise HTTPException(409, {"code": "not_released"})
    if isinstance(error, LookupError):
        raise HTTPException(404, "not found")
    if isinstance(error, LlmBlocked):
        status = 429 if error.status == "blocked_budget" else 503
        raise HTTPException(status, {"code": error.status})
    if isinstance(error, (ProviderError, TimeoutError)):
        logger.warning("ask provider failure", extra={"error_type": type(error).__name__})
        raise HTTPException(502, {"code": "model_error"})
    if error is not None:
        raise error
    assert answer is not None
    return AskAnswer(
        answerable=answer.answerable,
        sentences=[AskSentence(**s) for s in answer.sentences],
        dropped=answer.dropped,
    )
