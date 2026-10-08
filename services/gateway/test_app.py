"""Unit tests: no database, no network."""

import json
import logging

import pytest
from fastapi.testclient import TestClient

from services.gateway import log
from services.gateway.app import app


class FakeDb:
    def __init__(self, ok: bool) -> None:
        self.ok = ok

    def ping(self) -> bool:
        if not self.ok:
            raise ConnectionError("db down")
        return True


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)  # no `with`: lifespan (real DB + JWKS) is not started


def test_health_ok(client: TestClient) -> None:
    app.state.db = FakeDb(ok=True)
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok", "db": "ok"}


def test_health_reports_db_down_with_503(client: TestClient) -> None:
    app.state.db = FakeDb(ok=False)
    r = client.get("/health")
    assert r.status_code == 503
    assert r.json() == {"status": "ok", "db": "down"}


def test_request_id_is_echoed_when_valid_and_replaced_when_not(client: TestClient) -> None:
    app.state.db = FakeDb(ok=True)
    assert (
        client.get("/health", headers={"X-Request-Id": "abc12345"}).headers["x-request-id"]
        == "abc12345"
    )
    bad = client.get("/health", headers={"X-Request-Id": "<script>"}).headers["x-request-id"]
    assert bad != "<script>" and len(bad) == 32


def test_protected_routes_require_a_token(client: TestClient) -> None:
    assert client.get("/me").status_code == 401
    assert client.get("/orgs/10000000-0000-4000-a000-00000000000a/reports").status_code == 401


def test_log_lines_keep_only_allowlisted_fields() -> None:
    record = logging.LogRecord("gateway", logging.INFO, __file__, 1, "request", None, None)
    record.route = "/orgs/{org_id}/reports"
    record.email = "someone@example.com"  # must never reach the log line
    record.query = "?price=123"
    line = json.loads(log.JsonFormatter().format(record))
    assert line["route"] == "/orgs/{org_id}/reports"
    assert "email" not in line and "query" not in line
    assert "someone@example.com" not in json.dumps(line)
