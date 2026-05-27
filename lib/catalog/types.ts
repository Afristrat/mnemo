// Catalogue de composants de la stack (reco vivante, spec n°3, S-035).
//
// Aujourd'hui les choix techniques sont figés dans `lib/engine/layers.ts` (catalogue daté). Cette
// couche les transforme en DONNÉES injectables : `buildLayers(preset, profile, catalog)` lit le
// catalogue au lieu de littéraux. Le **seed** (`catalog-seed.ts`) = transposition à l'identique de
// `layers.ts` → repli daté + baseline de plausibilité. La **veille live** (S-036, Firecrawl + LLM)
// propose des candidats sourcés ; le **garde-fou** (`reconcile.ts`) valide, sinon repli seed.
// Doctrine : extension aux CHOIX de la règle « prix jamais hardcodés » (cf. lib/pricing).

import type { Confidence } from "@/components/ui/StatusDot";
import type { CostSource } from "@/lib/engine/types";

/** Origine + statut garde-fou d'un candidat. `flagged` = live rejeté → seed conservé, confiance basse. */
export type Provenance = "live" | "seed" | "flagged";

/**
 * Niveau de souveraineté d'un composant (exploité par le filtre de contraintes dures en S-036 :
 * un profil `secret` interdit `api-third-party`). N'affecte PAS la sortie de `buildLayers`.
 */
export type ComponentSovereignty = "sovereign" | "eu-hosted" | "api-third-party";

/**
 * Candidat de composant pour un slot de la stack. `source` (DÉFCON 1) : pour le seed = référence de
 * calibration interne datée (pas une source web ; la veille live apporte les sources web réelles).
 */
export type ComponentCandidate = {
  name: string; // ex. « Claude Desktop (abonnement Pro 20$/mois) » — le `choice` rendu dans la couche
  role: string; // fonction du composant dans la couche, ex. « surface utilisateur MCP »
  license?: string; // ex. « Apache-2.0 » (vérifié par le garde-fou en S-036)
  sovereignty: ComponentSovereignty;
  benchmarkRank?: string; // ex. « #1 MMEB-V2 » (sourcé)
  source: CostSource; // { label, url, checkedAt } — toujours présent
  confidence: Confidence; // high | medium | low
  provenance: Provenance;
  note?: string; // explication rendue dans `Layer.note`
};

/** Identifiant de slot = couche C0..C6 (aligné sur `Layer.id`). */
export type SlotId = "c0" | "c1" | "c2" | "c3" | "c4" | "c5" | "c6";

/** Choix d'un slot : un candidat recommandé + des alternatives (rendues dans `Layer.alternatives`). */
export type CatalogSlot = {
  slot: SlotId;
  recommended: ComponentCandidate;
  alternatives: ComponentCandidate[];
};

/** Catalogue complet (un candidat par slot + alternatives), daté pour le snapshot reproductible. */
export type Catalog = {
  slots: Record<SlotId, CatalogSlot>;
  assembledAt: string;
  source: "live" | "seed" | "mixed";
};
