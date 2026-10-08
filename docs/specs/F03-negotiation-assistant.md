# F03. Negotiation assistant (future)

| Field | Value |
|---|---|
| User | Procurement manager |
| Phase | 6 (M8) |
| Dependencies | C03 findings, C10 offers, C11 price bands |
| Regulatory flag | Low; human sends all messages |

**Job:** "Walk into a negotiation with a target price and leverage, backed by data."
**Flow:** select offer -> brief: target price, leverage points, alternatives, all with Evidence -> draft message -> human edits and sends.
**Acceptance:** every number in the brief has an Evidence id; agent-security review: no send capability.
**AI vs deterministic:** targets computed; LLM drafts text.
