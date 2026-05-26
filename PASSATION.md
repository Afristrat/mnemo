# PASSATION — Mnémo (repo Infra)

> Passation de quart (protocole nucléaire). Le quart suivant reprend **sans relire d'autre fichier que celui-ci** ; pointeurs détaillés en bas.

```
== PASSATION MNEMO 2026-05-26T13:30 ==
[ETAT]    Lot 1 (conseil+moats) ✅ COMPLET 14/14 + DÉPLOYÉ en prod (https://infra.ai-mpower.com via Coolify) | branche main propre (artefacts non commités présents) | unit 76+4skip · e2e 5+1skip · typecheck 0 · lint 0/0
[ENCOURS] REFONTE du simulateur (traité comme un tout) — en BRAINSTORMING, design validé écran par écran, PAS encore spec-é ni codé. + Sondage de prix en COLLECTE.
[FAIT]    Lot 1 (S-001→S-014) | déploiement Coolify | refonte design (compagnon visuel + conseil 5 voix + pricing) | veille concurrentielle | sondage /sondage live | Supabase SERVEUR relancé + rails RLS Mnémo appliqués | fichier credentials
[ALERTE]  !! NE PAS CODER la refonte avant spec écrite+validée (HARD GATE brainstorming) | secrets → coffre chiffré DPAPI (load-secrets.ps1) ; token Coolify rotaté ✅ | Supabase serveur NON exposé (localhost:8200) | prix = [PLACEHOLDER] tant que le sondage n'a pas de réponses | costing multimodal (création de contenu) N'EXISTE PAS encore | webhook GitHub→Coolify non configuré → redeploy manuel
[BLOQUE]  RAS
[NEXT]    Décision: (a) exposer Supabase serveur + brancher l'app dessus, OU (b) consolider le SPEC de la refonte (docs/superpowers/specs/) → writing-plans → implémenter. Puis: collecter sondage → figer pricing → finir homepage.
[MEMO]    Tous les accès/secrets : coffre GLOBAL ~/.claude/secrets/secrets.env.dpapi (chiffré DPAPI, charger via ~/.claude/secrets/load-secrets.ps1 — cf. mémoire secrets-handling-protocol + CLAUDE.md global). Design refonte : design-proposals.html + décisions ci-dessous. "reprends en Ralph" relit .ralph/ + AGENTS.md.
```

---

## COMMENT REPRENDRE
1. Session dans `C:\Users\amans\OneDrive\Projets\Infra`.
2. Charger les accès (PowerShell, coffre **GLOBAL chiffré DPAPI**, tous projets) : `. "C:\Users\amans\.claude\secrets\load-secrets.ps1"` → peuple `$env:*` (SSH, Coolify, Firecrawl, Supabase local+serveur, sondage). L'état du shell ne persiste pas entre commandes → dot-sourcer dans chaque commande qui utilise un secret. Déchiffrable uniquement sous le compte/machine d'Amine. Doc : CLAUDE.md global, section « Coffre de secrets global ».
3. Lire les **mémoires** (MEMORY.md) : cadrage produit, déploiement Coolify, Supabase serveur, protocole run autonome, « Amine veut le big picture » (pas de menus fragmentés).
4. Selon la tâche : refonte simulateur → reprendre les **décisions design ci-dessous** + `design-proposals.html`, et **écrire le spec AVANT de coder**. Infra → cf. credentials + mémoires.

**Vérifs d'entrée** : `git log --oneline -3` (dernier commit code ≈ `8eb30b4 feat(sondage)`). App live : `curl -s -o /dev/null -w "%{http_code}" https://infra.ai-mpower.com/` → 200. Sondage : `https://infra.ai-mpower.com/sondage`.

---

## [ÉTAT] détaillé
- **Repo** : `github.com/Afristrat/mnemo`, branche `main`. Working tree : **artefacts non commités** (design-proposals.html, homepage-draft.html, scripts/shoot-*.mjs, docs/pricing/, presentation/, .gitignore +.superpowers) — pas du code produit, à committer ou ignorer au choix.
- **Stack** : Next.js 15 (App Router) · React 19 · TS strict · Tailwind v3 · Vitest · Playwright · jspdf · fflate · pg · @supabase/ssr+supabase-js. Lint = ESLint 9 flat config (`eslint .`).
- **Routes prod** : `/` `/configurateur` `/resultats` `/fiduciaire` `/api/pricing` (Firecrawl) `/sondage` + `/api/sondage` `/health`.
- **Déploiement** : Coolify app `mnemo` uuid `by7kdehyeieujf6oxzzt1r0m` (projet Ventures), Dockerfile standalone, domaine `https://infra.ai-mpower.com` (tunnel Cloudflare nahda → Traefik). Redeploy : `POST $COOLIFY_URL/api/v1/deploy?uuid=$MNEMO_APP_UUID&force=true` (webhook auto NON configuré).

