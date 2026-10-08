import type { NextConfig } from "next";

const config: NextConfig = {
  transpilePackages: ["@qazsupply/i18n"],
  async redirects() {
    return [{ source: "/", destination: "/ru", permanent: false }];
  },
};

export default config;
