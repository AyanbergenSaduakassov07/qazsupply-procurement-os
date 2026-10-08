/** Cookie names, kept free of server-only imports so client components can use them. */
export const ACCESS_TOKEN_COOKIE = "qs_access_token";
export const REFRESH_TOKEN_COOKIE = "qs_refresh_token";
export const ORG_COOKIE = "qs_org";
export const REDUCE_TRANSPARENCY_COOKIE = "qs_reduce_transparency";

/** Seconds before expiry at which the proxy refreshes the access token. */
export const REFRESH_LEEWAY_S = 60;
