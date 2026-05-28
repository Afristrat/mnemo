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

test("intake libre : décrire son besoin pré-remplit le configurateur", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel(/décrivez votre besoin/i).fill(
    "cabinet d'avocats, 8 personnes, dossiers clients confidentiels, hébergement en France",
  );
  await page.getByRole("button", { name: /Analyser et pré-remplir/ }).click();
  // Repli garanti (profil par défaut si LLM indispo) → la navigation vers le configurateur a lieu.
  await expect(page).toHaveURL(/\/configurateur/, { timeout: 35000 });
  await expect(page.getByRole("heading", { name: /Quelle infrastructure/ })).toBeVisible();
});

test("note libre par bloc : « Intégrer » ajuste le profil (repli gracieux si LLM indisponible)", async ({ page }) => {
  await page.goto("/configurateur");
  // Bouton désactivé tant que la note est vide (additif, jamais bloquant).
  await expect(page.getByRole("button", { name: "Intégrer cette note" })).toBeDisabled();
  await page.locator("textarea").first().fill("nous traitons aussi des fichiers audio confidentiels");
  const integrer = page.getByRole("button", { name: "Intégrer cette note" });
  await expect(integrer).toBeEnabled();
  await integrer.click();
  // LLM présent → « Vérifiez les champs » (ou « Aucun paramètre ») ; LLM indispo → « indisponible ».
  // Dans tous les cas : aucun crash et les contrôles manuels restent disponibles.
  await expect(page.getByText(/Vérifiez les champs|indisponible|Aucun paramètre/)).toBeVisible({ timeout: 35000 });
  await expect(page.getByRole("button", { name: "Suivant" })).toBeEnabled();
});

test("assistant Q&A : poser une question renvoie une réponse (ou repli gracieux), sans crash", async ({ page }) => {
  await page.goto("/resultats");
  await expect(page.getByRole("heading", { name: "Poser une question" })).toBeVisible();
  await page.getByPlaceholder(/pourquoi ce preset/i).fill("Pourquoi ce preset ?");
  await page.getByRole("button", { name: "Envoyer" }).click();
  // LLM présent → réponse ; LLM indispo → message de repli. Dans tous les cas : un message « Assistant » apparaît.
  await expect(page.getByText("Assistant", { exact: false }).first()).toBeVisible({ timeout: 35000 });
});

test("reco vivante : la provenance des choix techniques est affichée (repli seed immédiat)", async ({ page }) => {
  await page.goto("/resultats");
  await expect(page.getByText("Provenance des choix techniques")).toBeVisible();
  // Repli seed immédiat (ou live si la veille répond) : chaque couche porte une provenance.
  await expect(page.getByText(/Calibration datée|Vérifié en direct|À revérifier/).first()).toBeVisible();
});

test("ensemble : basculer sur un scénario recalcule la page puis revenir à la recommandation", async ({ page }) => {
  await page.goto("/resultats");
  const ensemble = page.getByRole("region", { name: "Ensemble de configurations" });
  await expect(ensemble).toBeVisible();

  await ensemble.getByRole("button", { name: /Coût minimal/ }).click();
  await expect(page.getByRole("button", { name: "Revenir à ma recommandation" })).toBeVisible();

  await page.getByRole("button", { name: "Revenir à ma recommandation" }).click();
  await expect(page.getByRole("button", { name: "Revenir à ma recommandation" })).toHaveCount(0);
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
