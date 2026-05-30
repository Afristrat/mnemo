import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import type { ReactElement } from "react";
import { Wizard } from "@/components/wizard/Wizard";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Configurateur");
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

export default async function ConfigurateurPage(): Promise<ReactElement> {
  const t = await getTranslations("Configurateur");
  return (
    <main className="mx-auto max-w-[1400px] px-container-margin py-section-padding">
      <header className="mb-8">
        <span className="font-mono text-xs uppercase tracking-widest text-primary">
          {t("eyebrow")}
        </span>
        <h1 className="mt-2 font-display text-headline-lg text-on-surface">
          {t("title")}
        </h1>
        <p className="mt-2 max-w-2xl text-body-lg text-on-surface-variant">
          {t("subtitle")}
        </p>
      </header>
      <Wizard />
    </main>
  );
}
