import { getSession } from "../../../../../../../lib/session";

const API_URL = process.env.API_URL ?? "http://localhost:8000";
const UUID = /^[0-9a-f-]{36}$/;

/** Proxy a supplier document download (RLS decides who may read it). Always an attachment. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; docId: string }> },
): Promise<Response> {
  const { id, docId } = await params;
  const session = await getSession();
  if (
    session.status !== "authenticated" ||
    !session.currentOrg ||
    !UUID.test(id) ||
    !UUID.test(docId)
  ) {
    return new Response("not found", { status: 404 });
  }
  const res = await fetch(
    `${API_URL}/orgs/${session.currentOrg.org_id}/onboarding/${id}/documents/${docId}`,
    { headers: { Authorization: `Bearer ${session.token}` }, cache: "no-store" },
  );
  if (!res.ok) return new Response("not found", { status: 404 });
  return new Response(res.body, {
    headers: {
      "Content-Type": res.headers.get("content-type") ?? "application/octet-stream",
      "Content-Disposition": res.headers.get("content-disposition") ?? "attachment",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "Cache-Control": "private, no-store",
    },
  });
}
