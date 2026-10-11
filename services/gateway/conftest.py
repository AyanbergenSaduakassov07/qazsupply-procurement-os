"""Gateway test fixtures. Unit tests may override `client` with a lifespan-free version."""

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from services.gateway.app import app


@pytest.fixture(scope="module")
def client() -> Iterator[TestClient]:
    """App with its lifespan (DB pool + JWKS): for integration tests against the local stack."""
    with TestClient(app) as c:
        yield c
