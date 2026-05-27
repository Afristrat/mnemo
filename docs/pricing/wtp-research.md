# Mnémo — Recherche de prix (Willingness-to-Pay)

Objectif : caler le **forfait service mensuel** du palier **Pro** (la « cuisine payante »).
Rappel cadre : on tarife le **service Mnémo** (déploiement + monitoring + recalibration + négo vendor), **pas l'infra** (transparente, ±30 %, payée aux fournisseurs). Tout montant ci-dessous = service Mnémo, hors coût d'infra.

> Statut : niveaux de prix **provisoires**, à caler sur la veille concurrentielle (en cours) + les réponses terrain. Ne pas figer avant ≥ 30 réponses conjoint / ≥ 15 réponses Van Westendorp.

---

## 1. Mini-test Van Westendorp (à envoyer à 10–15 prospects cible)

**Intro à montrer au répondant :**
> Mnémo déploie et exploite pour vous une « mémoire d'organisation » IA, hébergée chez vous ou en UE (pas chez les géants US). Vous gardez la main : repartez avec toute votre stack quand vous voulez (zéro verrouillage). Le **coût de l'infrastructure** (serveurs, modèles) est transparent et payé à vos fournisseurs. Les questions ci-dessous portent **uniquement sur l'abonnement au service Mnémo** (déploiement assisté + supervision continue + optimisation des coûts).

**Les 4 questions (prix mensuel du service) :**
1. À partir de quel prix mensuel ce service serait-il **trop cher** pour que vous l'envisagiez ? *(trop cher)*
2. À quel prix serait-il **si bas que vous douteriez de son sérieux / sa qualité** ? *(trop bon marché)*
3. À quel prix le trouveriez-vous **cher, mais vous y réfléchiriez quand même** ? *(cher / acceptable)*
4. À quel prix le trouveriez-vous **une bonne affaire** ? *(bon marché / bonne affaire)*

**+ Intention (Newton/Miller-Smith) :**
5. À votre **prix « bonne affaire »**, achèteriez-vous ? (Très probable / Probable / Peu probable / Non) — idem au prix « cher/acceptable ».

**Analyse :**
- Tracer les courbes cumulées des 4 prix.
- **OPP** (Optimal Price Point) = intersection « trop cher » × « trop bon marché ».
- **IPP** (Indifference) = intersection « cher » × « bonne affaire » (≈ prix médian psychologique).
- **Fourchette acceptable** = entre PMC (point de bon marché marginal) et PME (point de cher marginal).
- Les Q5 donnent la **demande réelle** aux deux prix (corrige l'optimisme du déclaratif).

---

## 2. Conjoint (Choice-Based Conjoint — CBC)

Le Van Westendorp donne une fourchette ; le conjoint dit **ce qui justifie le prix** (quels attributs portent la valeur) et **le prix optimal par configuration**.

**Attributs & niveaux :**

| Attribut | Niveaux |
|---|---|
| Déploiement | API souveraine UE · Hybride · On-prem air-gapped |
| Périmètre service | Déploiement seul · + Monitoring continu · + Recalibration & négo vendor |
| Capacités | Base · + Gouvernance (mémoire infalsifiable, détecteur de conflits…) · + Création de contenu |
| Support | Standard (email) · Prioritaire · Dédié + SLA |
| Engagement | Mensuel · Annuel (−20 %) |
| **Prix service /mois** | *(4 niveaux — à caler sur la veille : provisoirement N1 < N2 < N3 < N4)* |

**Protocole :**
- 10–12 tâches de choix ; chaque tâche = 2–3 profils + option « aucun ».
- Cible : 30–50 répondants du segment (dirigeants/PME Maroc + UE).
- Outil : Sawtooth / Conjointly / Qualtrics, ou un Google Form + plan factoriel fractionnaire si budget zéro.

**Analyse → pricing :**
- Estimer les **utilités partielles** (logit multinomial / Hierarchical Bayes).
- En déduire : **importance relative** de chaque attribut, **WTP** par niveau, et une **courbe prix-demande**.
- **Simulateur de parts** : tester des configurations de paliers (Diagnostic gratuit / Pro / Souverain+) et lire la part de préférence + le revenu attendu à chaque prix → **prix optimal par palier**.

---

## 3. Sortie attendue

1. Fourchette acceptable (Van Westendorp) : `[PMC … PME]`, OPP ≈ `?`, IPP ≈ `?`.
2. Prix optimal du **Pro** (conjoint) + les 2–3 attributs qui le portent (probables : Déploiement on-prem, Recalibration/négo, Support dédié).
3. Grille finale : **Diagnostic (gratuit) · Pro (forfait/mois) · Souverain+ (devis)** — ancrée sur la veille concurrentielle.
