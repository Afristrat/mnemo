import { describe, it, expect } from "vitest";
import { buildLayers } from "@/lib/engine/layers";
import type { Profile } from "@/lib/engine/types";
import { reconcileCatalog, seedCatalog } from "@/lib/catalog";
import type { ComponentCandidate } from "@/lib/catalog/types";

function prof(overrides: Partial<Profile> = {}): Profile {
  return {
    activity: "freelance",
    zone: "ue",
    users: 1,
    contentTypes: ["text"],
    volume: "1to10",
    growth: "medium",
    regulations: ["rgpd"],
    sensitivity: "internal",
    audit: false,
    bitemporal: false,
    techLevel: "hybrid",
    budget: "50to200",
    reqPerDay: "lt100",
    latency: "fast",
    voices: "solo",
    modules: { bisect: 0, reversal: 0, prereg: 0, mel: 0, conflict: 0 },
    ...overrides,
  };
}

describe("seedCatalog", () => {
  it("expose les 7 slots c0..c6 pour chaque preset", () => {
    for (const preset of ["LIGHT", "MEDIUM", "HARD"] as const) {
      const cat = seedCatalog(preset, prof());
      expect(Object.keys(cat.slots).sort()).toEqual(["c0", "c1", "c2", "c3", "c4", "c5", "c6"]);
      expect(cat.source).toBe("seed");
    }
  });

  it("chaque candidat recommandé porte un nom + une source (DÉFCON 1) + provenance seed", () => {
    const cat = seedCatalog("MEDIUM", prof());
    for (const slot of Object.values(cat.slots)) {
      expect(slot.recommended.name.length).toBeGreaterThan(0);
      expect(slot.recommended.source.url.length).toBeGreaterThan(0);
      expect(slot.recommended.provenance).toBe("seed");
    }
  });
});

describe("buildLayers via catalogue — identité avec l'historique (caractérisation)", () => {
  it("LIGHT, texte seul, non bitemporel", () => {
    const layers = buildLayers("LIGHT", prof());
    expect(layers).toHaveLength(7);
    expect(layers[1].choice).toBe("Claude Desktop (abonnement Pro 20$/mois)");
    expect(layers[1].alternatives).toBe(
      "UI custom React (effort dev), ChatGPT (non recommandé : pas de MCP)",
    );
    expect(layers[4].name).toBe("Embeddings");
    expect(layers[4].choice).toBe("Mistral embed API");
    expect(layers[5].name).toBe("Stockage polyglotte");
    expect(layers[5].choice).toBe("Postgres 16 + pgvector (Supabase free tier)");
    expect(layers[6].choice).toBe(
      "Mistral La Plateforme (API directe) + Scaleway FR (VPS €10) + Restic vers Backblaze B2",
    );
  });

  it("MEDIUM, multimodal + bitemporel", () => {
    const layers = buildLayers("MEDIUM", prof({ contentTypes: ["text", "audio"], bitemporal: true }));
    expect(layers[4].name).toBe("Embeddings multimodaux");
    expect(layers[4].choice).toBe("LCO-Embedding-Omni-7B local (GPU)");
    expect(layers[5].name).toBe("Stockage polyglotte bitemporel");
    expect(layers[5].choice).toBe("Postgres + Apache AGE (option Amine ADR-011) OU Graphiti+Neo4j");
    expect(layers[2].note).toBe("T1 = Mistral Small, T2 = Claude Sonnet sur escalade");
  });

  it("HARD, multimodal", () => {
    const layers = buildLayers("HARD", prof({ contentTypes: ["text", "video"], sensitivity: "secret" }));
    expect(layers[1].choice).toBe("Claude Desktop + Anthropic Workbench (audit)");
    expect(layers[4].choice).toBe("Qwen3-Embed-7B + Whisper large-v3 (audio)");
    expect(layers[6].choice).toBe(
      "vLLM on-prem (Qwen3-30B) + escalade Sonnet sources publiques + on-prem Hetzner dedicated + LUKS/Tang/Clevis",
    );
  });

  it("le coût des couches reste celui de l'historique (le catalogue ne porte pas les coûts)", () => {
    const light = buildLayers("LIGHT", prof());
    expect(light[1].cost).toBe(20);
    expect(light[6].cost).toBe(30);
    const hard = buildLayers("HARD", prof({ contentTypes: ["text", "video"] }));
    expect(hard[4].cost).toBe(200);
    expect(hard[6].cost).toBe(400);
  });
});

describe("reconcileCatalog (garde-fou)", () => {
  const seed: ComponentCandidate = {
    name: "BGE-M3 local (Ollama)",
    role: "embeddings",
    sovereignty: "sovereign",
    source: { label: "seed", url: "https://github.com/Afristrat/mnemo", checkedAt: "2026-05-27" },
    confidence: "medium",
    provenance: "seed",
  };
  const live: ComponentCandidate = {
    name: "Qwen3-Embed-8B",
    role: "embeddings",
    sovereignty: "sovereign",
    source: { label: "HF", url: "https://huggingface.co/Qwen", checkedAt: "2026-05-27" },
    confidence: "high",
    provenance: "live",
    benchmarkRank: "#1 MTEB",
  };

  it("promeut un candidat live valide", () => {
    const r = reconcileCatalog(live, seed, prof());
    expect(r.provenance).toBe("live");
    expect(r.name).toBe("Qwen3-Embed-8B");
  });

  it("replie sur le seed (flagged + confiance basse) si la source est absente (DÉFCON 1)", () => {
    const r = reconcileCatalog({ ...live, source: { ...live.source, url: "" } }, seed, prof());
    expect(r.provenance).toBe("flagged");
    expect(r.confidence).toBe("low");
    expect(r.name).toBe("BGE-M3 local (Ollama)");
  });

  it("rejette une API tierce pour un profil secret (repli seed)", () => {
    const apiLive: ComponentCandidate = { ...live, sovereignty: "api-third-party" };
    const r = reconcileCatalog(apiLive, seed, prof({ sensitivity: "secret" }));
    expect(r.provenance).toBe("flagged");
    expect(r.name).toBe("BGE-M3 local (Ollama)");
  });

  it("accepte une API tierce pour un profil non régulé", () => {
    const apiLive: ComponentCandidate = { ...live, sovereignty: "api-third-party" };
    const r = reconcileCatalog(apiLive, seed, prof());
    expect(r.provenance).toBe("live");
  });

  it("conserve un facteur de dimensionnement valide (S-056)", () => {
    const r = reconcileCatalog({ ...live, sizingParams: { gpuLoadFactor: 0.5 } }, seed, prof());
    expect(r.sizingParams?.gpuLoadFactor).toBe(0.5);
  });

  it("retire un facteur aberrant (hors bornes) → le moteur repliera sur la baseline (S-056)", () => {
    const r = reconcileCatalog({ ...live, sizingParams: { gpuLoadFactor: 100, storageFactor: 0.5 } }, seed, prof());
    expect(r.sizingParams?.gpuLoadFactor).toBeUndefined(); // aberrant → retiré
    expect(r.sizingParams?.storageFactor).toBe(0.5); // valide → conservé
  });
});
