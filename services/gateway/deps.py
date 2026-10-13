"""Request dependencies: authenticate, open a user-scoped transaction, check membership."""

from collections.abc import Iterator
from typing import Annotated
from uuid import UUID

from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from services.gateway.auth import AuthError, Principal, Verifier
from services.gateway.db import Database, UserConn
from services.tenancy import api as tenancy

bearer = HTTPBearer(auto_error=False)


def principal(
    request: Request,
    creds: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
) -> Principal:
    if creds is None:
        raise HTTPException(401, "unauthorized")
    verifier: Verifier = request.app.state.verifier
    try:
        return verifier.verify(creds.credentials)
    except AuthError:
        raise HTTPException(401, "unauthorized") from None


def user_conn(
    request: Request, who: Annotated[Principal, Depends(principal)]
) -> Iterator[UserConn]:
    db: Database = request.app.state.db
    with db.as_user(who) as conn:
        yield conn


# scope="function": commit (or roll back) BEFORE the response is sent. FastAPI's default
# ("request") ends a yield dependency after sending, so a client that wrote and immediately read
# (upload -> normalise) raced the commit, and a failed commit still answered 200.
def member_conn(
    org_id: UUID, conn: Annotated[UserConn, Depends(user_conn, scope="function")]
) -> UserConn:
    # 404, not 403: never confirm that another tenant's org exists.
    if not tenancy.is_member(conn, org_id):
        raise HTTPException(404, "not found")
    return conn


Who = Annotated[Principal, Depends(principal)]
Conn = Annotated[UserConn, Depends(user_conn, scope="function")]
OrgConn = Annotated[UserConn, Depends(member_conn)]
