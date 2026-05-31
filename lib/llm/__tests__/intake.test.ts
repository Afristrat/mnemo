import { describe, it, expect } from "vitest";
import { applyIntakeFields, buildIntakeMessages, coerceProfile, parseIntakeProfile, type IntakeResult } from "@/lib/llm/intake";
import { DEFAULT_PROFILE } from "@/lib/wizard/defaultProfile";
import type { Profile } from "@/lib/engine";

describe("buildIntakeMessages", () => {
  it("compose un prompt système (valeurs énumérées, interdiction d'inventer) + le texte utilisateur", () => {
    const messages = buildIntakeMessages("cabinet d'avocats, 10 personnes, données secrètes");
    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe("system");
    expect(messages[0].content).toContain("INVENT NOTHING");
    expect(messages[0].content).toContain("cabinet-regule"); // valeurs autorisées listées
    expect(messages[0].content).toContain("NO cost");
    expect(messages[0].content).not.toContain("CURRENT PROFILE"); // pas de base → pas de contexte d'ajustement
    expect(messages[1]).toEqual({ role: "user", content: "cabinet d'avocats, 10 personnes, données secrètes" });
  });

  it("avec une base (note libre S-052) : injecte le profil actuel + la consigne d'AJUSTEMENT des listes", () => {
    const base: Profile = { ...DEFAULT_PROFILE, activity: "agence", contentTypes: ["text"] };
    const messages = buildIntakeMessages("on ajoute de la vidéo", base);
    expect(messages[0].content).toContain("CURRENT PROFILE");
    expect(messages[0].content).toContain("agence"); // valeur du profil actuel injectée
    expect(messages[0].content).toContain("KEEP the values already present"); // merge listes
  });
});

describe("coerceProfile (borne une base reçue, S-052)", () => {
  it("ne conserve que les champs d'intake valides, par-dessus le profil par défaut", () => {
    const out = coerceProfile({ sensitivity: "secret", users: 5, sensitivityBogus: "x" });
    expect(out.sensitivity).toBe("secret");
    expect(out.users).toBe(5);
    expect(out.zone).toBe(DEFAULT_PROFILE.zone); // absent → défaut
  });

  it("valeur hors-bornes → défaut ; non-objet → profil par défaut intégral", () => {
    expect(coerceProfile({ sensitivity: "ultra-secret" }).sensitivity).toBe(DEFAULT_PROFILE.sensitivity);
    expect(coerceProfile("pas un objet")).toEqual(DEFAULT_PROFILE);
    expect(coerceProfile(null)).toEqual(DEFAULT_PROFILE);
  });
});

describe("applyIntakeFields (overlay des seuls champs appliqués, S-052)", () => {
  it("n'écrase QUE les champs appliqués ; champs structurés et non mentionnés préservés ; champ inconnu ignoré", () => {
    const current: Profile = {
      ...DEFAULT_PROFILE,
      activity: "freelance",
      sensitivity: "internal",
      contentTypes: ["text"],
      modules: { ...DEFAULT_PROFILE.modules },
      freeNotes: { medias: "garder la vidéo" },
    };
    const result: IntakeResult = {
      profile: { ...DEFAULT_PROFILE, activity: "agence", sensitivity: "secret", contentTypes: ["text", "audio"] },
      applied: ["sensitivity", "contentTypes", "json"], // "json" = nom inconnu → ignoré sans throw
      rejected: [],
    };
    const next = applyIntakeFields(current, result);
    expect(next.sensitivity).toBe("secret"); // appliqué
    expect(next.contentTypes).toEqual(["text", "audio"]); // appliqué (liste déjà fusionnée côté LLM)
    expect(next.activity).toBe("freelance"); // NON appliqué → préservé (≠ result.profile.activity)
    expect(next.modules).toEqual(current.modules); // structuré → préservé
    expect(next.freeNotes).toEqual(current.freeNotes); // structuré → préservé
  });

  it("applied vide (repli) → profil courant inchangé", () => {
    const current: Profile = { ...DEFAULT_PROFILE, sensitivity: "internal" };
    const next = applyIntakeFields(current, { profile: DEFAULT_PROFILE, applied: [], rejected: ["llm"] });
    expect(next).toEqual(current);
  });
});

