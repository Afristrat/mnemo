// Fondation i18n (S-057) — source de vérité des locales.
// Approche next-intl SANS préfixe d'URL : la locale vit dans un cookie (`NEXT_LOCALE`),
// détectée au 1ᵉʳ accès via Accept-Language (cf. middleware.ts), repli `fr`.
// L'arabe (`ar`, RTL) arrive en S-060 — ne PAS l'ajouter ici tant que le miroir RTL n'existe pas.

export const locales = ["fr", "en"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "fr";

// Nom du cookie de persistance (aligné sur la convention next-intl).
export const LOCALE_COOKIE = "NEXT_LOCALE";

// En-tête interne posé par le middleware pour transmettre la locale détectée au
// 1ᵉʳ rendu (avant que le cookie ne soit lisible côté serveur sur cette même requête).
export const LOCALE_HEADER = "x-next-locale";

// Autonymes (le libellé d'une langue est toujours écrit dans sa propre langue,
// quelle que soit la locale active de l'UI) — pour le sélecteur de langue.
export const localeNames: Record<Locale, string> = {
  fr: "Français",
  en: "English",
};

export function isLocale(value: string | undefined | null): value is Locale {
  return value === "fr" || value === "en";
}

// Nom anglais de la langue, injecté dans les prompts LLM (gabarits anglais → directive de langue de
// sortie « respond in {{language}} », S-059). Distinct des autonymes du sélecteur (`localeNames`).
export const promptLanguageNames: Record<Locale, string> = {
  fr: "French",
  en: "English",
};

// Sens d'écriture (S-060) : les locales RTL (arabe) pilotent `<html dir>` + le miroir des layouts via
// propriétés logiques. Set extensible ; `localeDir` accepte une chaîne (la locale active vient de
// `getLocale()`) et reste sûr pour toute valeur. `ar` n'est ajouté à `locales` qu'avec le miroir RTL prêt.
export const RTL_LOCALES: ReadonlySet<string> = new Set(["ar"]);

export function localeDir(locale: string): "ltr" | "rtl" {
  return RTL_LOCALES.has(locale) ? "rtl" : "ltr";
}
