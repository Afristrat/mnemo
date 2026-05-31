"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useEffect, useState, type ReactElement, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { BackupBlock } from "@/components/wizard/BackupBlock";
import { BudgetMeter } from "@/components/wizard/BudgetMeter";
import { ChoiceRecap } from "@/components/wizard/ChoiceRecap";
import { CheckboxCards } from "@/components/wizard/CheckboxCards";
import { ContinuousSlider } from "@/components/wizard/ContinuousSlider";
import { InfoBubble } from "@/components/wizard/InfoBubble";
import { MediaNeedsBlock } from "@/components/wizard/MediaNeedsBlock";
import { ModuleSlider } from "@/components/wizard/ModuleSlider";
import { ResidencyBlock } from "@/components/wizard/ResidencyBlock";
import { NumberStepper } from "@/components/wizard/NumberStepper";
import { RadioCards } from "@/components/wizard/RadioCards";
import { YesNo } from "@/components/wizard/YesNo";
import { MODULES, PRESET_PROFILES, decidePreset, defaultCountryFor, recommend, type BlockId, type Profile } from "@/lib/engine";
import { useEngineText } from "@/lib/i18n/engine";
import { applyIntakeFields } from "@/lib/llm/intake";
import { getBackupPrices } from "@/lib/pricing/backup-seed";
import { getComputePrices } from "@/lib/pricing/compute-seed";
import { getMediaPricesEur } from "@/lib/pricing/media-feed";
import { getLlmTokenPrices } from "@/lib/pricing/llm-token-seed";
import { getResidencyPrices } from "@/lib/pricing/residency-seed";
import { buildChoiceRecap } from "@/lib/wizard/recap";
import { useWizardProfile } from "@/hooks/useWizardProfile";
import { cn } from "@/lib/utils/cn";
import { useOptions } from "@/lib/wizard/useOptions";

const BLOCK_IDS: BlockId[] = ["profil", "infra", "memoire", "medias"];

function Field({
  label,
  info,
  children,
}: {
  label: string;
  info?: { why: string; consequence: string };
  children: ReactNode;
}): ReactElement {
  return (
    <fieldset className="border-0 p-0">
      <legend className="mb-2 flex items-center gap-2 text-label-caps uppercase text-on-surface-variant">
        {label}
        {info ? <InfoBubble label={label} why={info.why} consequence={info.consequence} /> : null}
      </legend>
      {children}
    </fieldset>
  );
}

type IntakeResponse = { profile?: Profile; applied?: string[]; rejected?: string[] };
type NoteState = { kind: "idle" } | { kind: "busy" } | { kind: "error" } | { kind: "done"; applied: string[] };

/**
 * Note libre par bloc (S-019) RÉELLEMENT intégrée (S-052) : « Intégrer » fait lire la note par l'intake
 * LLM (route serveur), qui AJUSTE le profil courant (valeurs validées/bornées, le LLM ne calcule rien).
 * On n'applique que les champs réellement extraits (`applyIntakeFields`) → médias/backup/modules
 * préservés. Additif et jamais bloquant : la saisie manuelle reste disponible, la note est conservée
 * (persistée + reprise par la narration des résultats). Repli silencieux si le LLM est indisponible.
 */
