# PASSATION — Strate (repo Infra)

> Passation de quart (protocole nucléaire). Le quart suivant reprend **sans relire d'autre fichier que celui-ci** ; pointeurs détaillés en bas.

```
== PASSATION STRATE 2026-05-28T14:20 ==
[ETAT]    prd.json = **56 stories, 50 faites, 6 restantes** (les 6 = ÉPIC RÉSIDENCE/DR S-043→S-048). **ÉPIC LLM COMPLET** (S-034→040 + 052 + 053). origin/main = `379dd9e`. Qualité : typecheck 0 · lint 0/0 · **356 unit + 10 skip** · build OK. ✅ **PROD = MAIN** : redéployée 2026-05-28T~14:18 (deploy `playxlhhkise7alzrgh1turd`, finished) et **VÉRIFIÉE LIVE** : assistant `/api/llm/chat` → `ok=True`, 3 sources web, cite **exactement** le chiffre fourni « 137 €/mois (±30 %) » sans en inventer (garde-fou DÉFCON 1 par construction OK). Proxy LiteLLM `proxy.ai-mpower.com` (200), `deepseek-v4-flash`.
[ENCOURS] **RAS — checkpoint propre, prod à jour.** Aucune story à mi-chemin. **⚠ ACTIVATION PROD DE S-053 (console admin) À FINALISER AVEC AMINE** : (1) appliquer la migration `20260528120000_admin_prompts.sql` au Supabase self-hosté (SSH/psql) ; (2) seed `insert into super_admins(user_id)` du compte admin (lequel ? créer le compte via /admin une fois, puis seed son id) ; (3) ajouter `SUPABASE_SERVICE_ROLE_KEY` dans Coolify. SANS ça → dégradation gracieuse (gabarits par défaut, l'app marche, /admin rend la connexion). Décisions = compte super-admin + OK pour migrer la prod.
[FAIT]    Session 2026-05-28 (4 stories livrées + déployées + vérifiées) : **S-052** (texte libre par bloc intégré via intake LLM borné + narration ; lève dette freeNotes) · **S-056 option A** (heuristiques de dimensionnement → SizingParams injectables + sourcés ; ComponentCandidate porte gpuLoadFactor/storageFactor consommés si dans bornes [0.25,4], sinon repli baseline ; garde-fou reconcile ; snapshot via catalogue gelé) · **S-053 option C** (prompts système versionnés éditables : migration prompts+super_admins RLS, lib/prompts/{registry,store}, client service-role, builders refactorés en gabarit+composePrompt, console /admin login+éditeur ; option C sûre car validateurs serveur bornent la sortie) · **S-040** (assistant Q&A : serializeRecoFacts + buildChatMessages, route /api/llm/chat + searchWeb sourcé, AssistantPanel sur /resultats ; cite SEULEMENT les faits affichés + web sourcé). Fix typage : `TableShape` gagne `Relationships: []` (requis supabase-js v2). Commits a42eaea→379dd9e.
[ALERTE]  ⚠ **Déploiement** : utiliser **`COOLIFY_PUBLIC_URL`** (PAS `COOLIFY_URL` = IP LAN injoignable) ; PS 5.1 → forcer TLS 1.2. · **S-053 prod** : migration + super_admin + SERVICE_ROLE_KEY à poser (cf. ENCOURS). · **LLM tokens à l'usage NON chiffré** (dette → story future). · **Prix de vente = [PLACEHOLDER]**. · **e2e local fragile** (`next start` KO en `output:standalone`) → viser prod via `E2E_BASE_URL=https://infra.ai-mpower.com`. · Coolify env var champ `is_buildtime`. · webhook GitHub→Coolify non configuré (redeploy manuel API).
[BLOQUE]  Activation admin S-053 (migration + super-admin) en attente d'Amine. Reste 100 % buildable sinon.
[NEXT]    **CE QUI RESTE = ÉPIC RÉSIDENCE/DR (S-043→S-048, spec n°2 validée)**, dans l'ordre des deps : **S-043** pricing egress inter-région + table conformité transferts (sourcés, DÉFCON 1) → **S-044** moteur résidence/DR pur (deriveResidencyPlan + costResidency + CONFLIT résidence×DR exposé, jamais résolu en douce) → **S-045** scoring **9→10** (ajoute `geosov`, resilience étendu DR, sov recadré ; MAJ tous les `toHaveLength(9)`→10 + RadarChart) → **S-046** intégration dans recommend (+ ensemble) → **S-047** Exit Escrow DR (runbook bascule + IaC multi-région) → **S-048** UI Bloc ② Résidence + Résultats (radar 10 + transferts) + e2e. Puis : story LLM tokens (prix live) ; backlog test P2 (U5/U7/U8).
[MEMO]    Coffre GLOBAL ~/.claude/secrets/secrets.env.dpapi (load-secrets.ps1, 39 secrets) : SSH, Coolify (`COOLIFY_PUBLIC_URL`, `COOLIFY_API_TOKEN`, `MNEMO_APP_UUID`=`by7kdehyeieujf6oxzzt1r0m`), Firecrawl, Supabase (`SUPABASE_SERVICE_ROLE_KEY` à mettre en prod pour S-053), sondage, LITELLM_*. Anti-leak : preuve = code HTTP, jamais la valeur. DÉCISIONS AMINE verrouillées : admin prompts = super-admin GLOBAL (S-053) ; **S-053 édition = option C** (tout éditable, garanties dans les validateurs serveur) ; **S-056 = option A** (paramètres vivants) ; presets scoré/explicable (ADR-020) ; texte libre INTÉGRÉ (S-052) ; doctrine déterminisme (LLM propose, moteur calcule). Supabase self-hosté : /home/serveurai/stacks/supabase/docker. Mémoires CLÉS : `strate-audit-options-presets-admin` · `strate-reco-vivante-llm-plateforme` · `prix-jamais-hardcodes-feed-live` · `definition-de-termine` · `strate-avis-critique-non-oriente` · `secrets-handling-protocol`. « reprends en Ralph » relit `.ralph/prd.json`+`progress.md`+AGENTS.md AVANT d'agir.
== FIN PASSATION ==
```

---

## COMMENT REPRENDRE
1. Session dans `C:\Users\amans\OneDrive\Projets\Infra`.
2. Charger les accès : `. "C:\Users\amans\.claude\secrets\load-secrets.ps1"` → peuple `$env:*` (DPAPI, déchiffrable sous le compte/machine d'Amine). Dot-sourcer dans CHAQUE commande qui utilise un secret. Protocole anti-leak : jamais afficher une valeur, preuve = code HTTP / résultat.
3. Lire `.ralph/prd.json` + `.ralph/progress.md` + `AGENTS.md` AVANT d'agir (mode Ralph permanent).
4. Vérifs d'entrée : `npm run typecheck && npm test && npm run lint && npm run build` → vert. Prod : `curl -s -o /dev/null -w "%{http_code}" https://infra.ai-mpower.com/health` → 200.
5. Après tout commit de code mergé : **redéployer la prod** : `POST $COOLIFY_PUBLIC_URL/api/v1/deploy?uuid=$MNEMO_APP_UUID&force=true` (Bearer `$env:COOLIFY_API_TOKEN` ; ⚠ `COOLIFY_PUBLIC_URL`, PAS `COOLIFY_URL` qui est l'IP LAN injoignable hors réseau ; PS 5.1 → forcer TLS 1.2), poller `GET .../api/v1/deployments/<deployment_uuid>` jusqu'à `finished`, puis vérifier au **navigateur** (HTML SSR sans le récap/preset, rendus après hydratation) ou via la route concernée. Prod actuelle = `379dd9e` (à jour 2026-05-28T14:18).

## DÉCISIONS PRODUIT VERROUILLÉES (ne pas re-litiger)
- Cœur = conseil → déploiement ; « recette ouverte, cuisine payante ». Production-ready, zéro dette, DÉFCON 1.
- ±30 % assumé ; **prix JAMAIS hardcodés** (feed live + seed de repli daté) — étendu aux **choix de composants** (catalogue vivant, spec n°3).
- **Reco vivante = « tout vivant + filet »** (spec n°3) : web+LLM reconsidèrent tout, MAIS calcul de coût déterministe sur prix sourcés, snapshot daté reproductible, garde-fou DÉFCON 1, **le LLM ne calcule jamais un coût**. LLM au niveau plateforme via proxy LiteLLM (super-admin GLOBAL hors tenant — décision S-053).
- **Presets = modèle scoré/explicable** (ADR-020, S-051) : déclencheurs durs → HARD ; sinon score de besoin (volume dominant) → LIGHT (≤3) / MEDIUM ; étiquettes des profils-types réconciliées (test de garde). Score + drivers exposés dans `presetReason`.
- **Aucune option collectée ne doit rester sans effet** (DÉFCON 1) : growth/latency intégrés au compute (S-049) ; test de garde anti-dette.
- Trio de moats : ① Exit Escrow ② Fiduciary (zéro commission cachée) ③ Intelligence Network.
- **Honnêteté brutale** : tensions exposées, jamais résolues en douce (ex. résidence stricte × DR hot, spec n°2).
- Scoring : 9 dimensions (resilience ajoutée S-027) ; spec n°2 prévoit la 10ᵉ `geosov`.

## POINTEURS
- **Specs** : `docs/superpowers/specs/2026-05-27-strate-backup-design.md` (n°1, livrée) · `…-llm-plateforme-reco-vivante-design.md` (n°3, en cours S-037→S-040, S-052/053) · `…-strate-residence-dr-design.md` (n°2, validée, → S-043→S-048).
- **Plans** : `docs/superpowers/plans/2026-05-27-strate-backup.md` · `…-llm-plateforme-reco-vivante.md`.
- **Test utilisateur** : `docs/test-feedback-2026-05-27.md` (26 findings priorisés P0-P3 ; bugs P0 résolus par redéploiement).
- **Pricing sourcé** : `docs/pricing/{media,backup,compute}-cost-sources.md`.
- **Ralph** : `.ralph/prd.json` (**56 stories, 50 faites, 6 restantes = épic Résidence/DR**) · `.ralph/progress.md` (log + patterns). `PRD.md` · `docs/DECISIONS.md` (jusqu'à **ADR-020**) · `AGENTS.md` · `CLAUDE.md`.
- **Mémoires** : `~/.claude/projects/C--Users-amans-OneDrive-Projets-Infra/memory/MEMORY.md` (dont **`strate-audit-options-presets-admin`** = audit + décisions de cette session).
- **Déploiement** : Coolify app `mnemo` uuid `by7kdehyeieujf6oxzzt1r0m`, domaine `https://infra.ai-mpower.com`.
```
== FIN PASSATION ==
```
