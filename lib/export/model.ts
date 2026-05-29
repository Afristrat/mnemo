// Modèle de livrable (F6) : structure pure et neutre de présentation, partagée par
// les rendus Markdown et PDF. Aucune dépendance UI ni I/O → entièrement testable.

import { costBand, type EngineResolver, type Ensemble, type Profile, type Recommendation } from "@/lib/engine";
import type { Catalog, Provenance, SlotId } from "@/lib/catalog";
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

const SLOT_ORDER: SlotId[] = ["c0", "c1", "c2", "c3", "c4", "c5", "c6"];

const PROVENANCE_LABEL: Record<Provenance, string> = {
  live: "vérifié en direct",
  seed: "calibration datée",
  flagged: "à revérifier (repli)",
};

/**
 * Fige le catalogue retenu (S-037) : un candidat par couche, sa provenance (live/seed/flagged), sa
 * confiance et sa source. Rend le livrable rejouable — on sait exactement quels composants ont été
 * recommandés, d'où vient l'information, et à quelle date le catalogue a été assemblé.
 */
function catalogSection(catalog: Catalog): DeliverableSection {
  return {
    heading: "Catalogue retenu (provenance des choix)",
    bullets: [
      `Catalogue assemblé le ${catalog.assembledAt} (origine : ${catalog.source}). ` +
        "Chaque composant porte sa provenance et sa source : le plan est rejouable à l'identique.",
    ],
    rows: SLOT_ORDER.map((slot) => {
      const rec = catalog.slots[slot].recommended;
      return {
        left: `${slot.toUpperCase()} · ${rec.name}`,
        right: `${PROVENANCE_LABEL[rec.provenance]} · confiance ${rec.confidence}`,
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
 * `resolve` (S-058) résout les descripteurs `Message` du moteur (scores, et progressivement les
 * autres champs) en chaîne localisée. La localisation des EN-TÊTES propres au livrable et du
 * disclaimer relève de S-059 (ils restent en français ici).
 */
export function buildDeliverable(
  profile: Profile,
  reco: Recommendation,
  ensemble: Ensemble,
  resolve: EngineResolver,
  now: Date = new Date(),
  catalog?: Catalog,
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
    heading: "Scores (10 dimensions)",
    bullets: [],
    rows: reco.scores.map((s) => ({ left: resolve(s.label), right: `${s.score}/10` })),
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
    ...(catalog !== undefined ? [catalogSection(catalog)] : []),
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
    sources: dedupeSources([
      ...collectSources(reco),
      ...(catalog !== undefined ? catalogSources(catalog) : []),
    ]),
    disclaimer: DISCLAIMER,
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
