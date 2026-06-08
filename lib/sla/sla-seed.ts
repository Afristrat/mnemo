// SLA paramétrique (moat « chaîne de preuve », vague 3 — #5). Strate ne PROMET pas une disponibilité ; il
// la CALCULE à partir des SLA PUBLIÉS des fournisseurs d'infrastructure, exactement comme les prix sont
// sourcés. DÉFCON 1 : seules les valeurs réellement publiées sont affirmées (source + date + confiance) ;
// une valeur non publiée distinctement reste `null` — jamais fabriquée. Donnée périssable → datée et
// re-vérifiable (cf. mémoire « jamais graver de décision périssable »).

import type { HostingClass } from "@/lib/engine";

export type SlaConfidence = "high" | "medium";

export type SlaProvider = {
  id: string;
  name: string;
  hostingClass: HostingClass;
  /** Service couvert par le SLA (compute, le plus structurant pour une base mémorielle auto-hébergée). */
  service: string;
  /** SLA mensuel d'une instance unique (%), ou null si non publié distinctement. */
  singlePct: number | null;
  /** SLA mensuel en configuration redondée (multi-AZ / multi-zone) (%), ou null si non publié. */
  haPct: number | null;
  sourceUrl: string;
  /** Date de relevé (ISO court). */
  asOf: string;
  confidence: SlaConfidence;
  /** Nuance honnête (variantes d'offre, périmètre). */
  note: string | null;
};

// Relevé au 2026-06-08. Valeurs issues des pages SLA officielles (confiance « high ») sauf mention.
export const SLA_SEED: readonly SlaProvider[] = [
  // ── Souverains UE ───────────────────────────────────────────────────────────
  {
    id: "ovh-pci",
    name: "OVHcloud",
    hostingClass: "sovereign-eu",
    service: "Public Cloud — Instance",
    singlePct: 99.99,
    haPct: null,
    sourceUrl: "https://us.ovhcloud.com/legal/sla/public-cloud/",
    asOf: "2026-06-08",
    confidence: "high",
    note: "Engagement par instance ; instances « Discovery » 99,95 %.",
  },
  {
    id: "scaleway-inst",
    name: "Scaleway",
    hostingClass: "sovereign-eu",
    service: "Instances (dédiées)",
    singlePct: 99.5,
    haPct: null,
    sourceUrl: "https://www.scaleway.com/en/virtual-instances/sla/",
    asOf: "2026-06-08",
    confidence: "high",
    note: "Instances mutualisées 99 % ; sans engagement pour les types « Development ».",
  },
  // ── SecNumCloud ─────────────────────────────────────────────────────────────
  {
    id: "outscale-snc",
    name: "3DS OUTSCALE",
    hostingClass: "secnumcloud",
    service: "Cloud SecNumCloud (multi-zone)",
    singlePct: null,
    haPct: 99.95,
    sourceUrl: "https://fr.outscale.com/",
    asOf: "2026-06-08",
    confidence: "medium",
    note: "« Jusqu'à 99,95 % » en multi-zone (communiqué OKS) ; vérifier la convention SNC applicable.",
  },
  // ── Hyperscalers ──────────────────────────────────────────────────────────────
  {
    id: "aws-ec2",
    name: "AWS EC2",
    hostingClass: "hyperscaler",
    service: "Compute",
    singlePct: 99.5,
    haPct: 99.99,
    sourceUrl: "https://aws.amazon.com/compute/sla/",
    asOf: "2026-06-08",
    confidence: "high",
    note: "99,99 % au niveau région (≥ 2 zones) ; 99,5 % par instance.",
  },
  {
    id: "gcp-ce",
    name: "Google Compute Engine",
    hostingClass: "hyperscaler",
    service: "Compute",
    singlePct: null,
    haPct: 99.99,
    sourceUrl: "https://cloud.google.com/compute/sla",
    asOf: "2026-06-08",
    confidence: "high",
    note: "99,99 % pour des instances réparties sur plusieurs zones.",
  },
  {
    id: "azure-vm",
    name: "Azure Virtual Machines",
    hostingClass: "hyperscaler",
    service: "Compute",
    singlePct: null,
    haPct: 99.99,
    sourceUrl: "https://learn.microsoft.com/azure/virtual-machines/availability",
    asOf: "2026-06-08",
    confidence: "high",
    note: "99,99 % pour ≥ 2 VM réparties sur ≥ 2 zones de disponibilité.",
  },
];

/** Fournisseurs publiant un SLA pour une classe d'hébergement donnée (préserve l'ordre du seed). */
export function providersForClass(hostingClass: HostingClass): readonly SlaProvider[] {
  return SLA_SEED.filter((p) => p.hostingClass === hostingClass);
}
