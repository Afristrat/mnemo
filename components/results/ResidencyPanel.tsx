import type { ReactElement } from "react";
import { Card } from "@/components/ui/Card";
import type { Region, ResidencyPlan, TransferFlag } from "@/lib/engine";

type ResidencyPanelProps = {
  plan: ResidencyPlan;
};

const REGION_LABEL: Record<Region, string> = {
  eu: "Union européenne",
  maroc: "Maroc",
  us: "États-Unis",
  other: "Autre",
};

const STATUS_META: Record<TransferFlag["status"], { icon: string; label: string; tone: string }> = {
  ok: { icon: "✅", label: "Autorisé", tone: "text-primary" },
  restricted: { icon: "⚠️", label: "Encadré", tone: "text-tertiary" },
  forbidden: { icon: "⛔", label: "Interdit", tone: "text-error" },
};

/**
 * Panneau Résidence & transferts (S-048, spec n°2 §9) : topologie des régions, conformité des flux
 * inter-juridiction (pastilles autorisé/encadré/interdit + base légale datée), RPO/RTO régionaux et
 * alerte de conflit. Rendu uniquement si une continuité régionale est dérivée (DR ≠ none) ou si des
 * transferts sont à signaler. Disclaimer « ingénierie, pas un avis juridique » systématique.
 */
export function ResidencyPanel({ plan }: ResidencyPanelProps): ReactElement | null {
  const hasDr = plan.drTier !== "none" || plan.activeActive;
  if (!hasDr && plan.transfers.length === 0 && !plan.conflict.hasConflict) return null;

  return (
    <Card>
      <h3 className="font-display text-headline-md text-on-surface">Résidence &amp; transferts</h3>
      <p className="mt-1 text-body-sm text-on-surface-variant">
        Où vivent les données et la conformité des flux inter-juridiction. Orientation d’ingénierie, pas un avis
        juridique : vérifiez chaque base légale avec un conseil avant décision.
      </p>

      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <dt className="text-label-caps uppercase text-on-surface-variant">Région primaire</dt>
          <dd className="text-body-md text-on-surface">{REGION_LABEL[plan.primaryRegion]}</dd>
        </div>
        <div>
          <dt className="text-label-caps uppercase text-on-surface-variant">Continuité régionale</dt>
          <dd className="text-body-md text-on-surface">
            {plan.activeActive ? "Actif-actif" : plan.drTier === "none" ? "Aucune (restauration backup)" : `DR ${plan.drTier}`} ·
            RPO ≈ {plan.rpoMinutes} min · RTO ≈ {plan.rtoMinutes} min
          </dd>
        </div>
      </dl>

      {plan.transfers.length > 0 ? (
        <div className="mt-4">
          <p className="text-label-caps uppercase text-on-surface-variant">Transferts inter-juridiction</p>
          <ul className="mt-2 space-y-2">
            {plan.transfers.map((t) => {
              const meta = STATUS_META[t.status];
              return (
                <li key={`${t.from}-${t.to}`} className="rounded-card bg-surface-container p-3 text-body-sm">
                  <p className="flex items-center gap-2">
                    <span aria-hidden="true">{meta.icon}</span>
                    <span className="text-on-surface">
                      {REGION_LABEL[t.from]} → {REGION_LABEL[t.to]}
                    </span>
                    <span className={meta.tone}>· {meta.label}</span>
                  </p>
                  <p className="mt-1 text-on-surface-variant">
                    <span className="font-medium text-on-surface">Base légale : </span>
                    {t.legalBasis}
                  </p>
                  {t.note !== "" ? <p className="mt-1 text-on-surface-variant/80">{t.note}</p> : null}
                </li>
              );
            })}
          </ul>
        </div>
      ) : hasDr ? (
        <p className="mt-4 text-body-sm text-on-surface-variant">
          Aucun flux inter-juridiction : la continuité régionale reste dans la juridiction primaire (résidence
          stricte respectée).
        </p>
      ) : null}

      {plan.conflict.hasConflict ? (
        <div className="mt-4 rounded-card border border-error/40 bg-error/5 p-4 text-body-sm" role="alert">
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
    </Card>
  );
}
