"""Procurement OS routes (M5). Thin handlers over services.procurement.api.

The database enforces the RFQ state machine; its reason codes come back as 409 {code}.
Nothing here sends a message or picks a winner on its own.
"""

from collections.abc import Callable
from datetime import date, datetime
from decimal import Decimal
from typing import Annotated, Any, Literal
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field, StringConstraints

from services.gateway.deps import OrgConn
from services.procurement import api as proc

router = APIRouter(tags=["procurement"])
Text = Annotated[str, StringConstraints(strip_whitespace=True, max_length=4000)]
Title = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=255)]


class SpecIn(BaseModel):
    text: Annotated[str, StringConstraints(max_length=50000)]


class Requirement(BaseModel):
    name: str
    comparator: str
    value: str
    unit: str
    span: tuple[int, int]


class SpecIssue(BaseModel):
    kind: str
    message: str
    span: tuple[int, int] | None
    suggestion: str | None


class SpecOut(BaseModel):
    requirements: list[Requirement]
    standards: list[str]
    family: str | None
    issues: list[SpecIssue]
    suggested: str


class Item(BaseModel):
    name: Title
    quantity: Decimal = Field(gt=0)
    unit: Annotated[str, StringConstraints(max_length=20)]
    enstru_code: str | None = None


class RfqIn(BaseModel):
    title: Title
    deadline: date | None = None
    spec_text: Annotated[str, StringConstraints(max_length=50000)] = ""
    items: list[Item] = Field(min_length=1, max_length=200)
    terms: dict[str, Any] = {}


class VersionIn(BaseModel):
    spec_text: Annotated[str, StringConstraints(max_length=50000)] = ""
    items: list[Item] = Field(min_length=1, max_length=200)
    terms: dict[str, Any] = {}


class Note(BaseModel):
    note: Text | None = None


class InviteIn(BaseModel):
    supplier_id: UUID
    channel: Literal["portal", "email", "phone", "other"]
    email: Annotated[str, StringConstraints(max_length=255)] | None = None


class OfferLine(BaseModel):
    item: int = Field(ge=0, le=199)
    unit_price: Decimal | None = Field(default=None, ge=0)
    note: Annotated[str, StringConstraints(max_length=500)] | None = None


class OfferIn(BaseModel):
    invite_id: UUID
    source: Literal["portal", "email", "pdf", "phone", "manual"]
    currency: Annotated[str, StringConstraints(pattern=r"^[A-Z]{3}$")]
    payment_days: int | None = Field(default=None, ge=0, le=365)
    lead_time_days: int | None = Field(default=None, ge=0, le=730)
    valid_until: date | None = None
    incoterms: Annotated[str, StringConstraints(pattern=r"^[A-Z]{3}$")] | None = None
    lines: list[OfferLine] = Field(min_length=1, max_length=200)


class WeightsIn(BaseModel):
    weights: dict[Literal["price", "lead_time", "payment", "risk"], float]


class DecisionIn(BaseModel):
    offer_id: UUID
    reason: Annotated[str, StringConstraints(strip_whitespace=True, min_length=10, max_length=4000)]


class RfqRow(BaseModel):
    id: UUID
    title: str
    status: str
    current_version: int
    deadline: date | None
    created_at: datetime
    invites: int
    offers: int
    due_soon: bool


class RfqDetail(BaseModel):
    id: UUID
    title: str
    status: str
    current_version: int
    deadline: date | None
    weights: dict[str, Any]
    created_at: datetime
    mine: bool
    versions: list[dict[str, Any]]
    approvals: list[dict[str, Any]]
    invites: list[dict[str, Any]]
    offers: list[dict[str, Any]]
    decision: dict[str, Any] | None


class ComparisonRow(BaseModel):
    offer_id: str
    supplier: str
    confirmed: bool
    currency: str
    total: Decimal | None
    total_kzt: Decimal | None
    rate: Decimal | None
    rate_date: date | None
    lead_time: int | None
    payment: int | None
    risk: int | None
    landed_cost: Decimal | None
    excluded: str | None
    score: Decimal | None
    deltas: dict[str, Decimal]


