import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { version: reactVersion } = require("react/package.json");

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // API app uses TypeScript type checking instead of ESLint:
    "apps/api/**",
  ]),
  // Provide react version explicitly to avoid eslint-plugin-react auto-detection
  // which uses a deprecated API removed in ESLint 10.
  {
    settings: {
      react: {
        version: reactVersion,
      },
    },
  },
]);

export default eslintConfig;
