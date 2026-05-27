# Retour de test utilisateur — STRATE (Pôle 1) — 2026-05-27

> Source : transcript d'un test à voix haute (~10 min) sur la **prod** `infra.ai-mpower.com`, par un
> évaluateur technique qui simule aussi le **client final non technique**. 26 points extraits (timecodes
> conservés, verbatim fidèle — DÉFCON 1). Objet : backlog priorisé + mapping vers les stories.
>
> ⚠ Les **bugs** (B1–B3) sont rapportés sur la prod ; ils étaient réputés verts en CI (S-009/S-011/S-013).
> **À diagnostiquer d'abord** : prod obsolète (pas redéployée depuis le travail du 2026-05-27) **vs** vraie
> régression **vs** écart prod/navigateur (CSP, chunk dynamique). Ne pas présumer.

## Priorités

| Prio | Définition |
|------|------------|
| **P0** | Bug sur une feature livrée (casse la promesse, = dette) |
| **P1** | Blocage de parcours / conversion (l'utilisateur ne peut pas avancer) |
| **P2** | Friction UX / compréhension (jargon, libellé, message) |
| **P3** | Amélioration / confort |

---

## P0 — Bugs sur du livré (à diagnostiquer puis corriger)

| ID | Timecode | Verbatim | Feature | Action |
|----|----------|----------|---------|--------|
| B1 | 08:47 | « charte fiducia, là il y a une erreur » | `/fiduciaire` (S-011) | Reproduire ; vérifier route prod vs local |
| B2 | 10:06 | « PDF ne marche pas… le zip non plus… y'a que le markdown » | Export PDF + ZIP (S-009/S-010) | Tester en prod ; jsPDF/fflate en import dynamique → chunk/CSP ? |
| B3 | 09:01 | « Modifier mon profil. Ah ça, ça marche pas non plus » | Lien « Modifier mon profil » (résultats) | Vérifier la cible du lien / l'état localStorage |

**Note interne** : la prod date d'**avant** le travail du 2026-05-27 (S-027→S-031, S-035, spec n°3). Premier
réflexe : **redéployer** puis re-tester B1–B3 avant d'ouvrir une enquête de régression.

> **✅ RÉSOLU (2026-05-27, après redéploiement)** — les bugs B1/B2/B3 étaient dus à l'**obsolescence de la
> prod** (build antérieur au travail du jour), **pas à une régression de code**. Après redéploiement Coolify
> + suite e2e Playwright **en navigateur propre contre la prod** (`E2E_BASE_URL=https://infra.ai-mpower.com`,
> **7/7 verts**), « charte fiduciaire accessible » et « export Markdown/PDF/ZIP » passent ; B3 couvert par le
> round-trip `/configurateur ↔ /resultats`. La pollution observée côté navigateur du test manuel venait des
> **extensions** (Loom/Quillbot/…) + du beacon Cloudflare Insights (503, tiers, non critique).

## P1 — Blocages de parcours & conversion

| ID | Timecode | Verbatim | Diagnostic | Mapping |
|----|----------|----------|------------|---------|
| C1 | 07:46 / 09:16 | « comment je fais pour sélectionner [coût minimal] ?… tout est preset par cette config et on ne peut pas changer… il m'impose Scaleway » | L'**ensemble** (souveraineté/coût/délai) est affiché mais **non sélectionnable** ; pas de comparaison côte-à-côte ni de changement de fournisseur | **Nouvelle story** : ensemble interactif (choisir/figer une config, comparer, swap composant) — converge avec la **reco vivante (spec n°3)** |
| C2 | 08:31 | « redimensionné en médium… mais comment je redimensionne en médium ? » | La reco **suggère** un downgrade HARD→MEDIUM mais **aucune action** pour l'appliquer | Nouvelle story : action « appliquer la suggestion » / override preset |
| C3 | 10:49 | « j'ai fait mon diagnostic… j'aimerais le truc pro, mais comment ? après le diagnostic il n'y avait pas de possibilité d'aller plus loin » | **Aucun chemin de conversion** diagnostic gratuit → pro | Nouvelle story : funnel pro (lié sondage→prix + capture e-mail S-023) |
| C4 | 01:18 | « Zone d'hébergement, autre… il n'y a pas d'option parce que je vais héberger dans plusieurs continents » | Pas d'option **multi-continent / multi-région** | **Spec n°2** (résidence/DR) — brainstorm en pause |

## P2 — Friction UX / compréhension (jargon, libellés, messages)

| ID | Timecode | Verbatim | Problème |
|----|----------|----------|----------|
| U1 | 01:35 | « interne et confidentielle… interne est par définition confidentielle. Quoique » | Sensibilité : libellés qui se chevauchent → clarifier les définitions (InfoBubble) |
| U2 | 01:59 | « Au-dessus du budget… c'est plutôt en dessous ? Peut-être que j'ai mal compris » | Message budget-mètre ambigu → reformuler (qu'est-ce qui dépasse, de combien) |
| U3 | 02:47 | « Comment je peux savoir [le volume] ? » | Volume : aucun repère → exemples concrets (« ~X docs ≈ Y Go ») |
| U4 | 03:22 | « Croissance attendue, c'est flou… pour un non technique, difficile » | « Croissance attendue » non actionnable → exemples / rendre optionnel |
| U5 | 04:20 | « Traçage des revirements… compliqué pour un non technique » / « Recherche binaire dans l'historique » | Usages avancés : noms encore trop techniques → reformuler en bénéfice |
| U6 | 04:42 | « Plan de panne… délai de réparation et procédure. Comment je sais ? » | Plan de panne / monitoring : pas de guidage pour renseigner |
| U7 | 05:31 | « À mémoriser. Comment on peut savoir ça ? » / « le client ne comprend pas » | Bloc Médias (mémoriser/créer) : intention pas claire → exemples |
| U8 | 09:46 | « stockage polyglotte, pourquoi polyglotte et pas une seule langue ? » | **Faux-ami** : « polyglotte » compris comme *langues* → renommer (« multi-modèle » / « hybride ») |
| U9 | 08:10 | « Qdrant. Pourquoi il est orange ? » | Pastille de confiance non expliquée au survol → tooltip sur 🟢🟡🟠 |
| U10 | 09:33 | « Pourquoi Mistral ? pour la souveraineté… mais c'est pas forcément souverain » | Choix non justifié + souveraineté contestable → exposer le « pourquoi ce choix » (= **reco vivante sourcée**) |
| U11 | 09:50 | « ça l'impose à 40 balles par mois » | Coût d'une couche perçu comme imposé sans justification |
| U12 | 07:25 | « j'ai pas choisi Maroc mais il me propose Maroc » | L'ensemble propose une zone non choisie → clarifier que ce sont des variantes hypothétiques |
| U13 | 06:44 | « pourquoi le coût il est bas, c'est bizarre » | Config « coût minimal » : coût bas inexpliqué → afficher les arbitrages de la variante |

## P3 — Manques dans le livrable

| ID | Timecode | Verbatim | Manque |
|----|----------|----------|--------|
| L1 | 10:22 | « pas de nom ou de prénom… pas de balise, on ne sait pas à qui ça appartient » | Livrable MD/PDF sans **identité client** (métadonnée propriétaire) |
| L2 | 10:33 | « il y a uniquement la configuration souveraine. Imagine le gars il veut shifter » | Livrable **mono-config** : n'inclut pas les alternatives de l'ensemble |

## F — Critique de fond (recoupe les chantiers en cours)

| ID | Timecode | Verbatim | Lien |
|----|----------|----------|------|
| F1 | 09:26 | « apporter plus de matière, là c'est **ultra déterministe**… plein d'autres solutions, même pour l'embedding multimodal » | = **spec n°3 reco-vivante** (S-034→S-040), déjà cadrée, S-035 livré |
| F2 | 11:27 | « pluguer les pôles 2 et 3 au pôle 1 pour plus de diversité (infra, embedding, chunking, outils) » | Même direction (catalogue vivant + veille) |

---

## Synthèse — 5 chantiers

1. **Reco vivante (spec n°3, en cours)** ← F1, F2, U10, et partiellement C1. Le « trop déterministe » est le grief n°1 ; la spec validée y répond directement.
2. **Bugs P0** ← B1, B2, B3. **À traiter après diagnostic prod/régression.** Risque : simple obsolescence de la prod.
3. **Parcours & conversion (P1)** ← C1 (ensemble sélectionnable), C2 (appliquer suggestion), C3 (funnel pro). Chantier produit neuf, fort impact.
4. **UX / langage non technique (P2)** ← U1–U13. Beaucoup de quick wins (libellés, InfoBubbles, exemples, renommer « polyglotte »).
5. **Résidence multi-région (spec n°2)** ← C4. Brainstorm en pause, à reprendre.

## Pointeurs

`.ralph/prd.json` (stories) · spec n°2 `docs/superpowers/specs/2026-05-27-…` (à venir) · spec n°3
`docs/superpowers/specs/2026-05-27-llm-plateforme-reco-vivante-design.md` · `docs/BACKLOG-USECASES.md`.
Dette technique annexe relevée pendant S-031 : webServer Playwright utilise `next start` alors que
`output: standalone` (warning, tests verts) → migrer vers `node .next/standalone/server.js`.
