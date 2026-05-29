// Garde-fou de la veille juridique (S-062, jumeau de `lib/catalog/reconcile`).
//
// Un signal de statut proposé par la veille live (Firecrawl + LLM) NE remplace JAMAIS en silence un
// statut juridique : DÉFCON 1 sur du droit. `reconcileTransferBasis` réconcilie le signal live vs le
// repli daté (`lookupTransferBasis`) :
//   - veille indisponible (null)           → repli seed inchangé (provenance `seed`).
//   - signal live CONCORDANT avec le seed   → statut CONFIRMÉ : fraîcheur rafraîchie, source live,
//                                             provenance `live` (toujours daté + révisable + disclaimer).
//   - signal live DIVERGENT du seed          → statut NON adopté : on conserve la base datée, on baisse
//                                             la confiance, on marque `volatile` + provenance `flagged`
//                                             et on note la divergence (« à revérifier par un conseil »).
// Aucune sortie sans `checkedAt` + `disclaimer` + caractère révisable. Fonction PURE, sans réseau.

import type { LegalSource, TransferBasis, TransferStatus } from "./transfers";

/** Signal brut proposé par la veille (déjà borné : statut valide + source URL ∈ résultats web). */
export type LiveTransferSignal = {
  status: TransferStatus;
  legalBasis?: string;
  source: LegalSource;
  note?: string;
};

function withNote(base: string | undefined, added: string): string {
  return base === undefined || base.trim() === "" ? added : `${base} ${added}`;
}

/**
 * Réconcilie un signal live vs le repli daté (DÉFCON 1). Pure, totale. Le résultat porte TOUJOURS
 * `checkedAt`, `disclaimer` et reste révisable ; un statut divergent est FLAGGÉ, jamais adopté en silence.
 */
export function reconcileTransferBasis(
  seed: TransferBasis,
  live: LiveTransferSignal | null,
  checkedAt: string,
): TransferBasis {
  if (live === null) {
    return { ...seed, provenance: "seed" };
  }

  if (live.status === seed.status) {
    // Concordance → statut confirmé par une source fraîche (reste juridiquement volatile par nature).
    return {
      ...seed,
      source: live.source,
      checkedAt,
      confidence: seed.confidence,
      provenance: "live",
      note: withNote(seed.note, `Veille ${checkedAt} : statut confirmé (${live.source.url}).`),
    };
  }

  // Divergence → NON adopté : base datée conservée, confiance basse, flag à revérifier (jamais silencieux).
  return {
    ...seed,
    confidence: "low",
    volatile: true,
    provenance: "flagged",
    note: withNote(
      seed.note,
      `⚠ Veille ${checkedAt} : signal divergent (« ${live.status} » selon ${live.source.url}) — à revérifier par un conseil avant toute décision.`,
    ),
  };
}
