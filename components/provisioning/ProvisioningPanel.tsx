"use client";

import { useTranslations } from "next-intl";
import { useMemo, type ReactElement } from "react";
import type { Catalog } from "@/lib/catalog";
import { useEngineText } from "@/lib/i18n/engine";
import { deriveProvisioningProcedures } from "@/lib/provisioning/procedures";
import { deriveProvisioningPlan } from "@/lib/provisioning/plan";

// Provisioning guidé (F10, Lot 2 · B, S-087/S-088) : procédures de création de compte (que l'UTILISATEUR
// réalise) + plan d'optimisation post-création (l'agent, sur compte autorisé). Garde-fou rappelé :
// Strate n'automatise aucune inscription ni saisie de carte.

export function ProvisioningPanel({ catalog }: { catalog?: Catalog }): ReactElement | null {
  const t = useTranslations("Provisioning");
  const resolve = useEngineText();

  const procedures = useMemo(() => (catalog ? deriveProvisioningProcedures(catalog) : []), [catalog]);
  const plan = useMemo(() => (catalog ? deriveProvisioningPlan(catalog) : null), [catalog]);

  if (catalog === undefined || procedures.length === 0 || plan === null) return null;

  return (
    <section className="rounded-card border border-outline-variant bg-surface-container-lowest p-5">
      <h3 className="font-display text-headline-md text-on-surface">{t("title")}</h3>
      <p className="mt-1 text-body-sm text-on-surface-variant">{t("intro")}</p>

      <ul className="mt-4 space-y-4">
        {procedures.map((p) => (
          <li key={p.slot} className="rounded-input border border-outline-variant p-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-body-md font-medium text-on-surface">{p.component}</span>
              <span className="text-label-caps uppercase text-on-surface-variant">
                {p.kind === "account" ? t("kindAccount") : t("kindSelfHost")}
              </span>
            </div>
            <p className="mt-1 text-body-sm text-on-surface-variant">{p.role}</p>
            {p.officialUrl.length > 0 ? (
              <a
                href={p.officialUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-block text-body-sm text-secondary underline decoration-dotted"
              >
                {t("officialLink")} · {p.checkedAt}
              </a>
            ) : null}
            <p className="mt-2 text-label-caps uppercase text-on-surface-variant">{t("stepsLabel")}</p>
            <ol className="ms-4 list-decimal text-body-sm text-on-surface">
              {p.steps.map((s) => (
                <li key={s.id}>{resolve(s)}</li>
              ))}
            </ol>
            <p className="mt-2 text-body-sm text-on-surface-variant">
              {t("fieldsLabel")} {p.fieldsToNote.map((f) => resolve(f)).join(" · ")}
            </p>
          </li>
        ))}
      </ul>

      <div className="mt-5">
        <p className="text-label-caps uppercase text-on-surface-variant">{t("planTitle")}</p>
        <ul className="mt-2 space-y-1 text-body-sm text-on-surface">
          {plan.tasks.map((task) => (
            <li key={task.slot}>• {resolve(task.action)}</li>
          ))}
        </ul>
        <p className="mt-3 rounded-input bg-surface-container p-3 text-body-sm text-on-surface-variant">
          🔒 {resolve(plan.guardrail)}
        </p>
      </div>
    </section>
  );
}
