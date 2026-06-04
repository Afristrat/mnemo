// Audit trail de la continuité de résidence (S-095) : constructeur PUR de la ligne
// residency_continuity_observations. L'insertion Supabase (et le respect RLS) se fait côté appelant
// (route serveur). Jumeau de lib/legal/regime-observation. `circleId`/`createdBy` restent null pour un
// relevé anonyme (configurateur public). Pur, sans effet de bord.

import type { ResidencyContinuityObservationInsert } from "@/lib/supabase/types";
import type { ResidencyContinuityReport } from "./continuity";

export function buildContinuityObservation(args: {
  report: ResidencyContinuityReport;
  integrityHash: string;
  circleId?: string | null;
  createdBy?: string | null;
}): ResidencyContinuityObservationInsert {
  const { report } = args;
  return {
    circle_id: args.circleId ?? null,
    created_by: args.createdBy ?? null,
    primary_region: report.primaryRegion,
    out_of_zone_count: report.outOfZoneCount,
    unverified_count: report.unverifiedCount,
    components: report.components.map((c) => ({
      id: c.id,
      region: c.region,
      flag: c.flag,
      legalBasis: c.legalBasis ?? null,
    })),
    integrity_hash: args.integrityHash,
    observed_at: report.generatedAt,
  };
}
