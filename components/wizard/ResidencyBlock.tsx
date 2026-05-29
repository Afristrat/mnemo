"use client";

import type { ReactElement } from "react";
import { CheckboxCards } from "@/components/wizard/CheckboxCards";
import { InfoBubble } from "@/components/wizard/InfoBubble";
import { RadioCards } from "@/components/wizard/RadioCards";
import { YesNo } from "@/components/wizard/YesNo";
import {
  decidePreset,
  deriveResidencyPlan,
  deriveResidencyTopology,
  hostingClassForProfile,
  type ComputePriceTable,
  type DrTier,
  type Profile,
  type Region,
  type Residency,
  type ResidencyPriceTable,
} from "@/lib/engine";
import { getComputePrices } from "@/lib/pricing/compute-seed";
import { getResidencyPrices } from "@/lib/pricing/residency-seed";
import { useOptions } from "@/lib/wizard/useOptions";
import { cn } from "@/lib/utils/cn";

type ResidencyBlockProps = {
  profile: Profile;
  onChange: (residency: Residency) => void;
  /** Prix résidence (egress inter-région) injectables (tests / aperçu live). */
  residencyPrices?: ResidencyPriceTable;
  /** Prix compute (régions en attente) injectables (tests / aperçu live). */
  computePrices?: ComputePriceTable;
};

const INFO_DR = {
  why: "La continuité régionale décide si la mémoire reste disponible quand une région entière tombe : réplication vers une 2ᵉ région, délai de bascule (RTO) et perte maximale (RPO).",
  consequence: "Plus le palier est élevé (tiède → chaude → actif-actif), plus une région en attente et la réplication coûtent, mais plus la reprise est rapide.",
};

const INFO_REGIONS = {
  why: "Au-delà de la juridiction primaire, vous pouvez héberger ou répliquer dans plusieurs régions — y compris sur plusieurs continents (finding C4).",
  consequence: "Chaque région distincte ajoute un coût (compute en attente + réplication) et un flux inter-juridiction dont la conformité est évaluée plus bas.",
};

