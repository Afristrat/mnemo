import type { Metadata } from "next";
import { ResultsView } from "@/components/results/ResultsView";

export const metadata: Metadata = {
  title: "Recommandation, Strate",
  description:
    "Votre stack de base mémorielle souveraine recommandée : 7 couches, radar 9 dimensions et carte de coûts sourcée.",
};

export default function ResultatsPage() {
  return (
    <main className="mx-auto max-w-5xl px-container-margin py-section-padding">
      <header className="mb-8">
        <span className="font-mono text-xs uppercase tracking-widest text-primary">
          Recommandation
        </span>
        <h1 className="mt-2 font-display text-headline-lg text-on-surface">
          Votre infrastructure souveraine
        </h1>
      </header>
      <ResultsView />
    </main>
  );
}
