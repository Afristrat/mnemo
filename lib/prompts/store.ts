// Store des prompts versionnés (S-053) — SERVEUR UNIQUEMENT (lit/écrit via service-role).
//
// `loadActivePrompt` : lu par les routes publiques (intake/narration/veille) pour greffer le prompt
// actif ; repli `null` si store vide/indisponible → l'appelant retombe sur le gabarit par défaut.
// `listPromptVersions` / `activateNewVersion` : pilotent la console admin (après contrôle super-admin
// côté route). Client injectable (tests). Aucune exception ne remonte : repli prudent partout.

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/types";
import type { PromptKey } from "./registry";

type Client = SupabaseClient<Database>;

/** Contenu du prompt actif d'une clé, ou `null` (store vide/indispo → repli sur le défaut). */
export async function loadActivePrompt(
  key: PromptKey,
  client: Client | null = createAdminClient(),
): Promise<string | null> {
  if (client === null) return null;
  try {
    const { data, error } = await client
      .from("prompts")
      .select("content")
      .eq("prompt_key", key)
      .eq("is_active", true)
      .maybeSingle();
    if (error !== null || data === null) return null;
    return data.content;
  } catch {
    return null;
  }
}

export type PromptVersion = {
  id: string;
  promptKey: string;
  version: number;
  content: string;
  isActive: boolean;
  createdAt: string;
};

/** Toutes les versions (historique), clé puis version décroissante. Repli `[]`. */
export async function listPromptVersions(client: Client | null = createAdminClient()): Promise<PromptVersion[]> {
  if (client === null) return [];
  try {
    const { data, error } = await client
      .from("prompts")
      .select("id, prompt_key, version, content, is_active, created_at")
      .order("prompt_key", { ascending: true })
      .order("version", { ascending: false });
    if (error !== null || data === null) return [];
    return data.map((r) => ({
      id: r.id,
      promptKey: r.prompt_key,
      version: r.version,
      content: r.content,
      isActive: r.is_active,
      createdAt: r.created_at,
    }));
  } catch {
    return [];
  }
}

export type ActivateResult = { ok: true; version: number } | { ok: false; reason: string };

/**
 * Crée une nouvelle version ACTIVE d'un prompt et désactive l'ancienne (historique conservé). À
 * n'appeler qu'APRÈS contrôle super-admin côté route. `authorId` = auteur du changement (audit).
 */
export async function activateNewVersion(
  key: PromptKey,
  content: string,
  authorId: string,
  client: Client | null = createAdminClient(),
): Promise<ActivateResult> {
  if (client === null) return { ok: false, reason: "store indisponible" };
  if (content.trim() === "") return { ok: false, reason: "contenu vide" };
  try {
    const { data: versions, error: readError } = await client
      .from("prompts")
      .select("version")
      .eq("prompt_key", key)
      .order("version", { ascending: false })
      .limit(1);
    if (readError !== null) return { ok: false, reason: readError.message };
    const nextVersion = (versions?.[0]?.version ?? 0) + 1;

    // Désactiver l'active courante AVANT d'insérer (l'index unique partiel n'autorise qu'une active).
    const { error: deactivateError } = await client
      .from("prompts")
      .update({ is_active: false })
      .eq("prompt_key", key)
      .eq("is_active", true);
    if (deactivateError !== null) return { ok: false, reason: deactivateError.message };

    const { error: insertError } = await client
      .from("prompts")
      .insert({ prompt_key: key, version: nextVersion, content, is_active: true, author: authorId });
    if (insertError !== null) return { ok: false, reason: insertError.message };

    return { ok: true, version: nextVersion };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : "erreur inconnue" };
  }
}