const INFO_NO_TRANSFER = {
  why: "La résidence stricte interdit toute copie hors de la juridiction primaire (exigée pour le secret ou certains régimes : CNDP, secret pro, HIPAA).",
  consequence: "Sous résidence stricte, la continuité régionale doit rester dans la même juridiction — une tension peut apparaître si elle n'offre pas 2 régions distinctes.",
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

/**
 * Section « Résidence & continuité » du Bloc ② (spec n°2 §9, S-048). Criticité DR (none/warm/hot) +
 * affinage expert (région primaire, régions autorisées multi-continent, résidence stricte, actif-actif,
 * RPO/RTO). Aperçu live du coût + alerte de conflit résidence × DR (jamais résolu en douce). Le moteur
 * reste pur : la dérivation + le coût viennent de `deriveResidencyPlan` (prix injectés).
 */
export function ResidencyBlock({
  profile,
  onChange,
  residencyPrices = getResidencyPrices(),
  computePrices = getComputePrices(),
}: ResidencyBlockProps): ReactElement {
  const opts = useOptions();
  const r: Residency = profile.residency ?? {};
  const update = (patch: Partial<Residency>): void => onChange({ ...r, ...patch });

  const preset = decidePreset(profile).preset;
  const plan = deriveResidencyPlan(profile, residencyPrices, computePrices, preset, hostingClassForProfile(profile));
  const noTransfer = deriveResidencyTopology(profile).noTransfer;
  const monthly = Math.round(plan.monthlyCost);
  const setup = Math.round(plan.setupCost);
  const isNone = plan.drTier === "none" && !plan.activeActive;
  const allowed: Region[] = r.allowedRegions ?? [];
  const replicaCount = plan.regions.filter((reg) => reg.role !== "primary").length;

  const toggleRegion = (value: Region): void =>
    update({
      allowedRegions: allowed.includes(value) ? allowed.filter((v) => v !== value) : [...allowed, value],
    });

  return (
    <div className="space-y-4">
      <fieldset className="border-0 p-0">
        <legend className="mb-2 flex items-center gap-2 text-label-caps uppercase text-on-surface-variant">
          Continuité régionale (DR)
          <InfoBubble label="Continuité régionale (DR)" why={INFO_DR.why} consequence={INFO_DR.consequence} />
        </legend>
        <RadioCards
          value={plan.drTier}
          options={opts.drTier}
          onChange={(drTier: DrTier) => update({ drTier })}
        />
      </fieldset>

      {!isNone ? (
        <details className="rounded-card border border-outline-variant p-4">
          <summary className="cursor-pointer text-body-sm font-medium text-on-surface">Affinage expert</summary>
          <div className="mt-4 space-y-4">
            <fieldset className="border-0 p-0">
              <legend className="mb-2 text-label-caps uppercase text-on-surface-variant">Région primaire</legend>
              <RadioCards
                value={plan.primaryRegion}
                options={opts.region}
                onChange={(primaryRegion: Region) => update({ primaryRegion })}
              />
            </fieldset>
            <fieldset className="border-0 p-0">
              <legend className="mb-2 flex items-center gap-2 text-label-caps uppercase text-on-surface-variant">
                Régions autorisées (multi-région / multi-continent)
                <InfoBubble label="Régions autorisées" why={INFO_REGIONS.why} consequence={INFO_REGIONS.consequence} />
              </legend>
              <CheckboxCards values={allowed} options={opts.region} onToggle={toggleRegion} />
            </fieldset>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="mb-1 flex items-center gap-2 text-label-caps uppercase text-on-surface-variant">
                  Résidence stricte
                  <InfoBubble label="Résidence stricte" why={INFO_NO_TRANSFER.why} consequence={INFO_NO_TRANSFER.consequence} />
                </p>
                <YesNo
                  ariaLabel="Résidence stricte (aucune copie hors juridiction)"
                  value={noTransfer}
                  onChange={(noTransferOutsideJurisdiction) => update({ noTransferOutsideJurisdiction })}
                />
              </div>
              <div>
                <p className="mb-1 text-label-caps uppercase text-on-surface-variant">Actif-actif (multi-région en charge)</p>
                <YesNo
                  ariaLabel="Actif-actif (régions en charge simultanée)"
                  value={plan.activeActive}
                  onChange={(activeActive) => update({ activeActive })}
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <NumberRow label="RPO régional, perte max (min)" value={plan.rpoMinutes} min={0} onChange={(drRpoMinutes) => update({ drRpoMinutes })} />
              <NumberRow label="RTO régional, bascule (min)" value={plan.rtoMinutes} min={0} onChange={(drRtoMinutes) => update({ drRtoMinutes })} />
            </div>
          </div>
        </details>
      ) : null}

      {/* Alerte de conflit résidence × DR — exposée, JAMAIS résolue en douce (décision Amine #6). */}
      {plan.conflict.hasConflict ? (
        <div className="rounded-card border border-error/40 bg-error/5 p-4 text-body-sm" role="alert">
          <p className="font-medium text-error">Tension résidence × continuité régionale</p>
          <p className="mt-1 text-on-surface-variant">{plan.conflict.reason}</p>
          <p className="mt-2 text-on-surface">Leviers possibles :</p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-on-surface-variant">
            {plan.conflict.levers.map((lever) => (
              <li key={lever}>{lever}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* Aperçu live, factuel (le détail des coûts + la conformité des transferts sont sur la page résultats). */}
      <div className="rounded-card bg-surface-container p-4 text-body-sm text-on-surface-variant" aria-live="polite">
        {isNone ? (
          <p>
            Aucune continuité régionale gérée : la reprise repose sur la restauration de la sauvegarde (pas de réplica
            en attente, pas de surcoût régional).
          </p>
        ) : (
          <>
            <p className="text-on-surface">
              La continuité régionale ajoute ≈ <strong className="font-mono">{monthly} €/mois</strong>
              {setup > 0 ? (
                <>
                  {" "}
                  (+ <strong className="font-mono">{setup} €</strong> de mise en route, amorçage des réplicas)
                </>
              ) : null}
              .
            </p>
            <p className="mt-1">
              Région primaire « {plan.primaryRegion} » · DR {plan.activeActive ? "actif-actif" : plan.drTier} ·{" "}
              {replicaCount} région{replicaCount > 1 ? "s" : ""} en attente · RTO ≈ {plan.rtoMinutes} min.
            </p>
            <p className="mt-1 text-on-surface-variant/80">
              Coûts variables ±30 %, sources datées sur la page résultats. Orientation d’ingénierie, pas un avis
              juridique.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
