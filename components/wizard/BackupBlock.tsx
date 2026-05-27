"use client";

import type { ReactElement } from "react";
import { InfoBubble } from "@/components/wizard/InfoBubble";
import { RadioCards } from "@/components/wizard/RadioCards";
import { YesNo } from "@/components/wizard/YesNo";
import {
  buildBackupPlan,
  costMultimodalSizing,
  type Backup,
  type BackupCriticality,
  type BackupPriceTable,
  type BackupStorageTier,
  type ErasurePolicy,
  type MultimodalPriceTable,
  type Profile,
  type VectorBackupStrategy,
} from "@/lib/engine";
import { getBackupPrices } from "@/lib/pricing/backup-seed";
import { getMediaPricesEur } from "@/lib/pricing/media-feed";
import type { Option } from "@/lib/wizard/options";
import { cn } from "@/lib/utils/cn";

type BackupBlockProps = {
  profile: Profile;
  onChange: (backup: Backup) => void;
  /** Prix médias € (réutilisés pour le stockage chaud + le dimensionnement). Injectable (tests). */
  prices?: MultimodalPriceTable;
  /** Prix backup € (egress/archive/hors-site). Injectable (tests). */
  backupPrices?: BackupPriceTable;
};

const CRITICALITY_OPTIONS: Option<BackupCriticality>[] = [
  { value: "none", label: "Aucune", hint: "Pas de sauvegarde gérée" },
  { value: "standard", label: "Standard", hint: "Quotidien · 30 j · hors-site" },
  { value: "high", label: "Élevée", hint: "Horaire · 90 j · air-gap · PITR" },
  { value: "critical", label: "Critique", hint: "≈ continu · 365 j · WORM" },
];

const TIER_OPTIONS: Option<BackupStorageTier>[] = [
  { value: "hot", label: "Chaud", hint: "Accès immédiat" },
  { value: "cold", label: "Froid", hint: "Archive longue durée, moins cher" },
];

const VECTOR_OPTIONS: Option<VectorBackupStrategy>[] = [
  { value: "auto", label: "Auto", hint: "Le moteur tranche au moindre coût" },
  { value: "backup", label: "Sauvegarder" },
  { value: "reembed", label: "Ré-embed", hint: "Reconstruit depuis la source, RTO plus long" },
];

const ERASURE_OPTIONS: Option<ErasurePolicy>[] = [
  { value: "expiration", label: "Expiration", hint: "Purge à l'expiration de la rétention" },
  { value: "crypto-shred", label: "Crypto-shred", hint: "Destruction de clé → donnée illisible" },
];

const INFO_CRITICALITY = {
  why: "La criticité dérive tout le plan : fréquence de sauvegarde (RPO), délai de reprise (RTO), rétention, nombre de copies, immutabilité et politique d'effacement.",
  consequence: "Plus c'est critique, plus la sauvegarde coûte (copies, hors-site, archivage), et plus la résilience monte.",
};

function NumberRow({
  label,
  value,
  min,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  onChange: (v: number) => void;
}): ReactElement {
  return (
    <label className="flex items-center justify-between gap-3 text-body-sm text-on-surface-variant">
      <span>{label}</span>
      <input
        type="number"
        min={min}
        value={value}
        onChange={(e) => onChange(Math.max(min, Math.round(Number(e.target.value) || min)))}
        className={cn(
          "w-28 rounded-input bg-surface-container px-3 py-1.5 text-right font-mono text-on-surface",
          "ring-1 ring-outline/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
        )}
      />
    </label>
  );
}

