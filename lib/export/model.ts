// Modèle de livrable (F6) : structure pure et neutre de présentation, partagée par
// les rendus Markdown et PDF. Aucune dépendance UI ni I/O → entièrement testable.

import { costBand, formatPresetReason, type EngineResolver, type Ensemble, type Profile, type Recommendation } from "@/lib/engine";
import type { Catalog, SlotId } from "@/lib/catalog";
import { FIDUCIARY_COMMITMENT_KEYS } from "@/lib/fiduciary/charter";
import { LAYER_PRICING } from "@/lib/pricing/sources";
import {
  ACTIVITY_OPTIONS,
  BUDGET_OPTIONS,
  CONTENT_TYPE_OPTIONS,
  GROWTH_OPTIONS,
  LATENCY_OPTIONS,
  optionLabelKey,
  REGULATION_OPTIONS,
  REQ_PER_DAY_OPTIONS,
  SENSITIVITY_OPTIONS,
  TECH_LEVEL_OPTIONS,
  VOICES_OPTIONS,
  VOLUME_OPTIONS,
  ZONE_OPTIONS,
  type OptionDef,
} from "@/lib/wizard/options";

/** Résout la clé de libellé d'une option (namespace `Options`) — injecté (UI) ou stub (tests). */
export type OptionLabel = (key: string) => string;

/** Traducteur du chrome propre au livrable (namespace `Deliverable`, S-059) — injecté (UI) ou stub. */
export type DeliverableLabel = (key: string, values?: Record<string, string | number>) => string;

export type DeliverableRow = { left: string; right: string };
export type DeliverableSection = { heading: string; rows: DeliverableRow[]; bullets: string[] };
export type DeliverableSource = { label: string; url: string; checkedAt: string };

export type Deliverable = {
  title: string;
  subtitle: string;
  generatedAt: string; // YYYY-MM-DD
  meta: DeliverableRow[];
  sections: DeliverableSection[];
  sources: DeliverableSource[];
  disclaimer: string;
};

function labelOf<T extends string>(defs: OptionDef<T>[], value: T, optionLabel: OptionLabel): string {
  return optionLabel(optionLabelKey(defs, value));
}

function labelsOf<T extends string>(defs: OptionDef<T>[], values: T[], optionLabel: OptionLabel): string {
  return values.map((v) => labelOf(defs, v, optionLabel)).join(", ");
}

function profileSection(p: Profile, optionLabel: OptionLabel, t: DeliverableLabel): DeliverableSection {
  const yesNo = (v: boolean): string => t(v ? "yes" : "no");
  return {
    heading: t("section.profile"),
    bullets: [],
    rows: [
      { left: t("profile.activity"), right: labelOf(ACTIVITY_OPTIONS, p.activity, optionLabel) },
      { left: t("profile.zone"), right: labelOf(ZONE_OPTIONS, p.zone, optionLabel) },
      { left: t("profile.users"), right: String(p.users) },
      { left: t("profile.contentTypes"), right: labelsOf(CONTENT_TYPE_OPTIONS, p.contentTypes, optionLabel) },
      { left: t("profile.volume"), right: labelOf(VOLUME_OPTIONS, p.volume, optionLabel) },
      { left: t("profile.growth"), right: labelOf(GROWTH_OPTIONS, p.growth, optionLabel) },
      { left: t("profile.regulations"), right: labelsOf(REGULATION_OPTIONS, p.regulations, optionLabel) },
      { left: t("profile.sensitivity"), right: labelOf(SENSITIVITY_OPTIONS, p.sensitivity, optionLabel) },
      { left: t("profile.audit"), right: yesNo(p.audit) },
      { left: t("profile.bitemporal"), right: yesNo(p.bitemporal) },
      { left: t("profile.techLevel"), right: labelOf(TECH_LEVEL_OPTIONS, p.techLevel, optionLabel) },
      { left: t("profile.budget"), right: labelOf(BUDGET_OPTIONS, p.budget, optionLabel) },
      { left: t("profile.reqPerDay"), right: labelOf(REQ_PER_DAY_OPTIONS, p.reqPerDay, optionLabel) },
      { left: t("profile.latency"), right: labelOf(LATENCY_OPTIONS, p.latency, optionLabel) },
      { left: t("profile.voices"), right: labelOf(VOICES_OPTIONS, p.voices, optionLabel) },
    ],
  };
}

function collectSources(reco: Recommendation): DeliverableSource[] {
  const out: DeliverableSource[] = [];
  const seen = new Set<string>();
  for (const layer of reco.layers) {
    const pricing = LAYER_PRICING[layer.id];
    if (pricing?.source == null) continue;
    if (seen.has(pricing.source.url)) continue;
    seen.add(pricing.source.url);
    out.push({ ...pricing.source });
  }
  return out;
}

const SLOT_ORDER: SlotId[] = ["c0", "c1", "c2", "c3", "c4", "c5", "c6"];

/**
 * Fige le catalogue retenu (S-037) : un candidat par couche, sa provenance (live/seed/flagged), sa
 * confiance et sa source. Rend le livrable rejouable — on sait exactement quels composants ont été
 * recommandés, d'où vient l'information, et à quelle date le catalogue a été assemblé.
 */
