"""Structured JSON logs. Allowlisted fields only: no emails, names, prices or query strings."""

import contextvars
import json
import logging
import sys

request_id: contextvars.ContextVar[str] = contextvars.ContextVar("request_id", default="-")

ALLOWED = {"route", "method", "status", "duration_ms", "org_id", "error_type"}


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "level": record.levelname.lower(),
            "logger": record.name,
            "msg": record.getMessage(),
            "request_id": request_id.get(),
        }
        payload.update({k: v for k, v in record.__dict__.items() if k in ALLOWED})
        return json.dumps(payload, ensure_ascii=False)


def configure() -> None:
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonFormatter())
    root = logging.getLogger()
    root.handlers[:] = [handler]
    root.setLevel(logging.INFO)
    logging.getLogger("uvicorn.access").disabled = True  # we log requests ourselves, without URLs
