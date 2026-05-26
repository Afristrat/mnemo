import { test, expect } from "@playwright/test";

// Parcours critique : wizard → résultats → livrable → export.
test("wizard → résultats : la recommandation détaillée s'affiche", async ({ page }) => {
  await page.goto("/configurateur");

  // Profil par défaut pré-rempli : on traverse les 4 blocs (3 « Suivant ») jusqu'au bloc Médias.
  for (let i = 0; i < 3; i += 1) {
    await page.getByRole("button", { name: "Suivant" }).click();
  }
  await page.getByRole("link", { name: "Voir ma recommandation détaillée" }).click();

  await expect(page).toHaveURL(/\/resultats/);
  await expect(page.getByText(/^Preset :/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Stack recommandée" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Ensemble de configurations" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Carte de coûts" })).toBeVisible();
});

test("export du livrable : Markdown, PDF et bundle Exit Escrow", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.includes("mobile"), "Téléchargements vérifiés sur desktop.");
  await page.goto("/resultats");
  await expect(page.getByText(/^Preset :/)).toBeVisible();

  const markdown = page.waitForEvent("download");
  await page.getByRole("button", { name: /Markdown/ }).click();
  expect((await markdown).suggestedFilename()).toMatch(/\.md$/);

  const pdf = page.waitForEvent("download");
  await page.getByRole("button", { name: /PDF/ }).click();
  expect((await pdf).suggestedFilename()).toMatch(/\.pdf$/);

  const zip = page.waitForEvent("download");
  await page.getByRole("button", { name: /bundle/i }).click();
  expect((await zip).suggestedFilename()).toMatch(/\.zip$/);
});

test("charte fiduciaire accessible et explicite", async ({ page }) => {
  await page.goto("/fiduciaire");
  await expect(page.getByRole("heading", { name: "Charte fiduciaire Mnémo" })).toBeVisible();
  await expect(page.getByText(/commission/i).first()).toBeVisible();
});
