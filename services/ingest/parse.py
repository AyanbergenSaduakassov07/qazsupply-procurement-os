"""File -> sheets of rows. CSV (encoding + delimiter detection) and XLSX (values, never formulas).

Rejected outright: macro-enabled workbooks, password-protected or corrupt files, oversized
files or sheets. Cell text is untrusted data: it is stored and displayed escaped, never executed.
"""

import csv
import io
import zipfile
from dataclasses import dataclass

from openpyxl import load_workbook

MAX_BYTES = 25 * 1024 * 1024
MAX_ROWS = 200_000
MAX_COLS = 60


class FileRejected(Exception):
    """The whole file is unusable. `code` maps to an i18n message (ingest.error.<code>)."""

    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


@dataclass(frozen=True)
class Sheet:
    name: str
    rows: list[list[object]]


def read_file(data: bytes, filename: str) -> list[Sheet]:
    if len(data) > MAX_BYTES:
        raise FileRejected("too_large")
    if not data:
        raise FileRejected("empty")
    name = filename.lower()
    if name.endswith((".xlsm", ".xlsb", ".xls")):
        raise FileRejected("unsupported_type")
    if name.endswith(".xlsx") or data[:2] == b"PK":
        return _read_xlsx(data)
    if name.endswith((".csv", ".txt")):
        return [_read_csv(data)]
    raise FileRejected("unsupported_type")


def _read_xlsx(data: bytes) -> list[Sheet]:
    try:
        with zipfile.ZipFile(io.BytesIO(data)) as z:
            names = z.namelist()
    except zipfile.BadZipFile as e:
        # Password-protected .xlsx files are OLE containers, not zips.
        raise FileRejected("unreadable") from e
    if any(n.lower().endswith("vbaproject.bin") for n in names):
        raise FileRejected("macros")
    try:
        wb = load_workbook(io.BytesIO(data), read_only=True, data_only=True)
    except Exception as e:  # noqa: BLE001 - openpyxl raises many types on corrupt input
        raise FileRejected("unreadable") from e
    sheets = []
    for ws in wb.worksheets:
        rows: list[list[object]] = []
        for i, row in enumerate(ws.iter_rows(values_only=True)):
            if i >= MAX_ROWS:
                raise FileRejected("too_many_rows")
            rows.append(["" if v is None else v for v in row[:MAX_COLS]])
        sheets.append(Sheet(ws.title, _trim(rows)))
    wb.close()
    return [s for s in sheets if s.rows]


def _read_csv(data: bytes) -> Sheet:
    for encoding in ("utf-8-sig", "cp1251"):
        try:
            text = data.decode(encoding)
            break
        except UnicodeDecodeError:
            continue
    else:
        raise FileRejected("encoding")
    sample = text[:4096]
    try:
        dialect: type[csv.Dialect] | csv.Dialect = csv.Sniffer().sniff(sample, delimiters=";,\t|")
    except csv.Error:
        dialect = csv.excel
    rows: list[list[object]] = []
    for i, row in enumerate(csv.reader(io.StringIO(text), dialect)):
        if i >= MAX_ROWS:
            raise FileRejected("too_many_rows")
        rows.append(list(row[:MAX_COLS]))
    return Sheet("csv", _trim(rows))


def _trim(rows: list[list[object]]) -> list[list[object]]:
    """Drop trailing empty rows and fully empty columns at the right edge."""
    while rows and all(str(v).strip() == "" for v in rows[-1]):
        rows.pop()
    width = max((len(r) for r in rows), default=0)
    while width and all(len(r) < width or str(r[width - 1]).strip() == "" for r in rows):
        width -= 1
    return [r[:width] + [""] * (width - len(r[:width])) for r in rows]
