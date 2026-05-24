import type { EngineModule, ModuleId } from "./types";

// Modules avancés (sliders d'intensité). Variables d'entrée du configurateur :
// ils ajustent coût + scoring + plan d'action, sans que la plateforme implémente
// ces features de la base mémorielle du client (cf. PRD §5, angle mort A5).
export const MODULES: readonly EngineModule[] = [
  {
    id: "bisect",
    name: "Bisect épistémique",
    why: "Recherche binaire dans l'historique tri-temporel : « à partir de quand ma doctrine sur X a-t-elle changé ? ». Outil de méta-réflexion épistémique.",
    layers: "C5 + UI",
    effort: "M",
    costFull: 10,
    maxLevel: 3,
    bonusFull: { audit: 1, adapt: 1 },
    levels: [
      { label: "Désactivé", desc: "Pas de bisect. Recherche temporelle classique." },
      { label: "Manuel", desc: "UI bisect : navigation chronologique manuelle dans l'historique tri-temporel." },
      { label: "Assisté IA", desc: "L'agent propose les pivots candidats, tu valides à chaque étape." },
      { label: "Automatique", desc: "L'agent fait le bisect de bout en bout, te livre directement l'atome pivot." },
    ],
    baseTask:
      "Implémenter l'opération bisect dans la couche C5 : sélectionner deux atomes (good/bad) sur un même concept, le système propose les atomes pivots à examiner par dichotomie.",
  },
  {
    id: "reversal",
    name: "Reversal entries (intégrité par construction)",
    why: "Jamais d'UPDATE in-place : pour corriger un atome, on crée un atome `reversal` qui inverse explicitement + un atome corrigé. Intégrité garantie par construction, pas par contrôle.",
    layers: "C0 + C5 + C2",
    effort: "S",
    costFull: 5,
    maxLevel: 3,
    bonusFull: { audit: 2 },
    levels: [
      { label: "Désactivé", desc: "UPDATE in-place classique." },
      { label: "Logique", desc: "Type `reversal` au frontmatter, sans signature crypto. Append-only par convention." },
      { label: "Signé HMAC", desc: "Type `reversal` + signature HMAC sur (atome_original_id, hash_contenu, timestamp). Append-only garanti." },
      { label: "Ledger chaîné", desc: "HMAC + hash chaîné de tous les atomes (style blockchain). Intégrité totale du grand-livre." },
    ],
    baseTask:
      "Ajouter le type `reversal` au frontmatter + signature crypto sur l'atome de reversal + filtre par défaut dans l'orchestrateur.",
  },
  {
    id: "prereg",
    name: "Pre-registration horodatée",
    why: "Annoncer hypothèse + critère de succès AVANT décision. Le postmortem référence obligatoirement le pre-reg. Anti-confirmation-bias structurel.",
    layers: "C0 + C2",
    effort: "S",
    costFull: 0,
    maxLevel: 3,
    bonusFull: { stress: 1, conf: 1 },
    levels: [
      { label: "Désactivé", desc: "Pas de pre-registration." },
      { label: "Soft", desc: "Pre-reg optionnel, juste recommandé dans la doc." },
      { label: "Lié", desc: "Postmortem peut référencer un pre-reg parent (non bloquant)." },
      { label: "Hard", desc: "Pre-reg obligatoire bloquant avant toute décision structurante. Postmortem doit le résoudre." },
    ],
    baseTask: "Ajouter type `pre_reg` au schéma + workflow décision → postmortem qui le référence.",
  },
  {
    id: "mel",
    name: "MEL — Minimum Equipment List & dégradation",
    why: "Doctrine pré-pensée : « ce qui peut être en panne et l'agent fonctionne quand même, avec délai de réparation et procédure alternative ». Pas improvisé en incident.",
    layers: "C6 + runbook + monitoring",
    effort: "M",
    costFull: 30,
    maxLevel: 4,
    bonusFull: { sov: 1, conf: 1 },
    levels: [
      { label: "Désactivé", desc: "Runbook minimal. Improvisation en incident." },
      { label: "Draft", desc: "MEL rédigée sur composants critiques uniquement." },
      { label: "Testée", desc: "MEL + tests de dégradation 1× par composant (vérifie que le mode dégradé fonctionne)." },
      { label: "Monitorée", desc: "MEL + tests + monitoring auto qui détecte la panne et bascule en dégradé." },
      { label: "Certifiée", desc: "MEL + tests réguliers + audit trail + revue annuelle de la matrice." },
    ],
    baseTask: "Rédiger la MEL : matrice composants × types panne × délai max × procédure alternative.",
  },
  {
    id: "conflict",
    name: "Conflict checking automatique",
    why: "Avant qu'un atome touche un client/projet/entité, cross-référence automatique : « cette entité est-elle adversaire / concurrente / cible d'une autre décision ? ». Empêche conseil contradictoire.",
    layers: "C0 + C2 + C5",
    effort: "M",
    costFull: 50,
    maxLevel: 4,
    bonusFull: { conf: 2, adapt: 1 },
    levels: [
      { label: "Désactivé", desc: "Aucun check de conflit." },
      { label: "NER simple", desc: "Extraction d'entités nommées (spaCy / Gliner). Alerte sur match exact." },
      { label: "NER + graphe", desc: "Graphe d'entités + détection match fuzzy (variantes orthographiques, alias)." },
      { label: "+ temporel", desc: "Check sur axe bitemporel : « cette entité a-t-elle été dans un contexte différent avant ? »" },
      { label: "+ cross-circle", desc: "Check entre tous les circles (multi-tenancy actif). Alerte cross-clients." },
    ],
    baseTask:
      "NER (spaCy ou Gliner local) sur l'ingestion + index entités + check pre-query orchestrateur.",
  },
];

/** Niveaux par défaut (tout au max, comme le simulateur v2). */
export function defaultModuleLevels(): Record<ModuleId, number> {
  return { bisect: 3, reversal: 3, prereg: 3, mel: 4, conflict: 4 };
}
