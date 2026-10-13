/**
 * Supabase Auth over its REST API (server-side only). Tokens live in httpOnly cookies;
 * the browser never sees them in JavaScript.
 */
import type { NextResponse } from "next/server";

import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from "./cookies";

const SUPABASE_URL = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";

export interface Tokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

export type GrantResult =
  | { ok: true; tokens: Tokens }
  | { ok: false; reason: "invalid" | "unavailable" };

async function grant(type: "password" | "refresh_token", body: object): Promise<GrantResult> {
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!key) return { ok: false, reason: "unavailable" };
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=${type}`, {
      method: "POST",
      headers: { apikey: key, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    if (res.status >= 500) return { ok: false, reason: "unavailable" };
    if (!res.ok) return { ok: false, reason: "invalid" };
    return { ok: true, tokens: (await res.json()) as Tokens };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}

export const passwordGrant = (email: string, password: string) =>
  grant("password", { email, password });
export const refreshGrant = (refreshToken: string) =>
  grant("refresh_token", { refresh_token: refreshToken });

/**
 * Revoke this session's refresh token at Supabase (sign-out), so a copied refresh cookie cannot
 * mint new access tokens. The current access token stays valid until it expires (<= 1 h).
 * Best effort: sign-out must still clear cookies when Auth is unreachable.
 */
export async function revokeSession(accessToken: string): Promise<void> {
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!key || !accessToken) return;
  try {
    await fetch(`${SUPABASE_URL}/auth/v1/logout?scope=local`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
  } catch {
    // Unreachable Auth: cookies are still cleared by the caller.
  }
}

/** Seconds until the JWT expires (no signature check: the API verifies; this only schedules refresh). */
export function secondsUntilExpiry(jwt: string): number {
  try {
    const payload = JSON.parse(
      atob(jwt.split(".")[1]?.replace(/-/g, "+").replace(/_/g, "/") ?? ""),
    );
    return Number(payload.exp) - Date.now() / 1000;
  } catch {
    return -1;
  }
}

type CookieWriter = Pick<NextResponse["cookies"], "set">;

/** Secure cookies whenever the public URL is HTTPS (always in production; plain http only for local/CI runs). */
// Fails closed: without APP_URL a production build still uses secure cookies.
export const httpsOnly = process.env.APP_URL
  ? process.env.APP_URL.startsWith("https://")
  : process.env.NODE_ENV === "production";
const secure = httpsOnly;

export function writeTokens(jar: CookieWriter, tokens: Tokens): void {
  jar.set(ACCESS_TOKEN_COOKIE, tokens.access_token, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: tokens.expires_in,
  });
  jar.set(REFRESH_TOKEN_COOKIE, tokens.refresh_token, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}