function catalogSection(catalog: Catalog, t: DeliverableLabel): DeliverableSection {
  return {
    heading: t("section.catalog"),
    bullets: [t("catalog.assembled", { date: catalog.assembledAt, origin: catalog.source })],
    rows: SLOT_ORDER.map((slot) => {
      const rec = catalog.slots[slot].recommended;
      return {
        left: `${slot.toUpperCase()} · ${rec.name}`,
        right: t("catalog.provenanceConfidence", { provenance: t(`provenance.${rec.provenance}`), confidence: rec.confidence }),
      };
    }),
  };
}

/** Sources web du catalogue retenu (candidat recommandé de chaque couche), dédupliquées par URL. */
function catalogSources(catalog: Catalog): DeliverableSource[] {
  const out: DeliverableSource[] = [];
  const seen = new Set<string>();
  for (const slot of SLOT_ORDER) {
    const src = catalog.slots[slot].recommended.source;
    if (seen.has(src.url)) continue;
    seen.add(src.url);
    out.push({ label: src.label, url: src.url, checkedAt: src.checkedAt });
  }
  return out;
}

/**
 * Construit le livrable structuré à partir de la recommandation et de l'ensemble.
 * `catalog` (optionnel) fige les choix de composants retenus + leur provenance (S-037, rejouable).
 * `resolve` (S-058) résout les descripteurs `Message` du moteur en chaîne localisée. `deliverableText`
 * (S-059) localise le chrome PROPRE au livrable (titres de sections, libellés de profil/méta, disclaimer)
 * via le namespace `Deliverable`. Les noms de composants/choix (données catalogue) restent bruts.
 */
export function buildDeliverable(
  profile: Profile,
  reco: Recommendation,
  ensemble: Ensemble,
  resolve: EngineResolver,
  optionLabel: OptionLabel,
  deliverableText: DeliverableLabel,
  fiduciaryText: DeliverableLabel,
  now: Date = new Date(),
  catalog?: Catalog,
): Deliverable {
  const t = deliverableText;
  const fid = fiduciaryText;
  const band = costBand(reco.totalCost);
  const generatedAt = now.toISOString().slice(0, 10);
  const perMonth = (cost: number): string => (cost > 0 ? t("perMonth", { cost }) : t("included"));

  const stack: DeliverableSection = {
    heading: t("section.stack"),
    bullets: [],
    rows: reco.layers.map((l) => ({
      left: `${resolve(l.name)}, ${l.choice}`,
      right: perMonth(l.cost),
    })),
  };

  const scores: DeliverableSection = {
    heading: t("section.scores"),
    bullets: [],
    rows: reco.scores.map((s) => ({ left: resolve(s.label), right: `${s.score}/10` })),
  };

  const costRows: DeliverableRow[] = reco.layers
    .filter((l) => l.cost > 0)
    .map((l) => ({ left: resolve(l.name), right: t("euro", { amount: l.cost }) }));
  for (const m of reco.activeModules) {
    costRows.push({ left: t("moduleLevel", { name: resolve(m.name), level: m.level, max: m.maxLevel }), right: t("euro", { amount: m.cost }) });
  }
  costRows.push({ left: t("totalEstimate"), right: t("perMonth", { cost: reco.totalCost }) });
  costRows.push({ left: t("band"), right: t("bandValue", { low: band.low, high: band.high }) });

  const ensembleSection: DeliverableSection = {
    heading: t("section.ensemble"),
    bullets: [resolve(ensemble.spread.uncertaintyLabel)],
    rows: ensemble.variants.map((v) => ({
      left: `${resolve(v.label)} (${v.recommendation.preset})`,
      right: `${v.recommendation.totalCost} € · ${v.recommendation.scoreAvg}/10`,
    })),
  };

  const sections: DeliverableSection[] = [
    profileSection(profile, optionLabel, t),
    { heading: t("section.presetReason"), rows: [], bullets: [formatPresetReason(reco.presetReason, resolve)] },
    stack,
    ...(catalog !== undefined ? [catalogSection(catalog, t)] : []),
    scores,
    { heading: t("section.costMap"), rows: costRows, bullets: [] },
    ensembleSection,
    { heading: t("section.compliance"), rows: [], bullets: reco.compliance.map(resolve) },
    { heading: t("section.risks"), rows: [], bullets: reco.risks.map(resolve) },
    {
      heading: t("section.fiduciary"),
      rows: [],
      bullets: [
        fid("revenueModel"),
        ...FIDUCIARY_COMMITMENT_KEYS.map((k) => `${fid(`commitment.${k}.title`)}, ${fid(`commitment.${k}.detail`)}`),
      ],
    },
  ];

  return {
    title: t("title"),
    subtitle: t("subtitle"),
    generatedAt,
    meta: [
      { left: t("meta.preset"), right: reco.preset },
      { left: t("meta.scoreAvg"), right: `${reco.scoreAvg}/10` },
      { left: t("meta.cost"), right: t("meta.costValue", { cost: reco.totalCost, low: band.low, high: band.high }) },
      { left: t("meta.agreement"), right: t("meta.agreementValue", { agreement: ensemble.spread.agreement }) },
    ],
    sections,
    sources: dedupeSources([
      ...collectSources(reco),
      ...(catalog !== undefined ? catalogSources(catalog) : []),
    ]),
    disclaimer: t("disclaimer"),
  };
}

/** Dédoublonne des sources par URL (préserve l'ordre d'apparition). */
function dedupeSources(sources: DeliverableSource[]): DeliverableSource[] {
  const seen = new Set<string>();
  const out: DeliverableSource[] = [];
  for (const s of sources) {
    if (seen.has(s.url)) continue;
    seen.add(s.url);
    out.push(s);
  }
  return out;
}
