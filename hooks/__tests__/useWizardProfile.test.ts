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
});
