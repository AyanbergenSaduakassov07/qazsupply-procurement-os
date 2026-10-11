"use server";

import { getSession } from "../lib/session";

const API_URL = process.env.API_URL ?? "http://localhost:8000";
const ID = /^[0-9a-f-]{36}$/;
const STEPS = new Set(["submit", "return", "approve", "reject", "reopen", "release"]);
const DECISIONS = new Set(["approve", "edit", "reject"]);
const MAX_NOTE = 2000;

export type ReviewResult = { ok: true } | { ok: false; code: string };

async function post(path: string, body: object | undefined): Promise<ReviewResult> {
  const session = await getSession();
  if (session.status !== "authenticated" || !session.currentOrg) {
    return { ok: false, code: "unauthorized" };
  }
  const res = await fetch(`${API_URL}/orgs/${session.currentOrg.org_id}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${session.token}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  if (res.ok) return { ok: true };
  try {
    const parsed = (await res.json()) as { detail?: { code?: string } | string };
    if (typeof parsed.detail === "object" && parsed.detail?.code) {
      return { ok: false, code: parsed.detail.code };
    }
  } catch {
    // fall through
  }
  return { ok: false, code: res.status === 403 ? "staff_only" : "unexpected" };
}

function cleanNote(note: string | undefined): string | undefined {
  const trimmed = note?.trim();
  return trimmed ? trimmed.slice(0, MAX_NOTE) : undefined;
}

/** One step of the report review flow; the database decides whether it is allowed. */
export async function reviewStep(
  reportId: string,
  step: string,
  note?: string,
): Promise<ReviewResult> {
  if (!ID.test(reportId) || !STEPS.has(step)) return { ok: false, code: "invalid" };
  const text = cleanNote(note);
  const body = step === "approve" || step === "reject" ? { note: text } : undefined;
  return post(`/reports/${reportId}/${step}`, body);
}

export async function decideFinding(
  reportId: string,
  findingId: string,
  decision: string,
  note?: string,
): Promise<ReviewResult> {
  if (!ID.test(reportId) || !ID.test(findingId) || !DECISIONS.has(decision)) {
    return { ok: false, code: "invalid" };
  }
  return post(`/reports/${reportId}/findings/${findingId}/decision`, {
    decision,
    note: cleanNote(note),
  });
}
