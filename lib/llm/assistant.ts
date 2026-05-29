// Assistant Q&A contextuel (S-040). Module PUR (aucun I/O) ; la route `app/api/llm/chat` orchestre la
// recherche web (Firecrawl) + l'appel LLM.
//
// GARANTIE DÉFCON 1 (et sa limite honnête) : un chat en texte libre ne peut pas être prouvé
// mathématiquement « sans chiffre inventé ». La garantie est obtenue par CONSTRUCTION du contexte :
// (1) on injecte les FAITS autoritatifs = exactement les montants/scores AFFICHÉS à l'utilisateur
// (issus de sa recommandation déterministe) comme seuls chiffres autorisés ; (2) toute info hors reco
// doit s'appuyer sur des RÉSULTATS WEB fournis, avec URL citée (jamais inventée) ; (3) disclaimer IA
// visible. Le prompt est éditable par le super-admin (S-053) ; les FAITS/web sont greffés par le code.

import type { EngineResolver, Recommendation } from "@/lib/engine";
import type { WebSearchResult } from "@/lib/pricing/firecrawl";
import { composePrompt, DEFAULT_PROMPTS } from "@/lib/prompts/registry";
import type { LlmMessage } from "./types";

/** Un tour de conversation (côté utilisateur ou assistant). */
export type ChatTurn = { role: "user" | "assistant"; content: string };

/**
 * Bloc de FAITS autoritatifs = les chiffres EXACTEMENT affichés à l'utilisateur (sa recommandation).
 * Ce sont les SEULS montants/scores que l'assistant a le droit de citer. Pur, déterministe.
 */
export function serializeRecoFacts(reco: Recommendation, resolve: EngineResolver): string {
  const layers = reco.layers.map((l) => `  - ${resolve(l.name)} : ${l.choice} (${l.cost} €/mois)`).join("\n");
  return [
    `Preset retenu : ${reco.preset}`,
    `Coût d'infrastructure total : ${reco.totalCost} €/mois (±30 %, payé aux fournisseurs)`,
    `Mise en route (une fois) : ${reco.setupCost} €`,
    `Coût variable estimé : ${reco.verdict.variableCostBand.low}–${reco.verdict.variableCostBand.high} €/mois`,
    `Mise en route estimée : ${reco.verdict.setupCostBand.low}–${reco.verdict.setupCostBand.high} €`,
    `Prix du service Strate : ${reco.verdict.firmPriceTier}`,
    `Score moyen : ${reco.scoreAvg}/10`,
    "Couches de la stack recommandée :",
    layers,
  ].join("\n");
}

function formatWebResults(results: WebSearchResult[]): string {
  if (results.length === 0) return "(aucun résultat web fourni — réponds alors uniquement à partir des FAITS)";
  return results.map((r, i) => `[${i + 1}] ${r.title} — ${r.url}\n${r.snippet}`).join("\n");
}

/**
 * Compose les messages du chat : prompt système (gabarit éditable, défaut = registre) avec les FAITS
 * autoritatifs et les résultats web greffés par le CODE, puis l'historique, puis la question. Pure.
 */
export function buildChatMessages(
  question: string,
  history: ChatTurn[],
  recoFacts: string,
  webResults: WebSearchResult[],
  template: string = DEFAULT_PROMPTS.assistant,
): LlmMessage[] {
  const system = composePrompt(template, { recoFacts, webResults: formatWebResults(webResults) });
  const past: LlmMessage[] = history.map((t) => ({ role: t.role, content: t.content }));
  return [{ role: "system", content: system }, ...past, { role: "user", content: question }];
}
