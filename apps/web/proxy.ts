import { type NextRequest, NextResponse } from "next/server";

import { httpsOnly, refreshGrant, secondsUntilExpiry, writeTokens } from "./lib/auth";
import { ACCESS_TOKEN_COOKIE, REFRESH_LEEWAY_S, REFRESH_TOKEN_COOKIE } from "./lib/cookies";

/** Per-request CSP: scripts only with this request's nonce (+ 'strict-dynamic'). */
function contentSecurityPolicy(nonce: string, dev: boolean): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    // Inline style attributes come from SSR'd component positioning; scripts are the real risk.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self'",
    `connect-src 'self'${dev ? " ws:" : ""}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(httpsOnly ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}

/**
 * 1. Sets a nonce-based CSP for this request (read by the root layout via `x-nonce`).
 * 2. Keeps the session alive: refreshes the access token shortly before it expires.
 * Authorization is NOT decided here (RLS + API do that).
 */
export async function proxy(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const csp = contentSecurityPolicy(nonce, process.env.NODE_ENV === "development");

  const access = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  const refresh = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value;
  const needsRefresh = !!refresh && (!access || secondsUntilExpiry(access) <= REFRESH_LEEWAY_S);
  const refreshed = needsRefresh && refresh ? await refreshGrant(refresh) : null;
  // Make a fresh token visible to this render (request cookies feed the request headers).
  if (refreshed?.ok) request.cookies.set(ACCESS_TOKEN_COOKIE, refreshed.tokens.access_token);

  const headers = new Headers(request.headers);
  headers.set("x-nonce", nonce);
  headers.set("Content-Security-Policy", csp);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set("Content-Security-Policy", csp);
  if (refreshed?.ok) writeTokens(response.cookies, refreshed.tokens);
  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!_next/static|_next/image|favicon.ico).*)",
      missing: [{ type: "header", key: "next-router-prefetch" }],
    },
  ],
};
