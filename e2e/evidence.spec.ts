import { test, expect, type Page } from "@playwright/test";

// Preuve sourcée (SearXNG) — les 3 panneaux apparaissent dans la zone preuve experte de /resultats et sont
// actionnables. On NE teste PAS le réseau live (SearXNG/LLM peuvent être indisponibles en CI) : seulement la
// présence + l'interactivité de base. Lead gate (S-068) levé via localStorage, comme strate.spec.ts.

async function unlockExpert(page: Page): Promise<void> {
  await page.addInitScript(() => {
    try {
      window.localStorage.setItem("strate.leadUnlocked.v1", "1");
    } catch {
      /* localStorage indisponible : sans effet. */
    }
  });
}

test("preuve sourcée : les 3 panneaux sont présents et actionnables", async ({ page }) => {
  await unlockExpert(page);
  await page.goto("/resultats");

  // A — citations sourcées
  const citations = page.getByRole("heading", { name: "Sources & preuves" });
  await expect(citations).toBeVisible();
  await expect(page.getByRole("button", { name: "Sourcer les affirmations" })).toBeEnabled();

  // B — drift externe
  await expect(page.getByRole("heading", { name: "Veille de dérive externe" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Lancer la veille" })).toBeEnabled();

  // C — vérification d'authenticité (le bouton est désactivé tant que l'artefact est vide)
  await expect(page.getByRole("heading", { name: /Vérification d.authenticité/ })).toBeVisible();
  const verify = page.getByRole("button", { name: "Vérifier", exact: true });
  await expect(verify).toBeDisabled();
  await page.getByPlaceholder(/Collez ici le contenu à vérifier/).fill("OVH héberge en France");
  await expect(verify).toBeEnabled();
});
