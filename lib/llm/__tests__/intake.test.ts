import { describe, it, expect } from "vitest";
import { buildIntakeMessages, parseIntakeProfile } from "@/lib/llm/intake";
import { DEFAULT_PROFILE } from "@/lib/wizard/defaultProfile";

describe("buildIntakeMessages", () => {
  it("compose un prompt système (valeurs énumérées, interdiction d'inventer) + le texte utilisateur", () => {
    const messages = buildIntakeMessages("cabinet d'avocats, 10 personnes, données secrètes");
    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe("system");
    expect(messages[0].content).toContain("N'INVENTE RIEN");
    expect(messages[0].content).toContain("cabinet-regule"); // valeurs autorisées listées
    expect(messages[0].content).toContain("AUCUN coût");
    expect(messages[1]).toEqual({ role: "user", content: "cabinet d'avocats, 10 personnes, données secrètes" });
  });
});

describe("parseIntakeProfile", () => {
  it("applique les champs valides extraits par le LLM", () => {
    const json = JSON.stringify({
      activity: "cabinet-regule",
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
