// Modèle de livrable (F6) : structure pure et neutre de présentation, partagée par
// les rendus Markdown et PDF. Aucune dépendance UI ni I/O → entièrement testable.

import { costBand, type Ensemble, type Profile, type Recommendation } from "@/lib/engine";
import { FIDUCIARY_CHARTER } from "@/lib/fiduciary/charter";
import { LAYER_PRICING } from "@/lib/pricing/sources";
import {
  ACTIVITY_OPTIONS,
  BUDGET_OPTIONS,
  CONTENT_TYPE_OPTIONS,
  GROWTH_OPTIONS,
  LATENCY_OPTIONS,
  REGULATION_OPTIONS,
  REQ_PER_DAY_OPTIONS,
  SENSITIVITY_OPTIONS,
  TECH_LEVEL_OPTIONS,
  VOICES_OPTIONS,
  VOLUME_OPTIONS,
  ZONE_OPTIONS,
  type Option,
} from "@/lib/wizard/options";

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

export const DISCLAIMER =
  "Une IA peut se tromper. Ces coûts sont des projections sourcées (±30 %), pas des engagements. Vérifiez chaque source avant toute décision.";

function labelOf<T extends string>(options: Option<T>[], value: T): string {
  return options.find((o) => o.value === value)?.label ?? value;
}

function labelsOf<T extends string>(options: Option<T>[], values: T[]): string {
  return values.map((v) => labelOf(options, v)).join(", ");
}

function profileSection(p: Profile): DeliverableSection {
  return {
    heading: "Profil",
    bullets: [],
    rows: [
      { left: "Activité", right: labelOf(ACTIVITY_OPTIONS, p.activity) },
      { left: "Zone d'hébergement", right: labelOf(ZONE_OPTIONS, p.zone) },
      { left: "Utilisateurs", right: String(p.users) },
      { left: "Types de contenu", right: labelsOf(CONTENT_TYPE_OPTIONS, p.contentTypes) },
      { left: "Volume de données", right: labelOf(VOLUME_OPTIONS, p.volume) },
      { left: "Croissance", right: labelOf(GROWTH_OPTIONS, p.growth) },
      { left: "Régimes réglementaires", right: labelsOf(REGULATION_OPTIONS, p.regulations) },
      { left: "Sensibilité", right: labelOf(SENSITIVITY_OPTIONS, p.sensitivity) },
      { left: "Audit", right: p.audit ? "Oui" : "Non" },
      { left: "Bitemporel", right: p.bitemporal ? "Oui" : "Non" },
      { left: "Compétences techniques", right: labelOf(TECH_LEVEL_OPTIONS, p.techLevel) },
      { left: "Budget", right: labelOf(BUDGET_OPTIONS, p.budget) },
      { left: "Requêtes / jour", right: labelOf(REQ_PER_DAY_OPTIONS, p.reqPerDay) },
      { left: "Latence", right: labelOf(LATENCY_OPTIONS, p.latency) },
      { left: "Voix / perspectives", right: labelOf(VOICES_OPTIONS, p.voices) },
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

/** Construit le livrable structuré à partir de la recommandation et de l'ensemble. */
export function buildDeliverable(
  profile: Profile,
  reco: Recommendation,
  ensemble: Ensemble,
  now: Date = new Date(),
): Deliverable {
  const band = costBand(reco.totalCost);
  const generatedAt = now.toISOString().slice(0, 10);

  const stack: DeliverableSection = {
    heading: "Stack recommandée (7 couches)",
    bullets: [],
    rows: reco.layers.map((l) => ({
      left: `${l.name}, ${l.choice}`,
      right: l.cost > 0 ? `${l.cost} €/mois` : "inclus",
    })),
  };

  const scores: DeliverableSection = {
    heading: "Scores (9 dimensions)",
    bullets: [],
    rows: reco.scores.map((s) => ({ left: s.label, right: `${s.score}/10` })),
  };

  const costRows: DeliverableRow[] = reco.layers
    .filter((l) => l.cost > 0)
    .map((l) => ({ left: l.name, right: `${l.cost} €` }));
  for (const m of reco.activeModules) {
    costRows.push({ left: `${m.name} (niv. ${m.level}/${m.maxLevel})`, right: `${m.cost} €` });
  }
  costRows.push({ left: "Total estimé", right: `${reco.totalCost} €/mois` });
  costRows.push({ left: "Fourchette ±30 %", right: `${band.low} – ${band.high} €/mois` });

  const ensembleSection: DeliverableSection = {
    heading: "Ensemble de configurations (incertitude)",
    bullets: [ensemble.spread.uncertaintyLabel],
    rows: ensemble.variants.map((v) => ({
      left: `${v.label} (${v.recommendation.preset})`,
      right: `${v.recommendation.totalCost} € · ${v.recommendation.scoreAvg}/10`,
    })),
  };

  const sections: DeliverableSection[] = [
    profileSection(profile),
    { heading: "Pourquoi ce preset", rows: [], bullets: [reco.presetReason] },
    stack,
    scores,
    { heading: "Carte de coûts", rows: costRows, bullets: [] },
    ensembleSection,
    { heading: "Actions de conformité", rows: [], bullets: reco.compliance },
    { heading: "Risques détectés", rows: [], bullets: reco.risks },
    {
      heading: "Charte fiduciaire",
      rows: [],
      bullets: [
        FIDUCIARY_CHARTER.revenueModel,
        ...FIDUCIARY_CHARTER.commitments.map((c) => `${c.title}, ${c.detail}`),
      ],
    },
  ];

  return {
    title: "Strate, Plan d'infrastructure mémorielle",
    subtitle: "Recommandation de configuration souveraine",
    generatedAt,
    meta: [
      { left: "Preset", right: reco.preset },
      { left: "Score moyen", right: `${reco.scoreAvg}/10` },
      { left: "Coût estimé", right: `${reco.totalCost} €/mois (±30 % : ${band.low} – ${band.high} €)` },
      { left: "Accord de l'ensemble", right: ensemble.spread.agreement },
    ],
    sections,
    sources: collectSources(reco),
    disclaimer: DISCLAIMER,
  };
}
