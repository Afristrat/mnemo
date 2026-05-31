import type { ComputeSizing } from "./compute";
import type { LlmUsage } from "./llm-usage";
import type { MultimodalPriceTable } from "./sizing";
import type { BackupPlan, Layer, Profile, ReqPerDay, ResidencyPlan, Sizing, Volume } from "./types";

const VOLUME_FACTOR: Record<Volume, number> = {
  lt1: 0,
  "1to10": 5,
  "10to100": 20,
  "100to1000": 60,
  gt1000: 200,
};

const REQ_FACTOR: Record<ReqPerDay, number> = {
  lt100: 0,
  lt1k: 10,
  lt10k: 50,
  gt10k: 250,
};

/** Coût mensuel cumulé des couches de la stack (€/mois). */
export function layersBaseCost(layers: Layer[]): number {
  return layers.reduce((sum, layer) => sum + layer.cost, 0);
}

/** Surcoût lié au volume, au débit de requêtes et au nombre d'utilisateurs (€/mois). */
export function profileCostFactors(p: Profile): number {
  const volume = VOLUME_FACTOR[p.volume];
  const req = REQ_FACTOR[p.reqPerDay];
  const users = p.users > 10 ? Math.round((p.users - 10) * 1.5) : 0;
  return volume + req + users;
}

/** Fourchette basse/haute autour d'un coût (disclaimer ±30 % assumé). */
export function costBand(total: number, spread = 0.3): { low: number; high: number } {
  return {
    low: Math.round(total * (1 - spread)),
    high: Math.round(total * (1 + spread)),
  };
}

/**
 * Injecte les coûts multimédias **dans** les couches (jamais en ligne séparée, spec §5) : pure,
 * renvoie de nouvelles couches.
 * - C4 (Embeddings) ← forfait embeddings multimodaux si requis.
 * - C5 (Stockage) ← Go indexés × €/Go/mois.
 * - C6 (Infra/inférence) ← pool GPU souverain (compté UNE FOIS) + coût à l'usage des charges API.
 * Les prix doivent être normalisés en € (cf. `normalizeMediaPricesToEur`).
 */
export function applyMultimodalSizing(layers: Layer[], sizing: Sizing, prices: MultimodalPriceTable): Layer[] {
  const embeddings = sizing.embeddingsMultimodal ? Math.round(prices.multimodalEmbeddings.amount) : 0;
  const storage = Math.round(sizing.storageGb * prices.storagePerGbMonth.amount);
  const apiUsage = sizing.workloads.reduce((sum, w) => sum + w.monthlyCost, 0);
  const compute = sizing.gpu.monthlyCost + apiUsage;

  return layers.map((layer) => {
    if (layer.id === 4 && embeddings > 0) {
      return { ...layer, cost: layer.cost + embeddings, note: `${layer.note} · +${embeddings} €/mois embeddings multimodaux` };
    }
    if (layer.id === 5 && storage > 0) {
      return { ...layer, cost: layer.cost + storage, note: `${layer.note} · +${storage} €/mois (${sizing.storageGb} Go médias)` };
    }
    if (layer.id === 6 && compute > 0) {
      const detail = sizing.gpu.tier === "none" ? `${apiUsage} €/mois API` : `GPU ${sizing.gpu.tier} ${sizing.gpu.monthlyCost} €/mois + ${apiUsage} €/mois API`;
      return { ...layer, cost: layer.cost + compute, note: `${layer.note} · +${compute} €/mois (${detail})` };
    }
    return layer;
  });
}

/**
 * Remplace le **forfait C6 hardcodé** (30/100/400, jadis serveurs + LLM mélangés) par le compute
 * souverain **dimensionné + sourcé** (S-041). Pure. `compute.monthlyCost <= 0` (table neutre) →
 * couches inchangées (le forfait historique est conservé, invariant des tests préservé). Le LLM à
 * l'usage n'est PAS inclus ici (estimation séparée, dette transparente notée S-033).
 */
export function applyCompute(layers: Layer[], compute: ComputeSizing): Layer[] {
  if (compute.monthlyCost <= 0) return layers;
  const detail = compute.instances.map((i) => `${i.count}×${i.spec.name}`).join(", ");
  return layers.map((layer) =>
    layer.id === 6
      ? {
          ...layer,
          cost: compute.monthlyCost,
          note: `Serveurs souverains dimensionnés : ${compute.monthlyCost} €/mois (${detail})`,
        }
      : layer,
  );
}

/**
 * Injecte le coût d'inférence LLM À L'USAGE (S-074, tarifé au 1M tokens) dans la couche C6. Pure.
 * `monthlyCost <= 0` (auto-hébergé : déjà compté dans le compute/GPU ; ou prix neutres) → couches
 * inchangées (invariant `totalCost` préservé). Le détail (modèle, volume, source) est affiché à part.
 */
export function applyLlmUsage(layers: Layer[], usage: LlmUsage): Layer[] {
  if (usage.monthlyCost <= 0) return layers;
  return layers.map((layer) => (layer.id === 6 ? { ...layer, cost: layer.cost + usage.monthlyCost } : layer));
}

/**
 * Injecte le coût récurrent de sauvegarde **dans** la couche C6 (dont le périmètre inclut le backup),
 * jamais en ligne séparée hors-total. Pure. `criticality "none"` (ou coût 0) → couches inchangées
 * (invariant `totalCost = baseCost + moduleCost` préservé). Le coût one-time va dans `setupCost`.
 */
export function applyBackup(layers: Layer[], backup: BackupPlan): Layer[] {
  const monthly = Math.round(backup.monthlyCost);
  if (monthly <= 0) return layers;
  return layers.map((layer) =>
    layer.id === 6
      ? {
          ...layer,
          cost: layer.cost + monthly,
          note: `${layer.note} · +${monthly} €/mois sauvegarde (criticité ${backup.criticality}, ${backup.copies} copies${backup.offsite ? ", hors-site" : ""})`,
        }
      : layer,
  );
}

/**
 * Injecte le coût récurrent de résidence/DR (réplication inter-région + régions en attente) **dans**
 * la couche C6 (infra), spec n°2 §6. Pure. `drTier none` + mono-région (ou prix neutres) → coût 0 →
 * couches inchangées (invariant `totalCost = baseCost + moduleCost` préservé). Le one-time va dans `setupCost`.
 */
export function applyResidency(layers: Layer[], residency: ResidencyPlan): Layer[] {
  const monthly = Math.round(residency.monthlyCost);
  if (monthly <= 0) return layers;
  const replicas = residency.regions.filter((r) => r.role !== "primary").length;
  const drLabel = residency.activeActive ? "actif-actif" : residency.drTier;
  return layers.map((layer) =>
    layer.id === 6
      ? {
          ...layer,
          cost: layer.cost + monthly,
          note: `${layer.note} · +${monthly} €/mois résidence/DR (${drLabel}, ${replicas} région${replicas > 1 ? "s" : ""} en attente)`,
        }
      : layer,
  );
}
