"use client";

import Link from "next/link";
import { useState, type ReactElement, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { CheckboxCards } from "@/components/wizard/CheckboxCards";
import { ModuleSlider } from "@/components/wizard/ModuleSlider";
import { NumberStepper } from "@/components/wizard/NumberStepper";
import { RadioCards } from "@/components/wizard/RadioCards";
import { YesNo } from "@/components/wizard/YesNo";
import { MODULES, PRESET_PROFILES, decidePreset, recommend } from "@/lib/engine";
import { useWizardProfile } from "@/hooks/useWizardProfile";
import { cn } from "@/lib/utils/cn";
import {
  ACTIVITY_OPTIONS,
  BUDGET_OPTIONS,
  CONTENT_TYPE_OPTIONS,
  GROWTH_OPTIONS,
  LATENCY_OPTIONS,
  REGULATION_OPTIONS,
  REQ_PER_DAY_OPTIONS,
  SENSITIVITY_OPTIONS,
  TECH_LEVEL_OPTIONS,
  VOICES_OPTIONS,
  VOLUME_OPTIONS,
  ZONE_OPTIONS,
} from "@/lib/wizard/options";

const STEPS = [
  { title: "Activité & échelle", description: "Qui êtes-vous et à quelle échelle ?" },
  { title: "Contenu & usage", description: "Quelle matière et quel usage ?" },
  { title: "Conformité & sensibilité", description: "Quelles contraintes réglementaires ?" },
  { title: "Contraintes techniques", description: "Compétences, budget, charge." },
  { title: "Modules avancés", description: "Mécanismes optionnels de fiabilité." },
  { title: "Récapitulatif", description: "Votre profil et le preset retenu." },
] as const;

function Field({ label, children }: { label: string; children: ReactNode }): ReactElement {
  return (
    <fieldset className="border-0 p-0">
      <legend className="mb-2 text-label-caps uppercase text-on-surface-variant">{label}</legend>
      {children}
    </fieldset>
  );
}

export function Wizard(): ReactElement {
  const {
    profile,
    hydrated,
    setField,
    toggleContentType,
    toggleRegulation,
    setModuleLevel,
    loadProfile,
  } = useWizardProfile();
  const [step, setStep] = useState(0);

  if (!hydrated) {
    return <p className="p-8 text-center text-on-surface-variant">Chargement…</p>;
  }

  const stepValid =
    (step === 1 && profile.contentTypes.length === 0) ||
    (step === 2 && profile.regulations.length === 0)
      ? false
      : true;

  const isLast = step === STEPS.length - 1;
  const decision = decidePreset(profile);
  const result = recommend(profile);

  return (
    <div className="mx-auto max-w-3xl">
      {/* Indicateur d'étapes */}
      <ol className="mb-6 flex flex-wrap gap-2">
        {STEPS.map((s, i) => (
          <li key={s.title}>
            <span
              className={cn(
                "rounded-full px-3 py-1 text-label-caps uppercase",
                i === step
                  ? "bg-primary text-on-primary"
                  : i < step
                    ? "bg-primary/10 text-primary"
                    : "bg-surface-container text-on-surface-variant",
              )}
            >
              {i + 1} · {s.title}
            </span>
          </li>
        ))}
      </ol>

      <Card>
        <h2 className="font-display text-headline-md text-on-surface">{STEPS[step].title}</h2>
        <p className="mt-1 text-body-md text-on-surface-variant">{STEPS[step].description}</p>

        <div className="mt-6 space-y-6">
          {step === 0 ? (
            <>
              <Field label="Activité">
                <RadioCards
                  value={profile.activity}
                  options={ACTIVITY_OPTIONS}
                  onChange={(v) => setField("activity", v)}
                />
              </Field>
              <Field label="Zone d'hébergement">
                <RadioCards value={profile.zone} options={ZONE_OPTIONS} onChange={(v) => setField("zone", v)} />
              </Field>
              <Field label="Nombre d'utilisateurs">
                <NumberStepper
                  label="Nombre d'utilisateurs"
                  value={profile.users}
                  onChange={(v) => setField("users", v)}
                />
              </Field>
              <Field label="Croissance attendue">
                <RadioCards value={profile.growth} options={GROWTH_OPTIONS} onChange={(v) => setField("growth", v)} />
              </Field>
            </>
          ) : null}

          {step === 1 ? (
            <>
              <Field label="Types de contenu (au moins un)">
                <CheckboxCards
                  values={profile.contentTypes}
                  options={CONTENT_TYPE_OPTIONS}
                  onToggle={toggleContentType}
                />
              </Field>
              <Field label="Volume de données">
                <RadioCards value={profile.volume} options={VOLUME_OPTIONS} onChange={(v) => setField("volume", v)} />
              </Field>
              <Field label="Perspectives / voix">
                <RadioCards value={profile.voices} options={VOICES_OPTIONS} onChange={(v) => setField("voices", v)} />
              </Field>
            </>
          ) : null}

          {step === 2 ? (
            <>
              <Field label="Régimes applicables (au moins un)">
                <CheckboxCards
                  values={profile.regulations}
                  options={REGULATION_OPTIONS}
                  onToggle={toggleRegulation}
                />
              </Field>
              <Field label="Sensibilité des données">
                <RadioCards
                  value={profile.sensitivity}
                  options={SENSITIVITY_OPTIONS}
                  onChange={(v) => setField("sensitivity", v)}
                />
              </Field>
              <Field label="Audit (traçabilité signée)">
                <YesNo value={profile.audit} onChange={(v) => setField("audit", v)} />
              </Field>
              <Field label="Bitemporalité (qui savait quoi quand)">
                <YesNo value={profile.bitemporal} onChange={(v) => setField("bitemporal", v)} />
              </Field>
            </>
          ) : null}

          {step === 3 ? (
            <>
              <Field label="Niveau technique">
                <RadioCards
                  value={profile.techLevel}
                  options={TECH_LEVEL_OPTIONS}
                  onChange={(v) => setField("techLevel", v)}
                />
              </Field>
              <Field label="Budget mensuel">
                <RadioCards value={profile.budget} options={BUDGET_OPTIONS} onChange={(v) => setField("budget", v)} />
              </Field>
              <Field label="Requêtes par jour">
                <RadioCards
                  value={profile.reqPerDay}
                  options={REQ_PER_DAY_OPTIONS}
                  onChange={(v) => setField("reqPerDay", v)}
                />
              </Field>
              <Field label="Latence tolérée">
                <RadioCards value={profile.latency} options={LATENCY_OPTIONS} onChange={(v) => setField("latency", v)} />
              </Field>
            </>
          ) : null}

          {step === 4 ? (
            <div className="space-y-4">
              {MODULES.map((mod) => (
                <ModuleSlider
                  key={mod.id}
                  module={mod}
                  level={profile.modules[mod.id] ?? 0}
                  onChange={(level) => setModuleLevel(mod.id, level)}
                />
              ))}
            </div>
          ) : null}

          {step === 5 ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <Chip tone="primary">Preset retenu : {decision.preset}</Chip>
                <span className="font-mono text-body-sm text-on-surface-variant">
                  ≈ {result.totalCost} €/mois (projection ±30 %)
                </span>
              </div>
              <p className="text-body-md text-on-surface-variant">{decision.reason}</p>
              <dl className="grid gap-2 text-body-sm sm:grid-cols-2">
                <div>
                  <dt className="text-on-surface-variant">Activité</dt>
                  <dd className="text-on-surface">{profile.activity}</dd>
                </div>
                <div>
                  <dt className="text-on-surface-variant">Contenus</dt>
                  <dd className="text-on-surface">{profile.contentTypes.join(", ")}</dd>
                </div>
                <div>
                  <dt className="text-on-surface-variant">Régimes</dt>
                  <dd className="text-on-surface">{profile.regulations.join(", ")}</dd>
                </div>
                <div>
                  <dt className="text-on-surface-variant">Sensibilité</dt>
                  <dd className="text-on-surface">{profile.sensitivity}</dd>
                </div>
              </dl>
              <p className="text-body-sm text-on-surface-variant">
                Une IA peut se tromper : la recommandation détaillée expose chaque coût avec sa
                source.
              </p>
            </div>
          ) : null}
        </div>
      </Card>

      {/* Navigation */}
      <div className="mt-6 flex items-center justify-between gap-3">
        <Button variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
          Précédent
        </Button>

        {isLast ? (
          <Link
            href="/resultats"
            className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-2.5 text-body-md font-medium text-on-primary transition-colors hover:bg-primary-container"
          >
            Voir ma recommandation détaillée
          </Link>
        ) : (
          <Button onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))} disabled={!stepValid}>
            Suivant
          </Button>
        )}
      </div>

      {/* Profils-types */}
      <div className="mt-8">
        <p className="mb-2 text-label-caps uppercase text-on-surface-variant">
          Ou partir d’un profil-type
        </p>
        <div className="flex flex-wrap gap-2">
          {PRESET_PROFILES.map((preset) => (
            <Button
              key={preset.name}
              variant="secondary"
              size="sm"
              onClick={() => {
                loadProfile(preset.profile);
                setStep(0);
              }}
            >
              {preset.name}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
