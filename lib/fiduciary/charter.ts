// Fiduciary Mode (F8, moat ②) : charte fiduciaire — donnée pure, source de vérité
// unique, réutilisée par la page de divulgation /fiduciaire ET par le livrable export.
// Principe : Mnémo agit dans le seul intérêt du client. Zéro commission vendor cachée
// (leçon Flipper, cf. docs/MOAT-HUNT.md).

export type FiduciaryCommitment = { title: string; detail: string };

export type FiduciaryCharter = {
  title: string;
  intro: string;
  revenueModel: string;
  commitments: FiduciaryCommitment[];
  lastUpdated: string;
};

export const FIDUCIARY_CHARTER: FiduciaryCharter = {
  title: "Charte fiduciaire Mnémo",
  intro:
    "Mnémo agit dans votre seul intérêt. Nos recommandations ne sont jamais orientées par une rémunération de fournisseur. Ce document est public et opposable.",
  revenueModel:
    "Nous facturons le conseil et le déploiement — la « cuisine ». La recette, elle, reste ouverte. Nous ne percevons aucune commission, aucun apport d'affaires ni aucune rétrocommission des fournisseurs que nous recommandons.",
  commitments: [
    {
      title: "Zéro commission cachée",
      detail:
        "Aucune recommandation n'est conditionnée à une rémunération vendor. Le moteur de reco ne connaît ni commission, ni programme d'affiliation, ni rétrocommission.",
    },
    {
      title: "Recette ouverte",
      detail:
        "La stack recommandée est intégralement documentée et reproductible : vous pouvez l'emporter et la redéployer ailleurs (Exit Escrow), sans nous.",
    },
    {
      title: "Prix sourcés et datés",
      detail:
        "Chaque coût affiché est lié à sa source publique, daté, avec un niveau de confiance. Le price feed est transparent et la marge d'incertitude (±30 %) est assumée.",
    },
    {
      title: "Souveraineté d'abord",
      detail:
        "Aucun verrouillage. Vos données et votre vault markdown restent la source de vérité ; la base vectorielle n'en est qu'une projection rejouable.",
    },
    {
      title: "Pas d'action à votre place sur vos comptes",
      detail:
        "L'agent (Lot 2) ne crée jamais de compte ni ne saisit de carte bancaire à votre place : vous gardez la main et la responsabilité contractuelle.",
    },
  ],
  lastUpdated: "2026-05-25",
};
