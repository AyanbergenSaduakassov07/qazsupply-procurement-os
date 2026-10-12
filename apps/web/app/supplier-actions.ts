"use server";

import { apiClient } from "@qazsupply/api-client";

import { getSession } from "../lib/session";

const API_URL = process.env.API_URL ?? "http://localhost:8000";
const UUID = /^[0-9a-f-]{36}$/;

export type Fail = { ok: false; code: string };
export interface Degraded {
  source_id: string;
  reason: string;
  bin?: string;
}

async function ctx(): Promise<{ token: string; orgId: string } | Fail> {
  const session = await getSession();
  if (session.status !== "authenticated" || !session.currentOrg) {
    return { ok: false, code: "unauthorized" };
  }
  return { token: session.token, orgId: session.currentOrg.org_id };
}

function code(error: unknown, status: number): string {
  const detail = (error as { detail?: { code?: string } } | undefined)?.detail;
  if (detail && typeof detail === "object" && detail.code) return detail.code;
  return status === 403 ? "forbidden" : "unexpected";
}

/** Refresh registry data and re-screen one supplier. */
export async function buildDossier(
  supplierId: string,
): Promise<{ ok: true; degraded: Degraded[]; truncated: boolean } | Fail> {
  const c = await ctx();
  if ("ok" in c) return c;
  if (!UUID.test(supplierId)) return { ok: false, code: "invalid" };
  const { data, error, response } = await apiClient(API_URL, c.token).POST(
    "/orgs/{org_id}/suppliers/{supplier_id}/dossier",
    { params: { path: { org_id: c.orgId, supplier_id: supplierId } } },
  );
  if (!data) return { ok: false, code: code(error, response.status) };
  return { ok: true, degraded: data.degraded as unknown as Degraded[], truncated: data.truncated };
}

export async function decideHit(
  hitId: string,
  decision: "confirmed" | "dismissed",
  reasonCode: string,
  note: string,
): Promise<{ ok: true } | Fail> {
  const c = await ctx();
  if ("ok" in c) return c;
  if (!UUID.test(hitId)) return { ok: false, code: "invalid" };
  const { error, response } = await apiClient(API_URL, c.token).POST(
    "/orgs/{org_id}/screening-hits/{hit_id}/decision",
    {
      params: { path: { org_id: c.orgId, hit_id: hitId } },
      body: { decision, reason_code: reasonCode, note: note.slice(0, 2000) || null },
    },
  );
  return response.status === 204 ? { ok: true } : { ok: false, code: code(error, response.status) };
}

export async function saveRiskWeights(
  weights: Record<string, number>,
): Promise<{ ok: true } | Fail> {
  const c = await ctx();
  if ("ok" in c) return c;
  const { data, error, response } = await apiClient(API_URL, c.token).PUT(
    "/orgs/{org_id}/risk-weights",
    { params: { path: { org_id: c.orgId } }, body: { weights } },
  );
  return data ? { ok: true } : { ok: false, code: code(error, response.status) };
}
