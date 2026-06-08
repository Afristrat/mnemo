import { test, expect } from "@playwright/test";

// Parcours AUTHENTIFIÉ → tableau de bord /compte (clôture S-089). Gated comme les tests d'intégration
// RLS : ne s'exécute que si un compte de test est fourni (sinon skip → CI vert). Fournir :
//   E2E_AUTH_EMAIL + E2E_AUTH_PASSWORD  (compte confirmé existant dans le Supabase ciblé)
// Les gardes d'accès NON authentifiées (/compte→/connexion, /admin) sont couvertes par auth-guards.spec.ts.

const EMAIL = process.env.E2E_AUTH_EMAIL ?? "";
const PASSWORD = process.env.E2E_AUTH_PASSWORD ?? "";
const ready = EMAIL !== "" && PASSWORD !== "";

test.describe("Compte authentifié (S-089)", () => {
  test.skip(!ready, "E2E_AUTH_EMAIL / E2E_AUTH_PASSWORD non fournis — test gated");

  test("connexion e-mail/mot de passe → tableau de bord /compte", async ({ page }) => {
    await page.goto("/connexion");
    await page.getByLabel("Adresse e-mail", { exact: true }).fill(EMAIL);
    await page.getByLabel("Mot de passe", { exact: true }).fill(PASSWORD);
    await page.getByRole("button", { name: "Continuer", exact: true }).click();

    // Le login renvoie vers /compte (window.location.assign) : on attend le tableau de bord.
    await page.waitForURL(/\/compte/, { timeout: 15000 });
    await expect(page.getByRole("heading", { name: "Identité" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Se déconnecter" })).toBeVisible();
    // Les 4 sections du tableau de bord sont présentes.
    await expect(page.getByRole("heading", { name: "Mes plans sauvegardés" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Réseau & consentement" })).toBeVisible();

    // Déconnexion → retour à l'accueil, /compte de nouveau protégé.
    await page.getByRole("button", { name: "Se déconnecter" }).click();
    await page.waitForURL(/\/$|\/\?/, { timeout: 15000 });
    await page.goto("/compte");
    await expect(page).toHaveURL(/\/connexion/);
  });
});
