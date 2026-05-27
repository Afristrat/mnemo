# Moat Hunt — Strate — 2026-05-24

> Chasse aux features par analogies inter-industries (skill `moat-hunter`).
> Objectif : trouver le game-changer qui fait de Strate « le Cloudflare des infras ».
> Toutes les analogies sont sourcées (DÉFCON-1). Une IA peut se tromper : vérifier les sources.

## Job universel identifié (niveau 3)

> **Permettre à un non-expert de prendre, exécuter et maintenir dans le temps une décision d'infrastructure engageante et difficilement réversible — sans se faire capturer par le fournisseur.**

Validé sur 10+ industries (énergie, assurance, banque, santé, aviation, télécoms, BTP, notariat, voyage, juridique).

## La thèse : le moat n'est pas le moteur de reco (commoditisé) — c'est ce TRIO

Le playbook Cloudflare, transposé :

| Cloudflare a gagné par… | …Strate le réplique avec |
|---|---|
| Se mettre devant l'origine **sans capturer** (tu peux partir) | **Exit Escrow** (sortie certifiée) |
| Free tier + transparence créant l'habitude | **Fiduciary Mode** (mandataire transparent) |
| Voir tout le trafic → meilleure défense pour tous | **Intelligence Network** (effet réseau de données) |

---

## Top 3 features (PRIORITÉ ABSOLUE + FORTE)

### 1. Sovereignty Exit Escrow — 14/15 — effort S
- **Analogie** : Source code escrow + IP Bankruptcy Protection Act 1989 (juridique/logiciel).
- **Mécanisme source** : un tiers séquestre code + conditions ; release automatique et inattaquable si le vendor fait faillite ou cesse la maintenance.
- **Translation** : bouton « Exit Guarantee » — en 1 clic, un bundle reproductible (Terraform/Docker Compose + dumps DB + vault markdown source-de-vérité + embeddings rejouables + runbook) redéployable ailleurs ou en self-host. Release auto même si Strate ferme.
- **Pourquoi personne n'y a pensé** : les plateformes d'infra vivent du lock-in ; **certifier la sortie** est contre-intuitif pour elles, mais c'est exactement la thèse anti-lock-in d'Amine rendue contractuelle. Faisable car le vault = source de vérité est DÉJÀ la doctrine ; les projections sont rejouables.

### 2. Fiduciary Broker Mode — 13/15 — effort S
- **Analogie** : courtier fiduciaire énergie/assurance vs litiges « secret commission ».
- **Mécanisme source** : le courtier qui agit « dans le meilleur intérêt du client » lui doit un devoir fiduciaire = divulgation totale de toute rémunération ; la commission cachée du vendor = violation du mandat.
- **Translation** : Strate s'engage contractuellement comme agent fiduciaire de l'utilisateur, jamais commissionné en douce par les vendors. Mode payant = « je négocie le tarif vendor en ton nom », rémunération affichée.
- **Leçon négative décisive** : **Flipper (auto-switch énergie) a fermé** et Look After My Bills ne bascule que vers les vendors qui le commissionnent → un courtier commissionné par le vendor trahit le mandat et meurt. Le moat est défensif : les concurrents commissionnés ne peuvent pas copier sans saborder leur modèle.

### 3. Cost & Config Intelligence Network — 12/15 — effort L
- **Analogie** : ISAC / threat intelligence sharing (cyber).
- **Mécanisme source** : organisation membre-driven ; chaque membre partage ses incidents, tous bénéficient ; plus de membres = meilleure protection.
- **Translation** : chaque déploiement monitoré renvoie (anonymisé, opt-in RGPD) le **coût réel** par profil/vendor/région → dataset de calibration collectif irréplicable qui tue le ±30 %. + alertes façon ISAC : un vendor change prix/CGU ou casse une API → tous les membres alertés. **C'est le vrai moat Cloudflare : effet réseau de données.**

---

## Toutes les analogies scorées

| # | Feature | Industrie source | N | F | M | Total | Effort | Verdict |
|---|---|---|:-:|:-:|:-:|:-:|:-:|---|
| 1 | Sovereignty Exit Escrow | Escrow logiciel / IP Bankruptcy Act | 5 | 4 | 5 | **14** | S | Priorité absolue |
| 2 | Fiduciary Broker Mode | Courtier énergie/assurance | 4 | 4 | 5 | **13** | S | Priorité absolue |
| 3 | Cost & Config Intelligence Network | ISAC cyber | 5 | 2 | 5 | **12** | L | Forte |
| 4 | Ensemble multi-config (incertitude) | Ensemble forecasting météo | 4 | 4 | 3 | **11** | S | Forte |
| 5 | Dispatch Deviation Guide | MEL aviation | 4 | 4 | 3 | **11** | S | Forte |
| 6 | Infra Health Score | NEWS2 médecine | 4 | 3 | 3 | **10** | M | Forte |
| 7 | Guaranteed Migration / In-Switch | CASS banque UK | 4 | 2 | 4 | **10** | L | Forte |
| 8 | Continuous Re-optimization | Auto-switch énergie (Flipper) | 3 | 2 | 3 | **8** | L | Intéressante |

N = Novelty · F = Feasibility · M = Moat potential (1-5 chacun)

---

## Sources

- Courtier énergie & devoir fiduciaire : [fosterec.com](https://www.fosterec.com/how-energy-brokers-get-paid-hidden-broker-compensation/) · [brabners (secret commission)](https://www.brabners.com/insights/litigation-disputes/half-secret-commissions-and-informed-consent-between-brokers-and-customers)
- Auto-switching énergie (leçon Flipper) : [Money to the Masses](https://moneytothemasses.com/quick-savings/utilities/flipper-review-is-it-the-best-energy-auto-switching-site) · [Which?](https://www.which.co.uk/news/article/is-energy-autoswitching-right-for-you-aj84U4y7wFNy)
- Source code escrow : [Wikipedia](https://en.wikipedia.org/wiki/Source_code_escrow) · [Traverse Legal](https://www.traverselegal.com/blog/software-escrow-agreement-source-code-protection/)
- Current Account Switch Service (CASS) : [currentaccountswitch.co.uk](https://www.currentaccountswitch.co.uk/the-switching-process-personal/) · [Pay.UK](https://www.wearepay.uk/what-we-do/switching-services/current-account-switch-service/)
- NEWS2 (early warning) : [NICE](https://www.nice.org.uk/advice/mib205/chapter/The-technology)
- Ensemble forecasting : [Science Advances — FuXi-ENS](https://www.science.org/doi/10.1126/sciadv.adu2854)
- ISAC / collective defense : [Anomali](https://www.anomali.com/glossary/information-sharing-and-analysis-center-isac) · [National Council of ISACs](https://www.nationalisacs.org/about-isacs)
- Minimum Equipment List : [SKYbrary](https://skybrary.aero/articles/minimum-equipment-list-mel) · [Pilot Institute](https://pilotinstitute.com/what-is-mel/)
