import { msg, type EngineResolver, type Message } from "./message";
import type { ActiveModule, EngineModule, ModuleId } from "./types";

// Modules avancés (sliders d'intensité). Variables d'entrée du configurateur :
// ils ajustent coût + scoring + plan d'action, sans que la plateforme implémente
// ces features de la base mémorielle du client (cf. PRD §5, angle mort A5).
//
// i18n (S-058, reliquat moteur) : toute la prose (nom, justification, libellés/descriptions de
// niveau, tâche de base) est un descripteur `Message` référençant `Engine.modules.<id>.*` des
// catalogues fr/en. Le moteur ne porte plus de chaîne user-facing. `layers`/`effort` = codes
// techniques (non localisés). Les `levels` portent `{ label, desc }` sous `Engine.modules.<id>.level.<n>`.
const lvl = (id: ModuleId, n: number): { label: Message; desc: Message } => ({
  label: msg(`modules.${id}.level.${n}.label`),
  desc: msg(`modules.${id}.level.${n}.desc`),
});

export const MODULES: readonly EngineModule[] = [
  {
    id: "bisect",
    name: msg("modules.bisect.name"),
    why: msg("modules.bisect.why"),
    layers: "C5 + UI",
    effort: "M",
    costFull: 10,
    maxLevel: 3,
    bonusFull: { audit: 1, adapt: 1 },
    levels: [lvl("bisect", 0), lvl("bisect", 1), lvl("bisect", 2), lvl("bisect", 3)],
    baseTask: msg("modules.bisect.baseTask"),
  },
  {
    id: "reversal",
    name: msg("modules.reversal.name"),
    why: msg("modules.reversal.why"),
    layers: "C0 + C5 + C2",
    effort: "S",
    costFull: 5,
    maxLevel: 3,
    bonusFull: { audit: 2 },
    levels: [lvl("reversal", 0), lvl("reversal", 1), lvl("reversal", 2), lvl("reversal", 3)],
    baseTask: msg("modules.reversal.baseTask"),
  },
  {
    id: "prereg",
    name: msg("modules.prereg.name"),
    why: msg("modules.prereg.why"),
    layers: "C0 + C2",
    effort: "S",
    costFull: 0,
    maxLevel: 3,
    bonusFull: { stress: 1, conf: 1 },
    levels: [lvl("prereg", 0), lvl("prereg", 1), lvl("prereg", 2), lvl("prereg", 3)],
    baseTask: msg("modules.prereg.baseTask"),
  },
  {
    id: "mel",
    name: msg("modules.mel.name"),
    why: msg("modules.mel.why"),
    layers: "C6 + runbook + monitoring",
    effort: "M",
    costFull: 30,
    maxLevel: 4,
    bonusFull: { sov: 1, conf: 1 },
    levels: [lvl("mel", 0), lvl("mel", 1), lvl("mel", 2), lvl("mel", 3), lvl("mel", 4)],
    baseTask: msg("modules.mel.baseTask"),
  },
  {
    id: "conflict",
    name: msg("modules.conflict.name"),
    why: msg("modules.conflict.why"),
    layers: "C0 + C2 + C5",
    effort: "M",
    costFull: 50,
    maxLevel: 4,
    bonusFull: { conf: 2, adapt: 1 },
    levels: [lvl("conflict", 0), lvl("conflict", 1), lvl("conflict", 2), lvl("conflict", 3), lvl("conflict", 4)],
    baseTask: msg("modules.conflict.baseTask"),
  },
];

/** Niveaux par défaut (tout au max, comme le simulateur v2). */
export function defaultModuleLevels(): Record<ModuleId, number> {
  return { bisect: 3, reversal: 3, prereg: 3, mel: 4, conflict: 4 };
}

/**
 * Compose le plan d'action d'un module actif en chaîne localisée (S-058). Pure : prend un résolveur
 * injecté (UI via next-intl, ou stub de test). Résout `baseTask` + le libellé/la description du niveau
 * actif, puis remplit le gabarit `Engine.modules.taskTemplate`. Modèle jumeau de `formatPresetReason` :
 * le moteur n'assemble JAMAIS la phrase, il fournit seulement les parties.
 */
export function formatModuleTask(
  active: Pick<ActiveModule, "level" | "maxLevel" | "levelLabel" | "levelDesc" | "baseTask">,
  resolve: EngineResolver,
): string {
  return resolve({
    id: "modules.taskTemplate",
    values: {
      level: active.level,
      maxLevel: active.maxLevel,
      label: resolve(active.levelLabel),
      baseTask: resolve(active.baseTask),
      desc: resolve(active.levelDesc),
    },
  });
}
