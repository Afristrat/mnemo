// Procédures guidées de provisioning (F10, Lot 2 · B, S-087) — PUR.
//
// Human-in-the-loop PAR DESIGN : Strate fournit, pour chaque composant retenu, la PROCÉDURE à suivre
// (lien officiel + étapes que l'UTILISATEUR réalise lui-même + champs à relever). Strate n'automatise
// AUCUNE inscription ni saisie de carte (CGU respectées, zéro engagement financier au nom d'autrui).
//
// DÉFCON 1 : le lien officiel = `source.url` du candidat catalogue (SOURCÉ, jamais inventé). Les
// étapes sont des descripteurs i18n génériques par type de provisioning — aucune donnée fabriquée.

import { msg, type Message } from "@/lib/engine/message";
import type { Catalog, ComponentSovereignty, SlotId } from "@/lib/catalog";

/** Type de provisioning : compte chez un fournisseur (inscription + carte) vs déploiement self-hosté. */
export type ProvisioningKind = "account" | "self-host";

export type ProvisioningProcedure = {
  slot: SlotId;
  component: string;
  role: string;
  kind: ProvisioningKind;
  /** Lien officiel SOURCÉ (page du fournisseur / du projet) — jamais fabriqué. */
  officialUrl: string;
  checkedAt: string;
  /** Étapes que l'UTILISATEUR réalise lui-même (descripteurs i18n). */
  steps: Message[];
  /** Informations à relever pour la suite (clés, endpoints…) (descripteurs i18n). */
  fieldsToNote: Message[];
};

const SLOT_ORDER: SlotId[] = ["c0", "c1", "c2", "c3", "c4", "c5", "c6"];

/** `api-third-party`/`eu-hosted` ⇒ inscription chez un fournisseur ; `sovereign` ⇒ déploiement self-hosté. */
function kindFor(sovereignty: ComponentSovereignty): ProvisioningKind {
  return sovereignty === "sovereign" ? "self-host" : "account";
}

function stepsFor(kind: ProvisioningKind): Message[] {
  if (kind === "account") {
    return [
      msg("provisioning.account.step1"),
      msg("provisioning.account.step2"),
      msg("provisioning.account.step3"),
      msg("provisioning.account.step4"),
      msg("provisioning.account.step5"),
    ];
  }
  return [
    msg("provisioning.selfHost.step1"),
    msg("provisioning.selfHost.step2"),
    msg("provisioning.selfHost.step3"),
    msg("provisioning.selfHost.step4"),
  ];
}

function fieldsFor(kind: ProvisioningKind): Message[] {
  return kind === "account"
    ? [msg("provisioning.fields.apiKey"), msg("provisioning.fields.endpoint")]
    : [msg("provisioning.fields.endpoint"), msg("provisioning.fields.adminCreds")];
}

/**
 * Dérive les procédures de provisioning à partir du catalogue retenu (un composant par slot). Pure.
 * Chaque procédure porte le lien officiel SOURCÉ du candidat et des étapes génériques selon le type.
 */
export function deriveProvisioningProcedures(catalog: Catalog): ProvisioningProcedure[] {
  return SLOT_ORDER.map((slot): ProvisioningProcedure => {
    const c = catalog.slots[slot].recommended;
    const kind = kindFor(c.sovereignty);
    return {
      slot,
      component: c.name,
      role: c.role,
      kind,
      officialUrl: c.source.url,
      checkedAt: c.source.checkedAt,
      steps: stepsFor(kind),
      fieldsToNote: fieldsFor(kind),
    };
  });
}
