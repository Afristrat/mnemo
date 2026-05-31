// Modèle géographique homogène CONTINENT → PAYS (S-076), pur.
//
// Corrige l'incohérence historique (« Europe » bloc vs « Maroc »/« États-Unis » pays, aucun continent
// hors Europe). L'utilisateur choisit un CONTINENT (les 6 visibles) puis un PAYS/juridiction. Le bucket
// juridique `Zone` (ue/maroc/us/other) qui pilote l'analyse légale + le moteur reste DÉRIVÉ du pays
// (`deriveZone`) → zéro régression moteur. Le pays affine la découverte de fournisseurs (S-073).
//
// DÉFCON 1 : on ne fabrique AUCUN statut juridique par pays. L'analyse légale (lib/legal/transfers)
// n'est précise que pour UE/Maroc/US (recherchée, sourcée) ; tout autre pays → bucket `other`
// (défaut CONSERVATEUR « base légale à valider par un conseil »), honnête, jamais inventé.

import type { Continent, Zone } from "./types";
import { CONTINENTS } from "./types";

export type Jurisdiction = {
  /** Code stable (kebab-case) stocké dans `Profile.country`. */
  code: string;
  continent: Continent;
  /** Clé i18n du libellé (namespace `Options.country`). */
  labelKey: string;
  /** Bucket juridique dérivé (analyse des transferts). UE/Maroc/US = recherché ; sinon `other` conservateur. */
  zone: Zone;
};

// Pays/juridictions par continent. Le 1ᵉʳ de chaque continent = défaut. Alignés sur l'annuaire de
// fournisseurs souverains (S-073) pour que la découverte par pays soit pertinente.
export const JURISDICTIONS: Jurisdiction[] = [
  // Europe — l'UE est le bloc juridique recherché (adéquation/RGPD) ; le reste = conservateur.
  { code: "union-europeenne", continent: "europe", labelKey: "country.union-europeenne", zone: "ue" },
  { code: "suisse", continent: "europe", labelKey: "country.suisse", zone: "other" },
  { code: "royaume-uni", continent: "europe", labelKey: "country.royaume-uni", zone: "other" },
  { code: "autre-europe", continent: "europe", labelKey: "country.autre-europe", zone: "other" },

  // Amérique du Nord
  { code: "etats-unis", continent: "north-america", labelKey: "country.etats-unis", zone: "us" },
  { code: "canada", continent: "north-america", labelKey: "country.canada", zone: "other" },
  { code: "autre-amerique-nord", continent: "north-america", labelKey: "country.autre-amerique-nord", zone: "other" },

  // Afrique — le Maroc est la juridiction recherchée (loi 09-08, CNDP) ; le reste = conservateur.
  { code: "maroc", continent: "africa", labelKey: "country.maroc", zone: "maroc" },
  { code: "nigeria", continent: "africa", labelKey: "country.nigeria", zone: "other" },
  { code: "kenya", continent: "africa", labelKey: "country.kenya", zone: "other" },
  { code: "afrique-sud", continent: "africa", labelKey: "country.afrique-sud", zone: "other" },
  { code: "autre-afrique", continent: "africa", labelKey: "country.autre-afrique", zone: "other" },

  // Amérique latine
  { code: "bresil", continent: "latam", labelKey: "country.bresil", zone: "other" },
  { code: "mexique", continent: "latam", labelKey: "country.mexique", zone: "other" },
  { code: "autre-amerique-latine", continent: "latam", labelKey: "country.autre-amerique-latine", zone: "other" },

  // Asie-Pacifique
  { code: "japon", continent: "apac", labelKey: "country.japon", zone: "other" },
  { code: "coree-sud", continent: "apac", labelKey: "country.coree-sud", zone: "other" },
  { code: "inde", continent: "apac", labelKey: "country.inde", zone: "other" },
  { code: "autre-asie-pacifique", continent: "apac", labelKey: "country.autre-asie-pacifique", zone: "other" },

  // Moyen-Orient
  { code: "emirats", continent: "middle-east", labelKey: "country.emirats", zone: "other" },
  { code: "arabie-saoudite", continent: "middle-east", labelKey: "country.arabie-saoudite", zone: "other" },
  { code: "autre-moyen-orient", continent: "middle-east", labelKey: "country.autre-moyen-orient", zone: "other" },
];

/** Juridictions d'un continent (ordre préservé). Au moins une par continent (garanti par les tests). */
export function jurisdictionsFor(continent: Continent): Jurisdiction[] {
  return JURISDICTIONS.filter((j) => j.continent === continent);
}

/** Pays par défaut d'un continent (1ᵉʳ de la liste). */
export function defaultCountryFor(continent: Continent): string {
  const first = jurisdictionsFor(continent)[0];
  return first === undefined ? "autre-europe" : first.code;
}

/** Juridiction d'un code pays (ou `undefined`). */
export function jurisdictionFor(country: string): Jurisdiction | undefined {
  return JURISDICTIONS.find((j) => j.code === country);
}

/** Bucket juridique `Zone` dérivé du pays (défaut conservateur `other` si inconnu). Pur, total. */
export function deriveZone(country: string): Zone {
  return jurisdictionFor(country)?.zone ?? "other";
}

/** Continent d'un code pays (défaut `europe` si inconnu). */
export function continentForCountry(country: string): Continent {
  return jurisdictionFor(country)?.continent ?? "europe";
}

/**
 * Réconcilie un profil legacy (ne portant qu'un `zone`, sans continent/pays) vers le modèle continent+pays.
 * Choisit un pays représentatif du bucket. Pur, total ; `other` → Europe/Autre (continent indéterminé).
 */
export function geographyFromZone(zone: Zone): { continent: Continent; country: string } {
  switch (zone) {
    case "ue":
      return { continent: "europe", country: "union-europeenne" };
    case "maroc":
      return { continent: "africa", country: "maroc" };
    case "us":
      return { continent: "north-america", country: "etats-unis" };
    default:
      return { continent: "europe", country: "autre-europe" };
  }
}

/** Tous les continents (ré-export pratique pour l'UI). */
export { CONTINENTS };
