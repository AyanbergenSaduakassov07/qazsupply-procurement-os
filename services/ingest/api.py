"""Ingest module public interface.

preview(): parse + suggest a mapping, nothing is stored.
ingest():  validate every row, store valid lines with source row + raw cells, report the rest.
Invalid rows never block valid rows. Re-uploading the same file (sha256) in the same org is a
no-op that returns the earlier upload.
"""

import hashlib
import json
from dataclasses import asdict, dataclass, field
from datetime import date
from decimal import Decimal
from typing import Any
from uuid import UUID

from services.gateway.db import UserConn
from services.ingest.mapping import FIELDS, MappingSuggestion, missing_required, suggest
from services.ingest.parse import MAX_BYTES, FileRejected, Sheet, read_file
from services.ingest.values import normalise_unit, parse_currency, parse_date, parse_number

PREVIEW_ROWS = 20
CONTENT_TYPES = {
    ".csv": "text/csv",
    ".txt": "text/csv",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
}

__all__ = [
    "FileRejected",
    "Preview",
    "IngestResult",
    "RowError",
    "preview",
    "ingest",
    "validate",
    "list_uploads",
    "MAX_BYTES",
]


@dataclass(frozen=True)
class RowError:
    row: int  # 1-based row number in the sheet, as the user sees it in Excel
    code: str  # i18n key suffix: ingest.row.<code>
    column: str | None = None


@dataclass(frozen=True)
class ParsedLine:
    source_row: int
    raw: dict[str, Any]
    item_text: str
    quantity: Decimal | None
    unit: str | None
    unit_price: Decimal
    currency: str
    purchased_on: date
    supplier_text: str | None
    supplier_bin: str | None
    warnings: tuple[str, ...] = ()


@dataclass(frozen=True)
class Preview:
    sha256: str
    sheets: list[str]
    sheet: str
    header_row: int
    columns: list[str]
    mapping: dict[str, int]
    missing_required: list[str]
    sample: list[list[str]]
    rows_total: int
    errors_by_code: dict[str, int]


@dataclass(frozen=True)
class IngestResult:
    file_id: UUID
    duplicate: bool
    inserted: int
    rejected: int
    errors: list[RowError] = field(default_factory=list)


def _sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _pick(sheets: list[Sheet], name: str | None) -> Sheet:
    if not sheets:
        raise FileRejected("empty")
    return next((s for s in sheets if s.name == name), sheets[0])


def validate(
    rows: list[list[object]], header_row: int, mapping: dict[str, int]
) -> tuple[list[ParsedLine], list[RowError]]:
    lines: list[ParsedLine] = []
    errors: list[RowError] = []
    seen: set[tuple[object, ...]] = set()
    header = [str(v) for v in rows[header_row - 1]] if rows else []
    for idx in range(header_row, len(rows)):
        row, row_no = rows[idx], idx + 1
        if all(str(v).strip() == "" for v in row):
            continue

        def cell(f: str, row: list[object] = row) -> object:
            col = mapping.get(f)
            return row[col] if col is not None and col < len(row) else ""

        item = str(cell("item_text")).strip()
        if not item:
            errors.append(RowError(row_no, "missing_item", "item_text"))
            continue
        try:
            purchased_on = parse_date(cell("purchased_on"))
        except ValueError:
            code = "missing_date" if str(cell("purchased_on")).strip() == "" else "bad_date"
            errors.append(RowError(row_no, code, "purchased_on"))
            continue
        warnings: list[str] = []
        quantity: Decimal | None = None
        if str(cell("quantity")).strip():
            try:
                quantity = parse_number(cell("quantity"))
            except ValueError:
                errors.append(RowError(row_no, "bad_number", "quantity"))
                continue
        try:
            if str(cell("unit_price")).strip():
                unit_price = parse_number(cell("unit_price"))
            elif str(cell("total")).strip() and quantity:
                unit_price = parse_number(cell("total")) / quantity
                warnings.append("price_from_total")
            else:
                errors.append(RowError(row_no, "missing_price", "unit_price"))
                continue
        except ValueError:
            errors.append(RowError(row_no, "bad_number", "unit_price"))
            continue
        if unit_price < 0:
            errors.append(RowError(row_no, "negative_price", "unit_price"))
            continue
        if "currency" in mapping and str(cell("currency")).strip():
            try:
                currency = parse_currency(cell("currency"))
            except ValueError:
                errors.append(RowError(row_no, "unknown_currency", "currency"))
                continue
        else:
            currency = "KZT"
            warnings.append("currency_assumed_kzt")
        bin_raw = "".join(ch for ch in str(cell("supplier_bin")) if ch.isdigit())
        supplier_bin = bin_raw if len(bin_raw) == 12 else None
        if str(cell("supplier_bin")).strip() and supplier_bin is None:
            warnings.append("bad_bin")
        supplier = str(cell("supplier_text")).strip() or None
        key = (item.lower(), quantity, unit_price, purchased_on, (supplier or "").lower())
        if key in seen:
            warnings.append("possible_duplicate")
        seen.add(key)
        raw = {
            header[i] if i < len(header) and header[i] else f"col{i + 1}": str(v)
            for i, v in enumerate(row)
        }
        lines.append(
            ParsedLine(
                source_row=row_no,
                raw=raw,
                item_text=item,
                quantity=quantity,
                unit=normalise_unit(cell("unit")) or (str(cell("unit")).strip() or None),
                unit_price=unit_price,
                currency=currency,
                purchased_on=purchased_on,
                supplier_text=supplier,
                supplier_bin=supplier_bin,
                warnings=tuple(warnings),
            )
        )
    return lines, errors


