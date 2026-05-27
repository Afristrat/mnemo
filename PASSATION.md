# PASSATION — Strate (repo Infra)

> Passation de quart (protocole nucléaire). Le quart suivant reprend **sans relire d'autre fichier que celui-ci** ; pointeurs détaillés en bas.

```
== PASSATION STRATE 2026-05-27T20:45 ==
[ETAT]    prd.json = **48 stories, 37 faites, 11 restantes**. **Lot 1 ✅ + Refonte Strate ✅ + EPIC BACKUP COMPLET (S-026→S-031) ✅ + S-041 compute ✅ + S-042 UX ✅ + S-034 fondation LLM ✅ + S-035 catalogue ✅**. **TOUT REDÉPLOYÉ EN PROD** (infra.ai-mpower.com, e2e prod 7/7, marqueur « radar 9 dimensions ») — **bugs P0 du test utilisateur = obsolescence, résolus**. origin/main = `287d28d`. Qualité : typecheck 0 · lint 0/0 · ~250 unit + 8 skip · build OK · e2e verts. **Clé LiteLLM EN PLACE** (coffre DPAPI local + Coolify runtime) ; proxy `proxy.ai-mpower.com` (200), modèle `deepseek-v4-flash`, format OpenAI.
[ENCOURS] **Finir S-036** (veille temps réel reco-vivante) : le **cœur est fait** (`searchWeb` + `assembleLiveCatalog` orchestration pure + `proposeForSlotLive` web+LLM, anti-hallucination d'URL, repli seed ; commit `[S-036 wip]`). **RESTE** : `lib/catalog/cache.ts` (TTL court) + route `app/api/catalog/live` + migration `catalog_observations` (RLS, audit trail) + branchement `ResultsView` (seed→live→recalcul, jumeau du price feed S-025). Puis S-036 passes=true.
[FAIT]    Session 2026-05-27 (énorme) : S-027 (resilience 8→9), **epic backup** S-028 (recommend)/S-029 (Exit Escrow piloté plan)/S-030 (UI Bloc ②)/S-031 (résultats+e2e), S-035 (catalogue injecté seed), S-041 (compute souverain remplace forfait C6), S-042 (UX quick wins test), S-034 (fondation LLM), S-036 cœur. **Spec n°3 reco-vivante** + **spec n°2 résidence/DR (VALIDÉE Amine)** + plans + **backlog test** (docs/test-feedback-2026-05-27.md, 26 findings). Clé LiteLLM posée (coffre + Coolify). Redéploiement prod.
[ALERTE]  ⚠ **LLM tokens à l'usage NON chiffré** (sorti du forfait C6 en S-041, dette transparente → story future, prix tokens live). · **Prix de vente = [PLACEHOLDER]** (sondage). · **S-036 passes=false** (couche d'exposition à finir). · webServer Playwright = `next start` alors que `output: standalone` (warning, e2e verts quand même) → migrer `node .next/standalone/server.js`. · **Tester la prod = Playwright `E2E_BASE_URL=https://infra.ai-mpower.com`** (navigateur propre), PAS claude-in-chrome (pollué par extensions Loom/Quillbot → captures bloquées). · webhook GitHub→Coolify non configuré (redeploy manuel API). · Coolify API env vars : champ **`is_buildtime`** (sans underscore, sinon 422).
[BLOQUE]  RAS (clé LiteLLM débloquée).
[NEXT]    **CE QUI RESTE** — ① **Finir S-036** (cache + route /api/catalog/live + audit trail RLS + branchement ResultsView) → reco vivante VISIBLE (répond au « trop déterministe » du test). ② **S-037** snapshot reproductible + provenance UI · **S-038** intake libre→Profile · **S-039** narration · **S-040** Q&A chat. ③ **Spec n°2 VALIDÉE → writing-plans** → stories **S-043→S-048** (résidence/DR + finding C4 multi-continent). ④ **Story LLM tokens** (prix tokens live, chiffrer l'usage). ⑤ Backlog test (docs/test-feedback) : **P1** ensemble sélectionnable (C1), funnel pro (C3) ; **P2** U5/U7/U8 (« polyglotte »)/U10. ⑥ Déployer S-034+ (env Coolify déjà prêtes) au fil de l'eau.
[MEMO]    Coffre GLOBAL ~/.claude/secrets/secrets.env.dpapi (load-secrets.ps1) : SSH, Coolify, Firecrawl, Supabase, sondage, **+ LITELLM_BASE_URL/LITELLM_API_KEY** (ajout 2026-05-27). Redeploy prod : `POST $COOLIFY_URL/api/v1/deploy?uuid=$MNEMO_APP_UUID&force=true` (Bearer `$COOLIFY_API_TOKEN`). Env var Coolify : `POST /api/v1/applications/{uuid}/envs` {key,value,is_buildtime:false,is_preview:false,is_literal:true}. LLM : `callLLM` (lib/llm) tape le proxy ; modèle `deepseek-v4-flash`. Mémoires CLÉS : `strate-reco-vivante-llm-plateforme` · `prix-jamais-hardcodes-feed-live` · `definition-de-termine` · `strate-avis-critique-non-oriente` · `secrets-handling-protocol`. « reprends en Ralph » relit `.ralph/prd.json`+`progress.md`+AGENTS.md AVANT d'agir.
== FIN PASSATION ==
```

---

## COMMENT REPRENDRE
1. Session dans `C:\Users\amans\OneDrive\Projets\Infra`.
2. Charger les accès : `. "C:\Users\amans\.claude\secrets\load-secrets.ps1"` → peuple `$env:*` (DPAPI, déchiffrable sous le compte/machine d'Amine). Dot-sourcer dans CHAQUE commande qui utilise un secret. Protocole anti-leak : jamais afficher une valeur, preuve = code HTTP / résultat.
3. Lire `.ralph/prd.json` + `.ralph/progress.md` + `AGENTS.md` AVANT d'agir (mode Ralph permanent).
4. Vérifs d'entrée : `npm run typecheck && npm test && npm run lint && npm run build` → vert. Prod : `curl -s -o /dev/null -w "%{http_code}" https://infra.ai-mpower.com/health` → 200.

## DÉCISIONS PRODUIT VERROUILLÉES (ne pas re-litiger)
- Cœur = conseil → déploiement ; « recette ouverte, cuisine payante ». Production-ready, zéro dette, DÉFCON 1.
- ±30 % assumé ; **prix JAMAIS hardcodés** (feed live + seed de repli daté) — étendu aux **choix de composants** (catalogue vivant, spec n°3).
- **Reco vivante = « tout vivant + filet »** (spec n°3) : web+LLM reconsidèrent tout, MAIS calcul de coût déterministe sur prix sourcés, snapshot daté reproductible, garde-fou DÉFCON 1, **le LLM ne calcule jamais un coût**. LLM au niveau plateforme via proxy LiteLLM (super-admin).
- Trio de moats : ① Exit Escrow ② Fiduciary (zéro commission cachée) ③ Intelligence Network.
- **Honnêteté brutale** : tensions exposées, jamais résolues en douce (ex. résidence stricte × DR hot, spec n°2).
- Scoring : 9 dimensions (resilience ajoutée S-027) ; spec n°2 prévoit la 10ᵉ `geosov`.

## POINTEURS
- **Specs** : `docs/superpowers/specs/2026-05-27-strate-backup-design.md` (n°1, livrée) · `…-llm-plateforme-reco-vivante-design.md` (n°3, en cours S-034→S-040) · `…-strate-residence-dr-design.md` (n°2, validée, → writing-plans, S-043→S-048).
- **Plans** : `docs/superpowers/plans/2026-05-27-strate-backup.md` · `…-llm-plateforme-reco-vivante.md`.
- **Test utilisateur** : `docs/test-feedback-2026-05-27.md` (26 findings priorisés P0-P3 ; bugs P0 résolus par redéploiement).
- **Pricing sourcé** : `docs/pricing/{media,backup,compute}-cost-sources.md`.
- **Ralph** : `.ralph/prd.json` (48 stories) · `.ralph/progress.md` (log + patterns). `PRD.md` · `docs/DECISIONS.md` · `AGENTS.md` · `CLAUDE.md`.
- **Mémoires** : `~/.claude/projects/C--Users-amans-OneDrive-Projets-Infra/memory/MEMORY.md`.
- **Déploiement** : Coolify app `mnemo` uuid `by7kdehyeieujf6oxzzt1r0m`, domaine `https://infra.ai-mpower.com`.
```
== FIN PASSATION ==
```
