// Bases légales des transferts inter-juridiction (S-043), DÉFCON 1.
//
// ⚠ Orientation d'INGÉNIERIE, PAS un avis juridique. Sert à afficher un statut INDICATIF, DATÉ et
// RÉVISABLE dans le configurateur (résidence / réplication inter-région).
//
// DOCTRINE « tout vivant + filet » (mémoire `jamais-graver-decision-perissable`) : un statut juridique
// n'est JAMAIS gravé comme permanent. `lookupTransferBasis` retourne TOUJOURS la date de relevé
// (`checkedAt`) + le flag `volatile` (statut instable) + le `disclaimer`. La VEILLE LIVE des statuts
// (LLM + sources officielles, via le registre de prompts S-053) = story dédiée S-062 ; ce module est
// le repli daté + baseline. Au relevé 2026-05-29 : DPF UE-US valide mais sous pourvoi CJUE (C-703/25 P) ;
// Maroc sans adéquation UE (peut évoluer). Sources : EUR-Lex/gdpr-info, Commission UE, CNDP (B.O. 5714),
// Cornell LII. Audit trail complet : `docs/legal/transfer-bases.md`.
//
// Pur, déterministe, total sur from × to × contexte. Aucune dépendance réseau/UI.

import type { Confidence } from "@/components/ui/StatusDot";

/** Régions modélisées (aligné 1-1 sur `Profile.zone`). S-044 importe ce type plutôt que le redéfinir. */
export type TransferRegion = "eu" | "maroc" | "us" | "other";
export const TRANSFER_REGIONS: readonly TransferRegion[] = ["eu", "maroc", "us", "other"] as const;

/** Statut d'un flux de transfert. Canonique ici (S-043) ; S-044 (`ResidencyPlan`) l'importe. */
export type TransferStatus = "ok" | "restricted" | "forbidden";

/** Provenance d'un statut après veille (S-062) : repli daté, confirmé live, ou divergence flaggée. */
export type TransferProvenance = "seed" | "live" | "flagged";

/** Contexte du flux, dérivé du `Profile` par S-044 (résidence stricte, données régulées). */
export type TransferContext = {
  noTransfer?: boolean;
  regulatedData?: boolean;
};

/** Source légale datée + révisable (DÉFCON 1). */
export type LegalSource = { label: string; url: string; checkedAt: string };

/** Base légale retournée — TOUJOURS datée, révisable, avec disclaimer (jamais un verdict gravé). */
export type TransferBasis = {
  from: TransferRegion;
  to: TransferRegion;
  status: TransferStatus;
  legalBasis: string;
  citation: string;
  source: LegalSource | null;
  confidence: Confidence;
  /** Statut juridiquement instable (à revérifier par la veille live S-062). */
  volatile: boolean;
  checkedAt: string;
  /** Exposition US CLOUD Act (flag de risque, distinct du statut RGPD). */
  cloudAct: boolean;
  disclaimer: string;
  /** Provenance après veille (S-062) : `seed` par défaut (repli daté), `live` (confirmé), `flagged` (divergence). */
  provenance?: TransferProvenance;
  note?: string;
};

/**
 * Flux dont le statut est juridiquement INSTABLE → cible de la veille live (S-062). Ce sont exactement
 * les paires `volatile` du repli daté (DPF UE-US sous pourvoi CJUE ; adéquation Maroc absente/évolutive).
 * Les flux stables (même juridiction, RGPD chap. V générique) ne déclenchent pas de veille.
 */
export const WATCHED_TRANSFER_FLOWS: readonly { from: TransferRegion; to: TransferRegion }[] = [
  { from: "eu", to: "us" },
  { from: "eu", to: "maroc" },
] as const;

export const TRANSFER_DISCLAIMER =
  "Orientation d'ingénierie, PAS un avis juridique — à valider par un conseil qualifié.";

const CHECKED_AT = "2026-05-29";

function source(label: string, url: string): LegalSource {
  return { label, url, checkedAt: CHECKED_AT };
}

// Champs « cœur » d'une règle (avant ajout de checkedAt/disclaimer/cloudAct, factorisés).
type RuleCore = {
  status: TransferStatus;
  legalBasis: string;
  citation: string;
  source: LegalSource | null;
  confidence: Confidence;
  volatile: boolean;
  note?: string;
};

const SAME_EU: RuleCore = {
  status: "ok",
  legalBasis: "RGPD art. 1(3) — libre circulation dans l'UE/EEE (pas un transfert pays tiers).",
  citation:
    "The free movement of personal data within the Union shall be neither restricted nor prohibited for reasons connected with the protection of natural persons with regard to the processing of personal data.",
  source: source("RGPD art. 1", "https://gdpr-info.eu/art-1-gdpr/"),
  confidence: "high",
  volatile: false,
};

const SAME_REGION: RuleCore = {
  status: "ok",
  legalBasis: "Transfert au sein de la même juridiction (pas de flux transfrontière).",
  citation: "",
  source: null,
  confidence: "high",
  volatile: false,
};

