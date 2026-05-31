# Fournisseurs souverains par continent — sources (S-073, tranche 1)

> **Vision** (Amine) : être présent sur **tous les continents** ; pour chacun, proposer de **trouver des
> fournisseurs dans le(s) pays cible(s)**, surtout pour les organisations qui veulent **plusieurs
> solutions infra redondantes** (sécurité par diversité de juridictions/opérateurs).
>
> Ce document trace l'**annuaire d'existence** porté par `lib/pricing/sovereign-providers-seed.ts`
> (contrat pur `lib/engine/providers.ts`). Doctrine `prix-jamais-hardcodes` + `jamais-graver-decision-perissable` :

## Ce que cet annuaire EST / N'EST PAS (DÉFCON 1)

- **EST** : un **repli daté** documentant, pour des fournisseurs **réels**, leur **existence**, leur
  **pays**, leur **classe de souveraineté** (positionnement public déclaré) et une **source** publique.
- **N'EST PAS** :
  - une **grille de prix egress** par fournisseur → jamais fabriquée ici ; devis / veille par
    fournisseur dans les tranches ultérieures (le contrat n'expose **aucun** champ de prix) ;
  - un **statut juridique de transfert** par pays → géré par `lib/legal` (défaut **conservateur** ;
    aucune base légale par pays n'est inventée).
- La classification `sovereignty` est **éditoriale** (déclaratif fournisseur) → la veille (tranche 3)
  l'affine et la confronte aux **contraintes utilisateur** (S-072, contrainte absolue) ; l'UI de
  redondance (tranche 4) consomme l'annuaire.

## Couverture (relevé **2026-05-31**)

| Continent | Fournisseur | Pays | Classe | Source |
|---|---|---|---|---|
| Europe | OVHcloud | France | sovereign | <https://www.ovhcloud.com/fr/> |
| Europe | Scaleway | France | sovereign | <https://www.scaleway.com/fr/> |
| Europe | Outscale (Dassault Systèmes) | France | sovereign (SecNumCloud) | <https://fr.outscale.com/> |
| Europe | IONOS | Allemagne | sovereign | <https://www.ionos.fr/> |
| Europe | Infomaniak | Suisse | sovereign | <https://www.infomaniak.com/fr> |
| Europe | Hetzner | Allemagne | eu-hosted | <https://www.hetzner.com/> |
| Afrique | UniCloud Africa | Nigeria / Kenya / Afrique du Sud | sovereign | <https://unicloudafrica.africa/> |
| Afrique | iXAfrica × Baobab Cloud | Kenya | sovereign | <https://techafricanews.com/2026/05/22/ixafrica-data-centres-and-baobab-cloud-services-launch-sovereign-public-cloud-platform-in-kenya/> |
| Moyen-Orient | Core42 (G42) | Émirats arabes unis | sovereign | <https://www.core42.ai/> |
| Moyen-Orient | STC Cloud (solutions by stc) | Arabie saoudite | sovereign | <https://www.solutions.com.sa/> |
| Moyen-Orient | e& enterprise | ÉAU / Qatar | sovereign | <https://www.eand.com/en/business.html> |
| APAC | Sakura Internet | Japon | sovereign (ISMAP) | <https://esolia.co.jp/en/articles/cloud-sovereignty-japan/> |
| APAC | NTT Communications | Japon | sovereign | <https://www.global.ntt/> |
| APAC | NAVER Cloud | Corée du Sud | sovereign (PIPA) | <https://www.crnasia.com/news/2026/cloud/south-korea-s-naver-cloud-focused-on-providing-sovereign-ai> |
| Amérique latine | Serpro — Government Cloud | Brésil | sovereign | <https://www.serpro.gov.br/> |
| Amérique du Nord | OVHcloud Canada | Canada | eu-hosted | <https://www.ovhcloud.com/en-ca/> |

Confiance **medium** : pages/articles publics récents attestant existence + positionnement ; **volatile**
(offres lancées en 2026, périmètres mouvants) → à **enrichir/confirmer par la veille** (découverte par
pays, tranche 3) qui respectera les **choix utilisateur comme contrainte absolue** (S-072).

## Tranches suivantes (S-073)

- **Tranche 2** ✅ (2026-05-31) — modèle : `EgressVector` étendu (`continent?`/`country?` additifs),
  les 7 vecteurs egress sourcés (UE, Amérique du Nord) annotés + helper `vectorsForContinent`. Les
  continents sans vecteur egress chiffré (Afrique, Moyen-Orient, APAC, Amérique latine) restent en
  **devis/veille** (aucun prix fabriqué — DÉFCON 1).
- **Tranche 3** ✅ (2026-05-31) — veille : découverte live de fournisseurs par pays cible
  (`lib/residency/discovery.ts` + route `POST /api/residency/providers`), **bornée par les contraintes
  utilisateur** (S-072, absolues) — requête orientée + règle dure du prompt + re-filtre de la sortie
  (souveraineté exigée ⇒ rejet hyperscaler) ; anti-hallucination d'URL ; repli annuaire seed garanti.
- **Tranche 4** — UI : choix de **N fournisseurs redondants** + topologie multi-juridiction.
- **Tranche 5** — coûts/transferts via S-044, défaut légal **conservateur**.
