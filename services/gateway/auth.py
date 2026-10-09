"""Supabase JWT verification against the project's JWKS (asymmetric keys)."""

from dataclasses import dataclass
from typing import Any
from uuid import UUID

import jwt


class AuthError(Exception):
    pass


@dataclass(frozen=True)
class Principal:
    user_id: UUID
    claims: dict[str, Any]


class Verifier:
    def __init__(self, jwks_url: str) -> None:
        self._jwks = jwt.PyJWKClient(jwks_url, cache_keys=True, lifespan=300)

    def verify(self, token: str) -> Principal:
        try:
            key = self._jwks.get_signing_key_from_jwt(token)
            claims = jwt.decode(
                token,
                key=key.key,
                algorithms=["ES256", "RS256"],
                audience="authenticated",
                options={"require": ["exp", "sub", "aud"]},
                leeway=30,  # tolerate clock skew between the auth server and this host
            )
        except (jwt.PyJWTError, ValueError) as e:
            raise AuthError(type(e).__name__) from e
        return Principal(user_id=UUID(claims["sub"]), claims=claims)
