# PRD — Mnémo

> Product Requirements Document — la plateforme souveraine de choix, déploiement et exploitation d'infrastructures de base mémorielle IA.
> Version 1.1 · 2026-05-24 · Auteur : Amine (sparring : Claude Code /NP)
> Documents liés : `MOAT-HUNT.md`, genèse dans `Projet_collectif\workshop-01-base-memorielle-collective\02-bases-individuelles\amine\`.
> Statut : draft à valider. **DÉFCON-1 : toute donnée chiffrée doit citer sa source ; une IA peut se tromper.**
> **Principe de livraison : production-ready, zéro dette. Pas de version mince, pas d'attente prudentielle.** Les lots ci-dessous sont tous livrés au niveau production ; leur ordre n'est dicté que par des dépendances causales, jamais par de la prudence.

---

## 0. TL;DR

Mnémo profile le besoin d'un dirigeant, **recommande** une stack de base mémorielle souveraine sur 7 couches avec coût projeté, **livre** un plan exportable et sourcé, **déploie** l'infra via un provisioning hybride (l'utilisateur crée le compte, l'agent optimise le setup) et la **monitore**. Modèle « recette ouverte, cuisine payante ». Trois moats inspirés d'autres industries — **Exit Escrow**, **Fiduciary Mode**, **Intelligence Network** — reproduisent le playbook Cloudflare et rendent la plateforme défendable là où la simple reco est commoditisée. Première brique d'un écosystème de souveraineté mémorielle.

---

## 1. Vision & thèse

**Job universel résolu** : *permettre à un non-expert de prendre, exécuter et maintenir dans le temps une décision d'infrastructure engageante et difficilement réversible — sans se faire capturer par le fournisseur.*

**Thèse** : aujourd'hui, un dirigeant qui veut une mémoire IA a trois options bancales — ChatGPT/Claude grand public (mémoire faible, données chez un tiers US), projet sur-mesure (30-200 k€, 6 mois, non réutilisable), ou SaaS mémoire US (locataire à vie). Aucune ne suit le client dans sa croissance, ne respecte la souveraineté progressive, ni ne s'adapte au budget réel. *(Source : genèse, présentation P4.)*

Mnémo n'est pas un conseil isolé : c'est **le point d'entrée d'un écosystème de souveraineté mémorielle** qui adresse quatre douleurs structurelles — perte de connaissance critique, re-contextualisation permanente dans chaque chat, non-souveraineté des données, et vendor lock-in.

**Promesse de marque** : *« La base mémorielle souveraine qui grandit avec votre organisation — sans migration, sans verrouillage, sans coûts cachés. »*

---

## 2. Jobs-to-be-done (le job ≠ la solution)

Le dirigeant n'« embauche » pas Mnémo pour « designer son infra » (ça, c'est le moyen). Les vrais jobs :

1. « Ne plus perdre la connaissance critique quand un sachant part. »
2. « Que mon IA réponde avec **MA** doctrine, pas la moyenne du web. »
3. « Garder la **souveraineté** sans payer un projet à 200 k€. »
4. « Choisir la bonne infra **sans être expert**, et pouvoir **partir** quand je veux. »

On vend un **résultat souverain et une tranquillité**, pas une stack technique.

---

## 3. Cible & personas

> **Décision de cadrage** : le simulateur couvre 5 ordres de grandeur (Solo 5 €/mois → Grand groupe 1 M€/an). Ce ne sont pas le même acheteur, ni le même cycle de vente, ni la même conformité. Le périmètre initial **ne vise pas tout le monde** — il vise le segment où Amine a un accès direct et une preuve sociale.

| Persona | Lot 1 ? | Justification |
|---|---|---|
| **P1 — Bâtisseur souverain** (coach/freelance/consultant francophone Maroc-UE, technophile, veut sa base revendable) | ✅ **Cœur** | Premiers clients nommés = membres de la communauté d'Amine. Accès direct, demande acquise, bouche-à-oreille. |
| **P2 — PME / startup tech** (équipe 5-10, ADR + specs + code) | ✅ Secondaire | Profil MEDIUM, technophile, cycle court. |
| **P3 — Agence / programme** (80+ accompagnés, multi-voix) | 🟡 Lot ultérieur | Volume + multi-tenancy, cohérent mais plus lourd. |
| **P4 — Cabinet régulé** (avocat/CGP/santé, secret pro) | 🟡 Lot ultérieur | Preset HARD, conformité forte = argument premium mais cycle long. |
| **P5 — ETI / Grand groupe** | ⛔ Hors périmètre | Appel d'offres, DPA, SecNumCloud → cycle de vente incompatible avec un self-service. |

---

## 4. Positionnement & moats (le cœur défendable)

La couche de **reco** est commoditisée (un LLM généraliste la rapproche gratuitement). Le moat est ailleurs — un trio qui reproduit le playbook Cloudflare *(détail + sources : `MOAT-HUNT.md`)*.

| # | Moat | Analogie | Ce qu'il défend | Lot 1 |
|---|---|---|---|---|
| ① | **Exit Escrow** — sortie certifiée | Escrow logiciel / IP Bankruptcy Act | Anti-capture : en 1 clic, un bundle reproductible (IaC + dumps + vault + runbook) redéployable ailleurs ; release auto même si Mnémo ferme. | ✅ |
| ② | **Fiduciary Mode** — mandataire transparent | Courtier énergie/assurance | Confiance : payé par l'utilisateur, **jamais commissionné en douce** par les vendors. Mode payant = négociation tarifaire au nom du client. | ✅ |
| ③ | **Intelligence Network** — effet réseau de données | ISAC cyber | Données : coût réel anonymisé renvoyé par chaque déploiement → calibration irréplicable + alertes vendor. | ✅ (rails) |

**Leçon négative décisive** : Flipper (auto-switch énergie) a fermé ; Look After My Bills ne bascule que vers les vendors qui le commissionnent. **Un courtier commissionné par le vendor trahit le mandat et meurt.** Le Fiduciary Mode est une condition de survie, pas une option. *(Sources : [moneytothemasses](https://moneytothemasses.com/quick-savings/utilities/flipper-review-is-it-the-best-energy-auto-switching-site), [brabners](https://www.brabners.com/insights/litigation-disputes/half-secret-commissions-and-informed-consent-between-brokers-and-customers).)*

---

## 5. Périmètre — production-ready, incréments par dépendance causale

> **Principe** : tout est livré production-ready (zéro dette : typecheck/lint/build verts, Playwright sur les parcours critiques, sécurité traitée). **Pas de version mince ni d'attente prudentielle.** L'ordre des lots n'est dicté que par **une seule dépendance que le code ne lève pas** : le moat ③ n'a pas de données tant qu'aucun déploiement n'est monitoré — il démarre donc en rails et se densifie mécaniquement. Le risque CGU/responsabilité de l'agent est, lui, levé par design (cf. F10), donc les lots peuvent avancer en parallèle.

### Lot 1 — Conseil + moats (production-ready, vendable seul)
- **F1 Moteur de profilage** : wizard ~16 paramètres → preset (LIGHT/MEDIUM/HARD).
- **F2 Moteur de stack** : catalogue 7 couches (C0→C6) × preset → composants + coûts.
- **F3 Moteur de coût** : base + facteurs (volume/req/users/modules), **slider de projection** assumé, bandes basse/haute par poste, confiance 🟢🟡🟠 sourcée.
- **F4 Price feed** : re-scrape des prix vendor (Firecrawl, rendu JS) + flag des changements. Remplace toute table de prix figée.
- **F5 Ensemble multi-config** : N configs candidates, divergence affichée = incertitude (répond au besoin de cross-check).
- **F6 Livrable exportable** : plan d'action + stack + carte de coûts, **chaque chiffre lié à sa source** + disclaimer.
- **F7 Exit Escrow (①)** : génération du bundle de sortie reproductible.
- **F8 Fiduciary Mode (②)** : divulgation contractuelle, zéro commission cachée.
- **F9 Rails du Network (③)** : consentement opt-in RGPD + schéma de données coût réel (collecte effective dès le monitoring).

### Lot 2 — Cuisine payante (déploiement assisté + monitoring)
- **F10 Provisioning hybride (human-in-the-loop par design)** : Mnémo fournit à l'utilisateur le **lien + la procédure guidée** pour créer lui-même chaque compte vendor (avec sa carte). L'agent **prend le relais après** sur la **configuration et l'optimisation du setup**, via OAuth/MCP/API officiels sur le compte autorisé par l'utilisateur. **L'agent ne crée jamais de compte ni ne saisit de carte** → zéro automatisation d'inscription (CGU respectées), zéro engagement financier au nom d'autrui (responsabilité maîtrisée).
- **F11 Coffre de secrets** chiffré, zéro clé en clair.
- **F12 Monitoring** : Infra Health Score (composite, seuil = alerte) + Dispatch Deviation Guide (dégradation opérée façon MEL).
- **F13 Network actif** : collecte du coût réel → recalibration continue + alertes vendor partagées.

### Lot 3 — Écosystème
- **F14 Guaranteed Migration / In-Switch** (double-run + garantie de rollback).
- **F15 Continuous Re-optimization** (proposition de migration quand économie > seuil, sur validation humaine).
- Catalogue de produits dérivés (couche juridique, déploiement MCP, audit critique…).

---

## 6. Architecture fonctionnelle

```
┌─────────────────────────────────────────────────────────────┐
│  WIZARD (profilage)  →  MOTEUR  →  LIVRABLE  →  AGENT  →  MONITORING │
└─────────────────────────────────────────────────────────────┘
        F1            F2/F3/F5        F6/F7       F10/F11        F12/F13
                          ↑                                        │
                    F4 price feed  ←──────── F9/F13 Intelligence Network (coût réel)
