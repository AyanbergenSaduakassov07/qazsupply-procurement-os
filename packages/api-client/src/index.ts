import createClient from "openapi-fetch";
import type { components, paths } from "./schema";

export type Schemas = components["schemas"];
export type Me = Schemas["Me"];
export type Membership = Schemas["Membership"];
export type Evidence = Schemas["Evidence"];
export type AuditLog = Schemas["AuditLog"];
export type Report = Schemas["Report"];

/** Typed API client. Pass the user's Supabase access token; RLS does the rest server-side. */
export function apiClient(baseUrl: string, accessToken?: string) {
  return createClient<paths>({
    baseUrl,
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
  });
}
