// Capture les empreintes de référence du price feed via le VRAI extracteur, pour
// garantir leur cohérence avec le runtime (jamais de saisie manuelle).
//
//   node --experimental-strip-types scripts/capture-baseline.mts
//
// Prérequis : FIRECRAWL_API_KEY dans l'environnement (charger .env.local au préalable).
// Sortie : un bloc PRICE_BASELINE à recopier dans lib/pricing/baseline.ts.

import { extractMoneyTokens, figuresFingerprint } from "../lib/pricing/extract.ts";
import { scrapePricingMarkdown } from "../lib/pricing/firecrawl.ts";
import { LAYER_PRICING } from "../lib/pricing/sources.ts";

const apiKey = process.env.FIRECRAWL_API_KEY;
const today = new Date().toISOString().slice(0, 10);

const sources: { layerId: number; label: string; url: string }[] = [];
for (const [key, pricing] of Object.entries(LAYER_PRICING)) {
  if (pricing.source === null) continue;
  sources.push({ layerId: Number(key), label: pricing.source.label, url: pricing.source.url });
}
sources.sort((a, b) => a.layerId - b.layerId);

const lines: string[] = [];
for (const source of sources) {
  const markdown = await scrapePricingMarkdown(source.url, { apiKey, timeoutMs: 90_000 });
  if (markdown === null) {
    lines.push(`  ${source.layerId}: { fingerprint: null, capturedAt: "${today}" }, // ${source.label} — INDISPO`);
    continue;
  }
  const figures = extractMoneyTokens(markdown);
  const fingerprint = figures.length === 0 ? null : figuresFingerprint(figures);
  const value = fingerprint === null ? "null" : `"${fingerprint}"`;
  lines.push(
    `  ${source.layerId}: { fingerprint: ${value}, capturedAt: "${today}" }, // ${source.label} — ${figures.length} figures`,
  );
}

process.stdout.write(`export const PRICE_BASELINE: Record<number, PriceBaseline> = {\n${lines.join("\n")}\n};\n`);
