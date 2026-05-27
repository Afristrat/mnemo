import { test, expect } from "@playwright/test";

// Parcours critiques de la refonte Strate (S-024), desktop + mobile.
// Le parcours « wizard 4 blocs → résultats expert » est couvert par parcours.spec.ts.

test("chemin 90 s → verdict", async ({ page }) => {
  await page.goto("/");
  // Le formulaire 90 s est pré-rempli (défauts) : on peut valider directement.
  await page.getByRole("button", { name: "Voir mon verdict" }).click();

  await expect(page).toHaveURL(/\/resultats\?mode=verdict/);
  await expect(page.getByText("Votre verdict")).toBeVisible();
  await expect(page.getByRole("button", { name: "Voir le détail (expert)" })).toBeVisible();
});

test("bloc Médias : génération vidéo souveraine → budget rouge + levier", async ({ page }) => {
  await page.goto("/configurateur");
  // Aller au bloc ④ Médias (3 « Suivant »).
  for (let i = 0; i < 3; i += 1) {
    await page.getByRole("button", { name: "Suivant" }).click();
  }

  // Régler « À créer / générer » de la vidéo (2ᵉ modalité) au maximum (intensif), mode souverain (défaut).
  const videoCreate = page.getByRole("slider", { name: "À créer / générer" }).nth(1);
  await videoCreate.focus();
  await videoCreate.press("End");

  // Le budget-mètre bascule au rouge et propose un levier (cause dominante = GPU de génération).
  await expect(page.getByText("Au-dessus du budget")).toBeVisible();
  await expect(page.getByText(/Levier/)).toBeVisible();
});

test("profil critique régulé → ligne backup + radar 9 axes + érasure crypto-shred", async ({ page }) => {
  await page.goto("/configurateur");
  // Bloc ① : sensibilité « secret » → surcharge conformité (crypto-shred + immutable).
  await page.getByRole("button", { name: /Secret/ }).click();
  // Bloc ② Infra (1 « Suivant ») : section Sauvegarde → criticité « Critique ».
  await page.getByRole("button", { name: "Suivant" }).click();
  await page.getByRole("button", { name: /Critique/ }).click();

  await page.goto("/resultats");
  // CostMap : la ligne backup reflète le plan critique + l'érasure crypto-shred (régulé).
  await expect(page.getByText(/Plan « critical »/)).toBeVisible();
  await expect(page.getByText(/crypto-shred/)).toBeVisible();
  // Radar passé à 9 axes (dimension resilience).
  await expect(page.getByRole("img", { name: /Radar des 9 dimensions/ })).toBeVisible();
});

test("round-trip /configurateur → /resultats : la génération souveraine se retrouve dans les coûts", async ({ page }) => {
  await page.goto("/configurateur");
  for (let i = 0; i < 3; i += 1) {
    await page.getByRole("button", { name: "Suivant" }).click();
  }
  const videoCreate = page.getByRole("slider", { name: "À créer / générer" }).nth(1);
  await videoCreate.focus();
  await videoCreate.press("End");

  // Le profil (avec mediaNeeds) est persisté en localStorage → /resultats le reprend (mode expert).
  await page.goto("/resultats");
  await expect(page.getByText(/^Preset :/)).toBeVisible();
  await expect(page.getByText("Apport multimédia", { exact: false })).toBeVisible();
  await expect(page.getByText(/Pool GPU souverain/)).toBeVisible();
});
