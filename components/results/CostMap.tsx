import { useTranslations } from "next-intl";
import type { ReactElement } from "react";
import { Card } from "@/components/ui/Card";
import { StatusDot } from "@/components/ui/StatusDot";
import { costBand, type ActiveModule, type BackupPlan, type GpuTier, type Layer, type ResidencyPlan } from "@/lib/engine";
import { useEngineText } from "@/lib/i18n/engine";
import { pricingForLayer } from "@/lib/pricing/sources";

/** Décomposition de l'apport multimédia (déjà inclus dans les couches C4/C5/C6), pour la transparence. */
export type MediaBreakdown = {
  gpuTier: GpuTier;
  gpuCost: number;
  storageGb: number;
  storageCost: number;
  embeddingsCost: number;
  apiLines: { label: string; cost: number }[];
};

type CostMapProps = {
  layers: Layer[];
  factorsCost: number;
  activeModules: ActiveModule[];
  totalCost: number;
  /** Coût one-time de mise en route (ingestion du backlog). Affiché en ligne séparée. */
  setupCost?: number;
  /** Décomposition multimédia (déjà comprise dans les couches), pastilles 🟢 souverain / 💳 API. */
  media?: MediaBreakdown;
  /** Plan de sauvegarde (coût récurrent déjà compris dans C6) — ligne backup + sources (S-031). */
  backup?: BackupPlan;
  /** Plan de résidence/DR (coût réplication déjà compris dans C6) — ligne réplication + sources (S-048). */
  residency?: ResidencyPlan;
};

const REGION_KEY: Record<ResidencyPlan["primaryRegion"], "regionEu" | "regionMaroc" | "regionUs" | "regionOther"> = {
  eu: "regionEu",
  maroc: "regionMaroc",
  us: "regionUs",
  other: "regionOther",
};