```

### 6.1 Moteur de recommandation (productisation du simulateur)
Logique existante (cf. `simulator-archi-base-memorielle-v2.html`) à porter côté serveur :
1. **Décision preset** : `needsHard` (secret/cabinet régulé/audit+bitemporel requis) ; `fitsLight` (faible volume + sensibilité modérée + budget bas) ; sinon MEDIUM.
2. **buildLayers** : C0 contrat YAML → C1 surface MCP → C2 orchestrateur RAG+cascade → C3 retrieval/rerank → C4 embeddings → C5 stockage bitemporel → C6 infra. Chaque couche : choix + coût + alternatives + note.
3. **computeCost** : `base + volumeFactor + reqFactor + userFactor + moduleCost`.
4. **computeScores** : 8 dimensions (conformité, auditabilité, stress-test, souveraineté, adaptativité, time-to-V1, multimodalité, coût).
5. **Modules avancés** : variables d'entrée (sliders d'intensité) qui ajustent coût + score + plan — **sans** que la plateforme implémente ces features de la base du client.

> Convergences techniques à intégrer comme défauts (verdicts genèse, pas débats) : frontmatter YAML pivot, bi-temporalité 4 timestamps, nomic-embed par défaut, Presidio (PII), Contextual Retrieval, **vault markdown = source de vérité** (clé de l'Exit Escrow).

### 6.2 Exit Escrow (F7)
Le bundle de sortie contient : (a) IaC `Terraform`/`Docker Compose` paramétré par la stack choisie ; (b) dumps DB ; (c) **vault markdown** (source de vérité) ; (d) embeddings rejouables ou script de re-embedding ; (e) runbook de redéploiement. Faisable parce que le vault est déjà la source de vérité et que les projections (DB, vecteur) sont des recalculs. *(Source mécanisme : [escrow logiciel](https://en.wikipedia.org/wiki/Source_code_escrow).)*

### 6.3 Ensemble multi-config (F5)
Génère N variantes (ex. « souveraineté max », « coût min », « time-to-V1 min »). Affiche le **spread** de coût/score comme incertitude. Convergence → haute confiance ; divergence → l'utilisateur arbitre en connaissance de cause. *(Source mécanisme : [ensemble forecasting](https://www.science.org/doi/10.1126/sciadv.adu2854).)*

### 6.4 Price feed (F4)
Crawl périodique + à la demande des pages tarifaires (rendu JS via Firecrawl). Stocke prix + timestamp + niveau de confiance + URL source. Détecte et flague les variations. Tout chiffre affiché renvoie à sa source datée.

### 6.5 Provisioning hybride (F10)
Flux : (1) Mnémo affiche pour chaque vendor de la stack choisie un **lien direct + procédure guidée** de création de compte ; (2) l'utilisateur crée le compte et saisit sa carte lui-même ; (3) l'utilisateur autorise Mnémo via **OAuth/MCP officiel** ; (4) l'agent configure et optimise le setup (paramètres, quotas, sécurité) sur le compte autorisé ; (5) chaque action est journalisée (audit trail). L'agent n'inscrit jamais, ne paie jamais.

---

## 7. Spécifications & critères d'acceptation (extrait Lot 1)

| ID | Exigence | Critère d'acceptation (testable Playwright) |
|---|---|---|
| F1 | Wizard 16 params | Un profil complet produit toujours un preset déterministe ; reprise via persistance locale. |
| F3 | Slider de projection | Modifier le slider de volume recalcule le coût en < 200 ms ; bandes basse/haute affichées. |
| F4 | Price feed sourcé | Chaque poste de coût expose une URL source + date + pastille 🟢🟡🟠. |
| F5 | Ensemble | Au moins 3 configs candidates avec écart de coût visible ; libellé d'incertitude présent. |
| F6 | Livrable | Export (PDF/MD) contenant disclaimer « une IA peut se tromper » + toutes les sources cliquables. |
| F7 | Exit bundle | Le bundle généré redéploie une stack identique sur un environnement vierge (test d'intégration). |
| F8 | Fiduciary | Aucune reco n'est conditionnée à une commission vendor ; page de divulgation accessible. |
| F9 | Consentement | Collecte de données coût réel impossible sans opt-in explicite horodaté. |

---

## 8. Sécurité & conformité (non négociable)

> L'agent (Lot 2) manipule de l'OAuth délégué et un coffre de secrets vendor → surface d'attaque critique. La sécurité est spécifiée **dès le Lot 1** même si l'agent arrive au Lot 2.

### 8.1 Threat model STRIDE (agent + coffre)
| Menace | Scénario | Mitigation |
|---|---|---|
| **S**poofing | Usurpation d'un compte utilisateur pour déclencher une config | Auth forte (MFA), sessions courtes, vérification d'intention. |
| **T**ampering | Altération d'une config avant exécution | Configs signées, diff human-in-the-loop avant exécution. |
| **R**epudiation | « Ce n'est pas moi qui ai validé » | Journal d'audit inviolable (append-only) de chaque action agent. |
| **I**nfo disclosure | Fuite de clés vendor du coffre | Coffre chiffré au repos, zéro clé en clair, accès scopé, rotation. |
| **D**oS / coût | Boucle de config qui sur-dimensionne | Compte + carte = l'utilisateur (pas l'agent) ; caps/quotas/budgets stricts ; alerte Infra Health Score. |
| **E**levation | Token OAuth sur-scopé | Scopes minimaux, consentement délégué granulaire, révocation testée. |

### 8.2 Conformité
- **RGPD + CNDP (Maroc)** : règle `max(RGPD, CNDP)`. Base légale du consentement réseau (F9), registre Art. 30, droit à l'oubli (tombstone + hard delete après rétention).
- **Multi-tenancy** : RLS activé sur toutes les tables (champ `circle`/tenant pivot), zéro exception.
- **Secrets** : jamais hardcodés, toujours via variables d'environnement / coffre.
- **Données vendor** : l'agent agit par OAuth/connexion déléguée sur un compte créé par l'utilisateur, **jamais d'automatisation d'inscription** (respect CGU).
- **Rollback** : tout déploiement est réversible ; bundle Exit Escrow = filet de sécurité ultime.

---

## 9. Modèle économique

- **Recette ouverte, cuisine payante** : le livrable montre tout le QUOI (renforce la confiance et l'anti-lock-in) ; on facture l'**opération continue**.
- **Gratuit** : wizard + reco + livrable de base (lead magnet, crée l'habitude — modèle Cloudflare free tier).
- **Payant** : Exit bundle premium, déploiement assisté (Lot 2), monitoring, recalibration, **négociation tarifaire vendor au nom du client** (fiduciaire, rémunération affichée).
- **Pricing indicatif par taille** (coûts cloud exposés, marge à découvert) : Solo ~30-100 € · Équipe ~100-500 € · PME ~500-3 000 € · ETI ~3 000-30 000 € · Grand groupe ~30 k-1 M€/an. *(Source : genèse P4 ; à recalibrer par le réseau.)*

---

## 10. Métriques de succès

| Catégorie | KPI | Cible initiale |
|---|---|---|
| Activation | % qui complètent le wizard → livrable | > 60 % |
| Confiance | % qui ouvrent ≥ 1 source ; NPS | mesurer baseline |
| Conversion | % livrable → engagement payant (segment P1) | > 10 % |
| Précision (moat ③) | écart médian coût estimé vs réel collecté | **baisse** trimestre après trimestre |
| Défense (moat ①) | % de comptes ayant généré un Exit bundle ; rétention | rétention > 80 % |

---

## 11. Risques & angles morts (avec mitigation)

| Risque | Gravité | Mitigation |
|---|---|---|
| **A3 — Dette de maintenance vendor** (prix/CGU/API changent en permanence) | Élevée | Price feed automatisé (F4) + alertes Network (F13) transforment la dette en flux ; jamais de table figée. |
| **A2 — Cible trop large** (5 ordres de grandeur) | Moyenne | Périmètre initial focalisé P1/P2 ; ETI/grand groupe explicitement hors périmètre. |
| **A4 — Le livrable sabote l'upsell** | Moyenne | Recette ouverte assumée ; l'upsell = opération continue, pas rétention d'info. |
| **Conflit d'intérêt vendor** (piège Flipper) | Existentielle | Fiduciary Mode (②), zéro commission cachée, divulgation contractuelle. |
| **±30 % perçu comme faux-rigoureux** | Moyenne | Slider de projection + bandes + sources datées + disclaimer ; recalibration par le réseau. |
| **Agent qui sur-dimensionne** (Lot 2) | Moyenne | Mitigé par design : compte + carte = l'utilisateur ; l'agent n'optimise qu'un setup autorisé ; caps/quotas + audit trail. |
| **Hallucination de prix (browser IA)** | Moyenne | Validation, sources liées, confiance par poste ; un humain peut corriger. |

---

## 12. Validation en parallèle du build (pas un préalable bloquant)

La demande est considérée acquise sur le segment P1 (accès direct communauté). Ces validations tournent **en parallèle** du développement, jamais avant :

- **Validation demande** : présenter à 5 membres P1 le parcours + la promesse Exit Guarantee + Fiduciary, recueillir des engagements réels (LOI/arrhes). Sert à affiner l'offre et le pricing, pas à autoriser le code.
- **Validation Exit Escrow** : c'est le **critère d'acceptation de F7** (cf. §7) — le bundle généré doit redéployer une stack identique sur un environnement vierge. Premier banc d'essai : la stack réelle d'Amine (Manahil).

---

## 13. Roadmap (production-ready à chaque lot, pas de version mince)

1. **Lot 1 — Conseil + moats** : F1-F9, production-ready. Stack Next.js + Supabase (RLS) + Tailwind + TypeScript. Playwright sur wizard→livrable→export + test d'intégration de l'Exit bundle (F7). Vendable seul.
2. **Lot 2 — Cuisine payante** : F10 (provisioning hybride) + F11-F13 (coffre, monitoring IHS+MEL, Network actif). Threat model rejoué. Avance en parallèle du Lot 1.
3. **Lot 3 — Écosystème** : F14-F15 + produits dérivés.

> Le moat ③ passe de « rails » (Lot 1) à « actif » (Lot 2) **mécaniquement**, dès les premiers déploiements monitorés. C'est la seule séquence imposée — tout le reste peut être mené de front.

---

## Annexe — Sources

Energie/fiduciaire : [fosterec](https://www.fosterec.com/how-energy-brokers-get-paid-hidden-broker-compensation/) · [brabners](https://www.brabners.com/insights/litigation-disputes/half-secret-commissions-and-informed-consent-between-brokers-and-customers) — Auto-switch : [moneytothemasses](https://moneytothemasses.com/quick-savings/utilities/flipper-review-is-it-the-best-energy-auto-switching-site) — Escrow : [Wikipedia](https://en.wikipedia.org/wiki/Source_code_escrow) — CASS : [currentaccountswitch](https://www.currentaccountswitch.co.uk/the-switching-process-personal/) — NEWS2 : [NICE](https://www.nice.org.uk/advice/mib205/chapter/The-technology) — Ensemble : [Science Advances](https://www.science.org/doi/10.1126/sciadv.adu2854) — ISAC : [Anomali](https://www.anomali.com/glossary/information-sharing-and-analysis-center-isac) — MEL : [SKYbrary](https://skybrary.aero/articles/minimum-equipment-list-mel)
