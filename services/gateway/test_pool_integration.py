"""The API survives a database restart: dead pooled connections are replaced on checkout."""

import psycopg
import pytest
from fastapi.testclient import TestClient

from services.gateway.testing import DB, auth

pytestmark = pytest.mark.integration


def test_requests_succeed_after_pooled_connections_die(client: TestClient) -> None:
    assert client.get("/me", headers=auth("clientAdminA")).status_code == 200
    with psycopg.connect(DB, autocommit=True) as admin:
        admin.execute(
            """select pg_terminate_backend(pid) from pg_stat_activity
               where pid <> pg_backend_pid() and backend_type = 'client backend'
                 and usename = 'postgres' and coalesce(application_name, '') = ''"""
        )
    for _ in range(3):  # every pooled connection was killed; none may surface as an error
        assert client.get("/me", headers=auth("clientAdminA")).status_code == 200
    assert client.get("/health").json()["db"] == "ok"
