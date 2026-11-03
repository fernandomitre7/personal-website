import { defineConfig } from "cf/config";

export default defineConfig({
  worker: {
    name: "personal-website",
    compatibilityDate: "2026-09-21",
    domains: ["fernandomitre.com", "www.fernandomitre.com"],
  },
});
