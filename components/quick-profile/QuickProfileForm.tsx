"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactElement, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { RadioCards } from "@/components/wizard/RadioCards";
import {
  DEFAULT_QUICK_ANSWERS,
  mapQuickAnswersToProfile,
  type QuickAnswers,
  type QuickData,
  type QuickMedia,
  type QuickPriority,
  type QuickWho,
} from "@/lib/quick/profile-mappers";
import { STORAGE_KEY } from "@/lib/wizard/defaultProfile";
import type { Option } from "@/lib/wizard/options";

function Field({ label, children }: { label: string; children: ReactNode }): ReactElement {
  return (
    <fieldset className="border-0 p-0">
      <legend className="mb-2 text-label-caps uppercase text-on-surface-variant">{label}</legend>
      {children}
    </fieldset>
  );
}

/**
 * Chemin 90 s : 4 questions qualitatives → `Profile` (mappers) écrit dans la source de vérité
 * (`localStorage`, même clé que le wizard) → `/resultats` en mode verdict. « Affiner » mène au
 * configurateur, pré-rempli avec le même profil.
 */
export function QuickProfileForm(): ReactElement {
  const router = useRouter();
  const t = useTranslations("QuickProfile");
  const [answers, setAnswers] = useState<QuickAnswers>(DEFAULT_QUICK_ANSWERS);

  const whoOptions: Option<QuickWho>[] = [
    { value: "solo", label: t("who.solo") },
    { value: "team", label: t("who.team") },
    { value: "regulated", label: t("who.regulated"), hint: t("who.regulatedHint") },
    { value: "research", label: t("who.research") },
  ];
  const dataOptions: Option<QuickData>[] = [
    { value: "public", label: t("data.public") },
    { value: "internal", label: t("data.internal") },
    { value: "sensitive", label: t("data.sensitive") },
    { value: "secret", label: t("data.secret") },
  ];
  const priorityOptions: Option<QuickPriority>[] = [
    { value: "sovereignty", label: t("priority.sovereignty") },
    { value: "cost", label: t("priority.cost") },
    { value: "speed", label: t("priority.speed") },
  ];
  const mediaOptions: Option<QuickMedia>[] = [
    { value: "text", label: t("media.text") },
    { value: "media", label: t("media.media") },
  ];

  function set<K extends keyof QuickAnswers>(key: K, value: QuickAnswers[K]): void {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  }

  function persist(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(mapQuickAnswersToProfile(answers)));
    } catch {
      /* stockage indisponible : /resultats retombera sur le profil par défaut. */
    }
  }

  return (
    <Card className="w-full max-w-2xl text-left">
      <div className="space-y-6">
        <Field label={t("fieldWho")}>
          <RadioCards value={answers.who} options={whoOptions} onChange={(v) => set("who", v)} />
        </Field>
        <Field label={t("fieldData")}>
          <RadioCards value={answers.data} options={dataOptions} onChange={(v) => set("data", v)} />
        </Field>
        <Field label={t("fieldPriority")}>
          <RadioCards value={answers.priority} options={priorityOptions} onChange={(v) => set("priority", v)} />
        </Field>
        <Field label={t("fieldMedia")}>
          <RadioCards value={answers.media} options={mediaOptions} onChange={(v) => set("media", v)} />
        </Field>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/configurateur"
          onClick={persist}
          className="text-body-sm text-secondary underline decoration-dotted"
        >
          {t("refine")}
        </Link>
        <Button
          onClick={() => {
            persist();
            router.push("/resultats?mode=verdict");
          }}
        >
          {t("verdict")}
        </Button>
      </div>
      <p className="mt-3 text-body-sm text-on-surface-variant">{t("disclaimer")}</p>
    </Card>
  );
}