def preview(data: bytes, filename: str, sheet: str | None = None) -> Preview:
    sheets = read_file(data, filename)
    chosen = _pick(sheets, sheet)
    s: MappingSuggestion = suggest(chosen.rows)
    _, errors = (
        validate(chosen.rows, s.header_row, s.mapping) if not s.missing_required else ([], [])
    )
    counts: dict[str, int] = {}
    for e in errors:
        counts[e.code] = counts.get(e.code, 0) + 1
    body = chosen.rows[s.header_row : s.header_row + PREVIEW_ROWS]
    return Preview(
        sha256=_sha(data),
        sheets=[x.name for x in sheets],
        sheet=chosen.name,
        header_row=s.header_row,
        columns=s.columns,
        mapping=s.mapping,
        missing_required=s.missing_required,
        sample=[[str(v) for v in r] for r in body],
        rows_total=max(len(chosen.rows) - s.header_row, 0),
        errors_by_code=counts,
    )


def ingest(
    conn: UserConn,
    org_id: UUID,
    data: bytes,
    filename: str,
    mapping: dict[str, int],
    sheet: str | None = None,
    header_row: int | None = None,
) -> IngestResult:
    unknown = set(mapping) - set(FIELDS)
    if unknown or missing_required(mapping):
        raise FileRejected("bad_mapping")
    sha = _sha(data)
    existing = conn.execute(
        "select id, rows_total, rows_rejected from public.files where org_id = %s and sha256 = %s",
        (org_id, sha),
    ).fetchone()
    if existing:
        return IngestResult(existing["id"], True, 0, existing["rows_rejected"])
    chosen = _pick(read_file(data, filename), sheet)
    header = header_row or suggest(chosen.rows).header_row
    lines, errors = validate(chosen.rows, header, mapping)
    ext = "." + filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    file_row = conn.execute(
        """insert into public.files (org_id, name, sha256, size_bytes, content_type, storage_path,
             sheet, header_row, mapping, rows_total, rows_rejected, row_errors)
           values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s) returning id""",
        (
            org_id,
            filename[:255],
            sha,
            len(data),
            CONTENT_TYPES.get(ext, "application/octet-stream"),
            f"{org_id}/{sha}",
            chosen.name,
            header,
            json.dumps(mapping),
            len(lines) + len(errors),
            len(errors),
            json.dumps([asdict(e) for e in errors[:1000]]),
        ),
    ).fetchone()
    assert file_row is not None
    file_id: UUID = file_row["id"]
    with conn.cursor() as cur:
        cur.executemany(
            """insert into public.purchase_lines (org_id, file_id, source_row, raw, item_text,
                 quantity, unit, unit_price, currency, purchased_on, supplier_text, supplier_bin,
                 row_warnings)
               values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
            [
                (
                    org_id,
                    file_id,
                    ln.source_row,
                    json.dumps(ln.raw, ensure_ascii=False),
                    ln.item_text,
                    ln.quantity,
                    ln.unit,
                    ln.unit_price,
                    ln.currency,
                    ln.purchased_on,
                    ln.supplier_text,
                    ln.supplier_bin,
                    list(ln.warnings),
                )
                for ln in lines
            ],
        )
    return IngestResult(file_id, False, len(lines), len(errors), errors)


def list_uploads(conn: UserConn, org_id: UUID, limit: int = 100) -> list[dict[str, Any]]:
    return conn.execute(
        """select id, name, created_at, rows_total, rows_rejected,
             (select count(*) from public.purchase_lines pl where pl.file_id = f.id) as lines
           from public.files f where org_id = %s order by created_at desc limit %s""",
        (org_id, limit),
    ).fetchall()
