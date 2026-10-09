import type { NextConfig } from "next";

const config: NextConfig = {
  transpilePackages: ["@qazsupply/i18n", "@qazsupply/ui", "@qazsupply/motion"],
  poweredByHeader: false,
  async headers() {
    // CSP is per request (nonce) and set in proxy.ts; these are static.
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
          },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
        ],
      },
    ];
  },
  async redirects() {
    return [{ source: "/", destination: "/ru", permanent: false }];
  },
};

export default config;
