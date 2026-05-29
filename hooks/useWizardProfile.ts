"use client";

import { useCallback, useEffect, useState } from "react";
import type { BlockId, ContentType, ModuleId, Profile, Regulation } from "@/lib/engine";
import { DEFAULT_PROFILE, STORAGE_KEY } from "@/lib/wizard/defaultProfile";

type UseWizardProfile = {
  profile: Profile;
  hydrated: boolean;
  setField: <K extends keyof Profile>(key: K, value: Profile[K]) => void;
  toggleContentType: (value: ContentType) => void;
  toggleRegulation: (value: Regulation) => void;
  setModuleLevel: (id: ModuleId, level: number) => void;
  setNote: (block: BlockId, value: string) => void;
  setOtherText: (field: "activity" | "zone" | "region", value: string) => void;
  loadProfile: (next: Profile) => void;
};

/** État du profil du wizard, persisté dans localStorage (reprise entre sessions). */
export function useWizardProfile(): UseWizardProfile {
  const [profile, setProfile] = useState<Profile>(DEFAULT_PROFILE);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved !== null) {
        const parsed: Partial<Profile> = JSON.parse(saved);
        setProfile({ ...DEFAULT_PROFILE, ...parsed });
      }
    } catch {
      /* localStorage indisponible ou JSON corrompu : on garde le profil par défaut. */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    } catch {
      /* quota dépassé ou stockage bloqué : sans effet sur la session courante. */
    }
  }, [profile, hydrated]);

  const setField = useCallback(<K extends keyof Profile>(key: K, value: Profile[K]) => {
    setProfile((prev) => ({ ...prev, [key]: value }));
  }, []);

  const toggleContentType = useCallback((value: ContentType) => {
    setProfile((prev) => ({
      ...prev,
      contentTypes: prev.contentTypes.includes(value)
        ? prev.contentTypes.filter((v) => v !== value)
        : [...prev.contentTypes, value],
    }));
  }, []);

  const toggleRegulation = useCallback((value: Regulation) => {
    setProfile((prev) => {
      const has = prev.regulations.includes(value);
      // « Aucun » est MUTUELLEMENT EXCLUSIF : le cocher vide tout le reste ; cocher un régime
      // concret retire « Aucun ». On ne peut pas avoir « Aucun » ET un régime en même temps.
      if (value === "none") {
        return { ...prev, regulations: has ? [] : ["none"] };
      }
      const regulations = has
        ? prev.regulations.filter((v) => v !== value)
        : [...prev.regulations.filter((v) => v !== "none"), value];
      return { ...prev, regulations };
    });
  }, []);

  const setModuleLevel = useCallback((id: ModuleId, level: number) => {
    setProfile((prev) => ({ ...prev, modules: { ...prev.modules, [id]: level } }));
  }, []);

  const setNote = useCallback((block: BlockId, value: string) => {
    setProfile((prev) => ({ ...prev, freeNotes: { ...prev.freeNotes, [block]: value } }));
  }, []);

  const setOtherText = useCallback((field: "activity" | "zone" | "region", value: string) => {
    setProfile((prev) => ({ ...prev, otherText: { ...prev.otherText, [field]: value } }));
  }, []);

  const loadProfile = useCallback((next: Profile) => setProfile(next), []);

  return {
    profile,
    hydrated,
    setField,
    toggleContentType,
    toggleRegulation,
    setModuleLevel,
    setNote,
    setOtherText,
    loadProfile,
  };
}
