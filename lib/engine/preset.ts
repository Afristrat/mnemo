import type { Preset, Profile } from "./types";

export type PresetDecision = { preset: Preset; reason: string };

/** Décide le preset (LIGHT/MEDIUM/HARD) à partir du profil. Fonction pure. */
export function decidePreset(p: Profile): PresetDecision {
  const needsHard =
    p.sensitivity === "secret" ||
    p.activity === "cabinet-regule" ||
    p.regulations.includes("hipaa") ||
    p.regulations.includes("secret-pro") ||
    (p.audit === "required" && p.bitemporal === "required");

  const fitsLight =
    !needsHard &&
    (p.sensitivity === "public" || (p.sensitivity === "confidential" && p.users <= 1)) &&
    p.audit !== "required" &&
    p.bitemporal !== "required" &&
    (p.budget === "lt50" || (p.budget === "50to200" && p.users <= 1)) &&
    (p.volume === "lt1" || p.volume === "1to10");

  if (needsHard) {
    return {
      preset: "HARD",
      reason:
        "Données ultra-sensibles ou cabinet régulé avec audit + bitemporel obligatoires → souveraineté maximale, on-prem privilégié, isolation forte.",
    };
  }
  if (fitsLight) {
    return {
      preset: "LIGHT",
      reason:
        "Usage léger, faible volume, sensibilité modérée, audit non obligatoire → stack simplifiée API-first qui démarre en quelques heures.",
    };
  }
  return {
    preset: "MEDIUM",
    reason:
      "Cas le plus fréquent : balance entre souveraineté (hébergement contrôlé) et pragmatisme (cascade API + self-host). Sweet spot freelance / PME / agence.",
  };
}
