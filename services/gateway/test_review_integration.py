"""Review gate through the API on the local stack: draft -> in_review -> approved -> released,
as the real users, with the client's view checked at every step."""

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from services.gateway.test_analysis_integration import spend_csv
from services.gateway.testing import ORG_A, ORG_B, RU_MAPPING, purge
from services.gateway.testing import auth as h

pytestmark = pytest.mark.integration


CREATED: list[str] = []


@pytest.fixture(autouse=True)
def clean() -> Iterator[None]:
    yield
    # Exactly the reports this test created (a title pattern would also match seed reports).
    purge(
        *[("delete from public.reports where id = %s", (rid,)) for rid in CREATED],
        (
            "delete from public.evidence where computation_id like 'analyze-%%'"
            " and created_at > now() - interval '1 hour' and org_id = %s",
            (ORG_A,),
        ),
        ("delete from public.files where name like 'it-%%'", ()),
    )
    CREATED.clear()


def _analysed_report(client: TestClient) -> str:
    up = client.post(
        f"/orgs/{ORG_A}/uploads",
        headers=h("clientUserA"),
        files={"file": ("it-review.csv", spend_csv(seed=11))},
        data={"mapping": RU_MAPPING},
    )
    assert up.status_code == 200, up.text
    norm = client.post(
        f"/orgs/{ORG_A}/normalize", headers=h("clientUserA"), json={"file_id": up.json()["file_id"]}
    )
    assert norm.status_code == 200, norm.text
    run = client.post(f"/orgs/{ORG_A}/analysis", headers=h("reviewer"))
    assert run.status_code == 200, run.text
    CREATED.append(str(run.json()["report_id"]))
    return CREATED[-1]


def test_a_report_reaches_the_client_only_through_the_full_review(client: TestClient) -> None:
    rid = _analysed_report(client)
    base = f"/orgs/{ORG_A}/reports/{rid}"

    def post(path: str, user: str = "reviewer", **body: object) -> tuple[int, dict[str, object]]:
        r = client.post(base + path, headers=h(user), json=body or None)
        return r.status_code, r.json()

    # Draft: invisible to the client, and the client cannot drive the workflow.
    assert client.get(base, headers=h("clientUserA")).status_code == 404
    assert post("/submit", "clientAdminA")[0] == 403
    assert post("/release")[1]["detail"] == {"code": "transition_not_allowed"}
    assert post("/approve")[1]["detail"] == {"code": "report_not_in_review"}

    code, detail = post("/submit")
    assert code == 200 and detail["status"] == "in_review" and detail["submitted_at"]
    findings = client.get(base + "/findings", headers=h("reviewer")).json()
    assert len(findings) >= 3
    dropped, kept = findings[-1], findings[:-1]

    assert post("/approve")[1]["detail"] == {"code": "undecided_findings"}
    reject_without_note = f"/findings/{dropped['id']}/decision"
    assert post(reject_without_note, decision="reject")[1]["detail"] == {"code": "note_required"}
    assert post(reject_without_note, decision="reject", note="one-off emergency order")[0] == 200
    for f in kept:
        assert post(f"/findings/{f['id']}/decision", decision="approve")[0] == 200

    code, detail = post("/approve", note="checked against the source rows")
    assert code == 200 and detail["status"] == "approved" and detail["undecided"] == 0
    assert client.get(base, headers=h("clientUserA")).status_code == 404  # approved, not released

    code, detail = post("/release")
    assert code == 200 and detail["status"] == "released" and detail["released_by"]
    assert post("/release")[1]["detail"] == {"code": "report_closed"}

    # Released: the client sees the report and only the kept findings.
    client_view = client.get(base, headers=h("clientUserA"))
    assert client_view.status_code == 200
    seen = {f["id"] for f in client.get(base + "/findings", headers=h("clientUserA")).json()}
    assert seen == {f["id"] for f in kept}
    notes = [r["note"] for r in client.get(base + "/reviews", headers=h("clientUserA")).json()]
    assert "one-off emergency order" not in notes
    # Another tenant never learns the report exists.
    assert client.get(f"/orgs/{ORG_B}/reports/{rid}", headers=h("clientAdminB")).status_code == 404
