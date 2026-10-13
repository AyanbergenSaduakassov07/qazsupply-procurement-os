"use server";

import { apiClient, type Schemas } from "@qazsupply/api-client";

import { errorCodeOf as code, actionContext as ctx, type Fail } from "../lib/server-action";

const API_URL = process.env.API_URL ?? "http://localhost:8000";
const UUID = /^[0-9a-f-]{36}$/;

type Ok<T = undefined> = T extends undefined ? { ok: true } : { ok: true; data: T };
type Item = { name: string; quantity: number; unit: string; enstru_code?: string | null };

function bad(...ids: string[]): Fail | null {
  return ids.every((id) => UUID.test(id)) ? null : { ok: false, code: "invalid" };
}

export async function checkSpec(text: string): Promise<Ok<Schemas["SpecOut"]> | Fail> {
  const c = await ctx();
  if ("ok" in c) return c;
  const { data, error, response } = await apiClient(API_URL, c.token).POST(
    "/orgs/{org_id}/spec-check",
    {
      params: { path: { org_id: c.orgId } },
      body: { text: text.slice(0, 50000) },
    },
  );
  return data
    ? { ok: true, data: data as Schemas["SpecOut"] }
    : { ok: false, code: code(error, response.status) };
}

export async function createRfq(input: {
  title: string;
  deadline: string | null;
  spec_text: string;
  items: Item[];
}): Promise<Ok<{ id: string }> | Fail> {
  const c = await ctx();
  if ("ok" in c) return c;
  const { data, error, response } = await apiClient(API_URL, c.token).POST("/orgs/{org_id}/rfqs", {
    params: { path: { org_id: c.orgId } },
    body: { ...input, deadline: input.deadline || null, terms: {} },
  });
  return data
    ? { ok: true, data: { id: String(data.id) } }
    : { ok: false, code: code(error, response.status) };
}

export async function newVersion(
  rfqId: string,
  spec_text: string,
  items: Item[],
): Promise<Ok | Fail> {
  const c = await ctx();
  if ("ok" in c) return c;
  const v = bad(rfqId);
  if (v) return v;
  const { data, error, response } = await apiClient(API_URL, c.token).POST(
    "/orgs/{org_id}/rfqs/{rfq_id}/versions",
    { params: { path: { org_id: c.orgId, rfq_id: rfqId } }, body: { spec_text, items, terms: {} } },
  );
  return data ? { ok: true } : { ok: false, code: code(error, response.status) };
}

type Step = "approve" | "close" | "cancel";

export async function rfqStep(rfqId: string, step: Step, note = ""): Promise<Ok | Fail> {
  const c = await ctx();
  if ("ok" in c) return c;
  const v = bad(rfqId);
  if (v) return v;
  const path = { org_id: c.orgId, rfq_id: rfqId };
  const api = apiClient(API_URL, c.token);
  const { error, response } =
    step === "approve"
      ? await api.POST("/orgs/{org_id}/rfqs/{rfq_id}/approve", {
          params: { path },
          body: { note: note || null },
        })
      : step === "close"
        ? await api.POST("/orgs/{org_id}/rfqs/{rfq_id}/close", { params: { path } })
        : await api.POST("/orgs/{org_id}/rfqs/{rfq_id}/cancel", { params: { path } });
  return response.status === 204 ? { ok: true } : { ok: false, code: code(error, response.status) };
}

export async function inviteSupplierToRfq(
  rfqId: string,
  supplierId: string,
  channel: "portal" | "email" | "phone" | "other",
  email: string,
): Promise<Ok | Fail> {
  const c = await ctx();
  if ("ok" in c) return c;
  const v = bad(rfqId, supplierId);
  if (v) return v;
  const { data, error, response } = await apiClient(API_URL, c.token).POST(
    "/orgs/{org_id}/rfqs/{rfq_id}/invites",
    {
      params: { path: { org_id: c.orgId, rfq_id: rfqId } },
      body: { supplier_id: supplierId, channel, email: email || null },
    },
  );
  return data ? { ok: true } : { ok: false, code: code(error, response.status) };
}

/** A human records that THEY sent the approved RFQ. QazSupply never sends it. */
export async function recordSent(inviteId: string): Promise<Ok | Fail> {
  const c = await ctx();
  if ("ok" in c) return c;
  const v = bad(inviteId);
  if (v) return v;
  const { error, response } = await apiClient(API_URL, c.token).POST(
    "/orgs/{org_id}/rfq-invites/{invite_id}/sent",
    { params: { path: { org_id: c.orgId, invite_id: inviteId } } },
  );
  return response.status === 204 ? { ok: true } : { ok: false, code: code(error, response.status) };
}