class ComparisonOut(BaseModel):
    rows: list[ComparisonRow]
    weights: dict[str, Decimal]
    winner: str | None
    sensitivity: list[dict[str, Any]]


def _call(fn: Callable[[], Any]) -> Any:
    try:
        return fn()
    except proc.Rejected as e:
        raise HTTPException(409, {"code": e.code}) from None
    except LookupError:
        raise HTTPException(404, "not found") from None


@router.post("/orgs/{org_id}/spec-check")
def spec_check(org_id: UUID, conn: OrgConn, body: SpecIn) -> SpecOut:
    r = proc.spec_check(body.text)
    return SpecOut(
        requirements=[Requirement(**q.__dict__) for q in r.requirements],
        standards=r.standards,
        family=r.family,
        issues=[SpecIssue(**i.__dict__) for i in r.issues],
        suggested=r.suggested,
    )


@router.get("/orgs/{org_id}/rfqs")
def list_rfqs(org_id: UUID, conn: OrgConn) -> list[RfqRow]:
    return [RfqRow(**r) for r in proc.list_rfqs(conn, org_id)]


@router.post("/orgs/{org_id}/rfqs", status_code=201)
def create_rfq(org_id: UUID, conn: OrgConn, body: RfqIn) -> dict[str, UUID]:
    items = [i.model_dump(mode="json") for i in body.items]
    rid = _call(
        lambda: proc.create_rfq(
            conn, org_id, body.title, body.deadline, body.spec_text, items, body.terms
        )
    )
    return {"id": rid}


@router.get("/orgs/{org_id}/rfqs/{rfq_id}")
def get_rfq(org_id: UUID, rfq_id: UUID, conn: OrgConn) -> RfqDetail:
    return RfqDetail(**_call(lambda: proc.get_rfq(conn, org_id, rfq_id)))


@router.post("/orgs/{org_id}/rfqs/{rfq_id}/versions", status_code=201)
def new_version(org_id: UUID, rfq_id: UUID, conn: OrgConn, body: VersionIn) -> dict[str, int]:
    items = [i.model_dump(mode="json") for i in body.items]
    return {
        "version": _call(
            lambda: proc.new_version(conn, org_id, rfq_id, body.spec_text, items, body.terms)
        )
    }


@router.post("/orgs/{org_id}/rfqs/{rfq_id}/approve", status_code=204)
def approve(org_id: UUID, rfq_id: UUID, conn: OrgConn, body: Note) -> None:
    _call(lambda: proc.approve(conn, org_id, rfq_id, body.note))


@router.post("/orgs/{org_id}/rfqs/{rfq_id}/invites", status_code=201)
def invite(org_id: UUID, rfq_id: UUID, conn: OrgConn, body: InviteIn) -> dict[str, UUID]:
    return {
        "id": _call(
            lambda: proc.invite(conn, org_id, rfq_id, body.supplier_id, body.channel, body.email)
        )
    }


@router.post("/orgs/{org_id}/rfq-invites/{invite_id}/sent", status_code=204)
def mark_sent(org_id: UUID, invite_id: UUID, conn: OrgConn) -> None:
    _call(lambda: proc.mark_sent(conn, org_id, invite_id))


@router.post("/orgs/{org_id}/rfqs/{rfq_id}/close", status_code=204)
def close(org_id: UUID, rfq_id: UUID, conn: OrgConn) -> None:
    _call(lambda: proc.close(conn, org_id, rfq_id))


@router.post("/orgs/{org_id}/rfqs/{rfq_id}/cancel", status_code=204)
def cancel(org_id: UUID, rfq_id: UUID, conn: OrgConn) -> None:
    _call(lambda: proc.cancel(conn, org_id, rfq_id))


