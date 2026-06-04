// Preuve de résidence continue (moat « chaîne de preuve », vague 2 #3) — PUR. Énumère les composants à
// EMPREINTE GÉOGRAPHIQUE CONNUE et drapeau ceux qui sortent de la zone primaire. DÉFCON 1 : on ne fabrique
// JAMAIS la juridiction d'un composant. Les couches auto-hébergées résident en région primaire par
// construction (in-zone) ; les réplicas DR ont une région connue (base légale via lib/legal/transfers,
// déjà calculée par le moteur) ; le backup hors-site et la supervision n'ont pas de région pinnée →
// `unverified` (« à confirmer »), jamais inventés. C'est exactement le job : surfacer ce qui PEUT sortir
// de zone, base légale datée à l'appui, en un relevé opposable.

import type { Message } from "@/lib/engine/message";
import { msg } from "@/lib/engine/message";
import type { Recommendation } from "@/lib/engine";
import type { TransferRegion } from "@/lib/legal/transfers";

export type ContinuityFlag = "in-zone" | "restricted" | "out-of-zone" | "unverified";

export type ResidencyComponent = {
  id: string;
  label: Message;
  /** Région effective si CONNUE, sinon null (jamais fabriquée). */
  region: TransferRegion | null;
  flag: ContinuityFlag;
  /** Base légale datée si flux inter-juridiction (issue de lib/legal). */
  legalBasis?: string;
};

export type ResidencyContinuityReport = {
  generatedAt: string;
  primaryRegion: TransferRegion;
  components: ResidencyComponent[];
  /** Composants en flux restreint ou interdit (sortie de zone avérée). */
  outOfZoneCount: number;
  /** Composants sans région pinnée à confirmer (backup hors-site, supervision). */
  unverifiedCount: number;
  disclaimer: string;
};

const DISCLAIMER =
  "Orientation d'ingénierie, PAS un avis juridique — faites valider chaque base légale par votre conseil.";

function statusToFlag(status: "ok" | "restricted" | "forbidden"): ContinuityFlag {
  return status === "ok" ? "in-zone" : status === "restricted" ? "restricted" : "out-of-zone";
}

/** Audit de continuité de résidence à partir de la reco. Pur ; `generatedAt` injecté. */
export function auditResidencyContinuity(reco: Recommendation, generatedAt: string): ResidencyContinuityReport {
  const r = reco.residency;
  const components: ResidencyComponent[] = [];

  // 1. Données primaires + couches auto-hébergeables : en région primaire par construction.
  components.push({
    id: "data-primary",
    label: msg("residencyContinuity.dataPrimary"),
    region: r.primaryRegion,
    flag: "in-zone",
  });

  // 2. Réplicas DR / flux inter-juridiction : région connue + base légale datée (déjà calculée par le moteur).
  for (const transfer of r.transfers) {
    components.push({
      id: `replica-${transfer.to}`,
      label: msg("residencyContinuity.replica", { region: transfer.to }),
      region: transfer.to,
      flag: statusToFlag(transfer.status),
      legalBasis: transfer.legalBasis,
    });
  }

  // 3. Backup hors-site : destination NON pinnée → à confirmer (jamais de région fabriquée).
  components.push(
    reco.backup.offsite
      ? { id: "backup", label: msg("residencyContinuity.backupOffsite"), region: null, flag: "unverified" }
      : { id: "backup", label: msg("residencyContinuity.backupLocal"), region: r.primaryRegion, flag: "in-zone" },
  );

  // 4. Supervision / monitoring : co-localisation à confirmer (souvent un SaaS).
  components.push({ id: "monitoring", label: msg("residencyContinuity.monitoring"), region: null, flag: "unverified" });

  const outOfZoneCount = components.filter((c) => c.flag === "restricted" || c.flag === "out-of-zone").length;
  const unverifiedCount = components.filter((c) => c.flag === "unverified").length;

  return {
    generatedAt,
    primaryRegion: r.primaryRegion,
    components,
    outOfZoneCount,
    unverifiedCount,
    disclaimer: DISCLAIMER,
  };
}
