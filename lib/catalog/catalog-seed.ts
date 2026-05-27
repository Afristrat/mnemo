// Seed du catalogue (S-035) = transposition À L'IDENTIQUE des choix figés de `lib/engine/layers.ts`.
//
// Sert de REPLI daté (réseau/LLM KO → seed) ET de BASELINE de plausibilité (candidat live aberrant
// → repli seed). DÉFCON 1 : le seed n'est PAS présenté comme une source web ; c'est une calibration
// interne datée (choix d'architecture du simulateur v2), confiance `medium`, à rafraîchir par la
// veille live (S-036). `buildLayers(preset, profile, catalog)` consomme ce catalogue.

import type { Preset, Profile } from "@/lib/engine/types";
import type { Catalog, CatalogSlot, ComponentCandidate, ComponentSovereignty } from "./types";

/** Référence de calibration interne (pas une source web ; la veille live apporte les URLs réelles). */
const SEED_SOURCE = {
  label: "Calibration Strate (simulateur v2, choix d'architecture datés)",
  url: "https://github.com/Afristrat/mnemo/tree/main/design-reference",
  checkedAt: "2026-05-27",
};

function cand(
  name: string,
  role: string,
  sovereignty: ComponentSovereignty,
  note?: string,
): ComponentCandidate {
  return { name, role, sovereignty, source: SEED_SOURCE, confidence: "medium", provenance: "seed", note };
}

function alts(names: string[], role: string, sovereignty: ComponentSovereignty): ComponentCandidate[] {
  return names.map((n) => cand(n, role, sovereignty));
}

function hasMultimodal(profile: Profile): boolean {
  return profile.contentTypes.some((t) => t === "audio" || t === "video" || t === "images");
}

function byPreset<T>(preset: Preset, light: T, medium: T, hard: T): T {
  return preset === "LIGHT" ? light : preset === "MEDIUM" ? medium : hard;
}

/**
 * Catalogue seed pour un profil. Reproduit la logique conditionnelle de `layers.ts`
 * (preset × multimodal × bitemporel) → `buildLayers` rend une stack identique à l'historique.
 */