export function BackupBlock({
  profile,
  onChange,
  prices = getMediaPricesEur(),
  backupPrices = getBackupPrices(),
}: BackupBlockProps): ReactElement {
  const b: Backup = profile.backup ?? { criticality: "none" };
  const update = (patch: Partial<Backup>): void => onChange({ ...b, ...patch });

  // Aperçu live + valeurs effectives (intègrent les défauts dérivés et la surcharge conformité).
  const sizing = costMultimodalSizing(profile, prices);
  const plan = buildBackupPlan(profile, sizing, prices.storagePerGbMonth, backupPrices);
  const monthly = Math.round(plan.monthlyCost);
  const setup = Math.round(plan.setupCost);
  const isNone = b.criticality === "none";

  return (
    <div className="space-y-4">
      <fieldset className="border-0 p-0">
        <legend className="mb-2 flex items-center gap-2 text-label-caps uppercase text-on-surface-variant">
          Criticité de la sauvegarde
          <InfoBubble label="Criticité de la sauvegarde" why={INFO_CRITICALITY.why} consequence={INFO_CRITICALITY.consequence} />
        </legend>
        <RadioCards value={b.criticality} options={CRITICALITY_OPTIONS} onChange={(criticality) => update({ criticality })} />
      </fieldset>

      {!isNone ? (
        <details className="rounded-card border border-outline-variant p-4">
          <summary className="cursor-pointer text-body-sm font-medium text-on-surface">Affinage expert</summary>
          <div className="mt-4 space-y-4">
            <fieldset className="border-0 p-0">
              <legend className="mb-2 text-label-caps uppercase text-on-surface-variant">Destination de stockage</legend>
              <RadioCards value={plan.tier} options={TIER_OPTIONS} onChange={(tier) => update({ tier })} />
            </fieldset>
            <fieldset className="border-0 p-0">
              <legend className="mb-2 text-label-caps uppercase text-on-surface-variant">Vecteurs (sauvegarder ou ré-embed)</legend>
              <RadioCards
                value={b.vectorStrategy ?? "auto"}
                options={VECTOR_OPTIONS}
                onChange={(vectorStrategy) => update({ vectorStrategy })}
              />
              <p className="mt-1 text-body-sm text-on-surface-variant/80">Décision retenue : {plan.vector.strategy}.</p>
            </fieldset>
            <fieldset className="border-0 p-0">
              <legend className="mb-2 text-label-caps uppercase text-on-surface-variant">Effacement (droit à l’oubli)</legend>
              <RadioCards value={plan.erasurePolicy} options={ERASURE_OPTIONS} onChange={(erasurePolicy) => update({ erasurePolicy })} />
            </fieldset>

            <div className="grid gap-3 sm:grid-cols-2">
              <NumberRow label="RPO, perte max (min)" value={plan.rpoMinutes} min={0} onChange={(rpoMinutes) => update({ rpoMinutes })} />
              <NumberRow label="RTO, reprise max (min)" value={plan.rtoMinutes} min={0} onChange={(rtoMinutes) => update({ rtoMinutes })} />
              <NumberRow label="Rétention (jours)" value={plan.retentionDays} min={0} onChange={(retentionDays) => update({ retentionDays })} />
              <NumberRow label="Copies (3-2-1)" value={plan.copies} min={1} onChange={(copies) => update({ copies })} />
              <NumberRow
                label="Restaurations testées / an"
                value={plan.restoreTestsPerYear}
                min={0}
                onChange={(restoreTestsPerYear) => update({ restoreTestsPerYear })}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <YesNo ariaLabel="Copie hors-site" value={plan.offsite} onChange={(offsite) => update({ offsite })} />
              <YesNo ariaLabel="Copie air-gap (hors-ligne)" value={plan.airgap} onChange={(airgap) => update({ airgap })} />
              <YesNo ariaLabel="Immutabilité (WORM)" value={plan.immutable} onChange={(immutable) => update({ immutable })} />
              <YesNo ariaLabel="Clés gérées par le client (BYOK)" value={plan.byok} onChange={(byok) => update({ byok })} />
            </div>
          </div>
        </details>
      ) : null}

      {/* Aperçu live, factuel (le détail des coûts est sur la page résultats). */}
      <div className="rounded-card bg-surface-container p-4 text-body-sm text-on-surface-variant" aria-live="polite">
        {isNone ? (
          <p>
            Aucune sauvegarde gérée : pas de surcoût, mais une base mémorielle sans sauvegarde est exposée à la perte de données.
          </p>
        ) : (
          <>
            <p className="text-on-surface">
              Cette sauvegarde ajoute ≈ <strong className="font-mono">{monthly} €/mois</strong>
              {setup > 0 ? (
                <>
                  {" "}
                  (+ <strong className="font-mono">{setup} €</strong> de mise en route, premier full)
                </>
              ) : null}
              .
            </p>
            <p className="mt-1">
              Plan « {plan.criticality} » : {plan.copies} copies
              {plan.offsite ? ", hors-site" : ""}
              {plan.airgap ? ", air-gap" : ""}
              {plan.immutable ? ", immuable" : ""} · rétention {plan.retentionDays} j · vecteurs {plan.vector.strategy}.
            </p>
            <p className="mt-1 text-on-surface-variant/80">
              Coûts variables ±30 %, sources datées sur la page résultats. Orientation d’ingénierie, pas un avis juridique.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
