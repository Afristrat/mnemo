// Rendu Markdown du SLA paramétrique — PUR. Traducteur (namespace Results.sla) injecté. Fige la
// disponibilité publiée des fournisseurs de la classe d'hébergement (sourcée, datée) → maillon opposable
// de la chaîne de preuve : Strate ne promet pas, il rapporte et calcule.

import type { ProviderSla, SlaAssessment } from "./compose";

type Translator = (key: string, values?: Record<string, string | number>) => string;

function providerRows(list: ProviderSla[], t: Translator): string[] {
  return list.map((p) => {
    const pct = p.pct === null ? t("notPublished") : `${p.pct} %`;
    const down = p.downtimeMinutes === null ? "—" : t("downtimePerMonth", { minutes: p.downtimeMinutes });
    const mode = t(p.mode === "ha" ? "modeHa" : "modeSingle");
    const conf = t(p.confidence === "high" ? "confHigh" : "confMedium");
    return `| ${p.name} | ${p.service} | ${pct} | ${mode} | ${down} | ${conf} | ${p.sourceUrl} (${p.asOf}) |`;
  });
}

export function renderSlaMarkdown(a: SlaAssessment, t: Translator, hostingClassLabel: string): string {
  const lines: string[] = [];
  lines.push(`# ${t("docTitle")}`);
  lines.push("");
  lines.push(`> ${t("disclaimer")}`);
  lines.push("");
  lines.push(`- **${t("hostingClassLabel")}** : ${hostingClassLabel}`);
  if (a.range !== null) {
    lines.push(`- **${t("publishedRange")}** : ${t("rangeValue", { min: a.range.minPct, max: a.range.maxPct })}`);
  }
  lines.push("");

  if (a.selfHosted) {
    lines.push(`> ${t("selfHostedNote")}`);
    lines.push("");
    lines.push(`## ${t("referenceTitle")}`);
  } else {
    lines.push(`## ${t("providersTitle")}`);
  }
  const list = a.selfHosted ? a.reference : a.providers;
  lines.push(`| ${t("colProvider")} | ${t("colService")} | ${t("colSla")} | ${t("colMode")} | ${t("colDowntime")} | ${t("colConfidence")} | ${t("colSource")} |`);
  lines.push("| --- | --- | --- | --- | --- | --- | --- |");
  for (const row of providerRows(list, t)) lines.push(row);
  lines.push("");

  if (a.coLocatedLayers.length > 0) {
    lines.push(`## ${t("coLocatedTitle")}`);
    lines.push(`> ${t("coLocatedNote")}`);
    lines.push("");
    for (const layer of a.coLocatedLayers) lines.push(`- ${layer}`);
    lines.push("");
  }

  return lines.join("\n");
}
