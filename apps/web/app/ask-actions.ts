"use server";

import { getSession } from "../lib/session";

const API_URL = process.env.API_URL ?? "http://localhost:8000";
const ID = /^[0-9a-f-]{36}$/;
const LOCALES = new Set(["kk", "ru", "en"]);

export interface AskSentence {
  text: string;
  evidence_ids: string[];
  cites_report: boolean;
}
export type AskResult =
  | { ok: true; answerable: boolean; sentences: AskSentence[]; dropped: number }
  | { ok: false; code: string };
export interface AskTurn {
  role: "user" | "assistant";
  text: string;
}

async function call(path: string, init: RequestInit): Promise<Response | { code: string }> {
  const session = await getSession();
  if (session.status !== "authenticated" || !session.currentOrg) return { code: "unauthorized" };
  return fetch(`${API_URL}/orgs/${session.currentOrg.org_id}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${session.token}`, "Content-Type": "application/json" },
    cache: "no-store",
  });
}

async function code(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { detail?: { code?: string } | string };
    if (typeof body.detail === "object" && body.detail?.code) return body.detail.code;
  } catch {
    // fall through
  }
  return "unexpected";
}

export async function askReport(
  reportId: string,
  question: string,
  locale: string,
  history: AskTurn[],
): Promise<AskResult> {
  const q = question.trim().slice(0, 500);
  if (!ID.test(reportId) || !q || !LOCALES.has(locale)) return { ok: false, code: "unexpected" };
  const res = await call(`/reports/${reportId}/ask`, {
    method: "POST",
    body: JSON.stringify({
      question: q,
      locale,
      history: history.slice(-8).map((t) => ({ role: t.role, text: t.text.slice(0, 2000) })),
    }),
  });
  if (!(res instanceof Response)) return { ok: false, code: res.code };
  if (!res.ok) return { ok: false, code: await code(res) };
  return { ok: true, ...((await res.json()) as Omit<Extract<AskResult, { ok: true }>, "ok">) };
}

export async function updateOrgSettings(changes: {
  ask_enabled?: boolean;
  four_eyes?: boolean;
  share_prices?: boolean;
}): Promise<{ ok: true } | { ok: false; code: string }> {
  const res = await call("/settings", { method: "PATCH", body: JSON.stringify(changes) });
  if (!(res instanceof Response)) return { ok: false, code: res.code };
  return res.ok
    ? { ok: true }
    : { ok: false, code: res.status === 403 ? "admin_only" : "unexpected" };
}
