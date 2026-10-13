"use server";

import { apiClient } from "@qazsupply/api-client";

import { getSession } from "../lib/session";

const API_URL = process.env.API_URL ?? "http://localhost:8000";
const MAX_BYTES = 25 * 1024 * 1024;

export type Fail = { ok: false; code: string };

async function ctx(): Promise<{ token: string; orgId: string } | Fail> {
  const session = await getSession();
  if (session.status !== "authenticated" || !session.currentOrg) {
    return { ok: false, code: "unauthorized" };
  }
  return { token: session.token, orgId: session.currentOrg.org_id };
}

async function errorCode(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { detail?: { code?: string } | string };
    if (typeof body.detail === "object" && body.detail?.code) return body.detail.code;
  } catch {
    // fall through
  }
  return res.status === 403 ? "forbidden" : "unexpected";
}

function fileFrom(form: FormData): File | Fail {
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, code: "empty" };
  if (file.size > MAX_BYTES) return { ok: false, code: "too_large" };
  return file;
}

export interface Preview {
  ok: true;
  sheet: string;
  sheets: string[];
  header_row: number;
  columns: string[];
  mapping: Record<string, number>;
  missing_required: string[];
  sample: string[][];
  rows_total: number;
  errors_by_code: Record<string, number>;
}

export async function previewUpload(form: FormData): Promise<Preview | Fail> {
  const c = await ctx();
  if ("ok" in c) return c;
  const file = fileFrom(form);
  if ("ok" in file) return file;
  const body = new FormData();
  body.set("file", file, file.name);
  const res = await fetch(`${API_URL}/orgs/${c.orgId}/uploads/preview`, {
    method: "POST",
    headers: { Authorization: `Bearer ${c.token}` },
    body,
    cache: "no-store",
  });
  if (!res.ok) return { ok: false, code: await errorCode(res) };
  return { ok: true, ...((await res.json()) as Omit<Preview, "ok">) };
}

export interface Imported {
  ok: true;
  duplicate: boolean;
  inserted: number;
  rejected: number;
  errors: { row: number; code: string }[];
  auto: number;
  review: number;
  bundled: number;
}

export async function importUpload(form: FormData): Promise<Imported | Fail> {
  const c = await ctx();
  if ("ok" in c) return c;
  const file = fileFrom(form);
  if ("ok" in file) return file;
  const mapping = String(form.get("mapping") ?? "{}");
  try {
    const parsed = JSON.parse(mapping) as Record<string, unknown>;
    if (Object.values(parsed).some((v) => !Number.isInteger(v))) throw new Error("bad");
  } catch {
    return { ok: false, code: "bad_mapping" };
  }
  const body = new FormData();
  body.set("file", file, file.name);
  body.set("mapping", mapping);
  const sheet = form.get("sheet");
  if (typeof sheet === "string" && sheet) body.set("sheet", sheet);
  const res = await fetch(`${API_URL}/orgs/${c.orgId}/uploads`, {
    method: "POST",
    headers: { Authorization: `Bearer ${c.token}` },
    body,
    cache: "no-store",
  });
  if (!res.ok) return { ok: false, code: await errorCode(res) };
  const up = (await res.json()) as {
    file_id: string;
    duplicate: boolean;
    inserted: number;
    rejected: number;
    errors: { row: number; code: string }[];
  };
  const norm = await apiClient(API_URL, c.token).POST("/orgs/{org_id}/normalize", {
    params: { path: { org_id: c.orgId } },
    body: { file_id: up.file_id },
  });
  // Never report "imported" when matching failed: the lines would sit unmatched, unseen.
  if (!norm.data) return { ok: false, code: await errorCode(norm.response) };
  const n = norm.data;
  return {
    ok: true,
    duplicate: up.duplicate,
    inserted: up.inserted,
    rejected: up.rejected,
    errors: up.errors.slice(0, 200).map((e) => ({ row: e.row, code: e.code })),
    auto: n.auto,
    review: n.review,
    bundled: n.bundled,
  };
}

export interface ClassifierEntry {
  code: string;
  name_ru: string;
  name_kk: string;
  unit: string;
}

/** Free search over the classifier, for lines whose suggestions are all wrong (D20). */
export async function searchClassifier(
  q: string,
): Promise<{ ok: true; entries: ClassifierEntry[] } | Fail> {
  const c = await ctx();
  if ("ok" in c) return c;
  const { data, response } = await apiClient(API_URL, c.token).GET("/orgs/{org_id}/classifier", {
    params: { path: { org_id: c.orgId }, query: { q: q.slice(0, 100), limit: 10 } },
  });
  if (!data) return { ok: false, code: await errorCode(response) };
  return { ok: true, entries: data.entries };
}

const ACTIONS = new Set(["accept", "choose", "reject", "undo"]);

export async function reviewLine(
  lineId: string,
  action: string,
  code?: string,
): Promise<{ ok: true; status: string } | Fail> {
  const c = await ctx();
  if ("ok" in c) return c;
  if (!ACTIONS.has(action) || !/^[0-9a-f-]{36}$/.test(lineId))
    return { ok: false, code: "invalid" };
  const { data, response } = await apiClient(API_URL, c.token).POST(
    "/orgs/{org_id}/purchase-lines/{line_id}/review",
    {
      params: { path: { org_id: c.orgId, line_id: lineId } },
      body: { action: action as "accept" | "choose" | "reject" | "undo", code: code ?? null },
    },
  );
  if (!data) return { ok: false, code: await errorCode(response) };
  return { ok: true, status: data.match_status };
}

export async function runAnalysis(): Promise<{ ok: true; reportId: string | null } | Fail> {
  const c = await ctx();
  if ("ok" in c) return c;
  const { data, response } = await apiClient(API_URL, c.token).POST("/orgs/{org_id}/analysis", {
    params: { path: { org_id: c.orgId } },
  });
  if (!data) return { ok: false, code: await errorCode(response) };
  return { ok: true, reportId: data.report_id ?? null };
}

export interface EvidenceView {
  ok: true;
  id: string;
  method: string;
  computation_id: string;
  code_version: string;
  result: number | null;
  sources: {
    purchase_line_id: string;
    file_name: string;
    source_row: number;
    item_text: string | null;
    supplier_text: string | null;
    quantity: number | null;
    unit_price: number | null;
    currency: string | null;
    purchased_on: string | null;
  }[];
}

export async function loadEvidence(evidenceId: string): Promise<EvidenceView | Fail> {
  const c = await ctx();
  if ("ok" in c) return c;
  if (!/^[0-9a-f-]{36}$/.test(evidenceId)) return { ok: false, code: "invalid" };
  const { data, response } = await apiClient(API_URL, c.token).GET(
    "/orgs/{org_id}/evidence/{evidence_id}",
    { params: { path: { org_id: c.orgId, evidence_id: evidenceId } } },
  );
  if (!data) return { ok: false, code: await errorCode(response) };
  return {
    ok: true,
    id: data.id,
    method: data.method,
    computation_id: data.computation_id,
    code_version: data.code_version,
    result: data.result ?? null,
    sources: data.sources.map((s) => ({ ...s, purchased_on: s.purchased_on ?? null })),
  };
}
