import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import type { ReactElement } from "react";
import { ResultsView } from "@/components/results/ResultsView";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Results");
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

export default async function ResultatsPage(): Promise<ReactElement> {
  const t = await getTranslations("Results");
  return (
    <main className="mx-auto max-w-5xl px-container-margin py-section-padding">
      <header className="mb-8">
        <span className="font-mono text-xs uppercase tracking-widest text-primary">
          {t("pageEyebrow")}
        </span>
        <h1 className="mt-2 font-display text-headline-lg text-on-surface">
          {t("pageTitle")}
        </h1>
      </header>
      <ResultsView />
    </main>
  );
}
