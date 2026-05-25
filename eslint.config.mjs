import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

// Flat config ESLint 9 (remplace `next lint` déprécié — dette S-014 résorbée).
// On conserve strictement le ruleset historique `next/core-web-vitals` (zéro
// changement de comportement) ; le lint s'invoque désormais via la CLI ESLint.
const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

const config = [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "design-reference/**",
      "playwright-report/**",
      "test-results/**",
      "next-env.d.ts",
    ],
  },
  ...compat.extends("next/core-web-vitals"),
];

export default config;
