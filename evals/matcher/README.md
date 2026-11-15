# evals/matcher

Measures the item matcher (`services/normalize/matcher.py`). Results are appended to `results.jsonl` (append-only).

| File | What | Status |
|---|---|---|
| `golden_synthetic.csv` | 300 generated lines (ru, kk, kk without Kazakh letters, Latin, mixed; 10% no-match, 3% bundled), fixed seed, train/test split. Rebuild: `uv run python evals/matcher/build_synthetic.py` | Optimistic by construction (same team wrote generator and matcher) |
| `holdout_realistic.csv` | 50 export-style lines (brands, specs, sizes, near-miss items) labelled by the team | **Seen in development since 2026-10-09** (general fixes were derived from its misses); no longer a clean test |
| owner's 300 hand-labelled lines | The real M2 gate set | **Does not exist yet** (needs real ЕНС ТРУ + real exports) |

Commands:
```bash
uv run python -m evals.matcher.train          # fit calibration on the synthetic train split
uv run python -m evals.matcher.score --gate   # score; CI runs this with --no-log
```

Definitions are in `score.py`. The CI gate holds: synthetic auto-precision >= 0.90 and abstain <= 0.15; holdout auto-precision >= 0.95 and no-match lines never auto-coded (>= 0.95). **The M2 gate itself (>= 90% top-1 at <= 15% abstain on the owner's set) is not evaluated by this harness until that set exists.**

Locked surface: change golden sets or scorers only in a separate `harness-change` PR.
