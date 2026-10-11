"""Second, independent implementation of the savings math, in SQL.

`api.run()` computes findings in Python, recomputes the money-producing detectors here, and refuses
to persist anything if the two disagree (fail closed). Same thresholds, different code path.
"""

from decimal import Decimal
from typing import Any
from uuid import UUID

from services.analyze.config import AnalysisConfig
from services.gateway.db import UserConn

# Literal SQL only (no string composition). Quantiles use exact linear interpolation on sorted
# numeric arrays (same rule as detectors._quantile); percentile_cont is avoided because it
# computes in double precision. For q in (0,1): pos = (n-1)*q, lo = floor(pos), hi = lo+1 capped.
PRICE_VARIANCE = """
with l as (
  select id, item_id, unit_norm as unit, supplier_id, quantity as q, unit_price_kzt as p
  from public.purchase_lines
  where org_id = %(org)s and match_status in ('auto', 'confirmed') and item_id is not null
    and unit_price_kzt is not null and quantity is not null and supplier_id is not null
),
own_arr as (
  select item_id, unit, supplier_id, count(*)::int as n, array_agg(p order by p) as own_arr
  from l group by item_id, unit, supplier_id
),
own as (
  select o.item_id, o.unit, o.supplier_id, o.n,
         o.own_arr[k.lo + 1] + (o.own_arr[k.hi + 1] - o.own_arr[k.lo + 1]) * (k.pos - k.lo) as mean
  from own_arr o
  cross join lateral (
    select (o.n - 1) * 0.5 as pos, floor((o.n - 1) * 0.5)::int as lo,
           least(floor((o.n - 1) * 0.5)::int + 1, o.n - 1) as hi
  ) k
),
others as (
  select o.*, oth.n_other, oth.arr
  from own o
  cross join lateral (
    select count(*)::int as n_other, array_agg(x.p order by x.p) as arr
    from l x
    where x.item_id = o.item_id and x.unit is not distinct from o.unit
      and x.supplier_id <> o.supplier_id
  ) oth
),
ref as (
  select r.*, idx.pos - idx.lo as frac, r.arr[idx.lo + 1] as v_lo, r.arr[idx.hi + 1] as v_hi
  from others r
  cross join lateral (
    select (r.n_other - 1) * 0.5 as pos,
           floor((r.n_other - 1) * 0.5)::int as lo,
           least(floor((r.n_other - 1) * 0.5)::int + 1, r.n_other - 1) as hi
  ) idx
),
med as (
  select item_id, unit, supplier_id, n, mean, n_other,
         v_lo + (v_hi - v_lo) * frac as median_other
  from ref
)
select m.item_id, m.supplier_id,
  round((select sum((x.p - m.median_other) * x.q) from l x
         where x.item_id = m.item_id and x.unit is not distinct from m.unit
           and x.supplier_id = m.supplier_id and x.p > m.median_other), 2) as saving
from med m
where m.n >= %(min_lines)s and m.n_other >= %(min_lines)s and m.median_other > 0
  and m.mean > m.median_other * (1 + %(pct)s)
"""

OUTLIERS = """
with l as (
  select id, item_id, unit_norm as unit, quantity as q, unit_price_kzt as p
  from public.purchase_lines
  where org_id = %(org)s and match_status in ('auto', 'confirmed') and item_id is not null
    and unit_price_kzt is not null and quantity is not null
),
grp as (
  select item_id, unit, count(*)::int as n, array_agg(p order by p) as arr
  from l group by item_id, unit
),
quant as (
  select g.item_id, g.unit, g.n, k.q,
         g.arr[k.lo + 1] + (g.arr[k.hi + 1] - g.arr[k.lo + 1]) * (k.pos - k.lo) as v
  from grp g
  cross join lateral (
    select q, (g.n - 1) * q as pos, floor((g.n - 1) * q)::int as lo,
           least(floor((g.n - 1) * q)::int + 1, g.n - 1) as hi
    from unnest(array[0.25, 0.5, 0.75]::numeric[]) as q
  ) k
),
stats as (
  select item_id, unit, n,
         max(v) filter (where q = 0.25) as q1,
         max(v) filter (where q = 0.5) as med,
         max(v) filter (where q = 0.75) as q3
  from quant group by item_id, unit, n
)
select x.id as line_id, round((x.p - s.med) * x.q, 2) as saving
from l x join stats s on s.item_id = x.item_id and s.unit is not distinct from x.unit
cross join lateral (
  select greatest(s.q3 + %(k)s * (s.q3 - s.q1), s.med * (1 + %(premium)s)) as fence
) f
where s.n >= %(min_lines)s and x.p > f.fence and f.fence > 0
"""


def price_variance(
    conn: UserConn, org_id: UUID, cfg: AnalysisConfig
) -> dict[tuple[UUID, UUID], Decimal]:
    rows: list[dict[str, Any]] = conn.execute(
        PRICE_VARIANCE,
        {
            "org": org_id,
            "min_lines": cfg.price_variance_min_lines,
            "pct": cfg.price_variance_min_pct,
        },
    ).fetchall()
    return {
        (r["item_id"], r["supplier_id"]): Decimal(r["saving"])
        for r in rows
        if r["saving"] and r["saving"] > 0
    }


def outliers(conn: UserConn, org_id: UUID, cfg: AnalysisConfig) -> dict[UUID, Decimal]:
    rows: list[dict[str, Any]] = conn.execute(
        OUTLIERS,
        {
            "org": org_id,
            "min_lines": cfg.outlier_min_lines,
            "k": cfg.outlier_iqr_k,
            "premium": cfg.outlier_min_premium,
        },
    ).fetchall()
    return {r["line_id"]: Decimal(r["saving"]) for r in rows}
