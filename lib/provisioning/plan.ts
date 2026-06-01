// Cadre d'optimisation post-création (F10, Lot 2 · B, S-088) — PUR + garde-fou exécution.
//
// Après que l'utilisateur a créé les comptes (S-087), l'agent prend le relais sur la CONFIGURATION /
// optimisation, via OAuth/MCP/API officiels, SUR LE COMPTE AUTORISÉ. Cette story livre le CADRE
// vérifiable : le plan de tâches + un GARDE-FOU DUR qui REFUSE toute action d'inscription ou de
// paiement (l'agent ne crée jamais de compte, ne saisit jamais de carte, n'engage jamais de dépense).
//
// ⚠ L'exécution réelle bout-en-bout nécessite des comptes vendor + apps OAuth (input externe) → ici
// l'executor est INJECTÉ (mocké en test) ; le branchement live s'active quand les creds existent.

import { msg, type Message } from "@/lib/engine/message";
import type { Catalog, SlotId } from "@/lib/catalog";

export type ProvisioningTaskStatus = "pending" | "done" | "blocked";

export type ProvisioningTask = {
  slot: SlotId;
  component: string;
  /** Action d'optimisation (descripteur i18n) — configuration sur un compte DÉJÀ créé par l'utilisateur. */
  action: Message;
  status: ProvisioningTaskStatus;
};

export type ProvisioningPlan = {
  tasks: ProvisioningTask[];
  /** Rappel du garde-fou human-in-the-loop (descripteur i18n). */
  guardrail: Message;
};

const SLOT_ORDER: SlotId[] = ["c0", "c1", "c2", "c3", "c4", "c5", "c6"];

/**
 * Dérive le plan d'optimisation à partir du catalogue retenu. Pure. Une tâche de configuration par
 * composant (sur le compte autorisé par l'utilisateur) ; le garde-fou rappelle l'invariant F10.
 */
export function deriveProvisioningPlan(catalog: Catalog): ProvisioningPlan {
  const tasks = SLOT_ORDER.map((slot): ProvisioningTask => {
    const c = catalog.slots[slot].recommended;
    return { slot, component: c.name, action: msg("provisioning.task.optimize", { component: c.name }), status: "pending" };
  });
  return { tasks, guardrail: msg("provisioning.guardrail") };
}

// ── Garde-fou DUR d'exécution ───────────────────────────────────────────────────────────────────
// L'agent ne peut JAMAIS créer de compte, saisir une carte, ni engager une dépense. Ces actions sont
// interdites par construction — le harnais d'exécution les refuse AVANT tout appel MCP/OAuth.

export type AgentActionType =
  | "configure" // modifier une configuration sur un compte autorisé (permis)
  | "read" // lire un état (permis)
  | "create-account" // INTERDIT
  | "enter-card" // INTERDIT
  | "financial-commitment"; // INTERDIT

export type AgentAction = { type: AgentActionType; target: string };

/** Actions strictement interdites à l'agent (F10, invariant non négociable, AGENTS.md §9). */
export const FORBIDDEN_AGENT_ACTIONS: ReadonlySet<AgentActionType> = new Set<AgentActionType>([
  "create-account",
  "enter-card",
  "financial-commitment",
]);

/** `true` si l'action est autorisée (ni inscription, ni carte, ni engagement financier). Pur, total. */
export function isAllowedAgentAction(action: AgentAction): boolean {
  return !FORBIDDEN_AGENT_ACTIONS.has(action.type);
}

export type AgentActionResult = { ok: true } | { ok: false; reason: "forbidden" | "executor-error" };

/** Exécuteur injecté (MCP/OAuth réel, ou mock de test). Jamais appelé si l'action est interdite. */
export type ProvisioningExecutor = (action: AgentAction) => Promise<void>;

/**
 * Exécute une action de provisioning EN PASSANT D'ABORD PAR LE GARDE-FOU : toute action interdite est
 * rejetée AVANT d'atteindre l'exécuteur (l'agent ne crée jamais de compte / ne saisit jamais de carte).
 * Ne lève jamais : une erreur d'exécuteur est capturée. Pur quant au contrôle (effets via l'executor).
 */
export async function runAgentAction(action: AgentAction, execute: ProvisioningExecutor): Promise<AgentActionResult> {
  if (!isAllowedAgentAction(action)) return { ok: false, reason: "forbidden" };
  try {
    await execute(action);
    return { ok: true };
  } catch {
    return { ok: false, reason: "executor-error" };
  }
}