function NoteField({
  block,
  value,
  onChange,
  profile,
  onApply,
}: {
  block: BlockId;
  value: string;
  onChange: (v: string) => void;
  profile: Profile;
  onApply: (next: Profile) => void;
}): ReactElement {
  const [state, setState] = useState<NoteState>({ kind: "idle" });
  const t = useTranslations("Wizard.note");
  const tLabels = useTranslations("Wizard.intakeFieldLabels");

  const integrate = async (): Promise<void> => {
    if (value.trim() === "") return;
    setState({ kind: "busy" });
    try {
      const res = await fetch("/api/llm/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: value, base: profile }),
      });
      if (!res.ok) {
        setState({ kind: "error" });
        return;
      }
      const data: IntakeResponse = await res.json();
      if (data.profile === undefined || data.applied === undefined) {
        setState({ kind: "error" });
        return;
      }
      // LLM indisponible (repli serveur) → rien appliqué : on le dit honnêtement, pas « aucun paramètre ».
      if ((data.rejected ?? []).includes("llm")) {
        setState({ kind: "error" });
        return;
      }
      const next = applyIntakeFields(profile, {
        profile: data.profile,
        applied: data.applied,
        rejected: data.rejected ?? [],
      });
      // La note est conservée dans freeNotes (persistée, et reprise par la narration côté résultats).
      onApply({ ...next, freeNotes: { ...next.freeNotes, [block]: value } });
      setState({ kind: "done", applied: data.applied });
    } catch {
      setState({ kind: "error" });
    }
  };

  return (
    <Field label={t("label")}>
      <textarea
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          if (state.kind !== "idle") setState({ kind: "idle" });
        }}
        rows={2}
        placeholder={t("placeholder")}
        className={cn(
          "w-full rounded-input bg-surface-container p-3 text-body-md text-on-surface",
          "ring-1 ring-outline/20 placeholder:text-on-surface-variant/60",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
        )}
      />
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => void integrate()}
          disabled={state.kind === "busy" || value.trim() === ""}
        >
          {state.kind === "busy" ? t("integrating") : t("integrate")}
        </Button>
        {state.kind === "done" ? (
          state.applied.length > 0 ? (
            <span className="text-body-sm text-on-surface-variant">
              {t("doneAdjusted", {
                fields: state.applied.map((f) => (tLabels.has(f) ? tLabels(f) : f)).join(", "),
              })}
            </span>
          ) : (
            <span className="text-body-sm text-on-surface-variant">{t("doneNothing")}</span>
          )
        ) : null}
        {state.kind === "error" ? (
          <span className="text-body-sm text-error">{t("error")}</span>
        ) : null}
      </div>
      <p className="mt-1 text-body-sm text-on-surface-variant">{t("help")}</p>
    </Field>
  );
}

/**
 * Saisie libre « Autre » (S-064), rendue inline sous un RadioCards dont la valeur === "other".
 * Le texte est une DONNÉE du profil (persistée), JAMAIS un nombre : il alimente uniquement le récap
 * et les canaux explicatifs/LLM (narration, FAITS de l'assistant), pas le chiffrage déterministe.
 */
function OtherTextField({
  field,
  value,
  onChange,
}: {
  field: "activity" | "zone" | "region";
  value: string;
  onChange: (value: string) => void;
}): ReactElement {
  const t = useTranslations("Wizard.other");
  const inputId = `other-${field}`;
  return (
    <div className="mt-3 rounded-card border border-outline-variant bg-surface-container-lowest p-4">
      <label htmlFor={inputId} className="mb-2 block text-label-caps uppercase text-on-surface-variant">
        {t(`${field}Label`)}
      </label>
      <input
        id={inputId}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t(`${field}Placeholder`)}
        className={cn(
          "w-full rounded-input bg-surface-container p-3 text-body-md text-on-surface",
          "ring-1 ring-outline/20 placeholder:text-on-surface-variant/60",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
        )}
      />
      <p className="mt-2 text-body-sm text-on-surface-variant">{t("help")}</p>
    </div>
  );
}

