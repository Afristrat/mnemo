import { describe, it, expect } from "vitest";
import { decodeProfileFromParam, encodeProfileToParam, profileFromUnknown } from "@/lib/share";
import { DEFAULT_PROFILE } from "@/lib/wizard/defaultProfile";
import type { Profile } from "@/lib/engine";

// Partage stateless (S-067) : encode/decode PURS. Round-trip exact + repli gracieux (null) sur corruption.

const RICH_PROFILE: Profile = {
  ...DEFAULT_PROFILE,
  activity: "cabinet-regule",
  continent: "africa",
  country: "maroc",
  zone: "maroc",
  users: 12,
  contentTypes: ["text", "audio", "video"],
  volume: "100to1000",
  growth: "high",
  regulations: ["rgpd", "cndp", "secret-pro"],
  sensitivity: "secret",
  audit: true,
  bitemporal: true,
  techLevel: "devops",
  budget: "gt2k",
  reqPerDay: "lt10k",
  latency: "fast",
  voices: "many",
  modules: { bisect: 2, reversal: 1, prereg: 0, mel: 1, conflict: 0 },
  mediaNeeds: [
    {
      modality: "video",
      mode: "sovereign",
      ingest: { tier: "medium", volume: 500 },
      generate: { tier: "intensive" },
      backlog: 2000,
    },
  ],
  backup: { criticality: "critical", rpoMinutes: 15, copies: 4, offsite: true, immutable: true, tier: "cold" },
  residency: {
    primaryRegion: "maroc",
    drTier: "hot",
    allowedRegions: ["maroc", "eu"],
    noTransferOutsideJurisdiction: true,
    selfHosted: true,
  },
  freeNotes: { profil: "Cabinet d’avocats, dossiers ultra-sensibles." },
  otherText: { region: "Casablanca uniquement" },
  preferSovereign: true,
};

describe("encode/decode du profil partagé (S-067)", () => {
  it("round-trip : décoder un profil encodé rend exactement le même profil (défaut)", () => {
    const param = encodeProfileToParam(DEFAULT_PROFILE);
    const back = decodeProfileFromParam(param);
    expect(back).toEqual(DEFAULT_PROFILE);
  });

  it("round-trip : profil riche (médias + backup + résidence + notes + préférences) préservé", () => {
    const param = encodeProfileToParam(RICH_PROFILE);
    const back = decodeProfileFromParam(param);
    expect(back).toEqual(RICH_PROFILE);
  });

  it("le paramètre encodé est URL-safe (pas de +, /, =)", () => {
    const param = encodeProfileToParam(RICH_PROFILE);
    expect(param).not.toMatch(/[+/=]/u);
  });

  it("encode UTF-8 (accents) sans perte", () => {
    const profile: Profile = { ...DEFAULT_PROFILE, freeNotes: { profil: "Évaluation à Châteauçà — émoji 🚀" } };
    expect(decodeProfileFromParam(encodeProfileToParam(profile))?.freeNotes?.profil).toBe(
      "Évaluation à Châteauçà — émoji 🚀",
    );
  });

  it("base64 invalide → null (repli gracieux)", () => {
    expect(decodeProfileFromParam("!!!pas-du-base64!!!")).toBeNull();
  });

  it("JSON corrompu (base64 valide d'un non-JSON) → null", () => {
    const param = encodeProfileToParam(DEFAULT_PROFILE).slice(0, 8); // tronqué → JSON cassé
    expect(decodeProfileFromParam(param)).toBeNull();
  });

  it("chaîne vide → null", () => {
    expect(decodeProfileFromParam("")).toBeNull();
  });

  it("objet JSON sans champ discriminant valide → null", () => {
    expect(profileFromUnknown({ activity: "inconnu", zone: "ue" })).toBeNull();
    expect(profileFromUnknown({ foo: "bar" })).toBeNull();
    expect(profileFromUnknown(null)).toBeNull();
    expect(profileFromUnknown(42)).toBeNull();
    expect(profileFromUnknown([1, 2, 3])).toBeNull();
  });

  it("contentTypes/regulations vides → null (un Profile en a toujours au moins un)", () => {
    expect(profileFromUnknown({ ...DEFAULT_PROFILE, contentTypes: [] })).toBeNull();
    expect(profileFromUnknown({ ...DEFAULT_PROFILE, regulations: [] })).toBeNull();
  });

  it("champs inconnus dans contentTypes/regulations filtrés, valides conservés", () => {
    const back = profileFromUnknown({ ...DEFAULT_PROFILE, contentTypes: ["text", "xxx"], regulations: ["rgpd", "yyy"] });
    expect(back?.contentTypes).toEqual(["text"]);
    expect(back?.regulations).toEqual(["rgpd"]);
  });

  it("nested invalide (backup sans criticité) ignoré sans casser le profil", () => {
    const back = profileFromUnknown({ ...DEFAULT_PROFILE, backup: { rpoMinutes: 10 } });
    expect(back).not.toBeNull();
    expect(back?.backup).toBeUndefined();
  });
});
