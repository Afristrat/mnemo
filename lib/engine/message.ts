// Descripteur de message i18n (S-058) — le moteur reste PUR : il ne compose JAMAIS de prose
// ni n'importe d'API intl. Il renvoie un descripteur SÉRIALISABLE { id, values } que la couche
// de présentation résout en chaîne localisée (ICU fr/en via next-intl). `id` référence une clé
// du namespace `Engine` des catalogues messages/{fr,en}.json ; `values` porte les variables
// d'interpolation (nombres pour la pluralisation ICU, chaînes/énum pour les `select`).
//
// Règle : tout champ user-facing des types du moteur (label, why, note, reason…) est de type
// `Message` (et non `string`). Les tests assertent `id` + `values` (plus robustes que de la prose).

// Pas de booléen : les discriminants de `select` ICU sont des chaînes ("yes"/"no", énum…),
// que le moteur émet explicitement ; next-intl n'accepte que string|number en valeurs.
export type MessageValue = string | number;
export type MessageValues = Record<string, MessageValue>;

export type Message = {
  /** Clé ICU sous le namespace `Engine` (ex. "scores.resilience.why"). */
  id: string;
  /** Variables d'interpolation ICU (pluralisation, select, nombres formatés). */
  values?: MessageValues;
};

/** Fabrique concise d'un descripteur de message (omet `values` si vide → égalité de tests stable). */
export function msg(id: string, values?: MessageValues): Message {
  return values && Object.keys(values).length > 0 ? { id, values } : { id };
}

/**
 * Résolveur d'un descripteur en chaîne localisée. Type PUR (pas de dépendance intl) : permet aux
 * fonctions pures non-UI (ex. `buildDeliverable`) d'accepter une fonction de résolution injectée
 * (fournie par l'UI via next-intl, ou un stub dans les tests). Le moteur ne le consomme jamais lui-même.
 */
export type EngineResolver = (message: Message) => string;
