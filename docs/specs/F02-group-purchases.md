# F02. Group purchases (future)

| Field | Value |
|---|---|
| User | Procurement managers of several consenting tenants |
| Phase | 6 (M8) |
| Dependencies | C11 consent model, C10 |
| Regulatory flag | HIGH: competition law (buyer cartels), data sharing consent; counsel first |

**Job:** "Buy common items together for a better price without revealing our volumes."
**Flow:** opt-in -> aggregate demand for the same Item (k-anonymous) -> joint RFQ run by QazSupply -> allocation.
**Acceptance:** anonymity tests prove no tenant volume leakage; consent ledger; revocation works.
**AI vs deterministic:** aggregation deterministic. **Human gate:** each tenant confirms participation and award.
**Open term:** "group purchase" (CONTEXT.md).
