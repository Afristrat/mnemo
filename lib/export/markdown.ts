// Rendu Markdown du livrable (F6). Pur : Deliverable → chaîne markdown.
// Les sources sont des liens cliquables ; le disclaimer est toujours présent.

import type { Deliverable } from "./model";

export function renderMarkdown(d: Deliverable): string {
  const lines: string[] = [`# ${d.title}`, "", `_${d.subtitle}_`, "", `**Généré le ${d.generatedAt}**`, ""];

  for (const m of d.meta) lines.push(`- **${m.left}** : ${m.right}`);
  lines.push("");

  for (const section of d.sections) {
    lines.push(`## ${section.heading}`, "");
    for (const row of section.rows) lines.push(`- **${row.left}** : ${row.right}`);
    for (const bullet of section.bullets) lines.push(`- ${bullet}`);
    lines.push("");
  }

  if (d.sources.length > 0) {
    lines.push("## Sources", "");
    for (const src of d.sources) {
      lines.push(`- [${src.label}](${src.url}) — vérifié le ${src.checkedAt}`);
    }
    lines.push("");
  }

  lines.push("---", "", `> ${d.disclaimer}`, "");
  return lines.join("\n");
}
