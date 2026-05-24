import type { Layer, Preset, Profile } from "./types";

const COLORS = ["#312e81", "#4338ca", "#6366f1", "#8b5cf6", "#a855f7", "#d946ef", "#ec4899"] as const;

function hasMultimodal(profile: Profile): boolean {
  return profile.contentTypes.some((t) => t === "audio" || t === "video" || t === "images");
}

/** Construit la stack 7 couches (C0→C6) selon le preset et le profil. */
export function buildLayers(preset: Preset, profile: Profile): Layer[] {
  const wantsMultimodal = hasMultimodal(profile);
  const wantsBitemporal = profile.bitemporal !== "no";

  const c0: Layer = {
    id: 0,
    name: "Contrat commun (frontmatter YAML)",
    color: COLORS[0],
    choice: "Frontmatter universel Xavier v1.0.0",
    cost: 0,
    note: "JSON Schema, triple validation, champ circle pivot RLS",
    alternatives: "Schema custom (déconseillé)",
  };

  const c1: Layer = {
    id: 1,
    name: "Surface utilisateur (MCP)",
    color: COLORS[1],
    choice:
      preset === "LIGHT"
        ? "Claude Desktop (abonnement Pro 20$/mois)"
        : preset === "HARD"
          ? "Claude Desktop + Anthropic Workbench (audit)"
          : "Claude Desktop + Claude Code",
    cost: preset === "LIGHT" ? 20 : preset === "HARD" ? 100 : 40,
    note: "MCP-first : Claude comme surface unique (pas d'UI custom à maintenir)",
    alternatives: "UI custom React (effort dev), ChatGPT (non recommandé : pas de MCP)",
  };

  const c2: Layer = {
    id: 2,
    name: "Orchestrateur RAG (+ cascade LLM)",
    color: COLORS[2],
    choice:
      preset === "LIGHT"
        ? "LangChain ou LlamaIndex (Python) sans cascade"
        : preset === "MEDIUM"
          ? "LiteLLM self-host + cascade T1→T2 (V1+ recommandé)"
          : "LiteLLM + vLLM on-prem + cascade T1→T2 stricte",
    cost: 0,
    note:
      preset === "LIGHT"
        ? "open-source ; LLM API direct"
        : preset === "MEDIUM"
          ? "T1 = Mistral Small, T2 = Claude Sonnet sur escalade"
          : "T1 = Qwen3-4B local, T2 = Qwen3-30B local",
    alternatives: preset === "LIGHT" ? "Haystack, DSPy" : preset === "MEDIUM" ? "OpenRouter, Portkey" : "SGLang, TGI",
  };

  const c3: Layer = {
    id: 3,
    name: "Retrieval + reranking",
    color: COLORS[3],
    choice:
      preset === "LIGHT"
        ? "Qdrant Cloud (free tier) ou pgvector simple"
        : preset === "MEDIUM"
          ? "Qdrant self-host + hybride dense/sparse + BGE-Reranker-v2"
          : "Qdrant on-prem air-gapped + BGE-Reranker v2.5",
    cost: 0,
    note:
      preset === "LIGHT"
        ? "dense uniquement ; pas de reranker"
        : preset === "MEDIUM"
          ? "score composite cosine × cognitive_weight × freshness (V1+)"
          : "isolé du net, audit trail sur chaque query",
    alternatives:
      preset === "LIGHT" ? "Pinecone, Weaviate Cloud" : preset === "MEDIUM" ? "Vespa, Marqo" : "ElasticSearch + RankZephyr",
  };

  const c4: Layer = {
    id: 4,
    name: "Embeddings" + (wantsMultimodal ? " multimodaux" : ""),
    color: COLORS[4],
    choice:
      preset === "LIGHT"
        ? wantsMultimodal
          ? "Voyage-Multimodal-3 API"
          : "Mistral embed API"
        : preset === "MEDIUM"
          ? wantsMultimodal
            ? "LCO-Embedding-Omni-7B local (GPU)"
            : "BGE-M3 local (Ollama)"
          : wantsMultimodal
            ? "Qwen3-Embed-7B + Whisper large-v3 (audio)"
            : "Qwen3-Embed-7B local",
    cost:
      preset === "LIGHT"
        ? wantsMultimodal
          ? 30
          : 10
        : preset === "MEDIUM"
          ? wantsMultimodal
            ? 80
            : 20
          : wantsMultimodal
            ? 200
            : 100,
    note:
      preset === "LIGHT"
        ? "API SaaS, simple"
        : preset === "MEDIUM"
          ? "self-host, contrôle total"
          : "GPU H100/A100 loué ou on-prem",
    alternatives:
      preset === "LIGHT"
        ? "OpenAI text-embedding-3, Cohere"
        : preset === "MEDIUM"
          ? "NV-Embed-v2, Stella"
          : "InternLM-Embed, GTE",
  };

  const c5: Layer = {
    id: 5,
    name: "Stockage polyglotte" + (wantsBitemporal ? " bitemporel" : ""),
    color: COLORS[5],
    choice:
      preset === "LIGHT"
        ? wantsBitemporal
          ? "Postgres 16 + pgvector + colonnes valid_from/recorded_at"
          : "Postgres 16 + pgvector (Supabase free tier)"
        : preset === "MEDIUM"
          ? profile.bitemporal === "required"
            ? "Postgres + Apache AGE (option Amine ADR-011) OU Graphiti+Neo4j"
            : "Postgres + pgvector + Graphiti (option Meydeey)"
          : "XTDB + Graphiti hybride (option C Chris) OU Postgres+AGE on-prem",
    cost: preset === "LIGHT" ? (wantsBitemporal ? 10 : 0) : preset === "MEDIUM" ? 15 : 40,
    note:
      preset === "LIGHT"
        ? "vault markdown source de vérité (Amine) recommandé"
        : preset === "MEDIUM"
          ? "vault markdown source de vérité + projections rejouables"
          : "fact-store bitemporel natif, audit signé PL/pgSQL",
    alternatives:
      preset === "LIGHT"
        ? "SQLite + Chroma (déconseillé production)"
        : preset === "MEDIUM"
          ? "XTDB hybride (option Chris), DuckDB+VSS"
          : "Datomic Pro, TerminusDB",
  };

  const c6: Layer = {
    id: 6,
    name: "Infra (LLM Gateway + inference + backup)",
    color: COLORS[6],
    choice:
      preset === "LIGHT"
        ? "Mistral La Plateforme (API directe) + Scaleway FR (VPS €10) + Restic vers Backblaze B2"
        : preset === "MEDIUM"
          ? "Mistral + escalade Claude Sonnet via LiteLLM + Hetzner CX31 + Backup 3-2-1 (B2 + Scaleway)"
          : "vLLM on-prem (Qwen3-30B) + escalade Sonnet sources publiques + on-prem Hetzner dedicated + LUKS/Tang/Clevis",
    cost: preset === "LIGHT" ? 30 : preset === "MEDIUM" ? 100 : 400,
    note:
      preset === "LIGHT"
        ? "tout managé, démarrage en 2h"
        : preset === "MEDIUM"
          ? "souveraineté UE/FR, cascade T1/T2 économise ~70 % LLM"
          : "souveraineté N4 + backup multi-continental P4 (Meydeey)",
    alternatives:
      preset === "LIGHT"
        ? "OpenAI API + OVH Public Cloud"
        : preset === "MEDIUM"
          ? "OVHcloud + Scaleway IA"
          : "OVHcloud Bare Metal + GPU AMD MI300",
  };

  return [c0, c1, c2, c3, c4, c5, c6];
}
