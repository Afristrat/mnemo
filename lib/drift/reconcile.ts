// Drift Monitor (moat « chaîne de preuve », vague 2 #7) — PUR. L'infra déployée est-elle TOUJOURS la reco
// signée ? DÉFCON 1 : Strate n'a PAS accès à l'infra vivante → elle compare deux artefacts DÉCLARÉS — le
// manifeste Exit Escrow (reco signée) vs l'état vivant RAPPORTÉ par le client (`live-state.json` qu'il
// produit). Réconciliation par couche + contrôle iso-contraintes (région hors ensemble signé). Total, ne
// lève jamais ; l'entrée live (inconnue) est bornée par garde de type, jamais de `as` brut.

import type { BundleManifest } from "@/lib/exit/bundle";

export type DriftStatus = "aligned" | "drifted" | "missing" | "unexpected";

export type DriftItem = {
  id: number;
  label: string;
  /** Choix signé (manifeste) ; null si la couche n'existe que dans le live (unexpected). */
  expected: string | null;
  /** Choix vivant rapporté ; null si la couche signée est absente du live (missing). */
  actual: string | null;
  status: DriftStatus;
};

export type DriftReport = {
  generatedAt: string;
  items: DriftItem[];
  alignedCount: number;
  /** drifted + missing + unexpected. */
  driftCount: number;
  constraintViolations: string[];
  /** Aucun écart ET aucune violation. */
  inSync: boolean;
  disclaimer: string;
};

const DISCLAIMER =
  "Réconciliation de deux artefacts déclarés (reco signée vs état vivant rapporté) — Strate ne lit pas votre infra. Une IA peut se tromper : vérifiez l'état rapporté.";

type LiveLayer = { id: number; choice: string };
type LiveState = { layers: LiveLayer[]; regions: string[] };

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Borne un `live-state` inconnu (anti-injection). Champs absents → vides ; jamais de throw. */
function parseLiveState(raw: unknown): LiveState {
  if (!isRecord(raw)) return { layers: [], regions: [] };
  const layers: LiveLayer[] = [];
  if (Array.isArray(raw.layers)) {
    for (const l of raw.layers) {
      if (isRecord(l) && typeof l.id === "number" && Number.isFinite(l.id) && typeof l.choice === "string") {
        layers.push({ id: l.id, choice: l.choice });
      }
    }
  }
  const regions: string[] = Array.isArray(raw.regions)
    ? raw.regions.filter((r): r is string => typeof r === "string" && r.trim() !== "")
    : [];
  return { layers, regions };
}

/** Régions de l'ensemble signé (primaire + réplicas du plan de résidence). */
function signedRegions(manifest: BundleManifest): Set<string> {
  const set = new Set<string>([manifest.residency.primaryRegion]);
  for (const r of manifest.residency.regions) set.add(r.region);
  return set;
}

/** Réconcilie la reco signée (manifeste) vs l'état vivant rapporté. Pur ; `generatedAt` injecté. */
export function reconcileDrift(manifest: BundleManifest, liveStateRaw: unknown, generatedAt: string): DriftReport {
  const live = parseLiveState(liveStateRaw);
  const liveById = new Map<number, string>(live.layers.map((l) => [l.id, l.choice]));
  const items: DriftItem[] = [];

  // Couches signées → comparées au live.
  for (const layer of manifest.layers) {
    const actual = liveById.get(layer.id);
    if (actual === undefined) {
      items.push({ id: layer.id, label: layer.name, expected: layer.choice, actual: null, status: "missing" });
    } else if (actual === layer.choice) {
      items.push({ id: layer.id, label: layer.name, expected: layer.choice, actual, status: "aligned" });
    } else {
      items.push({ id: layer.id, label: layer.name, expected: layer.choice, actual, status: "drifted" });
    }
  }

  // Couches vivantes absentes du manifeste → inattendues.
  const signedIds = new Set(manifest.layers.map((l) => l.id));
  for (const l of live.layers) {
    if (!signedIds.has(l.id)) {
      items.push({ id: l.id, label: `C${l.id}`, expected: null, actual: l.choice, status: "unexpected" });
    }
  }

  // Iso-contraintes : toute région vivante hors de l'ensemble signé = violation.
  const allowed = signedRegions(manifest);
  const constraintViolations: string[] = [];
  for (const region of live.regions) {
    if (!allowed.has(region)) {
      constraintViolations.push(`Région « ${region} » hors de l'ensemble signé (${[...allowed].join(", ")}).`);
    }
  }

  const alignedCount = items.filter((i) => i.status === "aligned").length;
  const driftCount = items.filter((i) => i.status !== "aligned").length;
  return {
    generatedAt,
    items,
    alignedCount,
    driftCount,
    constraintViolations,
    inSync: driftCount === 0 && constraintViolations.length === 0,
    disclaimer: DISCLAIMER,
  };
}
