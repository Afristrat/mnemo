// Seed des régimes réglementaires NOTOIRES par pays (S-077, tranche 1) — REPLI DATÉ + SOURCÉ.
//
// Doctrine `jamais-graver-decision-perissable` + DÉFCON 1 : on ne grave AUCUN statut périssable.
// Chaque entrée = EXISTENCE d'un régime (nom + portée + pays + source officielle + date + confiance),
// JAMAIS une qualification de conformité ni un avis juridique (« à valider par un conseil »). Le seed
// est le repli garanti quand la veille live (`regime-discovery`) échoue. La veille live le complète/
// rafraîchit (suite S-073/S-076 : la veille respecte les choix utilisateur, S-072).
//
// `code` est rempli UNIQUEMENT si le régime est mappable sur l'énum moteur (`Regulation`) — sinon `null`
// (régime « libre », porté comme donnée, n'altère pas le chiffrage déterministe, DÉFCON 1). Sources
// vérifiées sur pages officielles le 2026-06-01 (agences/textes de loi) ; confiance `medium` quand le
// régime est patchwork (US) ou en montée en charge progressive (Inde).

import type { Confidence } from "@/components/ui/StatusDot";
import type { Regulation } from "@/lib/engine";
import type { LegalSource } from "./transfers";

/** Portée d'un régime (oriente l'affichage + un futur mapping moteur). */
export type RegimeScope = "data-protection" | "ai" | "sector" | "other";

export type RegimeProvenance = "seed" | "live";

/**
 * Suggestion de régime applicable à un pays. `code` mappable sur l'énum moteur (`rgpd`/`cndp`/`aiact`/
 * `hipaa`) ⇒ le régime peut alimenter `profile.regulations` ; sinon `null` (régime libre, sourcé,
 * affiché mais sans effet sur le chiffrage déterministe — DÉFCON 1).
 */
export type RegimeSuggestion = {
  code: Regulation | null;
  /** Nom court du régime (ex. « LGPD », « APPI », « RGPD »). */
  name: string;
  scope: RegimeScope;
  /** Code pays (catalogue `geography`) auquel ce régime se rattache. */
  country: string;
  source: LegalSource;
  confidence: Confidence;
  provenance: RegimeProvenance;
};

const CHECKED_AT = "2026-06-01";

/** Fabrique concise d'une entrée seed (provenance `seed`). */
function r(
  country: string,
  code: Regulation | null,
  name: string,
  scope: RegimeScope,
  label: string,
  url: string,
  confidence: Confidence = "high",
): RegimeSuggestion {
  return { code, name, scope, country, confidence, provenance: "seed", source: { label, url, checkedAt: CHECKED_AT } };
}

