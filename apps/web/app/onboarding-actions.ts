"use server";

import { apiClient } from "@qazsupply/api-client";

import { getSession } from "../lib/session";

const API_URL = process.env.API_URL ?? "http://localhost:8000";
const UUID = /^[0-9a-f-]{36}$/;
const MAX_BYTES = 5 * 1024 * 1024;

export type Result = { ok: true; id?: string } | { ok: false; code: string };

async function ctx(): Promise<{ token: string; orgId: string } | { ok: false; code: string }> {
  const session = await getSession();
  if (session.status !== "authenticated" || !session.currentOrg) {
    return { ok: false, code: "unauthorized" };
  }
  return { token: session.token, orgId: session.currentOrg.org_id };
}

function code(error: unknown, status: number): string {
  const detail = (error as { detail?: { code?: string } } | undefined)?.detail;
  if (detail && typeof detail === "object" && detail.code) return detail.code;
  return status === 403 ? "forbidden" : status === 404 ? "not_found" : "unexpected";
}

export async function inviteSupplier(supplierId: string, email: string): Promise<Result> {
  const c = await ctx();
  if ("ok" in c) return c;
  if (!UUID.test(supplierId)) return { ok: false, code: "invalid" };
  const { data, error, response } = await apiClient(API_URL, c.token).POST(
    "/orgs/{org_id}/onboarding",
    {
      params: { path: { org_id: c.orgId } },
      body: { supplier_id: supplierId, email: email.slice(0, 255) },
    },
  );
  return data ? { ok: true, id: data.id } : { ok: false, code: code(error, response.status) };
}

export async function saveDetails(
  caseId: string,
  details: { legal_name: string; bin: string; contact_name: string; contact_phone: string },
): Promise<Result> {
  const c = await ctx();
  if ("ok" in c) return c;
  if (!UUID.test(caseId)) return { ok: false, code: "invalid" };
  const body = Object.fromEntries(Object.entries(details).filter(([, v]) => v.trim() !== ""));
  const { error, response } = await apiClient(API_URL, c.token).PUT(
    "/orgs/{org_id}/onboarding/{case_id}/details",
    { params: { path: { org_id: c.orgId, case_id: caseId } }, body },
  );
  return response.status === 204 ? { ok: true } : { ok: false, code: code(error, response.status) };
}

/** Multipart upload goes straight to the API (keeps the server action's origin check). */
export async function uploadDocument(caseId: string, form: FormData): Promise<Result> {
  const c = await ctx();
  if ("ok" in c) return c;
  if (!UUID.test(caseId)) return { ok: false, code: "invalid" };
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, code: "empty" };
  if (file.size > MAX_BYTES) return { ok: false, code: "too_large" };
  const body = new FormData();
  body.set("file", file, file.name);
  for (const key of ["kind", "doc_number", "issued_on", "fields_confirmed"]) {
    const v = form.get(key);
    if (typeof v === "string" && v !== "") body.set(key, v);
  }
  const res = await fetch(`${API_URL}/orgs/${c.orgId}/onboarding/${caseId}/documents`, {
    method: "POST",
    headers: { Authorization: `Bearer ${c.token}` },
    body,
    cache: "no-store",
  });
  if (res.ok) return { ok: true };
  let detail: unknown;
  try {
    detail = await res.json();
  } catch {
    detail = undefined;
  }
  return { ok: false, code: code(detail, res.status) };
}

export async function submitCase(caseId: string): Promise<Result> {
  const c = await ctx();
  if ("ok" in c) return c;
  if (!UUID.test(caseId)) return { ok: false, code: "invalid" };
  const { error, response } = await apiClient(API_URL, c.token).POST(
    "/orgs/{org_id}/onboarding/{case_id}/submit",
    { params: { path: { org_id: c.orgId, case_id: caseId } } },
  );
  return response.status === 204 ? { ok: true } : { ok: false, code: code(error, response.status) };
}

export async function decideCase(
  caseId: string,
  decision: "approve" | "reject" | "return",
  note: string,
): Promise<Result> {
  const c = await ctx();
  if ("ok" in c) return c;
  if (!UUID.test(caseId)) return { ok: false, code: "invalid" };
  const { data, error, response } = await apiClient(API_URL, c.token).POST(
    "/orgs/{org_id}/onboarding/{case_id}/decision",
    {
      params: { path: { org_id: c.orgId, case_id: caseId } },
      body: { decision, note: note.slice(0, 2000) || null },
    },
  );
  return data ? { ok: true } : { ok: false, code: code(error, response.status) };
}
