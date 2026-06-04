// Rendu Markdown du certificat de Restore Drill VÉRIFIÉ — PUR. Traducteur (namespace Results.restoreDrill)
// injecté. Le document fige le verdict + l'empreinte recalculée → maillon opposable de la chaîne de preuve.

import type { RestoreVerdict } from "./certificate";

type Translator = (key: string, values?: Record<string, string | number>) => string;

export function renderRestoreCertificateMarkdown(
  verdict: RestoreVerdict,
  hash: string,
  generatedAt: string,
  t: Translator,
): string {
  const lines: string[] = [];
  lines.push(`# ${t("docTitle")}`);
  lines.push("");
  lines.push(`> ${t("disclaimer")}`);
  lines.push("");
  lines.push(`- **${t("verdict")}** : ${verdict.valid ? t("verdictPass") : t("verdictFail")}`);
  lines.push(`- **${t("generatedAt")}** : ${generatedAt}`);
  lines.push(`- **${t("mode")}** : ${verdict.mode ?? "—"}`);
  lines.push(
    `- **${t("dataset")}** : ${verdict.dataset === null ? "—" : t(verdict.dataset === "real" ? "datasetReal" : "datasetSynthetic")}`,
  );
  lines.push(`- **${t("rto")}** : ${verdict.rtoMinutes === null ? "—" : `${verdict.rtoMinutes} min`}`);
  lines.push(`- **${t("checklist")}** : ${verdict.passedCount}/${verdict.totalCount}`);
  lines.push(
    `- **${t("integrity")}** : ${verdict.integrityOk ? t("integrityOk") : t("integrityFail")} \`sha256:${hash}\``,
  );
  if (verdict.issues.length > 0) {
    lines.push("");
    lines.push(`## ${t("issues")}`);
    for (const i of verdict.issues) lines.push(`- ${i}`);
  }
  lines.push("");
  return lines.join("\n");
}
