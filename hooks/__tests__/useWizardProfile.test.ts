import { describe, it, expect, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useWizardProfile } from "@/hooks/useWizardProfile";
import { DEFAULT_PROFILE, STORAGE_KEY } from "@/lib/wizard/defaultProfile";

// S-019 — hydratation localStorage (profil chargé hors composant) + round-trip.

describe("useWizardProfile — hydratation & persistance", () => {
  beforeEach(() => localStorage.clear());

  it("hydrate le profil par défaut quand localStorage est vide", () => {
    const { result } = renderHook(() => useWizardProfile());
    expect(result.current.hydrated).toBe(true);
    expect(result.current.profile.activity).toBe(DEFAULT_PROFILE.activity);
  });

  it("charge un profil pré-écrit dans localStorage (chargé hors composant)", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...DEFAULT_PROFILE, activity: "recherche", sensitivity: "secret" }));
    const { result } = renderHook(() => useWizardProfile());
    expect(result.current.profile.activity).toBe("recherche");
    expect(result.current.profile.sensitivity).toBe("secret");
  });

  it("round-trip : une modification est persistée puis relue par un nouveau montage", () => {
    const first = renderHook(() => useWizardProfile());
    act(() => first.result.current.setField("budget", "gt2k"));
    act(() => first.result.current.setNote("infra", "débit en pic le matin"));

    // Un nouveau montage relit la valeur persistée.
    const second = renderHook(() => useWizardProfile());
    expect(second.result.current.profile.budget).toBe("gt2k");
    expect(second.result.current.profile.freeNotes?.infra).toBe("débit en pic le matin");
  });

  it("persiste la précision « Autre » (S-064) et la relit au montage suivant", () => {
    const first = renderHook(() => useWizardProfile());
    act(() => first.result.current.setOtherText("activity", "Coopérative agricole"));
    act(() => first.result.current.setOtherText("zone", "Suisse"));

    const second = renderHook(() => useWizardProfile());
    expect(second.result.current.profile.otherText?.activity).toBe("Coopérative agricole");
    expect(second.result.current.profile.otherText?.zone).toBe("Suisse");
  });

  it("invariant : un profil neuf n'a aucun otherText (champ optionnel)", () => {
    const { result } = renderHook(() => useWizardProfile());
    expect(result.current.profile.otherText).toBeUndefined();
  });

  describe("toggleRegulation — « Aucun » mutuellement exclusif (S-069)", () => {
    it("cocher « Aucun » vide tous les autres régimes", () => {
      const { result } = renderHook(() => useWizardProfile());
      // Défaut = ["rgpd"] ; on ajoute un 2ᵉ régime concret.
      act(() => result.current.toggleRegulation("aiact"));
      expect(result.current.profile.regulations).toEqual(["rgpd", "aiact"]);
      act(() => result.current.toggleRegulation("none"));
      expect(result.current.profile.regulations).toEqual(["none"]);
    });

    it("cocher un régime concret retire « Aucun »", () => {
      const { result } = renderHook(() => useWizardProfile());
      act(() => result.current.toggleRegulation("none"));
      expect(result.current.profile.regulations).toEqual(["none"]);
      act(() => result.current.toggleRegulation("cndp"));
      expect(result.current.profile.regulations).toEqual(["cndp"]);
    });

    it("re-cliquer « Aucun » le retire (état vide, bloqué par « au moins un »)", () => {
      const { result } = renderHook(() => useWizardProfile());
      act(() => result.current.toggleRegulation("none"));
      act(() => result.current.toggleRegulation("none"));
      expect(result.current.profile.regulations).toEqual([]);
    });
  });

  describe("régimes dynamiques (S-077)", () => {
    it("addRegulations pré-coche sans doublon et retire « Aucun »", () => {
      const { result } = renderHook(() => useWizardProfile());
      act(() => result.current.toggleRegulation("none")); // → ["none"]
      act(() => result.current.addRegulations(["cndp", "rgpd", "rgpd"])); // dédup + retire none
      expect(result.current.profile.regulations).toEqual(["cndp", "rgpd"]);
      // Ré-appliquer n'ajoute pas de doublon ni ne retire les choix manuels.
      act(() => result.current.addRegulations(["cndp"]));
      expect(result.current.profile.regulations).toEqual(["cndp", "rgpd"]);
    });

    it("addRegulations([\"none\"]) est sans effet (jamais destructif)", () => {
      const { result } = renderHook(() => useWizardProfile());
      const before = result.current.profile.regulations;
      act(() => result.current.addRegulations(["none"]));
      expect(result.current.profile.regulations).toEqual(before);
    });

    it("toggleClientResidence ajoute/retire un pays (additif), persisté au montage suivant", () => {
      const first = renderHook(() => useWizardProfile());
      expect(first.result.current.profile.clientResidence).toBeUndefined();
      act(() => first.result.current.toggleClientResidence("bresil"));
      act(() => first.result.current.toggleClientResidence("japon"));
      act(() => first.result.current.toggleClientResidence("bresil")); // retire bresil
      const second = renderHook(() => useWizardProfile());
      expect(second.result.current.profile.clientResidence).toEqual(["japon"]);
    });
  });
});
