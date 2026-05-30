import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import type { ReactElement } from "react";
import { SurveyForm } from "@/components/sondage/SurveyForm";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Sondage");
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    robots: { index: false, follow: false },
  };
}

export default async function SondagePage(): Promise<ReactElement> {
  const t = await getTranslations("Sondage");
  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <p className="text-xs font-bold uppercase tracking-widest text-teal-600">{t("eyebrow")}</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">{t("title")}</h1>
      <p className="mt-3 text-slate-600">{t("intro")}</p>
      <div className="mt-8">
        <SurveyForm />
      </div>
    </main>
  );
}
