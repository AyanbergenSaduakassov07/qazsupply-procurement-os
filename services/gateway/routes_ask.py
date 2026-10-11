"""Ask route (M3): one cited answer about one released report. Thin handler over services.ask."""

import logging
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field, StringConstraints

from services.ask import api as ask
from services.gateway.db import Database
from services.gateway.deps import Who
from services.llm.api import (
    Gateway,
    LlmBlocked,
    PooledLedger,
    ProviderError,
    TransientProviderError,
)
from services.tenancy import api as tenancy

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
    org_id: UUID, report_id: UUID, body: AskRequest, who: Who, request: Request
) -> AskAnswer:
    provider = request.app.state.llm_provider
    if provider is None:
        raise HTTPException(503, {"code": "ask_unavailable"})
    db: Database = request.app.state.db
    # 1. Load under the caller's RLS in a short transaction, then release the connection:
    #    the model call can take a minute and must not hold a pooled connection.
    try:
        with db.as_user(who) as conn:
            if not tenancy.is_member(conn, org_id):
                raise LookupError("org")
            context = ask.load(conn, org_id, report_id)
    except ask.AskDisabled:
        raise HTTPException(409, {"code": "ask_disabled"}) from None
    except ask.NotReleased:
        raise HTTPException(409, {"code": "not_released"}) from None
    except LookupError:
        raise HTTPException(404, "not found") from None
    # 2. Ask the model (no connection held); the ledger borrows one per short write.
    try:
        answer = ask.answer_from(
            context.head,
            context.findings,
            body.question,
            [ask.Turn(t.role, t.text) for t in body.history],
            runner=Gateway(provider, PooledLedger(db.service)),
            model=request.app.state.ask_model,
            locale=body.locale,
            org_id=org_id,
        )
    except LlmBlocked as e:
        raise HTTPException(
            429 if e.status == "blocked_budget" else 503, {"code": e.status}
        ) from None
    except (ProviderError, TimeoutError, TransientProviderError) as e:
        logger.warning("ask provider failure", extra={"error_type": type(e).__name__})
        raise HTTPException(502, {"code": "model_error"}) from None
    return AskAnswer(
        answerable=answer.answerable,
        sentences=[AskSentence(**s) for s in answer.sentences],
        dropped=answer.dropped,
    )
