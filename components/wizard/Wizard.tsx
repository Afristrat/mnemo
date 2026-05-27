"use client";

import Link from "next/link";
import { useState, type ReactElement, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { BackupBlock } from "@/components/wizard/BackupBlock";
import { BudgetMeter } from "@/components/wizard/BudgetMeter";
import { CheckboxCards } from "@/components/wizard/CheckboxCards";
import { ContinuousSlider } from "@/components/wizard/ContinuousSlider";
import { InfoBubble } from "@/components/wizard/InfoBubble";
import { MediaNeedsBlock } from "@/components/wizard/MediaNeedsBlock";
import { ModuleSlider } from "@/components/wizard/ModuleSlider";
import { NumberStepper } from "@/components/wizard/NumberStepper";
import { RadioCards } from "@/components/wizard/RadioCards";
import { YesNo } from "@/components/wizard/YesNo";
import { MODULES, PRESET_PROFILES, decidePreset, recommend, type BlockId } from "@/lib/engine";
import { getBackupPrices } from "@/lib/pricing/backup-seed";
import { getMediaPricesEur } from "@/lib/pricing/media-feed";
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

// Les 4 blocs (spec §6). Le bloc ④ Médias est structurel ici ; son contenu détaillé
// (besoins par modalité + budget-mètre) est ajouté en S-020.
const BLOCKS: { id: BlockId; title: string; description: string }[] = [
  { id: "profil", title: "Profil & contraintes", description: "Qui vous êtes, et vos contraintes : conformité, sensibilité, budget." },
  { id: "infra", title: "Infra pure", description: "Volume, débit, latence, croissance attendue." },
  { id: "memoire", title: "Usage-Mémoire", description: "À qui sert cette mémoire, que mémoriser, et les usages avancés." },
  { id: "medias", title: "Médias", description: "Besoins audio / vidéo / images, à mémoriser et/ou à créer." },
];

// Infobulles « pourquoi + conséquence », factuelles, non orientées (l'utilisateur tranche).
const INFO = {
  zone: {
    why: "L'emplacement d'hébergement détermine quelles lois s'appliquent (RGPD, CNDP) et l'exposition à des juridictions étrangères (Cloud Act).",
    consequence: "Une zone hors UE peut soumettre vos données à un droit d'accès étranger.",
  },
  regulations: {
    why: "Chaque régime coché ajoute des obligations concrètes (registre Art. 30, AIPD, déclaration CNDP…).",
    consequence: "Les actions de conformité correspondantes sont listées dans la recommandation.",
  },
  sensitivity: {
    why: "Le niveau de sensibilité conditionne le chiffrement, l'isolation et l'auditabilité exigés.",
    consequence: "Plus c'est sensible, plus la stack se durcit, et le coût augmente.",
  },
  techLevel: {
    why: "Vos compétences déterminent ce qui est exploitable en interne, sans prestataire.",
    consequence: "Un profil non technique oriente vers du managé : mise en route plus rapide.",
  },
  budget: {
    why: "Le budget mensuel borne le champ des choix d'infra (managé vs auto-hébergé).",
    consequence: "Un dépassement par rapport à ce budget est explicitement signalé.",
  },
  volume: {
    why: "Le volume de données dimensionne le stockage et l'indexation vectorielle.",
    consequence: "Un volume élevé augmente le coût de stockage et peut imposer une stack plus robuste.",
  },
  reqPerDay: {
    why: "Le débit de requêtes dimensionne l'inférence et la passerelle LLM.",
    consequence: "Un débit élevé rend l'auto-hébergement (vLLM) plus économique que l'API à l'acte.",
  },
  voices: {
    why: "Le nombre de perspectives détermine la gouvernance des accès et la combinatoire de recherche.",
    consequence: "Plusieurs voix impliquent une délégation auditée (RLS, multi-tenant).",
  },
  contentTypes: {
    why: "Les types de contenu déterminent le modèle d'embeddings (texte seul vs multimodal).",
    consequence: "Du multimodal (audio/vidéo/images) ajoute des modèles et du GPU, détaillé au bloc Médias.",
  },
  audit: {
    why: "L'audit signé trace de façon infalsifiable qui a écrit quoi, et quand.",
    consequence: "Exiger l'audit écarte les presets les plus légers (pas de journal signé).",
  },
  bitemporal: {
    why: "Le bitemporel distingue « quand c'est arrivé » de « quand on l'a su », rejouer l'état des connaissances à une date.",
    consequence: "Exiger le bitemporel impose un stockage dédié (Postgres+AGE, Graphiti…).",
  },
} as const;

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

function NoteField({ value, onChange }: { value: string; onChange: (v: string) => void }): ReactElement {
  return (
    <Field label="Note libre (facultatif)">
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={2}
        placeholder="Une précision, une contrainte particulière, un contexte à garder en tête…"
        className={cn(
          "w-full rounded-input bg-surface-container p-3 text-body-md text-on-surface",
          "ring-1 ring-outline/20 placeholder:text-on-surface-variant/60",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
        )}
      />
    </Field>
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
    setNote,
    loadProfile,
  } = useWizardProfile();
  const [step, setStep] = useState(0);

  if (!hydrated) {
    return <p className="p-8 text-center text-on-surface-variant">Chargement…</p>;
  }

  const block = BLOCKS[step];
  const stepValid =
    (block.id === "profil" && profile.regulations.length === 0) ||
    (block.id === "memoire" && profile.contentTypes.length === 0)
      ? false
      : true;

  const isLast = step === BLOCKS.length - 1;
  // Prix médias + backup réels injectés → coût et budget-mètre reflètent multimédia ET sauvegarde.
  const prices = getMediaPricesEur();
  const backupPrices = getBackupPrices();
  const decision = decidePreset(profile);
  const result = recommend(profile, prices, undefined, backupPrices);

  return (
    <div className="w-full lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:gap-8">
      <div className="min-w-0">
      {/* Indicateur de blocs */}
      <ol className="mb-6 flex flex-wrap gap-2">
        {BLOCKS.map((b, i) => (
          <li key={b.id}>
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
              {i + 1} · {b.title}
            </span>
          </li>
        ))}
      </ol>

      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-headline-md text-on-surface">{block.title}</h2>
            <p className="mt-1 text-body-md text-on-surface-variant">{block.description}</p>
          </div>
          {/* Aperçu live, factuel (le budget-mètre détaillé arrive en S-020). */}
          <div className="flex items-center gap-2 whitespace-nowrap">
            <Chip tone="primary">Preset : {decision.preset}</Chip>
            <span className="font-mono text-body-sm text-on-surface-variant">≈ {result.totalCost} €/mois</span>
          </div>
        </div>

        <div className="mt-6 space-y-6">
          {block.id === "profil" ? (
            <>
              <Field label="Activité">
                <RadioCards value={profile.activity} options={ACTIVITY_OPTIONS} onChange={(v) => setField("activity", v)} />
              </Field>
              <Field label="Zone d'hébergement" info={INFO.zone}>
                <RadioCards value={profile.zone} options={ZONE_OPTIONS} onChange={(v) => setField("zone", v)} />
              </Field>
              <Field label="Nombre d'utilisateurs">
                <NumberStepper label="Nombre d'utilisateurs" value={profile.users} onChange={(v) => setField("users", v)} />
              </Field>
              <Field label="Régimes applicables (au moins un)" info={INFO.regulations}>
                <CheckboxCards values={profile.regulations} options={REGULATION_OPTIONS} onToggle={toggleRegulation} />
              </Field>
              <Field label="Sensibilité des données" info={INFO.sensitivity}>
                <RadioCards value={profile.sensitivity} options={SENSITIVITY_OPTIONS} onChange={(v) => setField("sensitivity", v)} />
              </Field>
              <Field label="Niveau technique" info={INFO.techLevel}>
                <RadioCards value={profile.techLevel} options={TECH_LEVEL_OPTIONS} onChange={(v) => setField("techLevel", v)} />
              </Field>
              <Field label="Budget mensuel" info={INFO.budget}>
                <RadioCards value={profile.budget} options={BUDGET_OPTIONS} onChange={(v) => setField("budget", v)} />
              </Field>
              <NoteField value={profile.freeNotes?.profil ?? ""} onChange={(v) => setNote("profil", v)} />
            </>
          ) : null}

          {block.id === "infra" ? (
            <>
              <Field label="Volume de données" info={INFO.volume}>
                <ContinuousSlider label="Volume" options={VOLUME_OPTIONS} value={profile.volume} onChange={(v) => setField("volume", v)} />
              </Field>
              <Field label="Débit de requêtes" info={INFO.reqPerDay}>
                <ContinuousSlider label="Débit" options={REQ_PER_DAY_OPTIONS} value={profile.reqPerDay} onChange={(v) => setField("reqPerDay", v)} />
              </Field>
              <Field label="Latence tolérée">
                <RadioCards value={profile.latency} options={LATENCY_OPTIONS} onChange={(v) => setField("latency", v)} />
              </Field>
              <Field label="Croissance attendue">
                <RadioCards value={profile.growth} options={GROWTH_OPTIONS} onChange={(v) => setField("growth", v)} />
              </Field>
              <div className="border-t border-outline-variant pt-6">
                <h3 className="font-display text-body-lg text-on-surface">Sauvegarde &amp; résilience</h3>
                <p className="mb-3 mt-1 text-body-sm text-on-surface-variant">
                  Choisissez une criticité : le plan (RPO/RTO, copies, hors-site, rétention, effacement) en découle, et
                  l’affinage expert reste possible. Le coût récurrent entre dans le budget-mètre.
                </p>
                <BackupBlock
                  profile={profile}
                  prices={prices}
                  backupPrices={backupPrices}
                  onChange={(backup) => setField("backup", backup)}
                />
              </div>
              <NoteField value={profile.freeNotes?.infra ?? ""} onChange={(v) => setNote("infra", v)} />
            </>
          ) : null}

          {block.id === "memoire" ? (
            <>
              <Field label="À qui sert cette mémoire ?" info={INFO.voices}>
                <RadioCards value={profile.voices} options={VOICES_OPTIONS} onChange={(v) => setField("voices", v)} />
              </Field>
              <Field label="Que mémoriser ? (au moins un)" info={INFO.contentTypes}>
                <CheckboxCards values={profile.contentTypes} options={CONTENT_TYPE_OPTIONS} onToggle={toggleContentType} />
              </Field>
              <Field label="Audit (traçabilité signée)" info={INFO.audit}>
                <YesNo ariaLabel="Audit (traçabilité signée)" value={profile.audit} onChange={(v) => setField("audit", v)} />
              </Field>
              <Field label="Bitemporalité (qui savait quoi quand)" info={INFO.bitemporal}>
                <YesNo
                  ariaLabel="Bitemporalité (qui savait quoi quand)"
                  value={profile.bitemporal}
                  onChange={(v) => setField("bitemporal", v)}
                />
              </Field>
              <Field label="Usages avancés (optionnels)">
                <p className="mb-3 text-body-sm text-on-surface-variant">
                  Mécanismes de gouvernance opt-in : chacun ajuste le coût et le plan d’action. Curseur à zéro = non retenu.
                </p>
                <div className="space-y-4">
                  {MODULES.map((mod) => (
                    <ModuleSlider key={mod.id} module={mod} level={profile.modules[mod.id] ?? 0} onChange={(level) => setModuleLevel(mod.id, level)} />
                  ))}
                </div>
              </Field>
              <NoteField value={profile.freeNotes?.memoire ?? ""} onChange={(v) => setNote("memoire", v)} />
            </>
          ) : null}

          {block.id === "medias" ? (
            <>
              <p className="text-body-md text-on-surface-variant">
                Par modalité : ce que vous devez <strong>mémoriser</strong> (traiter l’existant) et ce que votre infra doit
                <strong> créer</strong>, en souverain 🟢 ou via API 💳. Sans besoin audio/vidéo/images, laissez tout sur « Aucun ».
              </p>
              <MediaNeedsBlock profile={profile} prices={prices} onChange={(mn) => setField("mediaNeeds", mn)} />
              <NoteField value={profile.freeNotes?.medias ?? ""} onChange={(v) => setNote("medias", v)} />
            </>
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
          <Button onClick={() => setStep((s) => Math.min(BLOCKS.length - 1, s + 1))} disabled={!stepValid}>
            Suivant
          </Button>
        )}
      </div>

      {/* Profils-types */}
      <div className="mt-8">
        <p className="mb-2 text-label-caps uppercase text-on-surface-variant">Ou partir d’un profil-type</p>
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
      </aside>
    </div>
  );
}
