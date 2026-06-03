// Rendu Markdown du Decision Record — PUR. Le traducteur (namespace `Results.decisionRecord`) est injecté
// par la présentation. Le document est figé dans une langue ; son hash d'intégrité y est inscrit.

import type { DecisionRecord } from "./record";

type Translator = (key: string, values?: Record<string, string | number>) => string;

export function renderDecisionRecordMarkdown(record: DecisionRecord, hash: string, t: Translator): string {
  const d = record.decision;
  const lines: string[] = [];

  lines.push(`# ${t("docTitle")}`);
  lines.push("");
  lines.push(`> ${t("disclaimer")}`);
  lines.push("");
  lines.push(`- **${t("generatedAt")}** : ${record.generatedAt}`);
  lines.push(`- **${t("version")}** : v${record.version}`);
  lines.push(`- **${t("integrity")}** : \`sha256:${hash}\``);
  lines.push("");

  lines.push(`## ${t("decisionTitle")}`);
  lines.push(`- **${t("preset")}** : ${d.preset}`);
  lines.push(`- ${d.reason}`);
  lines.push(`- **${t("monthlyCost")}** : ${t("costValue", { cost: d.monthlyCost, low: d.costLow, high: d.costHigh })}`);
  lines.push(`- **${t("setup")}** : ${d.setupCost} €`);
  lines.push(`- **${t("scoreAvg")}** : ${d.scoreAvg}/10`);
  lines.push("");

  lines.push(`## ${t("scoresTitle")}`);
  lines.push(`| ${t("dimension")} | ${t("scoreCol")} |`);
  lines.push("| --- | --- |");
  for (const s of record.scores) lines.push(`| ${s.label} | ${s.value}/10 |`);
  lines.push("");

  lines.push(`## ${t("alternativesTitle")}`);
  lines.push(t("alternativesIntro"));
  for (const a of record.alternatives) {
    lines.push("");
    lines.push(`### ${a.label} — ${a.preset}, ${a.monthlyCost} €/mois, ${a.scoreAvg}/10`);
    lines.push(a.intent);
    for (const h of a.assumptions) lines.push(`- ${h}`);
  }
  lines.push("");

  lines.push(`## ${t("tensionsTitle")}`);
  lines.push(`- **${t("agreement")}** : ${t("agreementValue", { agreement: record.tensions.agreement })}`);
  lines.push(`- **${t("costSpread")}** : ${record.tensions.costSpreadPct} %`);
  if (record.tensions.risks.length > 0) {
    lines.push(`- **${t("risks")}** :`);
    for (const r of record.tensions.risks) lines.push(`  - ${r}`);
  }
  if (record.tensions.residencyConflict !== null) {
    lines.push(`- **${t("residencyConflict")}** : ${record.tensions.residencyConflict}`);
  }
  lines.push("");

  if (record.sources.length > 0) {
    lines.push(`## ${t("sourcesTitle")}`);
    for (const src of record.sources) lines.push(`- ${src.label} — ${src.url} (${src.date})`);
    lines.push("");
  }

  lines.push(`## ${t("replayTitle")}`);
  lines.push(t("replayIntro"));
  lines.push("");
  lines.push("```");
  lines.push(record.profileEncoded);
  lines.push("```");
  lines.push("");

  return lines.join("\n");
}
