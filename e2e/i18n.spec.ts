import { test, expect } from "@playwright/test";

// Bascule fr↔en (S-058, chantier c). Prouve end-to-end : (1) le LocaleSwitcher pose le cookie
// `NEXT_LOCALE` et `<html lang>` suit ; (2) le chrome de l'accueil est bilingue ; (3) le VERDICT
// (descripteurs Message du MOTEUR, S-058) se rend dans la langue active — la preuve que l'i18n
// moteur fonctionne jusqu'au navigateur. La config Playwright fixe `fr-FR` → FR déterministe au départ.

test("accueil : bascule fr→en→fr (cookie + <html lang> + chrome bilingue)", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "fr");
  await expect(page.getByText("Infrastructure de mémoire IA souveraine", { exact: true })).toBeVisible();

  // FR → EN : le sélecteur (étiqueté « Langue ») pose le cookie et rafraîchit l'arbre RSC.
  await page.getByLabel("Langue").selectOption("en");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByText("Sovereign AI memory infrastructure", { exact: true })).toBeVisible();

  // EN → FR : le sélecteur est désormais étiqueté « Language ».
  await page.getByLabel("Language").selectOption("fr");
  await expect(page.locator("html")).toHaveAttribute("lang", "fr");
  await expect(page.getByText("Infrastructure de mémoire IA souveraine", { exact: true })).toBeVisible();
});

test("verdict rendu en anglais (i18n MOTEUR : verdict via descripteurs Message)", async ({ page }) => {
  await page.goto("/");
  // Attendre l'hydratation (handler onChange du sélecteur câblé) avant de basculer — sinon, sur mobile
  // (rendu plus lent), `selectOption` change la valeur native sans déclencher le cookie/refresh.
  await expect(page.getByRole("button", { name: "Voir mon verdict" })).toBeVisible();
  await page.getByLabel("Langue").selectOption("en");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");

  // Chemin 90 s en anglais : le bouton du QuickProfile est localisé.
  await page.getByRole("button", { name: "See my verdict" }).click();
  await expect(page).toHaveURL(/\/resultats\?mode=verdict/);

  // Chrome du verdict en anglais.
  await expect(page.getByText("Your verdict")).toBeVisible();
  // Corps du verdict issu du MOTEUR (gain = descripteur Message, constant) → doit s'afficher en anglais
  // (« proven » est propre à l'EN ; le FR dirait « prouvé »). Preuve que l'i18n moteur atteint l'écran.
  await expect(page.getByText(/proven/i)).toBeVisible();
});

test("arabe : bascule applique dir=rtl + lang=ar + contenu arabe (S-060)", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr"); // LTR par défaut (fr)
  await expect(page.getByRole("button", { name: "Voir mon verdict" })).toBeVisible(); // hydratation
  // Sélecteur de langue dans l'en-tête (indépendant de la langue du label, qui devient arabe après bascule).
  const switcher = page.getByRole("navigation").getByRole("combobox");
  await switcher.selectOption("ar");

  // <html> bascule en arabe RTL.
  await expect(page.locator("html")).toHaveAttribute("lang", "ar");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  // Du contenu en écriture arabe est rendu (script arabe U+0600–U+06FF), sans coder en dur la traduction.
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/[؀-ۿ]/);

  // Retour au français : LTR rétabli.
  await switcher.selectOption("fr");
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
  await expect(page.locator("html")).toHaveAttribute("lang", "fr");
});