const EU_TO_US: RuleCore = {
  status: "restricted",
  legalBasis:
    "RGPD chap. V art. 44-46 ; adéquation partielle EU-US Data Privacy Framework (10/07/2023) si destinataire certifié DPF, sinon clauses contractuelles types (SCC, art. 46).",
  citation:
    "the United States (commercial organisations participating in the EU-US Data Privacy Framework)",
  source: source(
    "Commission UE — EU-US data transfers",
    "https://commission.europa.eu/law/law-topic/data-protection/international-dimension-data-protection/eu-us-data-transfers_en",
  ),
  confidence: "medium",
  volatile: true,
  note: "Statut évolutif : DPF valide mais sous pourvoi CJUE (C-703/25 P, à reconfirmer) ; conserver des SCC en filet.",
};

const EU_TO_MAROC: RuleCore = {
  status: "restricted",
  legalBasis:
    "RGPD chap. V — le Maroc n'a pas de décision d'adéquation UE (vérifié 2026-05-29) → transfert via garanties art. 46 (SCC/BCR) + évaluation d'impact.",
  citation:
    "Liste d'adéquation de la Commission européenne — le Maroc n'y figure pas (Andorre, Argentine, Brésil, Canada, Féroé, Guernesey, Israël, Île de Man, Japon, Jersey, N.-Zélande, Corée du Sud, Suisse, RU, USA-DPF, Uruguay).",
  source: source(
    "Commission UE — Adequacy decisions",
    "https://commission.europa.eu/law/law-topic/data-protection/international-dimension-data-protection/adequacy-decisions_en",
  ),
  confidence: "high",
  volatile: true,
  note: "L'adéquation peut évoluer ; à revérifier par la veille (S-062).",
};

const EU_TO_THIRD: RuleCore = {
  status: "restricted",
  legalBasis: "RGPD chap. V — art. 44 (principe), 45 (adéquation), 46 (garanties / SCC).",
  citation:
    "Any transfer of personal data … to a third country or to an international organisation shall take place only if … the conditions laid down in this Chapter are complied with.",
  source: source("RGPD art. 44", "https://gdpr-info.eu/art-44-gdpr/"),
  confidence: "high",
  volatile: false,
};

const MAROC_OUT: RuleCore = {
  status: "restricted",
  legalBasis:
    "Loi 09-08 art. 43 (pays à « niveau de protection suffisant ») + art. 44 (dérogations / autorisation CNDP) ; sanction pénale art. 60.",
  citation:
    "Le responsable d'un traitement ne peut transférer des données à caractère personnel vers un Etat étranger que si cet Etat assure un niveau de protection suffisant…",
  source: source("CNDP — Loi 09-08 (B.O. 5714)", "https://www.cndp.ma/wp-content/uploads/2023/11/Loi-09-08-Fr.pdf"),
  confidence: "high",
  volatile: false,
};

const FROM_US_OUT: RuleCore = {
  status: "restricted",
  legalBasis: "Régime du pays de destination à vérifier ; données soumises à la juridiction US à la source.",
  citation: "",
  source: null,
  confidence: "low",
  volatile: false,
  note: "Régime local de la destination à valider par un conseil.",
};

const FROM_OTHER_OUT: RuleCore = {
  status: "restricted",
  legalBasis: "Régime du pays d'origine et de destination à vérifier (hors zones modélisées).",
  citation: "",
  source: null,
  confidence: "low",
  volatile: false,
  note: "Hors UE/Maroc/US : base légale à valider par un conseil.",
};

/** Résout les champs « cœur » d'un flux (avant enrobage daté). Pur et total. */
function resolveCore(from: TransferRegion, to: TransferRegion): RuleCore {
  if (from === to) return from === "eu" ? SAME_EU : SAME_REGION;
  if (from === "eu") {
    if (to === "us") return EU_TO_US;
    if (to === "maroc") return EU_TO_MAROC;
    return EU_TO_THIRD;
  }
  if (from === "maroc") return MAROC_OUT;
  if (from === "us") return FROM_US_OUT;
  return FROM_OTHER_OUT;
}

/**
 * Base légale d'un flux `from → to`, datée + révisable (DÉFCON 1). Pure, totale.
 * - `noTransfer` (résidence stricte) + flux transfrontière → `forbidden`.
 * - `regulatedData` + destination `us` → flag `cloudAct`.
 * Le résultat porte TOUJOURS `checkedAt` + `volatile` + `disclaimer`.
 */
export function lookupTransferBasis(
  from: TransferRegion,
  to: TransferRegion,
  ctx: TransferContext = {},
): TransferBasis {
  const cloudAct = to === "us" && ctx.regulatedData === true;

  if (ctx.noTransfer === true && from !== to) {
    return {
      from,
      to,
      status: "forbidden",
      legalBasis: "Résidence stricte : aucune copie hors juridiction (dérivé de la sensibilité / du régime régulé).",
      citation: "",
      source: null,
      confidence: "high",
      volatile: false,
      checkedAt: CHECKED_AT,
      cloudAct,
      disclaimer: TRANSFER_DISCLAIMER,
      note: "Contrainte de résidence définie par l'organisation.",
    };
  }

  const core = resolveCore(from, to);
  return {
    from,
    to,
    status: core.status,
    legalBasis: core.legalBasis,
    citation: core.citation,
    source: core.source,
    confidence: core.confidence,
    volatile: core.volatile,
    checkedAt: CHECKED_AT,
    cloudAct,
    disclaimer: TRANSFER_DISCLAIMER,
    ...(core.note === undefined ? {} : { note: core.note }),
  };
}
