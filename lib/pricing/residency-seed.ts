// Seed des coûts d'egress inter-région & sécurisation inter-site (S-043), DÉFCON 1.
//
// DOCTRINE « tout vivant + filet » (mémoires `prix-jamais-hardcodes-feed-live`,
// `jamais-graver-decision-perissable`) : ces valeurs sont un **repli daté + baseline de validation**,
// JAMAIS des décisions gravées. La valeur effective vient de la veille live (extraction Firecrawl
// réconciliée vs cette baseline, cf. `live-feed.ts` + `reconcile.ts`). Un prix d'hébergeur change
// (OVH est passé à l'egress gratuit en janv. 2026 ; Scaleway révise sa grille) → ne jamais figer.
//
// MULTI-SEGMENT, pas de référent unique (retour Amine 2026-05-29) : une solution souveraine couvre
// le spectre des profils — self-hosted/bare-metal (à sécuriser), souverains UE, hyperscalers (repères).
// Le moteur (S-044) choisit le vecteur selon le profil. Devises NATIVES (pas de conversion gravée).
//
// ⚠ Ne JAMAIS éditer un montant ici sans mettre à jour `docs/pricing/residency-cost-sources.md`.
// Sourcing : recherche web réelle, pages officielles (relevé 2026-05-29).

// Le CONTRAT (types + table neutre + sélecteurs) vit DANS le moteur (lib/engine/residency), comme
// `BackupPriceTable` vit dans lib/engine/backup. Ici = le SEED sourcé (repli daté + baseline) + le
// garde-fou de réconciliation live. Le moteur reste pur (il n'importe jamais lib/pricing).
import type { EgressVector, InterSiteSecurityPrices, ResidencyPriceTable } from "@/lib/engine";
import { reconcilePrice, type PriceStatus } from "./reconcile";

export type { EgressVector, HostingClass, InterSiteSecurityPrices, ResidencyPriceTable } from "@/lib/engine";
export { NEUTRAL_RESIDENCY_PRICES, selectEgressVector, vectorsForClass, vectorsForContinent } from "@/lib/engine";

const CHECKED_AT = "2026-05-29";

function src(label: string, url: string): { label: string; url: string; checkedAt: string } {
  return { label, url, checkedAt: CHECKED_AT };
}

// --- Vecteurs d'egress (repli daté + baseline ; valeur effective = veille live) ----------------

export const RESIDENCY_EGRESS_SEED: EgressVector[] = [
  {
    provider: "Hetzner",
    hostingClass: "self-hosted",
    sovereign: true,
    continent: "europe",
    country: "Allemagne",
    interRegionEgress: {
      amount: 0.001,
      currency: "EUR",
      unit: "Go",
      confidence: "medium",
      source: src("Hetzner Cloud — trafic inclus + overage", "https://www.hetzner.com/cloud/pricing/"),
      note: "20 To/mois inclus en EU ; au-delà 1,00 €/To = 0,001 €/Go ; trafic privé même-zone gratuit. Self-hosted : liaison inter-site à sécuriser (cf. interSiteSecurity).",
    },
  },
  {
    provider: "OVHcloud",
    hostingClass: "sovereign-eu",
    sovereign: true,
    continent: "europe",
    country: "France",
    interRegionEgress: {
      amount: 0,
      currency: "EUR",
      unit: "Go",
      confidence: "high",
      source: src("OVHcloud Object Storage — no egress fees", "https://www.ovhcloud.com/en/public-cloud/object-storage/"),
      note: "Egress gratuit (toutes classes/régions, depuis ~janv. 2026) ; inter-région objet non facturé.",
    },
  },
  {
    provider: "Scaleway",
    hostingClass: "sovereign-eu",
    sovereign: true,
    continent: "europe",
    country: "France",
    interRegionEgress: {
      amount: 0.01,
      currency: "EUR",
      unit: "Go",
      confidence: "high",
      source: src("Scaleway — Object Storage egress", "https://www.scaleway.com/en/pricing/storage/"),
      note: "75 Go/mois gratuits puis 0,01 €/Go ; intra-région gratuit, inter-région (AMS↔PAR↔WAW) au tarif egress standard. Live-câblé via live-feed.ts (backup.egress).",
    },
  },
  {
    provider: "IONOS",
    hostingClass: "sovereign-eu",
    sovereign: true,
    continent: "europe",
    country: "Allemagne",
    interRegionEgress: {
      amount: 0.03,
      currency: "EUR",
      unit: "Go",
      confidence: "high",
      source: src("IONOS — Object Storage pricing", "https://docs.ionos.com/cloud/backup-and-storage/ionos-object-storage/overview/pricing"),
      note: "2 To/mois gratuits puis paliers 0,030→0,015 €/Go (1 To = 1 024 Go) ; inter-pays IONOS facturé comme egress public. IONOS SE = EUR.",
    },
  },
  {
    provider: "Outscale",
    hostingClass: "secnumcloud",
    sovereign: true,
    continent: "europe",
    country: "France",
    interRegionEgress: {
      amount: 0,
      currency: "EUR",
      unit: "Go",
      confidence: "high",
      source: src("Outscale — pricing (traffic included EU/US)", "https://en.outscale.com/pricing/"),
      note: "Entrant + sortant inclus en EU et US (région souveraine cloudgouv-eu-west-1, SecNumCloud) ; exception Asie 0,009 €/Gio.",
    },
  },
  {
    provider: "GCP",
    hostingClass: "hyperscaler",
    sovereign: false,
    continent: "north-america",
    country: "États-Unis",
    interRegionEgress: {
      amount: 0.05,
      currency: "USD",
      unit: "Gio",
      confidence: "medium",
      source: src("Google Cloud — VPC network pricing announce", "https://cloud.google.com/vpc/pricing-announce"),
      note: "0,05 $/Gio inter-région NA↔Europe (table officielle eff. 2024-02-01) ; intra-Europe ~0,02 $/Gio NON CONFIRMÉ. Repère non souverain UE.",
    },
  },
  {
    provider: "AWS",
    hostingClass: "hyperscaler",
    sovereign: false,
    continent: "north-america",
    country: "États-Unis",
    interRegionEgress: {
      amount: 0.02,
      currency: "USD",
      unit: "Go",
      confidence: "low",
      source: src("AWS — S3 pricing / Data Transfer", "https://aws.amazon.com/s3/pricing/"),
      note: "Inter-région ~0,02 $/Go (repère, table JS non rendue) ; S3 inter-région US ~0,01 ; egress Internet 0,09 $/Go. Repère non souverain UE. Azure : NON CONFIRMÉ (non retenu).",
    },
  },
];

