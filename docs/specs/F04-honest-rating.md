# F04. Honest supplier rating (future)

| Field | Value |
|---|---|
| User | Buyers (read), suppliers (dispute) |
| Phase | 6 (M8) |
| Dependencies | C06, C12 delivery performance |
| Regulatory flag | HIGH: defamation, unfair competition; counsel reviews method and dispute process |

**Job:** "Trust a rating because I can see exactly how it is computed and nobody can buy a better one."
**Flow:** published formula -> rating from verified events only -> dispute workflow with SLA -> audit log of every change.
**Acceptance:** no pay-to-rank ever (test: billing state has no effect on rank); disputes resolved within SLA.
**Open term:** "honest rating".
