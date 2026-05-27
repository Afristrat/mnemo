import Link from "next/link";
import type { ReactElement } from "react";
import { QuickProfileForm } from "@/components/quick-profile/QuickProfileForm";

// Homepage de vente Strate, portage du brouillon validé en sparring (homepage-draft.html,
// décision #11 de la passation). 4 promesses (une seule « prouvée » = −risques, DÉFCON 1 :
// pas de stat inventée), wedge « notre différence », chemin 90 s, tarifs (prix = sondage en
// cours), CTA final. Tokens du design system (DESIGN.md), jamais de couleur hors palette.

const PILL_PRIMARY =
  "inline-flex items-center justify-center rounded-full bg-primary px-7 py-3 text-body-md font-medium text-on-primary transition-colors hover:bg-primary-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";
const PILL_GHOST =
  "inline-flex items-center justify-center rounded-full border border-outline-variant bg-surface-container-lowest px-7 py-3 text-body-md font-medium text-on-surface transition-colors hover:bg-surface-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

type Promise = { title: string; body: string; proof: string; hard: boolean };

const PROMISES: Promise[] = [
  {
    title: "↑ Plus de profits",
    body: "De meilleures décisions, plus vite : votre mémoire répond au lieu de dormir dans des dossiers. Le bon savoir, au bon moment, au bon rôle.",
    proof: "À mesurer chez vous (avant / après)",
    hard: false,
  },
  {
    title: "↑ Plus efficient",
    body: "Fini les heures perdues à chercher « où est ce document, qui a décidé quoi ». On vous rend ce temps.",
    proof: "À mesurer chez vous (temps de recherche)",
    hard: false,
  },
  {
    title: "↓ Moins de coûts",
    body: "Le juste dimensionnement, des prix sourcés et datés, et la traque des surcoûts cachés. Jamais de facture surprise.",
    proof: "Carte de coûts sourcée + veille prix continue",
    hard: false,
  },
  {
    title: "↓ Moins de risques",
    body: "Zéro verrouillage (repartez avec toute votre stack en un clic), conformité par conception, et l’expertise qui vous évite l’erreur qui coûte cher.",
    proof: "★ Prouvé, Exit Escrow + mode fiduciaire",
    hard: true,
  },
];

const DIFFERENTIATORS = [
  "🟢 Open-source quand c’est mieux",
  "💳 Payant quand c’est nécessaire",
  "⚖️ Zéro commission cachée",
  "🔓 Zéro verrouillage",
];

type Step = { n: number; title: string; body: string };

const STEPS: Step[] = [
  {
    n: 1,
    title: "Diagnostic gratuit",
    body: "Dites ce qui coince (en vos mots ou guidé). On vous donne votre risque, votre gain et un prix ferme.",
  },
  {
    n: 2,
    title: "Plan sourcé & partageable",
    body: "Une reco claire, chaque coût lié à sa source, exportable et partageable à votre direction.",
  },
  {
    n: 3,
    title: "Déploiement par agents",
    body: "Nos agents déploient et opèrent, sans que vous ayez à recruter ni à tout réapprendre.",
  },
];

type Tier = {
  name: string;
  price: string;
  surveyTag?: boolean;
  features: string[];
  featured?: boolean;
  cta?: string;
};

const TIERS: Tier[] = [
  {
    name: "Diagnostic",
    price: "Gratuit",
    features: [
      "Configurateur 90 s",
      "Plan & coûts sourcés",
      "Livrable partageable",
      "Bundle de sortie (Exit Escrow)",
    ],
  },
  {
    name: "Pro",
    price: "[__ / mois]",
    surveyTag: true,
    featured: true,
    cta: "Commencer le diagnostic",
    features: [
      "Déploiement assisté",
      "Supervision continue",
      "Optimisation des coûts",
      "Expertise & évitement d’erreurs",
    ],
  },
  {
    name: "Souverain+",
    price: "Sur devis",
    features: [
      "On-premise / air-gapped",
      "Négociation fournisseurs (mode fiduciaire)",
      "Support dédié + SLA",
    ],
  },
];

function Eyebrow({ children }: { children: string }): ReactElement {
  return (
    <span className="text-label-caps uppercase tracking-widest text-primary">{children}</span>
  );
}