## [FAIT] depuis la fin du Lot 1
1. **Déploiement prod** : Dockerfile + /health, image testée, déployée sur Coolify, domaine infra.ai-mpower.com (tunnel). cf. mémoire `mnemo-deploiement-coolify`.
2. **Refonte du simulateur — brainstorming** (compagnon visuel `.superpowers/brainstorm/`, conseil 5 voix, skill pricing). Récap visuel : **`design-proposals.html`** + **`homepage-draft.html`** (homepage de vente brouillon). Décisions validées → section dédiée ci-dessous.
3. **Veille concurrentielle pricing** (sourcée) + instruments **Van Westendorp + conjoint** : `docs/pricing/wtp-research.md`.
4. **Sondage de prix LIVE** : page `/sondage` (VW + mini-conjoint) → `/api/sondage` → **Postgres Coolify `mnemo-survey-db`** (uuid `l2x4swo8…`). Export : `GET /api/sondage?token=$SURVEY_EXPORT_TOKEN`. (Choix : page same-origin plutôt qu'artefact Claude.ai, car CSP bloque le POST sortant.)
5. **Supabase SERVEUR self-hosted** (≠ local dev) : était cassé (mots de passe rôles ≠ .env) → réparé (réalignement via trust loopback), 13/13 healthy. **Rails RLS Mnémo (S-012) rejoués dessus** (5 tables + RLS). cf. mémoire `supabase-serveur-selfhosted`. Compose : `/home/serveurai/stacks/supabase/docker`. Kong sur `localhost:8200`, **non exposé**.
6. **Credentials** consolidés : `mnemo-infra-credentials.env` (cf. mémoire `mnemo-infra-credentials`).

## DÉCISIONS DE REFONTE DU SIMULATEUR (validées en sparring — base du spec à écrire)
1. **Entrée = paradigme B** : structuré **+ expression libre/dictée** (« décrivez votre besoin » + note libre par étape).
2. **Chemin 90 s** (reco n°1 du conseil) : entrée par la **douleur** (zéro jargon « souverain ») → verdict **risque / gain / prix ferme par palier / next step**. Le configurateur 16 params devient **« mode expert »**.
3. **Questionnaire en 4 blocs** : ① Profil & contraintes · ② **Infra pure** (volume, débit, latence, croissance, souveraineté) · ③ **Usage-Mémoire** (base interrogeable ? · « À qui sert cette mémoire » = ex-multivoix · contenu à mémoriser · **capacités costables** = ex-modules) · ④ **Usage-Création de contenu** (audio/vidéo/images/formations, souverain vs API — **NOUVEAU**).
4. **Pattern d'étape** : label + **vraie infobulle (pourquoi + conséquence)** · **sliders continus** (volume/requêtes) · « voix/perspectives » → **« À qui sert cette mémoire ? »** · **binaire Oui/Non** (fin du « souhaité ») · note libre.
5. **Carte flottante « budget-mètre »** vert→rouge selon coût/budget ; au-dessus → **explique pourquoi + un levier**.
6. **Honnêteté brutale partout** : rien masqué, incohérences pointées (petit budget + souveraineté max), étiquettes 🟢 open-source / 💳 payant.
7. **Modules avancés** = **options d'usage costables** (renommées clair : Traçage des revirements · Mémoire infalsifiable · Décisions horodatées · Plan de panne · Détecteur de conflits) — PAS de l'infra pure ; activées via opt-in « en faire une base mémorielle ».
8. **Multi-tenant** : Super-admin (Amine) + Membres ; rôles RLS owner/admin/member déjà en base ; **pas d'écran admin-d'org** pour l'instant. **LLM configuré au niveau plateforme** (super-admin, via LiteLLM `proxy.ai-mpower.com`), pas par org.
9. **Moteur de coût DÉTERMINISTE** (±30 % sourcé) ; le **LLM ne touche JAMAIS le calcul** — il sert : interpréter l'intake libre/dictée, réécrire infobulles/cas d'usage selon le profil, narration du rapport.
10. **Thème clair par défaut** + sombre.
11. **Homepage de vente** (`homepage-draft.html`) : 4 promesses — **« −risques » = PREUVE DURE (Exit Escrow + Fiduciary, déjà livrés)** ; les 3 autres (+profits/+efficience/−coûts) = « voici comment on le mesure » (PAS de stat inventée → DÉFCON 1).
12. **Rapport partageable** + encadrés valeur ; **capture email exit-intent** + **log des simulations** (= moat data, recos du conseil).
13. **Pricing** : « **recette ouverte (diagnostic gratuit), cuisine payante** ». **SPLIT** : prix FERME (service Mnémo) vs coût VARIABLE (infra, pass-through transparent ±30 %). Valeur-based = **coût humain évité**, **PAS un TJM** (livré par agents → marge logicielle). Montant = **[PLACEHOLDER]** jusqu'aux réponses du sondage (VW + conjoint).

### Angles morts soulevés par le conseil (à respecter dans le spec)
- « Souverain » = jargon d'initié → copy acheteur par **peur/conformité (CNDP/Cloud Act/RGPD)**.
- Le **±30 % nu** fait fuir le décideur → **prix ferme par palier + leviers**.
- Le configurateur 16 params **effraie** le non-technique → chemin 90 s d'abord, expert derrière.
- « Prouvé » sans cas client = mensonge (DÉFCON 1) → preuve dure uniquement pour « −risques ».

## [ALERTE] pièges & risques
- **HARD GATE brainstorming** : ne PAS coder la refonte avant d'avoir écrit le spec (`docs/superpowers/specs/AAAA-MM-JJ-refonte-simulateur-mnemo-design.md`) ET obtenu validation d'Amine. Ensuite invoquer `writing-plans`.
- **Token Coolify** : ✅ **rotaté le 2026-05-26** — ancien token (leaké en chat) remplacé dans le coffre DPAPI puis révoqué au dashboard. Coffre = `mnemo-infra-credentials.env.dpapi`, chargé via `load-secrets.ps1` (cf. mémoire `secrets-handling-protocol`).
- **Supabase serveur** : non exposé (localhost:8200). Pour brancher l'app prod dessus → router via tunnel (`supabase.ai-mpower.com → localhost:8200`) puis fixer `NEXT_PUBLIC_SUPABASE_*` côté app. **Supabase LOCAL = dev jetable**, ne pas l'utiliser en prod.
- **sondage.ai-mpower.com** ajouté au tunnel + domaine app, mais son routage Traefik renvoyait 404 au dernier test → **à vérifier** (le sondage marche sûrement via `infra.ai-mpower.com/sondage`).
- **Costing multimodal** (bloc Création de contenu) = vrai chantier neuf (le moteur ignore audio/vidéo/images aujourd'hui : `profileCostFactors` = volume/req/users seulement).
- **Modules** sont encore costés dans le moteur actuel ; la refonte les déplace en « usage costable » — à recâbler proprement.
- OneDrive : I/O parfois lents (non bloquant).

## [MEMO] conventions & learnings (ne pas réapprendre)
1. Validation par story : typecheck 0 → test vert → lint 0/0 → build OK → commit+push.
2. TS du poste (`~/.claude/rules/typescript.md`) : pas de `any`/`as`/`!`, return types exportés, `const`+`as const` au lieu d'enum.
3. **Apostrophes JSX = ’ typographique** (sinon `react/no-unescaped-entities`).
4. `pg`/Coolify Postgres : l'app Coolify atteint une DB Coolify du même projet par son hostname interne (uuid) — réseau OK d'office.
5. **Supabase self-hosted** : `local`/loopback en `trust` (interne), réseau en `scram` → les tests `-h 127.0.0.1` ne valident PAS le mot de passe (trust). Tester via `-h db`. Réparer mots de passe = ALTER rôles via trust loopback en `supabase_admin` (superuser).
6. SSH sortie tronquée sur longs scripts si un `psql` attend un mot de passe (prompt) → toujours `PGPASSWORD=` ou trust.
7. Cloudflare tunnel : éditer config-nahda.yml avec backup + `ingress validate` + `kill -HUP`, règle AVANT le `http_status:404`.
8. Claude.ai artefact publié ne peut PAS POST vers l'extérieur (CSP) → pour collecter, page same-origin sur l'app.
9. Préférence Amine : **vision d'ensemble synthétisée, pas de menus d'options fragmentés** (cf. mémoire `amine-veut-big-picture`).

## DÉCISIONS PRODUIT VERROUILLÉES (ne pas re-litiger)
- Cœur = conseil → déploiement séquencés ; modèle « recette ouverte, cuisine payante ».
- Production-ready, zéro dette, PAS de MVP.
- ±30 % assumé (simulateur) ; prix infra via price feed Firecrawl, pas de table figée.
- Agent (Lot 2) = provisioning hybride human-in-the-loop (jamais de compte/carte à la place de l'user).
- Trio de moats : ① Exit Escrow ② Fiduciary ③ Intelligence Network. Jamais de commission vendor cachée.
- Cible = P1 (communauté Amine) + P2 (PME tech).

## POINTEURS
- **Credentials** : coffre GLOBAL `C:\Users\amans\.claude\secrets\secrets.env.dpapi` (chiffré DPAPI, chargeur `C:\Users\amans\.claude\secrets\load-secrets.ps1`, hors git + hors OneDrive, partagé tous projets).
- **Design refonte** : `design-proposals.html` · `homepage-draft.html` · `.superpowers/brainstorm/.../content/*.html`.
- **Pricing** : `docs/pricing/wtp-research.md`.
- **Spec & règles** : `PRD.md` (F1→F15, threat model §8) · `docs/MOAT-HUNT.md` · `docs/DECISIONS.md` (ADR-001..008) · `AGENTS.md` · `plan.md` · `CLAUDE.md`.
- **Ralph** : `.ralph/prd.json` (14/14 ✓) · `.ralph/progress.md`.
- **Design system** : `design-reference/mn_mo_brand_identity/DESIGN.md`.
- **Mémoires** : `~/.claude/projects/C--Users-amans-OneDrive-Projets-Infra/memory/MEMORY.md` (cadrage, déploiement, Supabase serveur, credentials, protocoles).
```
== FIN PASSATION ==
```
