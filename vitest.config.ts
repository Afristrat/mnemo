import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const root = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    // `server-only` (S-078) lève une erreur à l'import hors contexte react-server ; en test Node on
    // l'alias vers un module vide. Le garde-fou réel est appliqué au build Next.js.
    alias: { "@": root, "server-only": `${root}/test/server-only-stub.ts` },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./test/setup.ts"],
    include: ["**/*.test.{ts,tsx}"],
    exclude: ["node_modules", ".next", "design-reference", "e2e"],
  },
});
