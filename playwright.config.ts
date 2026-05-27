import { defineConfig, devices } from "@playwright/test";

// E2E des parcours critiques (S-013). Par défaut, le serveur de prod local est démarré par
// Playwright (build + start). On peut viser un environnement externe (ex. la prod) en fixant
// `E2E_BASE_URL` : dans ce cas, aucun serveur local n'est lancé (navigateur propre → la cible réelle).
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const isExternal = baseURL.startsWith("https://");

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chrome", use: { ...devices["Pixel 7"] } },
  ],
  webServer: isExternal
    ? undefined
    : {
        command: "npm run build && npm run start",
        url: "http://localhost:3000",
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
      },
});
