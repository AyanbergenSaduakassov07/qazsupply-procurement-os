# services/analyze

Deterministic findings from normalised lines. No model touches any number.

**Public interface** (`services.analyze.api`):
- `run(conn, org_id) -> AnalysisResult`: staff only. Runs the detectors, recomputes the money in independent SQL (`savings_sql.py`) and fails closed on any mismatch, then writes a draft Report with Findings and Evidence as the signed-in reviewer (RLS applies).
- `findings(conn, org_id, report_id)`.

**Detectors** (`detectors.py`, version `0.1.0`): price_variance (supplier median vs median of other suppliers, same item and unit), outlier (above Q3 + 1.5 IQR and >= 30% over median), repeat_purchase (assumption-labelled consolidation estimate), split_purchase (risk, no saving), concentration (risk, no saving). Outlier lines already inside a price-variance finding are not counted twice. Thresholds: `config.py`, overridable per org (`organizations.analysis_config`). Evals: `evals/findings`.
