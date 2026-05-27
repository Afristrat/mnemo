import { seedCatalog } from "@/lib/catalog/catalog-seed";
import type { Catalog, CatalogSlot, SlotId } from "@/lib/catalog/types";
import type { Layer, Preset, Profile } from "./types";

const COLORS = ["#312e81", "#4338ca", "#6366f1", "#8b5cf6", "#a855f7", "#d946ef", "#ec4899"] as const;

function hasMultimodal(profile: Profile): boolean {
  return profile.contentTypes.some((t) => t === "audio" || t === "video" || t === "images");
}

/** Reconstruit la chaîne d'alternatives d'une couche depuis les candidats du catalogue. */
function altString(slot: CatalogSlot): string {
  return slot.alternatives.map((a) => a.name).join(", ");
}

/**
 * Construit la stack 7 couches (C0→C6) selon le preset et le profil. Les CHOIX (choice/note/
 * alternatives) viennent du `catalog` injecté (défaut = seed daté = transposition de l'historique
 * `layers.ts`) ; les identifiants, noms de couche, couleurs et **coûts** restent calculés ici (le
 * catalogue ne porte pas les coûts — DÉFCON 1, ils viennent du feed/dimensionnement). Reco vivante
 * (spec n°3) : S-036 injecte un catalogue live ; le défaut seed garantit une sortie **identique**
 * à l'historique (déterminisme préservé).
 */
export function buildLayers(
  preset: Preset,
  profile: Profile,
  catalog: Catalog = seedCatalog(preset, profile),
): Layer[] {
  const wantsMultimodal = hasMultimodal(profile);
  const wantsBitemporal = profile.bitemporal;
  const s = (id: SlotId): CatalogSlot => catalog.slots[id];

  const c0: Layer = {
    id: 0,
    name: "Contrat commun (frontmatter YAML)",
    color: COLORS[0],
    choice: s("c0").recommended.name,
    cost: 0,
    note: s("c0").recommended.note ?? "",
    alternatives: altString(s("c0")),
  };

  const c1: Layer = {
    id: 1,
    name: "Surface utilisateur (MCP)",
    color: COLORS[1],
    choice: s("c1").recommended.name,
    cost: preset === "LIGHT" ? 20 : preset === "HARD" ? 100 : 40,
    note: s("c1").recommended.note ?? "",
    alternatives: altString(s("c1")),
  };

  const c2: Layer = {
    id: 2,
    name: "Orchestrateur RAG (+ cascade LLM)",
    color: COLORS[2],
    choice: s("c2").recommended.name,
    cost: 0,
    note: s("c2").recommended.note ?? "",
    alternatives: altString(s("c2")),
  };

  const c3: Layer = {
    id: 3,
    name: "Retrieval + reranking",
    color: COLORS[3],
    choice: s("c3").recommended.name,
    cost: 0,
    note: s("c3").recommended.note ?? "",
    alternatives: altString(s("c3")),
  };

  const c4: Layer = {
    id: 4,
    name: "Embeddings" + (wantsMultimodal ? " multimodaux" : ""),
    color: COLORS[4],
    choice: s("c4").recommended.name,
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
    note: s("c4").recommended.note ?? "",
    alternatives: altString(s("c4")),
  };

  const c5: Layer = {
    id: 5,
    name: "Stockage polyglotte" + (wantsBitemporal ? " bitemporel" : ""),
    color: COLORS[5],
    choice: s("c5").recommended.name,
    cost: preset === "LIGHT" ? (wantsBitemporal ? 10 : 0) : preset === "MEDIUM" ? 15 : 40,
    note: s("c5").recommended.note ?? "",
    alternatives: altString(s("c5")),
  };

  const c6: Layer = {
    id: 6,
    name: "Infra (LLM Gateway + inference + backup)",
    color: COLORS[6],
    choice: s("c6").recommended.name,
    cost: preset === "LIGHT" ? 30 : preset === "MEDIUM" ? 100 : 400,
    note: s("c6").recommended.note ?? "",
    alternatives: altString(s("c6")),
  };

  return [c0, c1, c2, c3, c4, c5, c6];
}
