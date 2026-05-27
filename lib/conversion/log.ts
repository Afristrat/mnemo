// Conversion & data (S-023) : constructeurs PURS des charges utiles à insérer (log des
// simulations + capture e-mail). Aucun effet de bord, l'insertion Supabase (et le respect
// RLS) se fait côté appelant (route serveur / client), exercé par le test d'intégration gated
// et l'e2e (S-024). Pattern aligné sur `lib/network/consent.ts` (builder pur).

import type { Profile, Recommendation } from "@/lib/engine";
import type { LeadCaptureInsert, LeadContext, SimulationLogInsert } from "@/lib/supabase/types";

/**
 * Construit la ligne `simulation_log` à partir d'un profil et de sa recommandation.
 * `circleId`/`createdBy` restent `null` pour une simulation anonyme (configurateur public) ;
 * `id`/`share_token`/`created_at` sont générés par la base. Pur.
 */
export function buildSimulationLog(args: {
  profile: Profile;
  recommendation: Recommendation;
  circleId?: string | null;
  createdBy?: string | null;
}): SimulationLogInsert {
  return {
    circle_id: args.circleId ?? null,
    created_by: args.createdBy ?? null,
    preset: args.recommendation.preset,
    profile: args.profile,
    verdict: args.recommendation.verdict,
    total_cost: args.recommendation.totalCost,
    setup_cost: args.recommendation.setupCost,
  };
}

/** Validation minimale de la forme d'un e-mail (l'UI valide aussi ; la base ne fait pas confiance). */
export function isValidEmail(email: string): boolean {
  const trimmed = email.trim();
  return trimmed.length >= 5 && trimmed.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}

/**
 * Construit la ligne `lead_capture` (capture e-mail exit-intent). E-mail normalisé (trim +
 * minuscules). Collecte minimale (RGPD/CNDP) : e-mail + contexte + liens facultatifs. Pur.
 */
export function buildLeadCapture(args: {
  email: string;
  simulationId?: string | null;
  circleId?: string | null;
  context?: LeadContext;
}): LeadCaptureInsert {
  return {
    email: args.email.trim().toLowerCase(),
    simulation_id: args.simulationId ?? null,
    circle_id: args.circleId ?? null,
    context: args.context ?? "exit_intent",
  };
}
