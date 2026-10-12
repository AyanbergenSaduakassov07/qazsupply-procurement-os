import { getSession } from "./session";

export type Fail = { ok: false; code: string };

/** The signed-in user's token and active org, or a typed failure. Server actions only. */
export async function actionContext(): Promise<{ token: string; orgId: string } | Fail> {
  const session = await getSession();
  if (session.status !== "authenticated" || !session.currentOrg) {
    return { ok: false, code: "unauthorized" };
  }
  return { token: session.token, orgId: session.currentOrg.org_id };
}

/** The API's `{detail: {code}}`, else a code from the HTTP status. */
export function errorCodeOf(error: unknown, status: number): string {
  const detail = (error as { detail?: { code?: string } } | undefined)?.detail;
  if (detail && typeof detail === "object" && detail.code) return detail.code;
  if (status === 403) return "forbidden";
  if (status === 404) return "not_found";
  return "unexpected";
}
