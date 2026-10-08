"""Redaction before anything leaves our boundary. Conservative: over-redacting is acceptable."""

import re

PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    ("EMAIL", re.compile(r"[\w.+-]+@[\w-]+(\.[\w-]+)+")),
    ("IBAN", re.compile(r"\bKZ\d{2}[A-Z0-9]{16}\b", re.IGNORECASE)),
    ("CARD", re.compile(r"\b(?:\d[ -]?){15,18}\d\b")),
    ("IIN_BIN", re.compile(r"\b\d{12}\b")),  # KZ IIN (people) and BIN (companies) are 12 digits
    ("PHONE", re.compile(r"(?:\+7|\b8)[\s(-]*\d{3}[\s)-]*\d{3}[\s-]*\d{2}[\s-]*\d{2}\b")),
]


def redact(text: str) -> tuple[str, bool]:
    """Return (redacted text, whether anything was replaced)."""
    changed = False
    for label, pattern in PATTERNS:
        text, n = pattern.subn(f"[{label}]", text)
        changed = changed or n > 0
    return text, changed
