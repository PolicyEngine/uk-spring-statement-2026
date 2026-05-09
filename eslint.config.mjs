import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
  ...nextCoreWebVitals,
  {
    rules: {
      // App-router layouts inject <link rel="stylesheet"> directly so the
      // no-page-custom-font rule (which targets Pages router) doesn't apply.
      "@next/next/no-page-custom-font": "off",
      // Pre-existing patterns predating this lint config — keep them advisory
      // so the migration PR isn't widened into a refactor.
      "react/no-unescaped-entities": "off",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "coverage/**",
    "next-env.d.ts",
    "public/**",
  ]),
]);
