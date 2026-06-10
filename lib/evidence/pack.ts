// Evidence pack de la preuve sourcée — fige une liste de SourcedEvidence en MD + JSON + empreinte SHA-256
// → maillon opposable de la chaîne de preuve. Réutilise sha256Hex/canonicalJson (lib/decision/integrity).
// Calque lib/drift/evidence.ts. Pur (le hash via Web Crypto isomorphe).

import { canonicalJson, sha256Hex } from "@/lib/decision/integrity";
import type { EvidenceVerdict, SourcedEvidence } from "./types";

const VERDICT_LABEL: Record<EvidenceVerdict, string> = {
  attested: "✅ attesté",
  unattested: "◻️ non attesté",
  stable: "✅ stable",
  changed: "⚠️ changement",
  unknown: "❔ inconnu",
  match: "✅ cohérent",
  mismatch: "⚠️ incohérent",
  unverifiable: "◻️ invérifiable",
};

export type EvidencePack = { json: string; markdown: string; integrityHash: string };

export async function buildEvidencePack(items: SourcedEvidence[], title: string): Promise<EvidencePack> {
  const payload = { title, items, count: items.length };
  const integrityHash = await sha256Hex(canonicalJson(payload));

  const lines: string[] = [];
  lines.push(`# ${title}`);
  lines.push("");
  lines.push(
    "> Preuve sourcée (SearXNG + LLM) — confiance live « faible » par prudence, repli daté sinon. Une IA peut se tromper : vérifiez les sources citées.",
  );
  lines.push("");
  lines.push(`- **Éléments** : ${items.length}`);
  lines.push(`- **Intégrité** : \`sha256:${integrityHash}\``);
  lines.push("");
  for (const ev of items) {
    lines.push(`## ${ev.claim.subject}`);
    lines.push(
      `- **Verdict** : ${VERDICT_LABEL[ev.verdict]} · **confiance** : ${ev.confidence} · **provenance** : ${ev.provenance}`,
    );
    if (ev.rationale.length > 0) lines.push(`- ${ev.rationale}`);
    if (ev.sources.length > 0) {
      lines.push("- **Sources** :");
      for (const s of ev.sources) lines.push(`  - [${s.title || s.url}](${s.url}) — relevé ${s.retrievedAt}`);
    } else {
      lines.push("- _Aucune source publique au relevé._");
    }
    lines.push("");
  }

  return {
    json: JSON.stringify({ ...payload, integrityHash }, null, 2) + "\n",
    markdown: lines.join("\n"),
    integrityHash,
  };
}
