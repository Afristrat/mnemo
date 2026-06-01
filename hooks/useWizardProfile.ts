"use client";

import { useCallback, useEffect, useState } from "react";
import type { BlockId, Continent, ContentType, ModuleId, Profile, Regulation } from "@/lib/engine";
import { deriveZone, geographyFromZone } from "@/lib/engine";
import { DEFAULT_PROFILE, STORAGE_KEY } from "@/lib/wizard/defaultProfile";

type UseWizardProfile = {
  profile: Profile;
  hydrated: boolean;
  setField: <K extends keyof Profile>(key: K, value: Profile[K]) => void;
  /** Pose continent + pays + zone DÉRIVÉE de façon cohérente (S-076). */
  setGeography: (continent: Continent, country: string) => void;
  toggleContentType: (value: ContentType) => void;
  toggleRegulation: (value: Regulation) => void;
  /** Ajoute (sans doublon) des régimes pré-détectés (S-077), en retirant « Aucun ». Les cases manuelles restent maîtres. */
  addRegulations: (values: Regulation[]) => void;
  /** Pays de résidence des clients (S-077) : ajoute/retire un code pays (additif, sans cascade moteur). */
  toggleClientResidence: (code: string) => void;
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
        const merged = { ...DEFAULT_PROFILE, ...parsed };
        // Profil legacy (sans continent/pays) → reconstruit la géographie depuis la zone, cohérente.
        const reconciled =
          parsed.country === undefined ? { ...merged, ...geographyFromZone(merged.zone) } : merged;
        setProfile(reconciled);
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

  // Géographie (S-076) : le pays détermine le bucket juridique `zone` (dérivé), jamais saisi à part.
  const setGeography = useCallback((continent: Continent, country: string) => {
    setProfile((prev) => ({ ...prev, continent, country, zone: deriveZone(country) }));
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

  // Pré-cochage des régimes détectés (S-077) : on AJOUTE sans doublon et on retire « Aucun » (exclusif).
  // Jamais destructif des choix manuels existants (l'utilisateur reste maître via les cases).
  const addRegulations = useCallback((values: Regulation[]) => {
    const real = values.filter((v) => v !== "none");
    if (real.length === 0) return;
    setProfile((prev) => {
      const merged = [...prev.regulations.filter((v) => v !== "none")];
      for (const v of real) if (!merged.includes(v)) merged.push(v);
      return { ...prev, regulations: merged };
    });
  }, []);

  const toggleClientResidence = useCallback((code: string) => {
    setProfile((prev) => {
      const current = prev.clientResidence ?? [];
      const next = current.includes(code) ? current.filter((c) => c !== code) : [...current, code];
      return { ...prev, clientResidence: next };
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
    setGeography,
    toggleContentType,
    toggleRegulation,
    addRegulations,
    toggleClientResidence,
    setModuleLevel,
    setNote,
    setOtherText,
    loadProfile,
  };
}
