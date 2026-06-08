// Disponibilité OBSERVÉE (SLA #5, complément du SLA publié). La source de vérité = les PAGES DE STATUT
// publiques des fournisseurs (transparence : incidents réels, datés). DÉFCON : on rapporte des FAITS
// sourcés (incidents publiés), jamais un « % mesuré » fabriqué. Registre des sources par classe
// d'hébergement + fournisseurs LLM (le gateway en dépend). Endpoints vérifiés au 2026-06-08.

import type { HostingClass } from "@/lib/engine";

/** Format machine de la page de statut. */
export type StatusKind = "statuspage" | "gcp";

export type StatusSource = {
  id: string;
  name: string;
  /** Classe d'hébergement concernée, ou "llm" pour les fournisseurs de modèles (gateway). */
  scope: HostingClass | "llm";
  kind: StatusKind;
  /** Endpoint machine (JSON) interrogé au runtime. */
  endpoint: string;
  /** Page humaine (toujours affichée comme source, même en repli). */
  pageUrl: string;
};

// Sources à endpoint machine VÉRIFIÉ (2026-06-08). Atlassian Statuspage expose /api/v2/incidents.json ;
// Google Cloud expose incidents.json. Les fournisseurs RSS-only (AWS/Azure/OVH) seront ajoutés via un
// adaptateur RSS dédié — en attendant, leur page humaine reste liée par le SLA publié (pas d'invention).
export const STATUS_SOURCES: readonly StatusSource[] = [
  {
    id: "scaleway",
    name: "Scaleway",
    scope: "sovereign-eu",
    kind: "statuspage",
    endpoint: "https://status.scaleway.com/api/v2/incidents.json",
    pageUrl: "https://status.scaleway.com/",
  },
  {
    id: "outscale",
    name: "3DS OUTSCALE",
    scope: "secnumcloud",
    kind: "statuspage",
    endpoint: "https://status.outscale.com/api/v2/incidents.json",
    pageUrl: "https://status.outscale.com/",
  },
  {
    id: "gcp",
    name: "Google Cloud",
    scope: "hyperscaler",
    kind: "gcp",
    endpoint: "https://status.cloud.google.com/incidents.json",
    pageUrl: "https://status.cloud.google.com/",
  },
  {
    id: "anthropic",
    name: "Anthropic (Claude)",
    scope: "llm",
    kind: "statuspage",
    endpoint: "https://status.claude.com/api/v2/incidents.json",
    pageUrl: "https://status.claude.com/",
  },
];

/** Sources pertinentes pour une classe d'hébergement (+ fournisseurs LLM, qui concernent toute classe). */
export function sourcesForClass(hostingClass: HostingClass): readonly StatusSource[] {
  return STATUS_SOURCES.filter((s) => s.scope === hostingClass || s.scope === "llm");
}