export function Wizard(): ReactElement {
  const {
    profile,
    hydrated,
    setField,
    setGeography,
    toggleContentType,
    toggleRegulation,
    setModuleLevel,
    setNote,
    setOtherText,
    loadProfile,
  } = useWizardProfile();
  const [step, setStep] = useState(0);
  const opts = useOptions();
  const tOptions = useTranslations("Options");
  const t = useTranslations("Wizard");
  const tInfo = useTranslations("Wizard.info");
  const tFields = useTranslations("Wizard.fields");
  const tBlocks = useTranslations("Wizard.blocks");
  const tRecap = useTranslations("Wizard.recap");
  const resolveEngine = useEngineText();

  // À chaque changement d'étape (Suivant/Précédent/profil-type), remonter en haut de page :
  // l'utilisateur n'a pas à utiliser l'ascenseur pour retrouver le début du bloc suivant.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [step]);

  if (!hydrated) {
    return <p className="p-8 text-center text-on-surface-variant">{t("loading")}</p>;
  }

  const blockId = BLOCK_IDS[step];
  const stepValid =
    (blockId === "profil" && profile.regulations.length === 0) ||
    (blockId === "memoire" && profile.contentTypes.length === 0)
      ? false
      : true;

  const isLast = step === BLOCK_IDS.length - 1;
  // Prix médias + backup réels injectés → coût et budget-mètre reflètent multimédia ET sauvegarde.
  const prices = getMediaPricesEur();
  const backupPrices = getBackupPrices();
  const residencyPrices = getResidencyPrices();
  const decision = decidePreset(profile);
  const result = recommend(profile, prices, undefined, backupPrices, getComputePrices(), residencyPrices, getLlmTokenPrices());

  return (
    <div className="w-full lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:gap-8">
      <div className="min-w-0">
      {/* Indicateur de blocs */}
      <ol className="mb-6 flex flex-wrap gap-2">
        {BLOCK_IDS.map((id, i) => (
          <li key={id}>
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
              {t("stepBadge", { n: i + 1, title: tBlocks(`${id}.title`) })}
            </span>
          </li>
        ))}
      </ol>

      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-headline-md text-on-surface">{tBlocks(`${blockId}.title`)}</h2>
            <p className="mt-1 text-body-md text-on-surface-variant">{tBlocks(`${blockId}.description`)}</p>
          </div>
          {/* Aperçu live, factuel (le budget-mètre détaillé arrive en S-020). */}
          <div className="flex items-center gap-2 whitespace-nowrap">
            <Chip tone="primary">{t("presetChip", { preset: decision.preset })}</Chip>
            <span className="font-mono text-body-sm text-on-surface-variant">{t("monthlyApprox", { cost: result.totalCost })}</span>
          </div>
        </div>

        <div className="mt-6 space-y-6">
          {blockId === "profil" ? (
            <>
              <Field label={tFields("activity")}>
                <RadioCards value={profile.activity} options={opts.activity} onChange={(v) => setField("activity", v)} />
                {profile.activity === "other" ? (
                  <OtherTextField
                    field="activity"
                    value={profile.otherText?.activity ?? ""}
                    onChange={(v) => setOtherText("activity", v)}
                  />
                ) : null}
              </Field>
              <Field label={tFields("continent")} info={{ why: tInfo("continent.why"), consequence: tInfo("continent.consequence") }}>
                <RadioCards
                  value={profile.continent}
                  options={opts.continent}
                  onChange={(c) => setGeography(c, defaultCountryFor(c))}
                />
              </Field>
              <Field label={tFields("country")} info={{ why: tInfo("country.why"), consequence: tInfo("country.consequence") }}>
                <RadioCards
                  value={profile.country}
                  options={opts.countriesFor(profile.continent)}
                  onChange={(c) => setGeography(profile.continent, c)}
                />
                {profile.country.startsWith("autre-") ? (
                  <OtherTextField
                    field="zone"
                    value={profile.otherText?.zone ?? ""}
                    onChange={(v) => setOtherText("zone", v)}
                  />
                ) : null}
              </Field>
              <Field label={tFields("users")}>
                <NumberStepper label={tFields("users")} value={profile.users} onChange={(v) => setField("users", v)} />
              </Field>
              <Field label={tFields("regulations")} info={{ why: tInfo("regulations.why"), consequence: tInfo("regulations.consequence") }}>
                <CheckboxCards values={profile.regulations} options={opts.regulation} onToggle={toggleRegulation} />
              </Field>
              <Field label={tFields("sensitivity")} info={{ why: tInfo("sensitivity.why"), consequence: tInfo("sensitivity.consequence") }}>
                <RadioCards value={profile.sensitivity} options={opts.sensitivity} onChange={(v) => setField("sensitivity", v)} />
              </Field>
              <Field label={tFields("techLevel")} info={{ why: tInfo("techLevel.why"), consequence: tInfo("techLevel.consequence") }}>
                <RadioCards value={profile.techLevel} options={opts.techLevel} onChange={(v) => setField("techLevel", v)} />
              </Field>
              <Field label={tFields("budget")} info={{ why: tInfo("budget.why"), consequence: tInfo("budget.consequence") }}>
                <RadioCards value={profile.budget} options={opts.budget} onChange={(v) => setField("budget", v)} />
              </Field>
              <Field
                label={tFields("preferSovereign")}
                info={{ why: tInfo("preferSovereign.why"), consequence: tInfo("preferSovereign.consequence") }}
              >
                <YesNo
                  ariaLabel={tFields("preferSovereign")}
                  value={profile.preferSovereign ?? false}
                  onChange={(v) => setField("preferSovereign", v)}
                />
              </Field>
              <NoteField
                block="profil"
                value={profile.freeNotes?.profil ?? ""}
                onChange={(v) => setNote("profil", v)}
                profile={profile}
                onApply={loadProfile}
              />
            </>
          ) : null}

          {blockId === "infra" ? (
            <>
              <Field label={tFields("volume")} info={{ why: tInfo("volume.why"), consequence: tInfo("volume.consequence") }}>
                <ContinuousSlider label={t("sliderLabels.volume")} options={opts.volume} value={profile.volume} onChange={(v) => setField("volume", v)} />
              </Field>
              <Field label={tFields("reqPerDay")} info={{ why: tInfo("reqPerDay.why"), consequence: tInfo("reqPerDay.consequence") }}>
                <ContinuousSlider label={t("sliderLabels.reqPerDay")} options={opts.reqPerDay} value={profile.reqPerDay} onChange={(v) => setField("reqPerDay", v)} />
              </Field>
              <Field label={tFields("latency")}>
                <RadioCards value={profile.latency} options={opts.latency} onChange={(v) => setField("latency", v)} />
              </Field>
              <Field label={tFields("growth")}>
                <RadioCards value={profile.growth} options={opts.growth} onChange={(v) => setField("growth", v)} />
              </Field>
              <div className="border-t border-outline-variant pt-6">
                <h3 className="font-display text-body-lg text-on-surface">{t("backup.sectionTitle")}</h3>
                <p className="mb-3 mt-1 text-body-sm text-on-surface-variant">{t("backup.sectionDesc")}</p>
                <BackupBlock
                  profile={profile}
                  prices={prices}
                  backupPrices={backupPrices}
                  onChange={(backup) => setField("backup", backup)}
                />
              </div>
              <div className="border-t border-outline-variant pt-6">
                <h3 className="font-display text-body-lg text-on-surface">{t("residency.sectionTitle")}</h3>
                <p className="mb-3 mt-1 text-body-sm text-on-surface-variant">{t("residency.sectionDesc")}</p>
                <ResidencyBlock
                  profile={profile}
                  residencyPrices={residencyPrices}
                  computePrices={getComputePrices()}
                  onChange={(residency) => setField("residency", residency)}
                />
                {profile.residency?.primaryRegion === "other" ||
                (profile.residency?.allowedRegions ?? []).includes("other") ? (
                  <OtherTextField
                    field="region"
                    value={profile.otherText?.region ?? ""}
                    onChange={(v) => setOtherText("region", v)}
                  />
                ) : null}
              </div>
              <NoteField
                block="infra"
                value={profile.freeNotes?.infra ?? ""}
                onChange={(v) => setNote("infra", v)}
                profile={profile}
                onApply={loadProfile}
              />
            </>
          ) : null}

          {blockId === "memoire" ? (
            <>
              <Field label={tFields("voices")} info={{ why: tInfo("voices.why"), consequence: tInfo("voices.consequence") }}>
                <RadioCards value={profile.voices} options={opts.voices} onChange={(v) => setField("voices", v)} />
              </Field>
              <Field label={tFields("contentTypes")} info={{ why: tInfo("contentTypes.why"), consequence: tInfo("contentTypes.consequence") }}>
                <CheckboxCards values={profile.contentTypes} options={opts.contentType} onToggle={toggleContentType} />
              </Field>
              <Field label={tFields("audit")} info={{ why: tInfo("audit.why"), consequence: tInfo("audit.consequence") }}>
                <YesNo ariaLabel={tFields("audit")} value={profile.audit} onChange={(v) => setField("audit", v)} />
              </Field>
              <Field label={tFields("bitemporal")} info={{ why: tInfo("bitemporal.why"), consequence: tInfo("bitemporal.consequence") }}>
                <YesNo
                  ariaLabel={tFields("bitemporal")}
                  value={profile.bitemporal}
                  onChange={(v) => setField("bitemporal", v)}
                />
              </Field>
              <Field label={tFields("advancedUses")}>
                <p className="mb-3 text-body-sm text-on-surface-variant">{t("advancedUsesHint")}</p>
                <div className="space-y-4">
                  {MODULES.map((mod) => (
                    <ModuleSlider key={mod.id} module={mod} level={profile.modules[mod.id] ?? 0} onChange={(level) => setModuleLevel(mod.id, level)} />
                  ))}
                </div>
              </Field>
              <NoteField
                block="memoire"
                value={profile.freeNotes?.memoire ?? ""}
                onChange={(v) => setNote("memoire", v)}
                profile={profile}
                onApply={loadProfile}
              />
            </>
          ) : null}

          {blockId === "medias" ? (
            <>
              <p className="text-body-md text-on-surface-variant">
                {t.rich("media.intro", { strong: (chunks) => <strong>{chunks}</strong> })}
              </p>
              <MediaNeedsBlock profile={profile} prices={prices} onChange={(mn) => setField("mediaNeeds", mn)} />
              <NoteField
                block="medias"
                value={profile.freeNotes?.medias ?? ""}
                onChange={(v) => setNote("medias", v)}
                profile={profile}
                onApply={loadProfile}
              />
            </>
          ) : null}
        </div>
      </Card>

      {/* Navigation */}
      <div className="mt-6 flex items-center justify-between gap-3">
        <Button variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
          {t("prev")}
        </Button>

        {isLast ? (
          <Link
            href="/resultats"
            className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-2.5 text-body-md font-medium text-on-primary transition-colors hover:bg-primary-container"
          >
            {t("seeReco")}
          </Link>
        ) : (
          <Button onClick={() => setStep((s) => Math.min(BLOCK_IDS.length - 1, s + 1))} disabled={!stepValid}>
            {t("next")}
          </Button>
        )}
      </div>

      {/* Profils-types */}
      <div className="mt-8">
        <p className="mb-2 text-label-caps uppercase text-on-surface-variant">{t("orPreset")}</p>
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

      {/* Budget-mètre, colonne de droite, sticky (ne mange pas la hauteur du contenu). Coût d'infra, jamais prix de vente. */}
      <aside className="mt-6 lg:mt-0 lg:sticky lg:top-6">
        <BudgetMeter
          totalCost={result.totalCost}
          budget={profile.budget}
          sizing={result.sizing}
          backupMonthlyCost={result.backup.monthlyCost}
        />
        <ChoiceRecap className="mt-4" groups={buildChoiceRecap(profile, result, tOptions, resolveEngine, tRecap)} />
      </aside>
    </div>
  );
}
