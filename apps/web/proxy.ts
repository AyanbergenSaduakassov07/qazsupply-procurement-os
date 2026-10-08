import { type NextRequest, NextResponse } from "next/server";

import { refreshGrant, secondsUntilExpiry, writeTokens } from "./lib/auth";
import { ACCESS_TOKEN_COOKIE, REFRESH_LEEWAY_S, REFRESH_TOKEN_COOKIE } from "./lib/cookies";

/**
 * Keeps the session alive: refreshes the access token shortly before it expires.
 * Authorization is NOT decided here (RLS + API do that); this is an optimistic step only.
 */
export async function proxy(request: NextRequest) {
  const access = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  const refresh = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value;
  if (!refresh || (access && secondsUntilExpiry(access) > REFRESH_LEEWAY_S)) {
    return NextResponse.next();
  }
  const result = await refreshGrant(refresh);
  if (!result.ok) return NextResponse.next(); // pages see "anonymous" and send the user to sign-in

  // Make the fresh token visible to this render and store it for later requests.
  request.cookies.set(ACCESS_TOKEN_COOKIE, result.tokens.access_token);
  const response = NextResponse.next({ request });
  writeTokens(response.cookies, result.tokens);
  return response;
}

export const config = {
  matcher: ["/((?!_next/|favicon.ico).*)"],
};
