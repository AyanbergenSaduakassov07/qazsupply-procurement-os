"use server";

import { isLocale } from "@qazsupply/i18n";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { passwordGrant, revokeSession, writeTokens } from "../lib/auth";
import {
  ACCESS_TOKEN_COOKIE,
  ORG_COOKIE,
  REDUCE_TRANSPARENCY_COOKIE,
  REFRESH_TOKEN_COOKIE,
} from "../lib/cookies";

/** Persist the reduce-transparency preference so the server can render it without a flash. */
export async function setReduceTransparency(enabled: boolean): Promise<void> {
  (await cookies()).set(REDUCE_TRANSPARENCY_COOKIE, enabled ? "1" : "0", {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
}

export async function signIn(formData: FormData): Promise<void> {
  const locale = String(formData.get("locale"));
  const safeLocale = isLocale(locale) ? locale : "ru";
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const result = await passwordGrant(email, password);
  if (!result.ok) redirect(`/${safeLocale}/sign-in?error=${result.reason}`);
  writeTokens(await cookies(), result.tokens);
  redirect(`/${safeLocale}`);
}

export async function signOut(locale: string): Promise<void> {
  const jar = await cookies();
  await revokeSession(jar.get(ACCESS_TOKEN_COOKIE)?.value ?? "");
  for (const name of [ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE, ORG_COOKIE]) jar.delete(name);
  redirect(`/${isLocale(locale) ? locale : "ru"}/sign-in`);
}

/** Remember the active organization. The server re-checks membership on every render. */
export async function setCurrentOrg(orgId: string): Promise<void> {
  (await cookies()).set(ORG_COOKIE, orgId, { path: "/", sameSite: "lax", httpOnly: true });
}