describe("parseIntakeProfile", () => {
  it("applique les champs valides extraits par le LLM", () => {
    const json = JSON.stringify({
      activity: "cabinet-regule",
      continent: "europe",
      country: "union-europeenne",
      zone: "ue",
      users: 12,
      sensitivity: "secret",
      regulations: ["rgpd", "secret-pro"],
      audit: true,
    });
    const { profile, applied, rejected } = parseIntakeProfile(json);
    expect(profile.activity).toBe("cabinet-regule");
    expect(profile.users).toBe(12);
    expect(profile.sensitivity).toBe("secret");
    expect(profile.regulations).toEqual(["rgpd", "secret-pro"]);
    expect(profile.audit).toBe(true);
    expect(applied).toEqual(expect.arrayContaining(["activity", "zone", "users", "sensitivity", "regulations", "audit"]));
    expect(rejected).toHaveLength(0);
  });

  it("REJETTE les valeurs hors-bornes/inconnues et conserve le défaut (DÉFCON 1, jamais d'invention)", () => {
    const json = JSON.stringify({
      sensitivity: "ultra-secret", // hors union
      budget: "1 million", // hors union
      users: -5, // invalide
      zone: "lune", // hors union
    });
    const { profile, applied, rejected } = parseIntakeProfile(json);
    expect(profile.sensitivity).toBe(DEFAULT_PROFILE.sensitivity);
    expect(profile.budget).toBe(DEFAULT_PROFILE.budget);
    expect(profile.users).toBe(DEFAULT_PROFILE.users);
    expect(profile.zone).toBe(DEFAULT_PROFILE.zone);
    expect(applied).toHaveLength(0);
    expect(rejected).toEqual(expect.arrayContaining(["sensitivity", "budget", "users", "zone"]));
  });

  it("tolère un JSON encadré de ```json … ``` et du texte autour", () => {
    const content = "Voici le profil extrait :\n```json\n{ \"volume\": \"100to1000\", \"growth\": \"high\" }\n```\nVoilà.";
    const { profile, applied } = parseIntakeProfile(content);
    expect(profile.volume).toBe("100to1000");
    expect(profile.growth).toBe("high");
    expect(applied).toEqual(expect.arrayContaining(["volume", "growth"]));
  });

  it("filtre les membres invalides d'un tableau ; tableau entièrement invalide → rejeté (défaut conservé)", () => {
    const ok = parseIntakeProfile(JSON.stringify({ contentTypes: ["text", "hologramme", "audio"] }));
    expect(ok.profile.contentTypes).toEqual(["text", "audio"]);
    const ko = parseIntakeProfile(JSON.stringify({ contentTypes: ["hologramme", "odeur"] }));
    expect(ko.profile.contentTypes).toEqual(DEFAULT_PROFILE.contentTypes);
    expect(ko.rejected).toContain("contentTypes");
  });

  it("borne le nombre d'utilisateurs (arrondi + plafond)", () => {
    expect(parseIntakeProfile(JSON.stringify({ users: 7.8 })).profile.users).toBe(8);
    expect(parseIntakeProfile(JSON.stringify({ users: 999999999 })).profile.users).toBe(100_000);
  });

  it("JSON illisible → profil de base inchangé, rejet « json »", () => {
    const { profile, applied, rejected } = parseIntakeProfile("désolé, je n'ai pas compris");
    expect(profile).toEqual(DEFAULT_PROFILE);
    expect(applied).toHaveLength(0);
    expect(rejected).toEqual(["json"]);
  });
});
