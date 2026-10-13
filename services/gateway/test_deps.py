from typing import get_args

from services.gateway import deps


def test_transactions_end_before_the_response_is_sent() -> None:
    # Default scope "request" commits after the response: write-then-read raced (2026-10-13).
    assert get_args(deps.Conn)[1].scope == "function"
    member = deps.member_conn.__annotations__["conn"]
    assert get_args(member)[1].scope == "function"
