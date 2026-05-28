import { describe, it, expect } from "vitest";
import { activateNewVersion, listPromptVersions, loadActivePrompt } from "@/lib/prompts/store";

// S-053 : garde-fou de repli. Sans client (store indisponible : clé service-role absente, env de
// test), TOUTES les opérations replient prudemment — l'app retombe sur le gabarit par défaut, et
// l'écriture échoue proprement (aucune exception ne remonte).

describe("store de prompts — repli quand le store est indisponible (client null)", () => {
  it("loadActivePrompt → null (l'appelant utilisera le gabarit par défaut)", async () => {
    expect(await loadActivePrompt("intake", null)).toBeNull();
  });

  it("listPromptVersions → [] (historique vide)", async () => {
    expect(await listPromptVersions(null)).toEqual([]);
  });

  it("activateNewVersion → échec explicite (jamais d'exception)", async () => {
    const r = await activateNewVersion("intake", "nouveau contenu", "user-1", null);
    expect(r.ok).toBe(false);
  });
});
