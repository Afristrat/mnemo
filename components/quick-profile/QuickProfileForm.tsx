"use client";

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

const WHO_OPTIONS: Option<QuickWho>[] = [
  { value: "solo", label: "Indépendant / solo" },
  { value: "team", label: "Équipe / PME" },
  { value: "regulated", label: "Profession régulée", hint: "Avocat, santé, CGP — secret pro" },
  { value: "research", label: "Recherche / académique" },
];

const DATA_OPTIONS: Option<QuickData>[] = [
  { value: "public", label: "Publiques" },
  { value: "internal", label: "Internes" },
  { value: "sensitive", label: "Confidentielles" },
  { value: "secret", label: "Ultra-sensibles / secret" },
];

const PRIORITY_OPTIONS: Option<QuickPriority>[] = [
  { value: "sovereignty", label: "Souveraineté & contrôle" },
  { value: "cost", label: "Coût maîtrisé" },
  { value: "speed", label: "Mise en route rapide" },
];

const MEDIA_OPTIONS: Option<QuickMedia>[] = [
  { value: "text", label: "Texte / documents seulement" },
  { value: "media", label: "Aussi audio / vidéo / images" },
];

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
  const [answers, setAnswers] = useState<QuickAnswers>(DEFAULT_QUICK_ANSWERS);

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
        <Field label="Vous êtes…">
          <RadioCards value={answers.who} options={WHO_OPTIONS} onChange={(v) => set("who", v)} />
        </Field>
        <Field label="Vos données sont surtout…">
          <RadioCards value={answers.data} options={DATA_OPTIONS} onChange={(v) => set("data", v)} />
        </Field>
        <Field label="Votre priorité">
          <RadioCards value={answers.priority} options={PRIORITY_OPTIONS} onChange={(v) => set("priority", v)} />
        </Field>
        <Field label="Au-delà du texte ?">
          <RadioCards value={answers.media} options={MEDIA_OPTIONS} onChange={(v) => set("media", v)} />
        </Field>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/configurateur"
          onClick={persist}
          className="text-body-sm text-secondary underline decoration-dotted"
        >
          Affiner en détail (configurateur)
        </Link>
        <Button
          onClick={() => {
            persist();
            router.push("/resultats?mode=verdict");
          }}
        >
          Voir mon verdict
        </Button>
      </div>
      <p className="mt-3 text-body-sm text-on-surface-variant">
        Réponses indicatives, ajustables ensuite. Une IA peut se tromper : chaque coût est sourcé et daté.
      </p>
    </Card>
  );
}
