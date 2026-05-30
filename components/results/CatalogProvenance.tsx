"use client";

import { useTranslations } from "next-intl";
import type { ReactElement } from "react";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { StatusDot } from "@/components/ui/StatusDot";
import type { Catalog, Provenance, SlotId } from "@/lib/catalog";

const SLOT_ORDER: SlotId[] = ["c0", "c1", "c2", "c3", "c4", "c5", "c6"];

const PROVENANCE_META: Record<Provenance, { tone: "primary" | "error" | "neutral"; labelKey: "provLive" | "provSeed" | "provFlagged" }> = {
  live: { tone: "primary", labelKey: "provLive" },
  seed: { tone: "neutral", labelKey: "provSeed" },
  flagged: { tone: "error", labelKey: "provFlagged" },
};

const SOURCE_LABEL_KEY: Record<Catalog["source"], "sourceLive" | "sourceSeed" | "sourceMixed"> = {
  live: "sourceLive",
  seed: "sourceSeed",
  mixed: "sourceMixed",
};

type CatalogProvenanceProps = {
  catalog: Catalog;
  /** true tant que la veille en direct n'a pas répondu (le seed est affiché en repli immédiat). */
  pending: boolean;
};

/**
 * Provenance des CHOIX de composants (reco vivante, S-037) — jumeau de `LivePriceStatus` côté prix.
 * Rend visible, par couche, d'où vient le composant recommandé : veille en direct (Firecrawl + LLM,
 * validée par garde-fou), repli sur calibration datée, ou candidat rejeté au profit du repli. Le
 * catalogue affiché est exactement celui qui a servi à la recommandation (snapshot rejouable).
 */
export function CatalogProvenance({ catalog, pending }: CatalogProvenanceProps): ReactElement {
  const t = useTranslations("Results.catalogProvenance");
  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-display text-headline-md text-on-surface">{t("title")}</h3>
        <Chip tone={catalog.source === "seed" ? "neutral" : "primary"}>{t(SOURCE_LABEL_KEY[catalog.source])}</Chip>
      </div>
      <p className="mt-1 text-body-sm text-on-surface-variant">
        {t.rich("intro", {
          date: () => <span className="font-mono">{catalog.assembledAt}</span>,
        })}
      </p>

      {pending ? (
        <p className="mt-3 text-body-sm text-on-surface-variant">{t("pending")}</p>
      ) : null}

      <ul className="mt-4 divide-y divide-outline-variant">
        {SLOT_ORDER.map((slot) => {
          const rec = catalog.slots[slot].recommended;
          const meta = PROVENANCE_META[rec.provenance];
          return (
            <li key={slot} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <span className="flex items-center gap-2">
                <StatusDot confidence={rec.confidence} />
                <span className="font-mono text-label-caps uppercase text-on-surface-variant/70">
                  {slot.toUpperCase()}
                </span>
                {rec.source.url.length > 0 ? (
                  <a
                    href={rec.source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-body-sm text-secondary underline decoration-dotted"
                  >
                    {rec.name}
                  </a>
                ) : (
                  <span className="text-body-sm text-on-surface">{rec.name}</span>
                )}
                <Chip tone={meta.tone}>{t(meta.labelKey)}</Chip>
              </span>
              <span className="font-mono text-body-sm text-on-surface-variant">{rec.source.checkedAt}</span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
