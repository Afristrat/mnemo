import { getTranslations } from "next-intl/server";
import Link from "next/link";
import type { ReactElement, ReactNode } from "react";
import { IntakeField } from "@/components/intake/IntakeField";
import { QuickProfileForm } from "@/components/quick-profile/QuickProfileForm";
import { LocaleSwitcher } from "@/components/ui/LocaleSwitcher";
import { AccountMenu } from "@/components/account/AccountMenu";

// Homepage de vente Strate, portage du brouillon validé en sparring (homepage-draft.html,
// décision #11 de la passation). 4 promesses (une seule « prouvée » = −risques, DÉFCON 1 :
// pas de stat inventée), wedge « notre différence », chemin 90 s, tarifs (prix = sondage en
// cours), CTA final. Tokens du design system (DESIGN.md), jamais de couleur hors palette.
// i18n (S-057) : tout le contenu provient de `messages/{fr,en}.json` (namespaces Nav/Home) ;
// seules subsistent les métadonnées structurelles (clés, drapeaux de mise en page).

const PILL_PRIMARY =
  "inline-flex items-center justify-center rounded-full bg-primary px-7 py-3 text-body-md font-medium text-on-primary transition-colors hover:bg-primary-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";
const PILL_GHOST =
  "inline-flex items-center justify-center rounded-full border border-outline-variant bg-surface-container-lowest px-7 py-3 text-body-md font-medium text-on-surface transition-colors hover:bg-surface-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

// Métadonnées structurelles (le texte vit dans les catalogues i18n) :
const PROMISE_KEYS = ["profits", "efficient", "costs", "risks"] as const;
const HARD_PROMISE = "risks";
const DIFFERENTIATOR_KEYS = ["openSource", "paid", "noCommission", "noLockin"] as const;
const STEP_KEYS = ["diagnostic", "plan", "deploy"] as const;
const TIERS = [
  {
    key: "diagnostic",
    features: ["configurator", "plan", "deliverable", "exit"],
  },
  {
    key: "essentiel",
    features: ["deploy", "supervision", "exitIncluded"],
  },
  {
    key: "pro",
    featured: true,
    features: ["allEssentiel", "costs", "expertise", "priority"],
  },
  {
    key: "sovereign",
    features: ["onprem", "negotiation", "support"],
  },
] as const;

// Vrai comparatif (lignes × tiers, ordre des colonnes = TIERS). Chaque ligne : inclus (true) / non (false)
// par palier [Diagnostic, Essentiel, Pro, Souverain+]. Repliable via <details> (hide/unhide natif, SSR).
const COMPARE_ROWS = [
  { key: "configurator", values: [true, true, true, true] },
  { key: "deliverable", values: [true, true, true, true] },
  { key: "exit", values: [true, true, true, true] },
  { key: "deploy", values: [false, true, true, true] },
  { key: "supervision", values: [false, true, true, true] },
  { key: "costs", values: [false, false, true, true] },
  { key: "expertise", values: [false, false, true, true] },
  { key: "priority", values: [false, false, true, true] },
  { key: "onprem", values: [false, false, false, true] },
  { key: "negotiation", values: [false, false, false, true] },
  { key: "support", values: [false, false, false, true] },
] as const;

function Eyebrow({ children }: { children: ReactNode }): ReactElement {
  return (
    <span className="text-label-caps uppercase tracking-widest text-primary">{children}</span>
  );
}

