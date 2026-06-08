// Rendu Markdown du MBOM — PUR. Traducteur (namespace Results.mbom) injecté. Le document fige la liste
// d'ingrédients + les checksums + l'empreinte → maillon opposable et vérifiable de la chaîne de preuve.

import type { Mbom } from "./manifest";
import type { MbomSignature } from "./signature";

type Translator = (key: string, values?: Record<string, string | number>) => string;

export function renderMbomMarkdown(mbom: Mbom, t: Translator, signature?: MbomSignature): string {
  const lines: string[] = [];
  lines.push(`# ${t("docTitle")}`);
  lines.push("");
  lines.push(`> ${t("disclaimer")}`);
  lines.push("");
  lines.push(`- **${t("product")}** : ${mbom.product}`);
  lines.push(`- **${t("generatedAt")}** : ${mbom.generatedAt}`);
  lines.push(`- **${t("integrity")}** : \`sha256:${mbom.integrityHash}\``);
  lines.push("");

  lines.push(`## ${t("componentsTitle")}`);
  lines.push(`| ${t("colLayer")} | ${t("colName")} | ${t("colChoice")} | ${t("colProvenance")} | ${t("colSource")} | ${t("colLicence")} |`);
  lines.push("| --- | --- | --- | --- | --- | --- |");
  for (const c of mbom.components) {
    lines.push(
      `| C${c.layer ?? "—"} | ${c.name} | ${c.choice} | ${c.provenance ?? "—"} | ${c.sourceUrl ?? "—"} | ${c.licence ?? t("toConfirm")} |`,
    );
  }
  lines.push("");

  lines.push(`## ${t("checksumsTitle")}`);
  lines.push(`| ${t("colFile")} | sha256 |`);
  lines.push("| --- | --- |");
  for (const f of mbom.files) lines.push(`| ${f.path} | \`${f.sha256}\` |`);
  lines.push("");

  if (signature !== undefined) {
    lines.push(`## ${t("signatureTitle")}`);
    lines.push(`- **${t("sigAlgo")}** : ${signature.algo}`);
    lines.push(`- **${t("sigSignedAt")}** : ${signature.signedAt}`);
    lines.push(`- **${t("sigKey")}** : \`${signature.publicKey}\``);
    lines.push(`- **${t("sigMessage")}** : \`${signature.message}\``);
    lines.push(`- **${t("sigValue")}** : \`${signature.value}\``);
    lines.push("");
    lines.push(`> ${t("sigVerifyHint")}`);
    lines.push("");
  }

  return lines.join("\n");
}