@router.put("/orgs/{org_id}/rfqs/{rfq_id}/weights", status_code=204)
def set_weights(org_id: UUID, rfq_id: UUID, conn: OrgConn, body: WeightsIn) -> None:
    _call(
        lambda: proc.set_weights(conn, org_id, rfq_id, {str(k): v for k, v in body.weights.items()})
    )


@router.post("/orgs/{org_id}/rfqs/{rfq_id}/offers", status_code=201)
def add_offer(org_id: UUID, rfq_id: UUID, conn: OrgConn, body: OfferIn) -> dict[str, UUID]:
    o = body.model_dump(mode="json")
    return {"id": _call(lambda: proc.add_offer(conn, org_id, rfq_id, body.invite_id, o))}


@router.post("/orgs/{org_id}/offers/{offer_id}/confirm", status_code=204)
def confirm_offer(org_id: UUID, offer_id: UUID, conn: OrgConn, body: Note) -> None:
    _call(lambda: proc.confirm_offer(conn, org_id, offer_id, body.note))


@router.get("/orgs/{org_id}/rfqs/{rfq_id}/comparison")
def comparison(org_id: UUID, rfq_id: UUID, conn: OrgConn) -> ComparisonOut:
    c = _call(lambda: proc.comparison(conn, org_id, rfq_id))
    return ComparisonOut(
        rows=[ComparisonRow(**r.__dict__) for r in c.rows],
        weights=c.weights,
        winner=c.winner,
        sensitivity=c.sensitivity,
    )


@router.post("/orgs/{org_id}/rfqs/{rfq_id}/decision", status_code=201)
def decide(org_id: UUID, rfq_id: UUID, conn: OrgConn, body: DecisionIn) -> dict[str, UUID]:
    return {"id": _call(lambda: proc.decide(conn, org_id, rfq_id, body.offer_id, body.reason))}


class EntryIn(BaseModel):
    name: Title
    enstru_code: str | None = None
    unit: str | None = None
    attributes: dict[str, str] = {}
    standards: list[str] = []
    item_id: UUID | None = None


@router.get("/orgs/{org_id}/catalogue")
def search_catalogue(
    org_id: UUID,
    conn: OrgConn,
    q: str = "",
    attr: Annotated[list[str] | None, Query(max_length=10)] = None,
) -> dict[str, Any]:
    attrs = dict(a.split(":", 1) for a in (attr or []) if ":" in a)
    return dict(proc.search_catalogue(conn, org_id, q[:200], attrs))


@router.post("/orgs/{org_id}/catalogue", status_code=201)
def add_entry(org_id: UUID, conn: OrgConn, body: EntryIn) -> dict[str, UUID]:
    return {"id": proc.add_entry(conn, org_id, body.model_dump(mode="json"))}


@router.get("/orgs/{org_id}/catalogue/{entry_id}/prices")
def prices(org_id: UUID, entry_id: UUID, conn: OrgConn) -> list[dict[str, Any]]:
    return proc.price_history(conn, org_id, entry_id)


@router.get("/orgs/{org_id}/catalogue/{entry_id}/analogs")
def analogs(org_id: UUID, entry_id: UUID, conn: OrgConn) -> list[dict[str, Any]]:
    return list(_call(lambda: proc.analogs(conn, org_id, entry_id)))


class FeedbackIn(BaseModel):
    accepted: bool
    note: Text | None = None


@router.post("/orgs/{org_id}/catalogue/{entry_id}/analogs/{analog_id}/feedback", status_code=204)
def analog_feedback(
    org_id: UUID, entry_id: UUID, analog_id: UUID, conn: OrgConn, body: FeedbackIn
) -> None:
    proc.analog_feedback(conn, org_id, entry_id, analog_id, body.accepted, body.note)


@router.get("/orgs/{org_id}/catalogue-acceptance")
def acceptance(org_id: UUID, conn: OrgConn) -> dict[str, Any]:
    return proc.analog_acceptance(conn, org_id)
