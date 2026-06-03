// Veille vendor planifiée (F13, S-084) — orchestration SERVEUR.
//
// `runVendorWatch` : un cycle de veille = prix live (S-025, cache) → variations vs baseline datée →
// alertes sourcées → persistance d'audit (dédup). Ne lève jamais. Réutilisé par la route cron
// (déclenchement manuel/externe) ET par le scheduler intégré.
// `startVendorWatchScheduler` : arme un cycle périodique DANS le process serveur (cf. instrumentation.ts).
// Souverain : aucune dépendance à un cron externe ni à un binaire du conteneur (curl/wget) — c'est du
// Node, toujours présent. Multi-instance éventuelle absorbée par le dédup d'audit (pas de doublon).

import "server-only";
import { getLivePricesCached, type LivePriceItem } from "@/lib/pricing/live-feed";
import { priceChangesFromLiveItems } from "@/lib/pricing/price-watch";
import { buildVendorAlerts, type VendorAlert } from "@/lib/network/alerts";
import { persistVendorAlerts } from "@/lib/network/vendor-alerts-persist";

export type VendorWatchResult = { detected: number; persisted: number };

type RunDeps = {
  /** Source des postes observés (défaut = veille prix live). Injectable pour les tests. */
  items?: () => Promise<readonly LivePriceItem[]>;
  /** Persistance des alertes (défaut = audit RLS service-role). Injectable pour les tests. */
  persist?: (alerts: readonly VendorAlert[]) => Promise<number>;
};

export async function runVendorWatch(deps: RunDeps = {}): Promise<VendorWatchResult> {
  try {
    const items = deps.items
      ? await deps.items()
      : (await getLivePricesCached({ apiKey: process.env.FIRECRAWL_API_KEY })).items;
    const changes = priceChangesFromLiveItems(items);
    const alerts = buildVendorAlerts(changes);
    const persisted = await (deps.persist ?? persistVendorAlerts)(alerts);
    return { detected: alerts.length, persisted };
  } catch {
    return { detected: 0, persisted: 0 };
  }
}

const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
const INITIAL_DELAY_MS = 60 * 1000; // laisse le serveur finir son boot avant le 1er scrape
let schedulerStarted = false;

/**
 * Démarre la veille vendor périodique (idempotent : ne s'arme qu'une fois). 1er passage différé,
 * puis toutes les 6 h (aligné sur le TTL du cache feed). À appeler depuis l'instrumentation serveur.
 */
export function startVendorWatchScheduler(): void {
  if (schedulerStarted) return;
  schedulerStarted = true;
  setTimeout(() => {
    void runVendorWatch();
    setInterval(() => void runVendorWatch(), SIX_HOURS_MS);
  }, INITIAL_DELAY_MS);
}
