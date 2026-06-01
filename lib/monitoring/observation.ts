// Audit des snapshots d'Infra Health Score (S-081, F12) : constructeur PUR d'une ligne `health_metrics`
// à partir d'un `HealthReport` (S-079). L'insertion Supabase (+ RLS) se fait côté appelant (route
// serveur). Pattern aligné sur les builders d'observation (S-062/S-077) — pur, sans effet de bord.

import type { HealthMetricInsert } from "@/lib/supabase/types";
import type { HealthSnapshot } from "./health";

export function buildHealthMetricRow(args: {
  report: HealthSnapshot;
  checkedAt: string;
  circleId?: string | null;
  createdBy?: string | null;
}): HealthMetricInsert {
  return {
    circle_id: args.circleId ?? null,
    created_by: args.createdBy ?? null,
    score: args.report.score,
    status: args.report.status,
    measured: args.report.measured,
    total: args.report.total,
    subscores: args.report.subscores.map((s) => ({ dimension: s.dimension, score: s.score, status: s.status })),
    checked_at: args.checkedAt,
  };
}
