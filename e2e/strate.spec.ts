import { test, expect, type Page } from "@playwright/test";

// Parcours critiques de la refonte Strate (S-024), desktop + mobile.
// Le parcours « wizard 4 blocs → résultats expert » est couvert par parcours.spec.ts.

// Lead gate (S-068) : la recette experte est gatée derrière nom + e-mail. Pour les parcours qui
// vérifient le DÉTAIL expert, on simule un lead déjà fourni (clé localStorage « débloqué »).
async function unlockExpert(page: Page): Promise<void> {
  await page.addInitScript(() => {
    try {
      window.localStorage.setItem("strate.leadUnlocked.v1", "1");
    } catch {
      /* localStorage indisponible : sans effet. */
    }
  });
}

test("chemin 90 s → verdict", async ({ page }) => {
  await page.goto("/");
  // Le formulaire 90 s est pré-rempli (défauts) : on peut valider directement.
  await page.getByRole("button", { name: "Voir mon verdict" }).click();

  await expect(page).toHaveURL(/\/resultats\?mode=verdict/);
  await expect(page.getByText("Votre verdict")).toBeVisible();
  await expect(page.getByRole("button", { name: "Voir le détail (expert)" })).toBeVisible();
});

test("lead gate : le verdict est libre ; le détail expert ne s'ouvre qu'après nom + e-mail", async ({ page }) => {
  await page.goto("/resultats");
  // Le détail expert est verrouillé : le formulaire de capture s'affiche, pas la stack.
  await expect(page.getByRole("heading", { name: /recette complète/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Stack recommandée" })).toHaveCount(0);

  // Saisir nom + e-mail valides → déverrouille la recette experte.
  await page.getByLabel("Nom", { exact: true }).fill("Amine");
  await page.getByLabel("E-mail", { exact: true }).fill("amine@example.com");
  await page.getByRole("button", { name: "Voir le détail (expert)" }).click();

  await expect(page.getByRole("heading", { name: "Stack recommandée" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Carte de coûts" })).toBeVisible();
});

test("MBOM signé : la vérification rejette un collage invalide (vague 3, authenticité)", async ({ page }) => {
  await unlockExpert(page);
  await page.goto("/resultats");
  // Le panneau MBOM charge ses modules en import dynamique (chunks) : sur un serveur standalone à froid,
  // attendre que le manifeste soit construit (bouton de téléchargement actif) avant d'interagir.
  await expect(page.getByRole("button", { name: "Télécharger le MBOM (Markdown)" })).toBeEnabled({
    timeout: 20000,
  });
  await page.getByPlaceholder(/Collez ici le contenu JSON/).fill("ceci n'est pas un MBOM signé");
  await page.getByRole("button", { name: "Vérifier l'authenticité" }).click();
  await expect(page.getByText(/Format non reconnu/)).toBeVisible({ timeout: 15000 });
});

test("SLA paramétrique : la disponibilité publiée des fournisseurs est affichée et sourcée (vague 3 #5)", async ({ page }) => {
  await unlockExpert(page);
  await page.goto("/resultats");
  const slaHeading = page.getByRole("heading", { name: "SLA paramétrique — disponibilité publiée" });
  await slaHeading.scrollIntoViewIfNeeded();
  await expect(slaHeading).toBeVisible();
  // Profil souverain par défaut (zone UE) → spectre OVHcloud / Scaleway, sourcé (on cible la cellule du tableau SLA).
  await expect(page.getByRole("cell", { name: "OVHcloud", exact: true })).toBeVisible();
  await expect(page.getByRole("cell", { name: /min\/mois/ }).first()).toBeVisible();
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

test("profil critique régulé → ligne backup + radar 10 axes + érasure crypto-shred", async ({ page }) => {
  await unlockExpert(page);
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
  // Radar passé à 10 axes (dimensions resilience + geosov).
  await expect(page.getByRole("img", { name: /Radar des 10 dimensions/ })).toBeVisible();
});

test("profil régulé multi-région → ligne réplication + transfert encadré + radar 10 axes", async ({ page }) => {
  await unlockExpert(page);
  await page.goto("/configurateur");
  // Bloc ② Infra (1 « Suivant ») : section Résidence & continuité.
  await page.getByRole("button", { name: "Suivant" }).click();
  // Continuité régionale « Chaude » (DR hot) → l'affinage expert résidence apparaît.
  await page.getByRole("button", { name: /Chaude/ }).click();
  await page.getByText("Affinage expert", { exact: true }).click();
  // Autoriser une 2ᵉ région sur un autre continent (finding C4) → flux UE → États-Unis.
  await page.getByRole("checkbox", { name: "États-Unis" }).click();

  await page.goto("/resultats");
  // Panneau Résidence & transferts : flux UE → US « Encadré » avec base légale.
  await expect(page.getByRole("heading", { name: "Résidence & transferts" })).toBeVisible();
  await expect(page.getByText(/Encadré/)).toBeVisible();
  // Scopé au panneau Résidence & transferts : la base légale apparaît aussi dans le panneau de
  // preuve de résidence continue (S-095) → on cible ce panneau-ci pour rester non ambigu.
  const residencyCard = page.getByRole("heading", { name: "Résidence & transferts" }).locator("xpath=ancestor::div[1]");
  await expect(residencyCard.getByText(/RGPD chap\. V/).first()).toBeVisible();
  // Radar à 10 axes (résilience + géo-souveraineté).
  await expect(page.getByRole("img", { name: /Radar des 10 dimensions/ })).toBeVisible();
});

test("intake libre : décrire son besoin pré-remplit le configurateur", async ({ page }) => {
  await page.goto("/");
  const field = page.getByLabel(/décrivez votre besoin/i);
  const analyse = page.getByRole("button", { name: /Analyser et pré-remplir/ });
  // Robuste à l'hydratation (le bouton est gaté par l'état React `text`) : un `fill` arrivé AVANT que
  // React n'attache `onChange` est perdu → le bouton reste `disabled`. On (re)remplit jusqu'à ce que la
  // saisie soit prise en compte (bouton activé), au lieu de courir l'hydratation (cause de flake e2e).
  await expect(async () => {
    await field.fill("cabinet d'avocats, 8 personnes, dossiers clients confidentiels, hébergement en France");
    await expect(analyse).toBeEnabled({ timeout: 1000 });
  }).toPass({ timeout: 20000 });
  await analyse.click();
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
  await unlockExpert(page);
  await page.goto("/resultats");
  await expect(page.getByRole("heading", { name: "Poser une question" })).toBeVisible();
  await page.getByPlaceholder(/pourquoi ce preset/i).fill("Pourquoi ce preset ?");
  await page.getByRole("button", { name: "Envoyer" }).click();
  // LLM présent → réponse ; LLM indispo → message de repli. Dans tous les cas : un message « Assistant » apparaît.
  await expect(page.getByText("Assistant", { exact: false }).first()).toBeVisible({ timeout: 35000 });
});

test("reco vivante : la provenance des choix techniques est affichée (repli seed immédiat)", async ({ page }) => {
  await unlockExpert(page);
  await page.goto("/resultats");
  await expect(page.getByText("Provenance des choix techniques")).toBeVisible();
  // Repli seed immédiat (ou live si la veille répond) : chaque couche porte une provenance.
  await expect(page.getByText(/Calibration datée|Vérifié en direct|À revérifier/).first()).toBeVisible();
});

test("ensemble : basculer sur un scénario recalcule la page puis revenir à la recommandation", async ({ page }) => {
  await unlockExpert(page);
  await page.goto("/resultats");
  const ensemble = page.getByRole("region", { name: "Ensemble de configurations" });
  await expect(ensemble).toBeVisible();

  await ensemble.getByRole("button", { name: /Coût minimal/ }).click();
  await expect(page.getByRole("button", { name: "Revenir à ma recommandation" })).toBeVisible();

  await page.getByRole("button", { name: "Revenir à ma recommandation" }).click();
  await expect(page.getByRole("button", { name: "Revenir à ma recommandation" })).toHaveCount(0);
});

test("round-trip /configurateur → /resultats : la génération souveraine se retrouve dans les coûts", async ({ page }) => {
  await unlockExpert(page);
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
