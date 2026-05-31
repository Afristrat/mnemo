// Annuaire de fournisseurs d'infrastructure souverains, MULTI-CONTINENT (S-073, tranche 1).
// Vision Amine : « être sur tous les continents ; pour chaque continent, proposer de trouver des
// fournisseurs dans le(s) pays cible(s), surtout pour la redondance multi-fournisseur ».
//
// CONTRAT PUR (le seed sourcé vit dans lib/pricing/sovereign-providers-seed, comme les autres seeds).
// DÉFCON 1 : on ne porte PAS de prix egress par fournisseur ici (devis/veille — jamais fabriqué) ;
// l'annuaire documente l'EXISTENCE + pays + classe de souveraineté + source datée. La découverte live
// par pays (veille, tranche 3, respectant les contraintes S-072) et l'UI de redondance (tranche 4)
// consomment cet annuaire. La classe légale de transfert reste gérée par lib/legal (conservatrice).
//
// Consommateurs : seed `lib/pricing/sovereign-providers-seed`, veille `lib/residency/discovery`,
// UI `components/results/RedundancyPanel`.

import type { CostSource } from "./types";

/** Continents couverts (granularité « présence mondiale »). */
export type Continent = "europe" | "north-america" | "latam" | "africa" | "middle-east" | "apac";

export const CONTINENTS: readonly Continent[] = ["europe", "north-america", "latam", "africa", "middle-east", "apac"];

/** Classe de souveraineté d'un fournisseur (pour le filtrage par contraintes utilisateur, cf. S-072). */
export type ProviderSovereignty = "sovereign" | "eu-hosted" | "hyperscaler";

export type SovereignProvider = {
  name: string;
  continent: Continent;
  /** Pays cible (nom courant) — granularité « fournisseurs dans le(s) pays cible(s) ». */
  country: string;
  sovereignty: ProviderSovereignty;
  note: string;
  /** Source datée (DÉFCON 1) — existence/positionnement public, jamais un prix gravé. */
  source: CostSource;
};

/** Filtre un annuaire par continent (tous si `continent` omis). Pur. */
export function providersByContinent(providers: SovereignProvider[], continent?: Continent): SovereignProvider[] {
  return continent === undefined ? providers : providers.filter((p) => p.continent === continent);
}

/** Continents effectivement couverts par un annuaire (pour vérifier l'amplitude « tous les continents »). */
export function coveredContinents(providers: SovereignProvider[]): Continent[] {
  return CONTINENTS.filter((c) => providers.some((p) => p.continent === c));
}
