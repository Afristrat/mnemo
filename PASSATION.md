# PASSATION — Strate (repo Infra)

> Passation de quart (protocole nucléaire). Le quart suivant reprend **sans relire d'autre fichier que celui-ci** ; pointeurs détaillés en bas.

```
== PASSATION STRATE 2026-05-27T22:20 ==
[ETAT]    prd.json = **53 stories, 41 faites, 12 restantes**. **Lot 1 ✅ + Refonte Strate ✅ + EPIC BACKUP (S-026→S-031) ✅ + compute S-041 ✅ + UX S-042 ✅ + fondation LLM S-034 ✅ + catalogue S-035 ✅ + veille catalogue S-036 ✅ + DETTE DURE S-049/050/051 ✅**. origin/main = `597610d`. Qualité : typecheck 0 · lint 0/0 · **282 unit + 10 skip** · build OK. ✅ **PROD = MAIN** : redéployée 2026-05-27T22:34 (Coolify deploy `k3mclytg7wo6be6kv0vg3oai`, finished) et **VÉRIFIÉE NAVIGATEUR** (`/configurateur` : « Vos choix » + « PRESET : MEDIUM » live). Clé LiteLLM en place (coffre DPAPI + Coolify) ; proxy `proxy.ai-mpower.com` (200), modèle `deepseek-v4-flash`.
[ENCOURS] **RAS — checkpoint propre, prod à jour.** Aucune story à mi-chemin. La phase « dette dure » du plan d'Amine (réponse à son audit) est CLOSE et EN LIGNE. Prochaine action = **epic LLM** (gros build, idéalement session fraîche pour la qualité DÉFCON 1).
[FAIT]    Session 2026-05-27 (soir) : **réponse à l'audit d'Amine** (preuves dans le code) → ① **growth + latency n'étaient PAS calculés** (collectés/affichés, 0 usage moteur) ② **presets incohérents** (étiquette `expected` divergeait des règles, ex. Coach « MEDIUM » calculé LIGHT) ③ **aucune partie admin** (prompts en dur). Puis livré : **S-036** (veille catalogue finie : cache TTL + route `/api/catalog/live` + migration `catalog_observations` RLS + builder audit ; RLS live 2/2), **S-049** (growth→réserve compute, latency→palier compute sous charge + diagnostics), **S-050** (récap des choix sous le budget-mètre, marqueur ●/○ coût), **S-051** (presets **scorés + explicables** + **réconciliation** étiquettes↔règles + **ADR-020** ; Coach passe MEDIUM). 5 stories ajoutées au prd (S-049→S-053) depuis le retour Amine. Tout committé/poussé, vérifié navigateur (/configurateur).
[ALERTE]  ⚠ **LLM tokens à l'usage NON chiffré** (sorti du forfait C6 en S-041, dette transparente → story future). · **Prix de vente = [PLACEHOLDER]** (sondage). · **e2e local fragile** : `next start` KO avec `output: standalone` ; en **dev `networkidle` n'est JAMAIS atteint** (websocket HMR) → capturer en `domcontentloaded`, ou viser prod via `E2E_BASE_URL=https://infra.ai-mpower.com` (navigateur propre, PAS claude-in-chrome pollué par extensions). · **Port 3000 résiduel** : un `(npm start &)` orphelin bloque le port → `Get-NetTCPConnection -LocalPort 3000 | Stop-Process`. · Coolify env vars : champ **`is_buildtime`** (sans underscore, sinon 422). · webhook GitHub→Coolify non configuré (redeploy manuel API).
[BLOQUE]  RAS.
[NEXT]    **CE QUI RESTE (ordre du plan validé par Amine : « tout, sans s'arrêter »)** — ① **EPIC LLM** dans l'ordre des dépendances : **S-037** snapshot/provenance catalogue (deps S-035/036 OK, consomme `/api/catalog/live`) → **S-038** intake libre→Profile (route LLM + validation bornée) → **S-039** narration (chiffres préservés) → **S-052** **champ texte libre PARTOUT, réellement intégré** (via intake+narration ; lève la dette `freeNotes` jamais lu) → **S-053** **console admin super-admin GLOBAL** (prompts versionnés reco/livrable/agent, greffe dynamique profil+notes) → **S-040** assistant Q&A. ② **Résidence/DR** S-043→S-048 (spec n°2 validée). ③ **Story LLM tokens** (prix tokens live, chiffrer l'usage). ④ Backlog test (docs/test-feedback) : P1 ensemble sélectionnable (C1), funnel pro (C3) ; P2 U5/U7/U8.
[MEMO]    Coffre GLOBAL ~/.claude/secrets/secrets.env.dpapi (load-secrets.ps1) : SSH, Coolify, Firecrawl, Supabase, sondage, LITELLM_*. Redeploy prod : `POST $COOLIFY_URL/api/v1/deploy?uuid=$MNEMO_APP_UUID&force=true` (Bearer `$COOLIFY_API_TOKEN`). DÉCISIONS AMINE 2026-05-27 (verrouillées) : **admin prompts = super-admin GLOBAL hors tenant** (S-053) ; **presets = modèle scoré/explicable + réconciliation** (FAIT, ADR-020) ; **texte libre partout doit être INTÉGRÉ** (S-052, via LLM). Test RLS local : `db reset` + `stop && start` pour restaurer `auth.uid()` ; clés locales = défauts partagés Supabase. Mémoires CLÉS : `strate-audit-options-presets-admin` (NOUVELLE) · `strate-reco-vivante-llm-plateforme` · `prix-jamais-hardcodes-feed-live` · `definition-de-termine` · `strate-avis-critique-non-oriente` · `secrets-handling-protocol`. « reprends en Ralph » relit `.ralph/prd.json`+`progress.md`+AGENTS.md AVANT d'agir.
== FIN PASSATION ==
```

---

## COMMENT REPRENDRE
1. Session dans `C:\Users\amans\OneDrive\Projets\Infra`.
2. Charger les accès : `. "C:\Users\amans\.claude\secrets\load-secrets.ps1"` → peuple `$env:*` (DPAPI, déchiffrable sous le compte/machine d'Amine). Dot-sourcer dans CHAQUE commande qui utilise un secret. Protocole anti-leak : jamais afficher une valeur, preuve = code HTTP / résultat.
3. Lire `.ralph/prd.json` + `.ralph/progress.md` + `AGENTS.md` AVANT d'agir (mode Ralph permanent).
4. Vérifs d'entrée : `npm run typecheck && npm test && npm run lint && npm run build` → vert. Prod : `curl -s -o /dev/null -w "%{http_code}" https://infra.ai-mpower.com/health` → 200.
5. Après tout commit de code mergé : **redéployer la prod** : `POST $COOLIFY_URL/api/v1/deploy?uuid=$MNEMO_APP_UUID&force=true` (Bearer `$env:COOLIFY_API_TOKEN`), puis vérifier au **navigateur** (le HTML SSR ne contient PAS le récap/preset, rendus après hydratation). Prod actuelle = `597610d` (à jour 22:34).

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
- **Ralph** : `.ralph/prd.json` (**53 stories**) · `.ralph/progress.md` (log + patterns). `PRD.md` · `docs/DECISIONS.md` (jusqu'à **ADR-020**) · `AGENTS.md` · `CLAUDE.md`.
- **Mémoires** : `~/.claude/projects/C--Users-amans-OneDrive-Projets-Infra/memory/MEMORY.md` (dont **`strate-audit-options-presets-admin`** = audit + décisions de cette session).
- **Déploiement** : Coolify app `mnemo` uuid `by7kdehyeieujf6oxzzt1r0m`, domaine `https://infra.ai-mpower.com`.
```
== FIN PASSATION ==
```
