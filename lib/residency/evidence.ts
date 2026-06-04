// Evidence pack de résidence continue — PUR. Fige le rapport en MD + JSON + empreinte SHA-256 → maillon
// opposable de la chaîne de preuve, ajoutable au bundle Exit Escrow. Résolveur i18n injecté (doc figé/langue).

import { computeIntegrityHash } from "@/lib/decision/integrity";
import type { EngineResolver } from "@/lib/engine/message";
import type { ResidencyContinuityReport, ContinuityFlag } from "./continuity";

const FLAG_LABEL: Record<ContinuityFlag, string> = {
  "in-zone": "✅ en zone",
  restricted: "⚠️ restreint",
  "out-of-zone": "⛔ hors zone",
  unverified: "❔ à confirmer",
};

export type ResidencyEvidence = { json: string; markdown: string; integrityHash: string };

export async function buildResidencyEvidence(
  report: ResidencyContinuityReport,
  resolve: EngineResolver,
): Promise<ResidencyEvidence> {
  const integrityHash = await computeIntegrityHash(report);
  const lines: string[] = [];
  lines.push("# Preuve de résidence continue");
  lines.push("");
  lines.push(`> ${report.disclaimer}`);
  lines.push("");
  lines.push(`- **Relevé** : ${report.generatedAt}`);
  lines.push(`- **Région primaire** : ${report.primaryRegion}`);
  lines.push(`- **Composants hors zone** : ${report.outOfZoneCount} · **à confirmer** : ${report.unverifiedCount}`);
  lines.push(`- **Intégrité** : \`sha256:${integrityHash}\``);
  lines.push("");
  lines.push("| Composant | Région | Statut | Base légale |");
  lines.push("| --- | --- | --- | --- |");
  for (const c of report.components) {
    lines.push(`| ${resolve(c.label)} | ${c.region ?? "—"} | ${FLAG_LABEL[c.flag]} | ${c.legalBasis ?? "—"} |`);
  }
  lines.push("");
  return { json: JSON.stringify({ ...report, integrityHash }, null, 2) + "\n", markdown: lines.join("\n"), integrityHash };
}