/** Carte de coûts transparente : chaque poste avec confiance + source datée, total avec bande ±30 %. */
export function CostMap({ layers, factorsCost, activeModules, totalCost, setupCost = 0, media, backup, residency }: CostMapProps): ReactElement {
  const resolveEngine = useEngineText();
  const t = useTranslations("Results.costMap");
  const band = costBand(totalCost);
  const setupBand = costBand(setupCost);
  const hasMedia =
    media !== undefined && (media.gpuCost > 0 || media.storageCost > 0 || media.embeddingsCost > 0 || media.apiLines.length > 0);
  const hasBackup = backup !== undefined && backup.criticality !== "none" && backup.monthlyCost > 0;
  const hasResidency = residency !== undefined && residency.monthlyCost > 0;
  const replicaRegions = residency?.regions.filter((r) => r.role !== "primary") ?? [];

  return (
    <Card>
      <h3 className="font-display text-headline-md text-on-surface">{t("title")}</h3>
      <p className="mt-1 text-body-sm text-on-surface-variant">{t("intro")}</p>

      <ul className="mt-4 divide-y divide-outline-variant">
        {layers
          .filter((l) => l.cost > 0)
          .map((layer) => {
            const pricing = pricingForLayer(layer.id);
            return (
              <li key={layer.id} className="flex items-center justify-between gap-4 py-2">
                <span className="flex items-center gap-2">
                  <StatusDot confidence={pricing.confidence} />
                  <span className="text-body-sm text-on-surface">{resolveEngine(layer.name)}</span>
                  {pricing.source !== null ? (
                    <a
                      href={pricing.source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-body-sm text-secondary underline decoration-dotted"
                    >
                      {t("sourceLink", { label: pricing.source.label, date: pricing.source.checkedAt })}
                    </a>
                  ) : null}
                </span>
                <span className="shrink-0 font-mono text-body-sm text-on-surface">{layer.cost} €</span>
              </li>
            );
          })}

        {factorsCost > 0 ? (
          <li className="flex items-center justify-between gap-4 py-2">
            <span className="flex items-center gap-2">
              <StatusDot confidence="medium" />
              <span className="text-body-sm text-on-surface">{t("factorsLine")}</span>
            </span>
            <span className="shrink-0 font-mono text-body-sm text-on-surface">{factorsCost} €</span>
          </li>
        ) : null}

        {activeModules.map((mod) => (
          <li key={mod.id} className="flex items-center justify-between gap-4 py-2">
            <span className="flex items-center gap-2">
              <StatusDot confidence="medium" />
              <span className="text-body-sm text-on-surface">
                {mod.name} <span className="text-on-surface-variant">{t("moduleLevel", { level: mod.level, maxLevel: mod.maxLevel })}</span>
              </span>
            </span>
            <span className="shrink-0 font-mono text-body-sm text-on-surface">{mod.cost} €</span>
          </li>
        ))}
      </ul>

      {hasMedia && media !== undefined ? (
        <div className="mt-4 rounded-card bg-surface-container p-3">
          <p className="text-label-caps uppercase text-on-surface-variant">
            {t("mediaTitle")} <span className="normal-case">{t("mediaIncluded")}</span>
          </p>
          <ul className="mt-2 space-y-1.5">
            {media.gpuCost > 0 ? (
              <li className="flex items-center justify-between gap-3 text-body-sm">
                <span>{t("mediaGpu", { tier: media.gpuTier })}</span>
                <span className="font-mono text-on-surface">{t("mediaPerMonth", { cost: media.gpuCost })}</span>
              </li>
            ) : null}
            {media.embeddingsCost > 0 ? (
              <li className="flex items-center justify-between gap-3 text-body-sm">
                <span>{t("mediaEmbeddings")}</span>
                <span className="font-mono text-on-surface">{t("mediaPerMonth", { cost: media.embeddingsCost })}</span>
              </li>
            ) : null}
            {media.storageCost > 0 ? (
              <li className="flex items-center justify-between gap-3 text-body-sm">
                <span>{t("mediaStorage", { gb: media.storageGb })}</span>
                <span className="font-mono text-on-surface">{t("mediaPerMonth", { cost: media.storageCost })}</span>
              </li>
            ) : null}
            {media.apiLines.map((line) => (
              <li key={line.label} className="flex items-center justify-between gap-3 text-body-sm">
                <span>{t("mediaApi", { label: line.label })}</span>
                <span className="font-mono text-on-surface">{t("mediaPerMonth", { cost: line.cost })}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-body-sm text-on-surface-variant">{t("mediaDisclaimer")}</p>
        </div>
      ) : null}

      {hasBackup && backup !== undefined ? (
        <div className="mt-4 rounded-card bg-surface-container p-3">
          <p className="text-label-caps uppercase text-on-surface-variant">
            {t("backupTitle")} <span className="normal-case">{t("backupIncluded")}</span>
          </p>
          <ul className="mt-2 space-y-1.5">
            <li className="flex items-center justify-between gap-3 text-body-sm">
              <span>
                {t("backupLine", {
                  criticality: backup.criticality,
                  copies: backup.copies,
                  offsite: backup.offsite ? t("offsite") : "",
                  airgap: backup.airgap ? t("airgap") : "",
                  immutable: backup.immutable ? t("immutable") : "",
                  retention: backup.retentionDays,
                  vector: backup.vector.strategy,
                })}
              </span>
              <span className="font-mono text-on-surface">{t("mediaPerMonth", { cost: Math.round(backup.monthlyCost) })}</span>
            </li>
          </ul>
          {backup.costSources.length > 0 ? (
            <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-body-sm">
              {backup.costSources.map((s) => (
                <a
                  key={s.url}
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-secondary underline decoration-dotted"
                >
                  {t("sourceLink", { label: s.label, date: s.checkedAt })}
                </a>
              ))}
            </p>
          ) : null}
          <p className="mt-2 text-body-sm text-on-surface-variant">
            {t("backupErasure", {
              policy: backup.erasurePolicy === "crypto-shred" ? t("erasureCryptoShred") : t("erasureExpiration"),
            })}
          </p>
        </div>
      ) : null}

      {hasResidency && residency !== undefined ? (
        <div className="mt-4 rounded-card bg-surface-container p-3">
          <p className="text-label-caps uppercase text-on-surface-variant">
            {t("residencyTitle")} <span className="normal-case">{t("residencyIncluded")}</span>
          </p>
          <ul className="mt-2 space-y-1.5">
            <li className="flex items-center justify-between gap-3 text-body-sm">
              <span>
                {t("residencyLine", {
                  dr: residency.activeActive ? t("drActiveActive") : t("drTier", { tier: residency.drTier }),
                  count: replicaRegions.length,
                  regions:
                    replicaRegions.map((r) => t(REGION_KEY[r.region])).join(", ") || t(REGION_KEY[residency.primaryRegion]),
                  rto: residency.rtoMinutes,
                })}
              </span>
              <span className="font-mono text-on-surface">{t("mediaPerMonth", { cost: Math.round(residency.monthlyCost) })}</span>
            </li>
          </ul>
          {residency.costSources.length > 0 ? (
            <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-body-sm">
              {residency.costSources.map((s) => (
                <a
                  key={s.url}
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-secondary underline decoration-dotted"
                >
                  {t("sourceLink", { label: s.label, date: s.checkedAt })}
                </a>
              ))}
            </p>
          ) : null}
          <p className="mt-2 text-body-sm text-on-surface-variant">{t("residencyDisclaimer")}</p>
        </div>
      ) : null}

      <div className="mt-4 flex items-center justify-between border-t border-outline-variant pt-4">
        <span className="font-display font-semibold text-on-surface">{t("totalLabel")}</span>
        <span className="text-right">
          <span className="block font-mono text-headline-md text-primary">{t("totalPerMonth", { cost: totalCost })}</span>
          <span className="block font-mono text-body-sm text-on-surface-variant">
            {t("band", { low: band.low, high: band.high })}
          </span>
        </span>
      </div>

      {setupCost > 0 ? (
        <div className="mt-2 flex items-center justify-between">
          <span className="text-body-sm text-on-surface-variant">
            {t("setupLabel", {
              backup: backup !== undefined && backup.setupCost > 0 ? t("setupBackup") : "",
              residency: residency !== undefined && residency.setupCost > 0 ? t("setupResidency") : "",
            })}
          </span>
          <span className="text-right">
            <span className="block font-mono text-body-md text-on-surface">{setupCost} €</span>
            <span className="block font-mono text-body-sm text-on-surface-variant">
              {t("band", { low: setupBand.low, high: setupBand.high })}
            </span>
          </span>
        </div>
      ) : null}
    </Card>
  );
}