export default function Home(): ReactElement {
  return (
    <div className="min-h-screen bg-surface text-on-surface">
      {/* Barre de navigation */}
      <header className="sticky top-0 z-30 border-b border-outline-variant/60 bg-surface/85 backdrop-blur">
        <nav className="mx-auto flex max-w-[1080px] items-center justify-between px-6 py-4">
          <Link href="/" className="font-display text-2xl font-bold tracking-tight">
            St<span className="text-primary">rate</span>
          </Link>
          <div className="hidden items-center gap-7 text-body-sm text-on-surface-variant md:flex">
            <a href="#pourquoi" className="transition-colors hover:text-on-surface">
              Pourquoi
            </a>
            <a href="#comment" className="transition-colors hover:text-on-surface">
              Comment
            </a>
            <a href="#tarifs" className="transition-colors hover:text-on-surface">
              Tarifs
            </a>
            <Link href="/fiduciaire" className="transition-colors hover:text-on-surface">
              Garanties
            </Link>
          </div>
          <a href="#diagnostic" className={`${PILL_PRIMARY} px-5 py-2.5 text-body-sm`}>
            Diagnostic gratuit
          </a>
        </nav>
      </header>

      <main className="mx-auto max-w-[1080px] px-6">
        {/* Hero */}
        <section className="py-14 text-center">
          <Eyebrow>Infrastructure de mémoire IA souveraine</Eyebrow>
          <h1 className="mx-auto mt-4 max-w-4xl font-display text-[34px] font-bold leading-[1.1] tracking-tight sm:text-5xl">
            Le savoir de votre organisation ne devrait{" "}
            <span className="text-primary">jamais</span> quitter vos murs.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-body-lg text-on-surface-variant">
            Strate transforme vos documents, décisions et échanges en une mémoire interrogeable —
            hébergée chez vous ou en UE, jamais chez des géants étrangers. Vous gardez tout. Vous
            ne dépendez de personne.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <a href="#diagnostic" className={PILL_PRIMARY}>
              Faire mon diagnostic, 90 s, gratuit
            </a>
            <a href="#comment" className={PILL_GHOST}>
              Voir comment ça marche
            </a>
          </div>
          <p className="mt-5 text-body-sm text-on-surface-variant">
            Hébergé UE / Maroc · Conforme CNDP & RGPD · Zéro verrouillage, repartez avec tout,
            quand vous voulez
          </p>
        </section>

        {/* Pourquoi, 4 promesses */}
        <section id="pourquoi" className="scroll-mt-24 py-12">
          <div className="mx-auto mb-8 max-w-2xl text-center">
            <Eyebrow>Pourquoi Strate</Eyebrow>
            <h2 className="mt-2 font-display text-headline-lg">
              Quatre promesses. Une seule déjà prouvée, les autres, mesurées chez vous.
            </h2>
            <p className="mt-2 text-body-md text-on-surface-variant">
              On ne vous promet pas la lune sans preuve. Voici ce qu’on défend, et avec quelle
              honnêteté.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {PROMISES.map((promise) => (
              <div
                key={promise.title}
                className="rounded-card border border-outline-variant bg-surface-container-lowest p-6 shadow-elevation"
              >
                <h3 className="font-display text-headline-md text-primary">{promise.title}</h3>
                <p className="mt-2 text-body-md text-on-surface-variant">{promise.body}</p>
                <span
                  className={
                    promise.hard
                      ? "mt-4 inline-flex items-center rounded-lg border border-primary/30 bg-primary/10 px-3 py-1 text-body-sm font-semibold text-primary"
                      : "mt-4 inline-flex items-center rounded-lg border border-outline-variant bg-surface-container px-3 py-1 text-body-sm text-on-surface-variant"
                  }
                >
                  {promise.proof}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Wedge, notre différence */}
        <section className="py-12">
          <div className="rounded-xl bg-inverse-surface px-6 py-10 text-center text-inverse-on-surface sm:px-10">
            <span className="text-label-caps uppercase tracking-widest text-inverse-primary">
              Notre différence
            </span>
            <h2 className="mt-2 font-display text-headline-lg text-inverse-on-surface">
              On vous dit la vérité, même quand elle dérange.
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-body-md text-inverse-on-surface/80">
              Si une solution open-source suffit, on vous le dit. Si seul un outil payant tient la
              route, on vous le dit aussi. Si vos contraintes se contredisent (petit budget +
              souveraineté maximale), on le pointe, on ne vous vend pas l’impossible. Et on ne
              touche aucune commission cachée des fournisseurs qu’on recommande.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2.5">
              {DIFFERENTIATORS.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-white/10 px-3.5 py-1.5 text-body-sm text-inverse-on-surface"
                >
                  {tag}
                </span>
              ))}
            </div>
            <Link
              href="/fiduciaire"
              className="mt-6 inline-block text-body-sm text-inverse-primary underline decoration-dotted"
            >
              Lire la charte fiduciaire, zéro commission cachée
            </Link>
          </div>
        </section>

        {/* Comment ça marche */}
        <section id="comment" className="scroll-mt-24 py-12">
          <div className="mx-auto mb-8 max-w-2xl text-center">
            <Eyebrow>Comment ça marche</Eyebrow>
            <h2 className="mt-2 font-display text-headline-lg">
              De la douleur à la décision, en 90 secondes.
            </h2>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {STEPS.map((step) => (
              <div key={step.n} className="px-4 text-center">
                <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 font-display text-headline-md font-bold text-primary">
                  {step.n}
                </div>
                <h3 className="mt-3 font-display text-body-lg font-semibold">{step.title}</h3>
                <p className="mt-1 text-body-sm text-on-surface-variant">{step.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Tarifs */}
        <section id="tarifs" className="scroll-mt-24 py-12">
          <div className="mx-auto mb-8 max-w-2xl text-center">
            <Eyebrow>Tarifs</Eyebrow>
            <h2 className="mt-2 font-display text-headline-lg">
              Le diagnostic est gratuit. Vous ne payez que la cuisine.
            </h2>
            <p className="mt-2 text-body-md text-on-surface-variant">
              Le coût de l’infra reste transparent, payé à vos fournisseurs, on ne marge pas
              dessus.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {TIERS.map((tier) => (
              <div
                key={tier.name}
                className={
                  tier.featured
                    ? "rounded-card border-2 border-primary bg-surface-container-lowest p-6 shadow-elevation"
                    : "rounded-card border border-outline-variant bg-surface-container-lowest p-6 shadow-elevation"
                }
              >
                <div className="flex flex-wrap items-center justify-center gap-2 text-center">
                  <h3 className="font-display text-headline-md">{tier.name}</h3>
                  {tier.surveyTag ? (
                    <span className="rounded-full bg-tertiary/10 px-2.5 py-0.5 text-label-caps uppercase text-tertiary">
                      Prix, sondage en cours
                    </span>
                  ) : null}
                </div>
                <div className="mt-2 text-center font-display text-headline-lg text-primary">
                  {tier.price}
                </div>
                <ul className="mt-4 space-y-1.5 text-body-sm text-on-surface-variant">
                  {tier.features.map((feature) => (
                    <li key={feature} className="relative pl-6">
                      <span className="absolute left-0 text-primary">✓</span>
                      {feature}
                    </li>
                  ))}
                </ul>
                {tier.cta ? (
                  <a href="#diagnostic" className={`${PILL_PRIMARY} mt-5 w-full`}>
                    {tier.cta}
                  </a>
                ) : null}
              </div>
            ))}
          </div>
          <p className="mx-auto mt-4 max-w-2xl text-center text-body-sm text-on-surface-variant">
            Les montants seront calés par le sondage de prix (Van Westendorp + analyse conjointe)
            en cours, pas de chiffre au doigt mouillé.
          </p>
        </section>

        {/* Diagnostic, chemin 90 s (vrai formulaire) */}
        <section id="diagnostic" className="scroll-mt-24 py-12">
          <div className="mx-auto mb-8 max-w-2xl text-center">
            <Eyebrow>Diagnostic gratuit</Eyebrow>
            <h2 className="mt-2 font-display text-headline-lg">Votre verdict en 90 secondes.</h2>
            <p className="mt-2 text-body-md text-on-surface-variant">
              Quatre questions. Un verdict chiffré et sourcé : votre risque, votre gain, un prix
              ferme et la marche à suivre.
            </p>
          </div>
          <div className="flex justify-center">
            <QuickProfileForm />
          </div>
        </section>

        {/* CTA final */}
        <section className="py-12">
          <div className="rounded-xl bg-primary/5 px-6 py-12 text-center">
            <h2 className="font-display text-headline-lg">
              Votre mémoire vous appartient. Reprenez-la.
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-body-md text-on-surface-variant">
              Commencez par le diagnostic gratuit. En 90 secondes, vous saurez votre risque, votre
              gain, et la marche à suivre.
            </p>
            <a href="#diagnostic" className={`${PILL_PRIMARY} mt-6`}>
              Faire mon diagnostic gratuit
            </a>
          </div>
        </section>
      </main>

      <footer className="mt-10 border-t border-outline-variant py-8 text-center text-body-sm text-on-surface-variant">
        © 2026 Strate, Infrastructure de mémoire IA souveraine · Hébergé UE / Maroc · Conforme
        CNDP & RGPD
      </footer>
    </div>
  );
}