export function seedCatalog(preset: Preset, profile: Profile): Catalog {
  const mm = hasMultimodal(profile);
  const bitemporal = profile.bitemporal;

  const c0: CatalogSlot = {
    slot: "c0",
    recommended: cand(
      "Frontmatter universel Xavier v1.0.0",
      "contrat commun (frontmatter YAML)",
      "sovereign",
      "JSON Schema, triple validation, champ circle pivot RLS",
    ),
    alternatives: alts(["Schema custom (déconseillé)"], "contrat commun (frontmatter YAML)", "sovereign"),
  };

  const c1Role = "surface utilisateur (MCP)";
  const c1: CatalogSlot = {
    slot: "c1",
    recommended: cand(
      byPreset(
        preset,
        "Claude Desktop (abonnement Pro 20$/mois)",
        "Claude Desktop + Claude Code",
        "Claude Desktop + Anthropic Workbench (audit)",
      ),
      c1Role,
      "api-third-party",
      "MCP-first : Claude comme surface unique (pas d'UI custom à maintenir)",
    ),
    alternatives: alts(
      ["UI custom React (effort dev)", "ChatGPT (non recommandé : pas de MCP)"],
      c1Role,
      "api-third-party",
    ),
  };

  const c2Role = "orchestrateur RAG (+ cascade LLM)";
  const c2: CatalogSlot = {
    slot: "c2",
    recommended: cand(
      byPreset(
        preset,
        "LangChain ou LlamaIndex (Python) sans cascade",
        "LiteLLM self-host + cascade T1→T2 (V1+ recommandé)",
        "LiteLLM + vLLM on-prem + cascade T1→T2 stricte",
      ),
      c2Role,
      byPreset<ComponentSovereignty>(preset, "eu-hosted", "sovereign", "sovereign"),
      byPreset(
        preset,
        "open-source ; LLM API direct",
        "T1 = Mistral Small, T2 = Claude Sonnet sur escalade",
        "T1 = Qwen3-4B local, T2 = Qwen3-30B local",
      ),
    ),
    alternatives: alts(
      byPreset(preset, ["Haystack", "DSPy"], ["OpenRouter", "Portkey"], ["SGLang", "TGI"]),
      c2Role,
      byPreset<ComponentSovereignty>(preset, "eu-hosted", "sovereign", "sovereign"),
    ),
  };

  const c3Role = "retrieval + reranking";
  const c3: CatalogSlot = {
    slot: "c3",
    recommended: cand(
      byPreset(
        preset,
        "Qdrant Cloud (free tier) ou pgvector simple",
        "Qdrant self-host + hybride dense/sparse + BGE-Reranker-v2",
        "Qdrant on-prem air-gapped + BGE-Reranker v2.5",
      ),
      c3Role,
      byPreset<ComponentSovereignty>(preset, "eu-hosted", "sovereign", "sovereign"),
      byPreset(
        preset,
        "dense uniquement ; pas de reranker",
        "score composite cosine × cognitive_weight × freshness (V1+)",
        "isolé du net, audit trail sur chaque query",
      ),
    ),
    alternatives: alts(
      byPreset(
        preset,
        ["Pinecone", "Weaviate Cloud"],
        ["Vespa", "Marqo"],
        ["ElasticSearch + RankZephyr"],
      ),
      c3Role,
      byPreset<ComponentSovereignty>(preset, "eu-hosted", "sovereign", "sovereign"),
    ),
  };

  const c4Role = "embeddings" + (mm ? " multimodaux" : "");
  const c4: CatalogSlot = {
    slot: "c4",
    recommended: cand(
      byPreset(
        preset,
        mm ? "Voyage-Multimodal-3 API" : "Mistral embed API",
        mm ? "LCO-Embedding-Omni-7B local (GPU)" : "BGE-M3 local (Ollama)",
        mm ? "Qwen3-Embed-7B + Whisper large-v3 (audio)" : "Qwen3-Embed-7B local",
      ),
      c4Role,
      byPreset<ComponentSovereignty>(preset, "api-third-party", "sovereign", "sovereign"),
      byPreset(
        preset,
        "API SaaS, simple",
        "self-host, contrôle total",
        "GPU H100/A100 loué ou on-prem",
      ),
    ),
    alternatives: alts(
      byPreset(
        preset,
        ["OpenAI text-embedding-3", "Cohere"],
        ["NV-Embed-v2", "Stella"],
        ["InternLM-Embed", "GTE"],
      ),
      c4Role,
      byPreset<ComponentSovereignty>(preset, "api-third-party", "sovereign", "sovereign"),
    ),
  };

  const c5Role = "stockage polyglotte" + (bitemporal ? " bitemporel" : "");
  const c5: CatalogSlot = {
    slot: "c5",
    recommended: cand(
      byPreset(
        preset,
        bitemporal
          ? "Postgres 16 + pgvector + colonnes valid_from/recorded_at"
          : "Postgres 16 + pgvector (Supabase free tier)",
        bitemporal
          ? "Postgres + Apache AGE (option Amine ADR-011) OU Graphiti+Neo4j"
          : "Postgres + pgvector + Graphiti (option Meydeey)",
        "XTDB + Graphiti hybride (option C Chris) OU Postgres+AGE on-prem",
      ),
      c5Role,
      "sovereign",
      byPreset(
        preset,
        "vault markdown source de vérité (Amine) recommandé",
        "vault markdown source de vérité + projections rejouables",
        "fact-store bitemporel natif, audit signé PL/pgSQL",
      ),
    ),
    alternatives: alts(
      byPreset(
        preset,
        ["SQLite + Chroma (déconseillé production)"],
        ["XTDB hybride (option Chris)", "DuckDB+VSS"],
        ["Datomic Pro", "TerminusDB"],
      ),
      c5Role,
      "sovereign",
    ),
  };

  const c6Role = "infra (LLM Gateway + inference + backup)";
  const c6: CatalogSlot = {
    slot: "c6",
    recommended: cand(
      byPreset(
        preset,
        "Mistral La Plateforme (API directe) + Scaleway FR (VPS €10) + Restic vers Backblaze B2",
        "Mistral + escalade Claude Sonnet via LiteLLM + Hetzner CX31 + Backup 3-2-1 (B2 + Scaleway)",
        "vLLM on-prem (Qwen3-30B) + escalade Sonnet sources publiques + on-prem Hetzner dedicated + LUKS/Tang/Clevis",
      ),
      c6Role,
      byPreset<ComponentSovereignty>(preset, "eu-hosted", "eu-hosted", "sovereign"),
      byPreset(
        preset,
        "tout managé, démarrage en 2h",
        "souveraineté UE/FR, cascade T1/T2 économise ~70 % LLM",
        "souveraineté N4 + backup multi-continental P4 (Meydeey)",
      ),
    ),
    alternatives: alts(
      byPreset(
        preset,
        ["OpenAI API + OVH Public Cloud"],
        ["OVHcloud + Scaleway IA"],
        ["OVHcloud Bare Metal + GPU AMD MI300"],
      ),
      c6Role,
      byPreset<ComponentSovereignty>(preset, "eu-hosted", "eu-hosted", "sovereign"),
    ),
  };

  return {
    slots: { c0, c1, c2, c3, c4, c5, c6 },
    assembledAt: SEED_SOURCE.checkedAt,
    source: "seed",
  };
}
