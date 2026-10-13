"""Agent-ready MCP API (D24): authenticated, tenant-scoped, read-only, Evidence-citing."""

import json
from typing import Any

import pytest
from fastapi.testclient import TestClient

from services.gateway.testing import ORG_A, ORG_B, auth

pytestmark = pytest.mark.integration
REPORT_A = "40000000-0000-4000-a000-00000000000a"
ALFA = "7a000000-0000-4000-a000-0000000000a1"
HEADERS = {"Accept": "application/json, text/event-stream", "Content-Type": "application/json"}


def rpc(client: TestClient, method: str, params: dict[str, Any], user: str | None) -> Any:
    headers = {**HEADERS, **(auth(user) if user else {})}
    body = {"jsonrpc": "2.0", "id": 1, "method": method, "params": params}
    return client.post("/mcp/", headers=headers, content=json.dumps(body))


def call(client: TestClient, user: str, tool: str, **args: Any) -> dict[str, Any]:
    r = rpc(client, "tools/call", {"name": tool, "arguments": args}, user)
    assert r.status_code == 200, r.text
    return dict(r.json()["result"])


def test_no_token_no_access(client: TestClient) -> None:
    assert rpc(client, "tools/list", {}, None).status_code == 401


def test_tools_are_read_only_and_listed(client: TestClient) -> None:
    r = rpc(client, "tools/list", {}, "clientAdminA")
    tools = {t["name"]: t for t in r.json()["result"]["tools"]}
    assert {"list_reports", "get_findings", "get_evidence", "get_supplier_dossier"} <= set(tools)
    assert all(t["annotations"]["readOnlyHint"] for t in tools.values())


def test_findings_carry_evidence_and_untrusted_text_is_data(client: TestClient) -> None:
    out = call(client, "clientUserA", "get_findings", org_id=ORG_A, report_id=REPORT_A)
    assert not out["isError"]
    payload = out["structuredContent"]
    assert payload["note"].startswith("Fields named `data`")
    assert payload["findings"] and all(f["evidence_id"] for f in payload["findings"])
    ev = call(client, "clientUserA", "get_evidence", org_id=ORG_A,
              evidence_id=payload["findings"][0]["evidence_id"])  # fmt: skip
    assert ev["structuredContent"]["evidence"]["computation_id"]


def test_another_tenant_is_not_found(client: TestClient) -> None:
    out = call(client, "clientUserA", "list_reports", org_id=ORG_B)
    assert out["isError"] is True


def test_supplier_dossier_through_mcp(client: TestClient) -> None:
    client.post(f"/orgs/{ORG_A}/suppliers/{ALFA}/dossier", headers=auth("clientUserA"))
    out = call(client, "clientUserA", "get_supplier_dossier", org_id=ORG_A, supplier_id=ALFA)
    d = out["structuredContent"]["dossier"]
    assert d["risk"]["verdict"] in ("caution", "high_risk")
    assert d["company"]["data"]["name"] == "ТОО «Альфа»"
