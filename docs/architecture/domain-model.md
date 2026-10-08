# Domain model: bounded contexts, events, state machines

Status: M0 proposal (2026-10-08). Terms: `CONTEXT.md`. Miro mirror: see link at the end. Each context is a deep module under `services/` (ADR 0001); contexts talk through their public interface or domain events, never through each other's tables.

## Bounded contexts

```mermaid
flowchart LR
  subgraph Core["Core (Phase 1)"]
    ING[Ingest<br/>services/ingest]
    NORM[Normalize<br/>services/normalize]
    ANA[Analyze<br/>services/analyze]
    EVD[Evidence<br/>services/evidence]
    REP[Report & Review<br/>services/report]
    CHAT[Ask<br/>services/chat]
  end
  subgraph Trust["Supplier trust (Phase 2)"]
    SUP[Supplier 360<br/>services/supplier]
    CMP[Compliance / Screening<br/>services/compliance]
  end
  subgraph Buy["Procurement OS (Phase 3)"]
    SPEC[Spec checker<br/>services/specs]
    RFQ[RFQ & Offers<br/>services/rfq]
    CAT[Catalogue<br/>services/catalog]
  end
  subgraph Move["Logistics (Phase 4-5)"]
    LOG[Shipments & Events<br/>services/logistics/*]
    FC[Forecasting / ETA<br/>services/forecasting]
    RAD[Risk Radar<br/>services/radar]
  end
  subgraph Platform
    GW[Gateway / Tenancy<br/>services/gateway]
    LLM[LLM gateway<br/>services/llm]
    CON[Connectors<br/>connectors/*]
    NOTIF[Notifications]
  end
  ING -->|PurchaseLinesIngested| NORM -->|LinesNormalized| ANA -->|FindingsComputed| REP
  ANA --> EVD
  REP -->|ReportReleased| CHAT
  CON --> SUP & CMP & LOG & RAD
  SUP <--> CMP
  ANA -->|price history| CAT
  CAT --> RFQ
  SPEC --> RFQ -->|OrderPlaced| LOG
  CMP -->|ScreeningHitConfirmed| RFQ & LOG
  LOG --> FC
  RAD -->|AlertRaised| NOTIF
  LOG -->|ExceptionRaised| NOTIF
  LLM -.used by.- NORM & CHAT & SPEC & SUP & RAD & LOG
```

Relationship types: Ingest -> Normalize -> Analyze is a pipeline (customer/supplier). Connectors are an anti-corruption layer for every external source. Compliance is a shared kernel for Party/Screening used by Supplier 360, RFQ and Logistics. The LLM gateway is a generic subdomain: no context calls a model API directly.

## Domain events (past tense, append-only, carry `org_id`)

| Context | Event | Key payload | Consumers |
|---|---|---|---|
| Ingest | `UploadReceived` | upload_id, sha256, rows | Ingest |
| Ingest | `PurchaseLinesIngested` | upload_id, valid_rows, rejected_rows | Normalize |
| Normalize | `LineMatched` / `LineSentToReview` | line_id, item_code, confidence, method | Analyze, review queue |
| Normalize | `MatchConfirmedByHuman` | line_id, item_code, reviewer | Analyze, evals |
| Normalize | `SupplierResolved` / `SuppliersMerged` / `SupplierMergeReverted` | supplier ids, BIN | Supplier 360 |
| Analyze | `FindingsComputed` | run_id, detector versions, finding ids | Report |
| Report | `ReportSubmittedForReview` / `FindingReviewed` / `ReportApproved` / `ReportReleased` / `ReportRejected` | report_id, version, reviewer | Ask, notifications, audit |
| Compliance | `PartyScreened` | party_id, source_version, result | Supplier 360 |
| Compliance | `ScreeningHitConfirmed` / `ScreeningHitDismissed` | party_id, reason_code, reviewer | RFQ, Logistics, Alerts |
| Supplier | `SupplierInvited` / `OnboardingSubmitted` / `SupplierApproved` | supplier_id | RFQ, portal |
| RFQ | `RfqApproved` / `RfqSent` / `OfferReceived` / `OfferConfirmed` / `DecisionRecorded` | rfq_id, version | Catalogue, Orders |
| Orders | `OrderPlaced` | order_id, items, supplier, incoterms | Logistics |
| Logistics | `ShipmentCreated`, `LegPlanned`, `ShipmentEventRecorded`, `DocumentReceived`, `DocumentMismatchFlagged`, `ExceptionRaised` | shipment_id, source, confidence | Forecasting, Alerts |
| Forecasting | `EtaUpdated` | shipment_id, quantiles, model version, prior flag | UI, Alerts |
| Radar | `AlertRaised` / `AlertFeedbackGiven` | alert_id, links, source_url | Notifications, evals |

## Shipment state machine

State is a fold over ShipmentEvents (ADR 0003). Illegal transitions are rejected and logged as `ConflictingEventIgnored`, never silently applied.

```mermaid
stateDiagram-v2
  [*] --> planned: ShipmentCreated
  planned --> booked: CarrierBooked
  planned --> cancelled: Cancelled
  booked --> picked_up: PickedUp
  booked --> cancelled: Cancelled
  picked_up --> in_transit: DepartedNode
  in_transit --> at_border: ArrivedAtBorder
  at_border --> customs_hold: CustomsHold
  customs_hold --> at_border: HoldReleased
  at_border --> in_transit: BorderCleared
  in_transit --> transshipment: ArrivedAtTerminal
  transshipment --> in_transit: DepartedNode
  in_transit --> arrived: ArrivedAtDestination
  arrived --> delivered: ProofOfDelivery
  delivered --> closed: DocumentsComplete
  in_transit --> exception: Damage / Lost
  exception --> in_transit: ExceptionResolved
  exception --> closed: ClaimSettled
```

`delayed` is **not** a state: it is a derived flag (actual or forecast arrival beyond the promised window), so a Shipment can be `in_transit` and delayed at once.

## Document lifecycle

```mermaid
stateDiagram-v2
  [*] --> received: upload / email / connector
  received --> rejected_file: unreadable / malware / wrong type
  received --> extracted: OCR + field extraction
  extracted --> confirmed: human or sender confirms fields
  confirmed --> cross_checked: compare to Order, Items, other docs
  cross_checked --> accepted: no mismatch
  cross_checked --> mismatch: qty / weight / HS / parties / Incoterms / dates differ
  mismatch --> resolved: corrected version or accepted with reason
  resolved --> accepted
  accepted --> superseded: newer version received
```

## Report lifecycle

```mermaid
stateDiagram-v2
  [*] --> draft: FindingsComputed
  draft --> in_review: submit
  in_review --> draft: reviewer requests changes
  in_review --> approved: all findings reviewed + approve
  in_review --> rejected
  approved --> released: reviewer releases (client can now see it)
  released --> superseded: new version released
```

Miro mirror (view only; the repo is the source of truth): https://miro.com/app/board/uXjVEclV0Io=/
