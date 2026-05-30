import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import type { ReactElement } from "react";
import { Card } from "@/components/ui/Card";
import { FIDUCIARY_CHARTER } from "@/lib/fiduciary/charter";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Fiduciaire");
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

export default async function FiduciaryPage(): Promise<ReactElement> {
  const t = await getTranslations("Fiduciaire");
  const charter = FIDUCIARY_CHARTER;
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <p className="font-mono text-xs uppercase tracking-widest text-primary">{t("eyebrow")}</p>
      <h1 className="mt-2 font-display text-display-lg font-bold text-on-surface">{charter.title}</h1>
      <p className="mt-4 text-body-lg text-on-surface-variant">{charter.intro}</p>

      <Card className="mt-8">
        <h2 className="font-display text-headline-md text-on-surface">{t("revenueTitle")}</h2>
        <p className="mt-2 text-body-md text-on-surface-variant">{charter.revenueModel}</p>
      </Card>

      <section className="mt-8 space-y-4">
        <h2 className="font-display text-headline-lg text-on-surface">{t("commitmentsTitle")}</h2>
        {charter.commitments.map((c) => (
          <Card key={c.title}>
            <h3 className="font-display text-body-lg text-on-surface">{c.title}</h3>
            <p className="mt-1 text-body-sm text-on-surface-variant">{c.detail}</p>
          </Card>
        ))}
      </section>

      <p className="mt-8 font-mono text-body-sm text-on-surface-variant">
        {t("lastUpdated", { date: charter.lastUpdated })}
      </p>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/configurateur"
          className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-2.5 text-body-md font-medium text-on-primary transition-colors hover:bg-primary-container"
        >
          {t("configure")}
        </Link>
        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-full border border-outline-variant px-5 py-2.5 text-body-md font-medium text-on-surface transition-colors hover:bg-surface-container"
        >
          {t("backHome")}
        </Link>
      </div>
    </main>
  );
}
