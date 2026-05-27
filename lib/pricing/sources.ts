import type { Confidence } from "@/components/ui/StatusDot";

export type PriceSource = { label: string; url: string; checkedAt: string };
export type LayerPricing = { confidence: Confidence; source: PriceSource | null };

// Sources de prix par couche (seed issu de l'audit vendor de la calibration ±30 %).
// Le price feed Firecrawl (S-008) viendra rafraîchir et dater ces valeurs automatiquement.
export const LAYER_PRICING: Record<number, LayerPricing> = {
  0: { confidence: "high", source: null },
  1: {
    confidence: "high",
    source: {
      label: "Anthropic, pricing",
      url: "https://platform.claude.com/docs/en/about-claude/pricing",
      checkedAt: "2026-05-23",
    },
  },
  2: { confidence: "high", source: null },
  3: {
    confidence: "high",
    source: { label: "Qdrant, pricing", url: "https://qdrant.tech/pricing/", checkedAt: "2026-05-23" },
  },
  4: {
    confidence: "medium",
    source: { label: "Mistral, pricing", url: "https://mistral.ai/pricing", checkedAt: "2026-05-23" },
  },
  5: {
    confidence: "medium",
    source: { label: "Supabase, pricing", url: "https://supabase.com/pricing", checkedAt: "2026-05-23" },
  },
  6: {
    confidence: "high",
    source: {
      label: "Scaleway, pricing",
      url: "https://www.scaleway.com/en/pricing/virtual-instances-pricing/",
      checkedAt: "2026-05-23",
    },
  },
};

export function pricingForLayer(layerId: number): LayerPricing {
  return LAYER_PRICING[layerId] ?? { confidence: "medium", source: null };
}