// --- Sécurisation inter-site self-hosted (chiffrage du poste, S-061) ----------------------------
//
// Seuls les postes CHIFFRABLES VENDEUR sont figés (DÉFCON 1) : la VM passerelle (la liaison chiffrée
// WireGuard/IPsec + mTLS reposent sur des logiciels open-source = licence 0 €, le coût est l'instance)
// et l'alternative managée (mesh/SASE par utilisateur). La supervision + le durcissement = OPEX /
// main-d'œuvre interne → flaggés « à chiffrer en devis », JAMAIS un montant inventé.

export const INTER_SITE_SECURITY_SEED: InterSiteSecurityPrices = {
  selfHostedGatewayPerMonth: {
    amount: 3.79,
    currency: "EUR",
    unit: "mois",
    confidence: "high",
    source: src("Hetzner Cloud — CX22 (passerelle WireGuard)", "https://www.hetzner.com/cloud/pricing/"),
    note: "VM passerelle dédiée CX22 (2 vCPU / 4 Go / 40 Go) = 3,79 €/mois ; WireGuard/IPsec + mTLS (PKI open-source type step-ca) = licence 0 €. Ajustement tarifaire Hetzner eff. 1ᵉʳ avr. 2026. Supervision + durcissement initial = OPEX à chiffrer en devis (non figé, DÉFCON 1).",
  },
  managedPerUserPerMonth: {
    amount: 8,
    currency: "USD",
    unit: "utilisateur·mois",
    confidence: "high",
    source: src("Tailscale — pricing (Standard)", "https://tailscale.com/pricing"),
    note: "Alternative managée : Tailscale Standard 8 $/u/mois (Personal 0 € ≤ 6 users ; Premium 18 $). Cloudflare Zero Trust : 0 € ≤ 50 users puis 7 $/u/mois (cloudflare.com/plans/zero-trust-services). Exploitation incluse. Devise USD (étage FX au runtime).",
  },
};

export const RESIDENCY_PRICE_SEED: ResidencyPriceTable = {
  egressVectors: RESIDENCY_EGRESS_SEED,
  interSiteSecurity: INTER_SITE_SECURITY_SEED,
};

/** Prix résidence (seed = repli/baseline daté). Le live arrive via la veille (réutilise `live-feed`). */
export function getResidencyPrices(): ResidencyPriceTable {
  return RESIDENCY_PRICE_SEED;
}

/**
 * Garde-fou DÉFCON 1 : réconcilie l'egress d'un vecteur avec une valeur live (ou null = repli).
 * Réutilise `reconcilePrice` (bande ±60 %, aberrant → baseline + flag). Pour S-046 / la veille live.
 */
export function reconcileEgressVector(
  vector: EgressVector,
  liveAmount: number | null,
  checkedAt: string,
): { vector: EgressVector; status: PriceStatus } {
  const seed = vector.interRegionEgress;
  const r = reconcilePrice(liveAmount, seed.amount, seed.confidence);
  const source =
    seed.source === null
      ? null
      : { ...seed.source, checkedAt: r.status === "live" ? checkedAt : seed.source.checkedAt };
  const note = r.note ?? seed.note;
  return {
    vector: {
      ...vector,
      interRegionEgress: {
        amount: r.amount,
        currency: seed.currency,
        unit: seed.unit,
        confidence: r.confidence,
        source,
        ...(note === undefined ? {} : { note }),
      },
    },
    status: r.status,
  };
}
