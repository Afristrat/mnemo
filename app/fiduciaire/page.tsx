import type { Metadata } from "next";
import Link from "next/link";
import type { ReactElement } from "react";
import { Card } from "@/components/ui/Card";
import { FIDUCIARY_CHARTER } from "@/lib/fiduciary/charter";

export const metadata: Metadata = {
  title: "Charte fiduciaire — Mnémo",
  description:
    "Mnémo agit dans votre seul intérêt : zéro commission vendor cachée, recette ouverte, prix sourcés, souveraineté d'abord.",
};

export default function FiduciaryPage(): ReactElement {
  const charter = FIDUCIARY_CHARTER;
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <p className="font-mono text-xs uppercase tracking-widest text-primary">Divulgation</p>
      <h1 className="mt-2 font-display text-display-lg font-bold text-on-surface">{charter.title}</h1>
      <p className="mt-4 text-body-lg text-on-surface-variant">{charter.intro}</p>

      <Card className="mt-8">
        <h2 className="font-display text-headline-md text-on-surface">Comment nous gagnons notre vie</h2>
        <p className="mt-2 text-body-md text-on-surface-variant">{charter.revenueModel}</p>
      </Card>

      <section className="mt-8 space-y-4">
        <h2 className="font-display text-headline-lg text-on-surface">Nos engagements</h2>
        {charter.commitments.map((c) => (
          <Card key={c.title}>
            <h3 className="font-display text-body-lg text-on-surface">{c.title}</h3>
            <p className="mt-1 text-body-sm text-on-surface-variant">{c.detail}</p>
          </Card>
        ))}
      </section>

      <p className="mt-8 font-mono text-body-sm text-on-surface-variant">
        Dernière mise à jour : {charter.lastUpdated}
      </p>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/configurateur"
          className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-2.5 text-body-md font-medium text-on-primary transition-colors hover:bg-primary-container"
        >
          Configurer mon infrastructure
        </Link>
        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-full border border-outline-variant px-5 py-2.5 text-body-md font-medium text-on-surface transition-colors hover:bg-surface-container"
        >
          Retour à l’accueil
        </Link>
      </div>
    </main>
  );
}