// Régimes notoires par code pays (catalogue `geography`). Vérifiés sur pages officielles 2026-06-01.
// Les buckets génériques (`autre-*`) n'ont pas de régime gravé → la veille live + le défaut conservateur
// « base légale à valider par un conseil » (lib/legal) s'en chargent.
const SEED: Record<string, RegimeSuggestion[]> = {
  "union-europeenne": [
    r("union-europeenne", "rgpd", "RGPD", "data-protection", "EUR-Lex — Règlement (UE) 2016/679", "https://eur-lex.europa.eu/eli/reg/2016/679/oj"),
    r("union-europeenne", "aiact", "AI Act", "ai", "EUR-Lex — Règlement (UE) 2024/1689", "https://eur-lex.europa.eu/eli/reg/2024/1689/oj"),
  ],
  suisse: [
    r("suisse", null, "nLPD (révision FADP)", "data-protection", "Confédération suisse — nLPD (en vigueur 01.09.2023)", "https://www.fedlex.admin.ch/eli/cc/2022/491/fr"),
  ],
  "royaume-uni": [
    r("royaume-uni", null, "UK GDPR + Data Protection Act 2018", "data-protection", "legislation.gov.uk — Data Protection Act 2018", "https://www.legislation.gov.uk/ukpga/2018/12/contents"),
  ],
  "etats-unis": [
    r("etats-unis", "hipaa", "HIPAA (santé)", "sector", "HHS — HIPAA", "https://www.hhs.gov/hipaa/index.html"),
    r("etats-unis", null, "CCPA / CPRA (Californie)", "data-protection", "California OAG — CCPA", "https://oag.ca.gov/privacy/ccpa", "medium"),
  ],
  canada: [
    r("canada", null, "PIPEDA", "data-protection", "OPC Canada — PIPEDA", "https://www.priv.gc.ca/en/privacy-topics/privacy-laws-in-canada/the-personal-information-protection-and-electronic-documents-act-pipeda/"),
  ],
  maroc: [
    r("maroc", "cndp", "Loi 09-08 (CNDP)", "data-protection", "CNDP Maroc", "https://www.cndp.ma/"),
  ],
  nigeria: [
    r("nigeria", null, "NDPA 2023", "data-protection", "Nigeria Data Protection Commission (NDPC)", "https://ndpc.gov.ng/"),
  ],
  kenya: [
    r("kenya", null, "Data Protection Act 2019", "data-protection", "Office of the Data Protection Commissioner (ODPC)", "https://www.odpc.go.ke/"),
  ],
  "afrique-sud": [
    r("afrique-sud", null, "POPIA", "data-protection", "Information Regulator South Africa", "https://inforegulator.org.za/"),
  ],
  bresil: [
    r("bresil", null, "LGPD (Lei 13.709/2018)", "data-protection", "ANPD Brésil", "https://www.gov.br/anpd/pt-br"),
  ],
  mexique: [
    r("mexique", null, "LFPDPPP", "data-protection", "Cámara de Diputados — LFPDPPP", "https://www.diputados.gob.mx/LeyesBiblio/ref/lfpdppp.htm", "medium"),
  ],
  japon: [
    r("japon", null, "APPI", "data-protection", "Personal Information Protection Commission (PPC) Japan", "https://www.ppc.go.jp/en/"),
  ],
  "coree-sud": [
    r("coree-sud", null, "PIPA", "data-protection", "Personal Information Protection Commission (PIPC) Korea", "https://www.pipc.go.kr/eng/"),
  ],
  inde: [
    r("inde", null, "DPDP Act 2023", "data-protection", "MeitY — Digital Personal Data Protection Act, 2023", "https://www.meity.gov.in/content/digital-personal-data-protection-act-2023", "medium"),
  ],
  emirats: [
    r("emirats", null, "PDPL (Décret-loi fédéral 45/2021)", "data-protection", "UAE Government — Data protection laws", "https://u.ae/en/about-the-uae/digital-uae/data/data-protection-laws"),
  ],
  "arabie-saoudite": [
    r("arabie-saoudite", null, "PDPL (Décret royal M/19)", "data-protection", "SDAIA — Data Protection Law", "https://sdaia.gov.sa/en/Research/Pages/DataProtection.aspx"),
  ],
};

/**
 * Régimes notoires sourcés d'un pays (repli daté). Liste vide si pays inconnu/générique (`autre-*`) →
 * la veille live + le défaut conservateur prennent le relais (jamais d'invention). Pur, total.
 */
export function regimesSeedFor(country: string): RegimeSuggestion[] {
  return SEED[country] ?? [];
}

/**
 * Régimes seed cumulés sur plusieurs pays (pays cible + résidences clients, S-077), dédupliqués par
 * (pays, nom). Ordre stable : ordre des pays fournis, puis ordre du seed. Pur, total.
 */
export function regimesSeedForCountries(countries: readonly string[]): RegimeSuggestion[] {
  const out: RegimeSuggestion[] = [];
  const seen = new Set<string>();
  for (const country of countries) {
    for (const regime of regimesSeedFor(country)) {
      const key = `${regime.country}::${regime.name.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(regime);
    }
  }
  return out;
}