export default async function Home(): Promise<ReactElement> {
  const tNav = await getTranslations("Nav");
  const t = await getTranslations("Home");
  return (
    <div className="min-h-screen bg-surface text-on-surface">
      {/* Barre de navigation */}
      <header className="sticky top-0 z-30 border-b border-outline-variant/60 bg-surface/85 backdrop-blur">
        <nav className="mx-auto flex max-w-[1080px] items-center justify-between px-6 py-4">
          {/* « Strate » = nom propre du produit (identique dans toutes les langues), rendu décoratif. */}
          <Link href="/" className="font-display text-2xl font-bold tracking-tight">
            St<span className="text-primary">rate</span>
          </Link>
          <div className="hidden items-center gap-7 text-body-sm text-on-surface-variant md:flex">
            <a href="#pourquoi" className="transition-colors hover:text-on-surface">
              {tNav("why")}
            </a>
            <a href="#comment" className="transition-colors hover:text-on-surface">
              {tNav("how")}
            </a>
            <a href="#tarifs" className="transition-colors hover:text-on-surface">
              {tNav("pricing")}
            </a>
            <Link href="/fiduciaire" className="transition-colors hover:text-on-surface">
              {tNav("guarantees")}
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <AccountMenu />
            <LocaleSwitcher />
            <a href="#diagnostic" className={`${PILL_PRIMARY} px-5 py-2.5 text-body-sm`}>
              {tNav("cta")}
            </a>
          </div>
        </nav>
      </header>

      <main className="mx-auto max-w-[1080px] px-6">
        {/* Hero */}
        <section className="py-14 text-center">
          <Eyebrow>{t("hero.eyebrow")}</Eyebrow>
          <h1 className="mx-auto mt-4 max-w-4xl font-display text-[34px] font-bold leading-[1.1] tracking-tight sm:text-5xl">
            {t.rich("hero.title", {
              mark: (chunks) => <span className="text-primary">{chunks}</span>,
            })}
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-body-lg text-on-surface-variant">
            {t("hero.subtitle")}
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <a href="#diagnostic" className={PILL_PRIMARY}>
              {t("hero.ctaPrimary")}
            </a>
            <a href="#comment" className={PILL_GHOST}>
              {t("hero.ctaSecondary")}
            </a>
          </div>
          <p className="mt-5 text-body-sm text-on-surface-variant">{t("hero.trust")}</p>
        </section>

        {/* Pourquoi, 4 promesses */}
        <section id="pourquoi" className="scroll-mt-24 py-12">
          <div className="mx-auto mb-8 max-w-2xl text-center">
            <Eyebrow>{t("why.eyebrow")}</Eyebrow>
            <h2 className="mt-2 font-display text-headline-lg">{t("why.title")}</h2>
            <p className="mt-2 text-body-md text-on-surface-variant">{t("why.subtitle")}</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {PROMISE_KEYS.map((key) => {
              const hard = key === HARD_PROMISE;
              return (
                <div
                  key={key}
                  className="rounded-card border border-outline-variant bg-surface-container-lowest p-6 shadow-elevation"
                >
                  <h3 className="font-display text-headline-md text-primary">
                    {t(`why.promises.${key}.title`)}
                  </h3>
                  <p className="mt-2 text-body-md text-on-surface-variant">
                    {t(`why.promises.${key}.body`)}
                  </p>
                  <span
                    className={
                      hard
                        ? "mt-4 inline-flex items-center rounded-lg border border-primary/30 bg-primary/10 px-3 py-1 text-body-sm font-semibold text-primary"
                        : "mt-4 inline-flex items-center rounded-lg border border-outline-variant bg-surface-container px-3 py-1 text-body-sm text-on-surface-variant"
                    }
                  >
                    {t(`why.promises.${key}.proof`)}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        {/* Wedge, notre différence */}
        <section className="py-12">
          <div className="rounded-xl bg-inverse-surface px-6 py-10 text-center text-inverse-on-surface sm:px-10">
            <span className="text-label-caps uppercase tracking-widest text-inverse-primary">
              {t("difference.eyebrow")}
            </span>
            <h2 className="mt-2 font-display text-headline-lg text-inverse-on-surface">
              {t("difference.title")}
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-body-md text-inverse-on-surface/80">
              {t("difference.body")}
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2.5">
              {DIFFERENTIATOR_KEYS.map((key) => (
                <span
                  key={key}
                  className="rounded-full bg-white/10 px-3.5 py-1.5 text-body-sm text-inverse-on-surface"
                >
                  {t(`difference.tags.${key}`)}
                </span>
              ))}
            </div>
            <Link
              href="/fiduciaire"
              className="mt-6 inline-block text-body-sm text-inverse-primary underline decoration-dotted"
            >
              {t("difference.link")}
            </Link>
          </div>
        </section>

        {/* Comment ça marche */}
        <section id="comment" className="scroll-mt-24 py-12">
          <div className="mx-auto mb-8 max-w-2xl text-center">
            <Eyebrow>{t("how.eyebrow")}</Eyebrow>
            <h2 className="mt-2 font-display text-headline-lg">{t("how.title")}</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {STEP_KEYS.map((key, index) => (
              <div key={key} className="px-4 text-center">
                <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 font-display text-headline-md font-bold text-primary">
                  {index + 1}
                </div>
                <h3 className="mt-3 font-display text-body-lg font-semibold">
                  {t(`how.steps.${key}.title`)}
                </h3>
                <p className="mt-1 text-body-sm text-on-surface-variant">
                  {t(`how.steps.${key}.body`)}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Tarifs */}
        <section id="tarifs" className="scroll-mt-24 py-12">
          <div className="mx-auto mb-8 max-w-2xl text-center">
            <Eyebrow>{t("pricing.eyebrow")}</Eyebrow>
            <h2 className="mt-2 font-display text-headline-lg">{t("pricing.title")}</h2>
            <p className="mt-2 text-body-md text-on-surface-variant">{t("pricing.subtitle")}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {TIERS.map((tier) => (
              <div
                key={tier.key}
                className={
                  "featured" in tier && tier.featured
                    ? "rounded-card border-2 border-primary bg-surface-container-lowest p-6 shadow-elevation"
                    : "rounded-card border border-outline-variant bg-surface-container-lowest p-6 shadow-elevation"
                }
              >
                <div className="flex flex-wrap items-center justify-center gap-2 text-center">
                  <h3 className="font-display text-headline-md">
                    {t(`pricing.tiers.${tier.key}.name`)}
                  </h3>
                </div>
                <div className="mt-2 text-center font-display text-headline-lg text-primary">
                  {t(`pricing.tiers.${tier.key}.price`)}
                </div>
                <ul className="mt-4 space-y-1.5 text-body-sm text-on-surface-variant">
                  {tier.features.map((feature) => (
                    <li key={feature} className="relative ps-6">
                      <span className="absolute start-0 text-primary">✓</span>
                      {t(`pricing.tiers.${tier.key}.features.${feature}`)}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Vrai comparatif détaillé, repliable (hide/unhide natif via <details>, sans JS). */}
          <details className="group mx-auto mt-6 max-w-4xl rounded-card border border-outline-variant bg-surface-container-lowest">
            <summary className="flex cursor-pointer list-none items-center justify-center gap-2 px-6 py-3 text-body-sm font-medium text-primary">
              <span className="transition-transform group-open:rotate-90" aria-hidden="true">▸</span>
              {t("pricing.compareSummary")}
            </summary>
            <div className="overflow-x-auto px-2 pb-4">
              <table className="w-full min-w-[640px] border-collapse text-body-sm">
                <thead>
                  <tr className="border-b border-outline-variant">
                    <th className="px-3 py-2 text-start font-medium text-on-surface-variant" scope="col" />
                    {TIERS.map((tier) => (
                      <th key={tier.key} className="px-3 py-2 text-center" scope="col">
                        <span className="block font-display text-on-surface">{t(`pricing.tiers.${tier.key}.name`)}</span>
                        <span className="block text-label-caps uppercase text-primary">{t(`pricing.tiers.${tier.key}.price`)}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {COMPARE_ROWS.map((row) => (
                    <tr key={row.key} className="border-b border-outline-variant/40">
                      <th className="px-3 py-2 text-start font-normal text-on-surface-variant" scope="row">
                        {t(`pricing.compare.${row.key}`)}
                      </th>
                      {row.values.map((included, i) => (
                        <td key={TIERS[i].key} className="px-3 py-2 text-center">
                          {included ? (
                            <span className="text-primary" aria-label={t("pricing.compareYes")}>✓</span>
                          ) : (
                            <span className="text-on-surface-variant/30" aria-label={t("pricing.compareNo")}>—</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>

          <p className="mx-auto mt-4 max-w-2xl text-center text-body-sm text-on-surface-variant">
            {t("pricing.note")}
          </p>

          {/* CTA unique en bas de la section (plus dans la seule carte Pro). */}
          <div className="mt-6 text-center">
            <a href="#diagnostic" className={PILL_PRIMARY}>
              {t("pricing.cta")}
            </a>
          </div>
        </section>

        {/* Diagnostic, chemin 90 s (vrai formulaire) */}
        <section id="diagnostic" className="scroll-mt-24 py-12">
          <div className="mx-auto mb-8 max-w-2xl text-center">
            <Eyebrow>{t("diagnostic.eyebrow")}</Eyebrow>
            <h2 className="mt-2 font-display text-headline-lg">{t("diagnostic.title")}</h2>
            <p className="mt-2 text-body-md text-on-surface-variant">{t("diagnostic.subtitle")}</p>
          </div>
          <div className="flex flex-col items-center gap-6">
            <QuickProfileForm />
            <div className="flex w-full max-w-2xl items-center gap-3 text-body-sm text-on-surface-variant">
              <span className="h-px flex-1 bg-outline-variant" />
              <span className="uppercase tracking-widest">{t("diagnostic.orNaturalLanguage")}</span>
              <span className="h-px flex-1 bg-outline-variant" />
            </div>
            <IntakeField />
          </div>
        </section>

        {/* CTA final */}
        <section className="py-12">
          <div className="rounded-xl bg-primary/5 px-6 py-12 text-center">
            <h2 className="font-display text-headline-lg">{t("ctaFinal.title")}</h2>
            <p className="mx-auto mt-3 max-w-xl text-body-md text-on-surface-variant">
              {t("ctaFinal.body")}
            </p>
            <a href="#diagnostic" className={`${PILL_PRIMARY} mt-6`}>
              {t("ctaFinal.cta")}
            </a>
          </div>
        </section>
      </main>

      <footer className="mt-10 border-t border-outline-variant py-8 text-center text-body-sm text-on-surface-variant">
        {t("footer")}
      </footer>
    </div>
  );
}
