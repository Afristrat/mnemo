import { useTranslations } from "next-intl";
import { useCallback } from "react";
import type { Message } from "@/lib/engine/message";

// Couche de présentation (S-058) : résout les descripteurs de message du moteur (purs,
// { id, values }) en chaînes localisées via le namespace ICU `Engine` des catalogues.
// Le moteur ne dépend JAMAIS de cette couche (sens unique : UI → moteur).

/** Type de la fonction de traduction next-intl (clé + valeurs ICU → chaîne). */
type Translator = (key: string, values?: Record<string, string | number>) => string;

/** Résout un descripteur avec une fonction `t` déjà obtenue (namespace `Engine`). */
export function formatEngineMessage(t: Translator, message: Message): string {
  return t(message.id, message.values);
}

/**
 * Hook de résolution des messages du moteur dans un composant client.
 * Retourne `format(message)` pour une valeur, `format` se mappe sur les listes (compliance, risks…).
 */
export function useEngineText(): (message: Message) => string {
  const t = useTranslations("Engine");
  return useCallback((message: Message) => t(message.id, message.values), [t]);
}
