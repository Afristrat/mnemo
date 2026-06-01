import { test, expect } from "@playwright/test";

// S-077 (T5) — preuve end-to-end que les régimes phares hors-UE MODÉLISÉS (LGPD/Brésil, APPI/Japon)
// atteignent le configurateur comme options sélectionnables, et que le détecteur dynamique de régimes
// (veille par pays + résidence des clients) est présent. Le bloc « profil » est le 1ᵉʳ → déterministe,
// sans dépendre de la veille live (/api/legal/regimes). La config Playwright fixe `fr-FR`.

test("configurateur : régimes LGPD/APPI sélectionnables + détecteur présent (S-077)", async ({ page }) => {
  await page.goto("/configurateur");

  // Les régimes phares hors-UE modélisés sont proposés comme cases à cocher (extension de l'énum → UI).
  await expect(page.getByText("LGPD (Brésil)", { exact: true })).toBeVisible();
  await expect(page.getByText("APPI (Japon)", { exact: true })).toBeVisible();

  // Le détecteur dynamique de régimes (S-077) est présent dans le bloc « profil ».
  await expect(
    page.getByText("Détecter les régimes applicables (selon le pays et vos clients)"),
  ).toBeVisible();
});
