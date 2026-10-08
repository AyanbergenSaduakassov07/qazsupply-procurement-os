import { apiClient, type Membership } from "@qazsupply/api-client";
import { cookies } from "next/headers";

import { ACCESS_TOKEN_COOKIE, ORG_COOKIE } from "./cookies";
import type { Role } from "./navigation";

const API_URL = process.env.API_URL ?? "http://localhost:8000";

export type Session =
  | { status: "anonymous" }
  | {
      status: "authenticated";
      userId: string;
      email: string | null;
      token: string;
      memberships: Membership[];
      /** Active org: the cookie's org if the user is a member of it, else the first membership. */
      currentOrg: Membership | null;
      /** Roles the user holds in the active org only. */
      roles: Role[];
    };

/**
 * Resolve the current session server-side. RLS does the authorization; this only decides
 * anonymous vs authenticated and which organization the shell shows.
 */
export async function getSession(): Promise<Session> {
  const jar = await cookies();
  const token = jar.get(ACCESS_TOKEN_COOKIE)?.value;
  if (!token) return { status: "anonymous" };

  try {
    const { data, error } = await apiClient(API_URL, token).GET("/me");
    if (error || !data) return { status: "anonymous" };
    const wanted = jar.get(ORG_COOKIE)?.value;
    const currentOrg =
      data.memberships.find((m) => m.org_id === wanted) ?? data.memberships[0] ?? null;
    const roles = data.memberships
      .filter((m) => m.org_id === currentOrg?.org_id)
      .map((m) => m.role);
    return {
      status: "authenticated",
      userId: data.user_id,
      email: data.email ?? null,
      token,
      memberships: data.memberships,
      currentOrg,
      roles,
    };
  } catch {
    // API down or token rejected: treat as signed out rather than failing the shell.
    return { status: "anonymous" };
  }
}
