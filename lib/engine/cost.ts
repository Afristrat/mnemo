import type { Layer, Profile, ReqPerDay, Volume } from "./types";

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
