import type { Metadata } from "next";
import type { ReactElement } from "react";
import { SurveyForm } from "@/components/sondage/SurveyForm";

export const metadata: Metadata = {
  title: "Mnémo — votre avis sur le juste prix",
  description: "2 minutes pour nous aider à fixer un prix juste pour le service Mnémo.",
  robots: { index: false, follow: false },
};

export default function SondagePage(): ReactElement {
  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <p className="text-xs font-bold uppercase tracking-widest text-teal-600">Sondage · 2 minutes</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">Aidez-nous à fixer le juste prix</h1>
      <p className="mt-3 text-slate-600">
        Mnémo rend la mémoire de votre organisation interrogeable et souveraine. Avant de figer nos tarifs, on
        préfère vous demander plutôt que deviner. Vos réponses sont anonymes et ne servent qu’à calibrer le prix.
      </p>
      <div className="mt-8">
        <SurveyForm />
      </div>
    </main>
  );
}
