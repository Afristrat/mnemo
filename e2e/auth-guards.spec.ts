import { test, expect } from "@playwright/test";

// Gardes d'accès des surfaces SENSIBLES (durcissement avant ouverture). Vérifie au navigateur qu'un
// visiteur NON authentifié ne peut atteindre ni /compte (coffre de credentials vendeurs) ni le contenu
// de la console /admin, et que l'API d'écriture admin refuse sans super-admin. Les parcours AUTHENTIFIÉS
// (ajout/révocation d'un credential, édition de prompt) restent à couvrir quand l'auth complète sera
// active (S-089 : SMTP + OAuth fournis par Amine). La config fixe la locale fr-FR.

test("/compte sans session → redirigé vers /connexion", async ({ page }) => {
  await page.goto("/compte");
  await expect(page).toHaveURL(/\/connexion/);
});

test("/admin sans session → écran de connexion, jamais le contenu admin", async ({ page }) => {
  await page.goto("/admin");
  // L'écran de connexion super-admin est affiché (titre + champ mot de passe)…
  await expect(page.getByText(/console d.administration/i)).toBeVisible();
  await expect(page.locator('input[type="password"]')).toBeVisible();
  // …et le contenu réservé (bouton de déconnexion de la console authentifiée) n'est PAS rendu.
  await expect(page.getByRole("button", { name: "Se déconnecter" })).toHaveCount(0);
});

test("POST /api/admin/prompts sans super-admin → 403", async ({ request }) => {
  const res = await request.post("/api/admin/prompts", { data: {} });
  expect(res.status()).toBe(403);
});
