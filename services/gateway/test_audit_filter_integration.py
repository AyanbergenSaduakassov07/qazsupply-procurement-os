"""Audit log action-family filter: older uploads stay reachable as screening grows the log."""

import pytest
from fastapi.testclient import TestClient

from services.gateway.testing import ORG_A, auth

pytestmark = pytest.mark.integration


def test_kind_keeps_one_action_family(client: TestClient) -> None:
    r = client.get(f"/orgs/{ORG_A}/audit-log?kind=file", headers=auth("clientAdminA"))
    assert r.status_code == 200
    actions = {e["action"] for e in r.json()["entries"]}
    assert actions and all(a.startswith("file.") for a in actions)


def test_kind_is_validated(client: TestClient) -> None:
    r = client.get(f"/orgs/{ORG_A}/audit-log?kind=file%25", headers=auth("clientAdminA"))
    assert r.status_code == 422
