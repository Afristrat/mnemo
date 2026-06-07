// Evidence pack du Drift Monitor — PUR. Fige le rapport de dérive en MD + JSON + empreinte SHA-256 →
// maillon opposable de la chaîne de preuve. Réutilise sha256Hex/canonicalJson (lib/decision/integrity).

import { sha256Hex, canonicalJson } from "@/lib/decision/integrity";
import type { DriftReport, DriftStatus } from "./reconcile";

const STATUS_LABEL: Record<DriftStatus, string> = {
  aligned: "✅ aligné",
  drifted: "⚠️ dérive",
  missing: "⛔ absent",
  unexpected: "❔ inattendu",
};

export type DriftEvidence = { json: string; markdown: string; integrityHash: string };

export async function buildDriftEvidence(report: DriftReport): Promise<DriftEvidence> {
  const integrityHash = await sha256Hex(canonicalJson(report));
  const lines: string[] = [];
  lines.push("# Preuve de conformité de déploiement (Drift Monitor)");
  lines.push("");
  lines.push(`> ${report.disclaimer}`);
  lines.push("");
  lines.push(`- **Relevé** : ${report.generatedAt}`);
  lines.push(`- **État** : ${report.inSync ? "✅ conforme à la reco signée" : "⚠️ dérive détectée"}`);
  lines.push(`- **Couches alignées** : ${report.alignedCount} · **écarts** : ${report.driftCount}`);
  lines.push(`- **Violations de contrainte** : ${report.constraintViolations.length}`);
  lines.push(`- **Intégrité** : \`sha256:${integrityHash}\``);
  lines.push("");
  lines.push("| Couche | Statut | Signé | Vivant |");
  lines.push("| --- | --- | --- | --- |");
  for (const i of report.items) {
    lines.push(`| C${i.id} ${i.label} | ${STATUS_LABEL[i.status]} | ${i.expected ?? "—"} | ${i.actual ?? "—"} |`);
  }
  if (report.constraintViolations.length > 0) {
    lines.push("");
    lines.push("## Violations de contrainte");
    for (const v of report.constraintViolations) lines.push(`- ${v}`);
  }
  lines.push("");
  return { json: JSON.stringify({ ...report, integrityHash }, null, 2) + "\n", markdown: lines.join("\n"), integrityHash };
}
