import { describe, it, expect } from "vitest";
import { buildChatMessages, serializeRecoFacts, type ChatTurn } from "@/lib/llm/assistant";
import { recommend, type Profile } from "@/lib/engine";
import type { WebSearchResult } from "@/lib/pricing/scraper";

// S-040 : l'assistant ne cite que les FAITS de la reco (chiffres affichés) + résultats web sourcés.

function baseProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    activity: "pme-startup",
    continent: "europe",
    country: "union-europeenne",
    zone: "ue",
    users: 5,
    contentTypes: ["text"],
    volume: "10to100",
    growth: "medium",
    regulations: ["rgpd"],
    sensitivity: "internal",
    audit: false,
    bitemporal: false,
    techLevel: "hybrid",
    budget: "200to500",
    reqPerDay: "lt1k",
    latency: "fast",
    voices: "solo",
    modules: { bisect: 0, reversal: 0, prereg: 0, mel: 0, conflict: 0 },
    ...overrides,
  };
}

const WEB: WebSearchResult[] = [
  { title: "Qdrant — open source vector DB", url: "https://qdrant.tech", snippet: "Base vectorielle Apache-2.0." },
];

describe("serializeRecoFacts", () => {
  it("expose les chiffres autoritatifs affichés (preset, coût total, setup, score, couches)", () => {
    const reco = recommend(baseProfile());
    const facts = serializeRecoFacts(reco, (m) => m.id);
    expect(facts).toContain(`Preset retenu : ${reco.preset}`);
    expect(facts).toContain(`${reco.totalCost} €/mois`);
    expect(facts).toContain(`${reco.setupCost} €`);
    expect(facts).toContain(`${reco.scoreAvg}/10`);
    // Chaque couche de la stack est listée avec son coût.
    for (const layer of reco.layers) expect(facts).toContain(layer.name.id);
  });

  it("greffe les précisions « Autre » comme CONTEXTE quand fournies (S-064)", () => {
    const reco = recommend(baseProfile({ activity: "other", zone: "other" }));
    const facts = serializeRecoFacts(reco, (m) => m.id, { activity: "Coopérative agricole", zone: "Suisse" });
    expect(facts).toContain("Précisions « Autre »");
    expect(facts).toContain("Coopérative agricole");
    expect(facts).toContain("Suisse");
  });

  it("invariant : sans précision « Autre », les FAITS sont strictement inchangés", () => {
    const reco = recommend(baseProfile());
    const without = serializeRecoFacts(reco, (m) => m.id);
    expect(serializeRecoFacts(reco, (m) => m.id, undefined)).toBe(without);
    expect(serializeRecoFacts(reco, (m) => m.id, { activity: "  ", zone: "" })).toBe(without);
    expect(without).not.toContain("Précisions « Autre »");
  });
});

describe("buildChatMessages", () => {
  it("injecte les FAITS + résultats web + règles DÉFCON 1 ; historique puis question en dernier", () => {
    const reco = recommend(baseProfile());
    const facts = serializeRecoFacts(reco, (m) => m.id);
    const history: ChatTurn[] = [
      { role: "user", content: "Bonjour" },
      { role: "assistant", content: "Bonjour, comment puis-je aider ?" },
    ];
    const messages = buildChatMessages("Quel composant pour les embeddings ?", history, facts, WEB);

    expect(messages[0].role).toBe("system");
    expect(messages[0].content).toContain("Invent NO figure");
    expect(messages[0].content).toContain("NEVER invent a URL");
    expect(messages[0].content).toContain(`${reco.totalCost} €/mois`); // FAITS greffés
    expect(messages[0].content).toContain("https://qdrant.tech"); // résultats web greffés
    // Historique threadé, question en dernier.
    expect(messages[1]).toEqual({ role: "user", content: "Bonjour" });
    expect(messages[messages.length - 1]).toEqual({ role: "user", content: "Quel composant pour les embeddings ?" });
  });

  it("sans résultat web → consigne de répondre à partir des seuls FAITS", () => {
    const reco = recommend(baseProfile());
    const messages = buildChatMessages("Une question", [], serializeRecoFacts(reco, (m) => m.id), []);
    expect(messages[0].content).toContain("no web result provided");
  });

  it("utilise un gabarit personnalisé (override admin S-053)", () => {
    const reco = recommend(baseProfile());
    const messages = buildChatMessages("q", [], serializeRecoFacts(reco, (m) => m.id), [], "ADMIN PERSO\n{{recoFacts}}");
    expect(messages[0].content).toContain("ADMIN PERSO");
    expect(messages[0].content).not.toContain("You are Strate's assistant");
  });
});