export async function submitOffer(
  rfqId: string,
  offer: {
    invite_id: string;
    source: "portal" | "email" | "pdf" | "phone" | "manual";
    currency: string;
    payment_days: number | null;
    lead_time_days: number | null;
    lines: { item: number; unit_price: number | null }[];
  },
): Promise<Ok | Fail> {
  const c = await ctx();
  if ("ok" in c) return c;
  const v = bad(rfqId, offer.invite_id);
  if (v) return v;
  const { data, error, response } = await apiClient(API_URL, c.token).POST(
    "/orgs/{org_id}/rfqs/{rfq_id}/offers",
    { params: { path: { org_id: c.orgId, rfq_id: rfqId } }, body: offer },
  );
  return data ? { ok: true } : { ok: false, code: code(error, response.status) };
}

export async function confirmOffer(offerId: string, note: string): Promise<Ok | Fail> {
  const c = await ctx();
  if ("ok" in c) return c;
  const v = bad(offerId);
  if (v) return v;
  const { error, response } = await apiClient(API_URL, c.token).POST(
    "/orgs/{org_id}/offers/{offer_id}/confirm",
    {
      params: { path: { org_id: c.orgId, offer_id: offerId } },
      body: { note: note || null },
    },
  );
  return response.status === 204 ? { ok: true } : { ok: false, code: code(error, response.status) };
}

export async function saveWeights(
  rfqId: string,
  weights: Record<string, number>,
): Promise<Ok | Fail> {
  const c = await ctx();
  if ("ok" in c) return c;
  const v = bad(rfqId);
  if (v) return v;
  const { error, response } = await apiClient(API_URL, c.token).PUT(
    "/orgs/{org_id}/rfqs/{rfq_id}/weights",
    {
      params: { path: { org_id: c.orgId, rfq_id: rfqId } },
      body: { weights },
    },
  );
  return response.status === 204 ? { ok: true } : { ok: false, code: code(error, response.status) };
}

/** A named approver awards; QazSupply never picks a winner on its own. */
export async function recordDecision(
  rfqId: string,
  offerId: string,
  reason: string,
): Promise<Ok | Fail> {
  const c = await ctx();
  if ("ok" in c) return c;
  const v = bad(rfqId, offerId);
  if (v) return v;
  const { data, error, response } = await apiClient(API_URL, c.token).POST(
    "/orgs/{org_id}/rfqs/{rfq_id}/decision",
    {
      params: { path: { org_id: c.orgId, rfq_id: rfqId } },
      body: { offer_id: offerId, reason },
    },
  );
  return data ? { ok: true } : { ok: false, code: code(error, response.status) };
}

export async function addCatalogueEntry(entry: {
  name: string;
  unit: string;
  attributes: Record<string, string>;
}): Promise<Ok | Fail> {
  const c = await ctx();
  if ("ok" in c) return c;
  const { data, error, response } = await apiClient(API_URL, c.token).POST(
    "/orgs/{org_id}/catalogue",
    {
      params: { path: { org_id: c.orgId } },
      body: { ...entry, standards: [] },
    },
  );
  return data ? { ok: true } : { ok: false, code: code(error, response.status) };
}

export async function analogFeedback(
  entryId: string,
  analogId: string,
  accepted: boolean,
): Promise<Ok | Fail> {
  const c = await ctx();
  if ("ok" in c) return c;
  const v = bad(entryId, analogId);
  if (v) return v;
  const { error, response } = await apiClient(API_URL, c.token).POST(
    "/orgs/{org_id}/catalogue/{entry_id}/analogs/{analog_id}/feedback",
    {
      params: { path: { org_id: c.orgId, entry_id: entryId, analog_id: analogId } },
      body: { accepted },
    },
  );
  return response.status === 204 ? { ok: true } : { ok: false, code: code(error, response.status) };
}

export async function catalogueAnalogs(
  entryId: string,
): Promise<Ok<Record<string, unknown>[]> | Fail> {
  const c = await ctx();
  if ("ok" in c) return c;
  const v = bad(entryId);
  if (v) return v;
  const { data, error, response } = await apiClient(API_URL, c.token).GET(
    "/orgs/{org_id}/catalogue/{entry_id}/analogs",
    { params: { path: { org_id: c.orgId, entry_id: entryId } } },
  );
  return data ? { ok: true, data } : { ok: false, code: code(error, response.status) };
}

export async function cataloguePrices(
  entryId: string,
): Promise<Ok<Record<string, unknown>[]> | Fail> {
  const c = await ctx();
  if ("ok" in c) return c;
  const v = bad(entryId);
  if (v) return v;
  const { data, error, response } = await apiClient(API_URL, c.token).GET(
    "/orgs/{org_id}/catalogue/{entry_id}/prices",
    { params: { path: { org_id: c.orgId, entry_id: entryId } } },
  );
  return data ? { ok: true, data } : { ok: false, code: code(error, response.status) };
}
