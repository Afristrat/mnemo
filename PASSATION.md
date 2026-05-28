# PASSATION — Strate (repo Infra)

> Passation de quart (protocole nucléaire). Le quart suivant reprend **sans relire d'autre fichier que celui-ci** ; pointeurs détaillés en bas.

```
== PASSATION STRATE 2026-05-28T12:00 ==
[ETAT]    prd.json = **56 stories, 47 faites, 9 restantes**. **Lot 1 ✅ + Refonte Strate ✅ + EPIC BACKUP ✅ + compute S-041 ✅ + UX S-042 ✅ + DETTE DURE S-049/050/051 ✅ + EPIC LLM : fondation S-034 ✅ catalogue S-035 ✅ veille S-036 ✅ reco-vivante-branchée S-037 ✅ intake libre S-038 ✅ narration S-039 ✅ texte-libre-intégré S-052 ✅ + fixes S-054 (PDF émojis) / S-055 (bascule ensemble) ✅**. origin/main = `6184e0b`. Qualité : typecheck 0 · lint 0/0 · **325 unit + 10 skip** · build OK. ✅ **PROD = MAIN** : redéployée 2026-05-28T~11:55 (Coolify deploy `a2f1ik61pryxnn0fus87gmnb`, finished) et **VÉRIFIÉE LIVE** (route prod `/api/llm/intake` avec note « fichiers audio confidentiels » → `applied: contentTypes, sensitivity`, `contentTypes → text, audio` = DeepSeek **fusionne** l'existant ; `rejected:` vide). Proxy LiteLLM `proxy.ai-mpower.com` (200), modèle `deepseek-v4-flash`.
[ENCOURS] **RAS — checkpoint propre, prod à jour.** Aucune story à mi-chemin. **⚠ S-056 (dette de supervision : heuristiques de dimensionnement figées) EST EN ATTENTE D'ARBITRAGE AMINE** : option **A** (paramètres vivants + sourcés, racine) / **C** (hybride borné : ComponentCandidate porte des params optionnels sourcés) / **différer** (ADR + statu quo). Le LLM ne calcule jamais un coût dans tous les cas. NE PAS trancher à sa place (cf. avis-non-orienté). Sélecteur AskUserQuestion bloqué par le mode « ne pas demander » → présenter A/C/différer et attendre sa réponse.
[FAIT]    Session 2026-05-28 : **S-052** (champ texte libre par bloc RÉELLEMENT intégré — lève la dette `freeNotes` jamais lu). `buildIntakeMessages(text, base?)` base-aware (LLM fusionne les listes) ; `validateIntakeFields` factorisé ; `coerceProfile` borne une base reçue ; **`applyIntakeFields(current, result)`** overlay type-safe par `applied` (préserve médias/backup/modules/freeNotes) ; route intake accepte `base` ; narration `NarrationContext.notes?` en contexte + garde-fou anti-injection ; `Wizard` NoteField « Intégrer cette note » → loadProfile en conservant la note ; `ResultsView` injecte les `freeNotes`. +9 tests. (Sessions précédentes non encore passationnées : S-037/038/039 + S-054/055 — toutes en git/prod.)
[ALERTE]  ⚠ **Déploiement** : `COOLIFY_URL` (coffre) = adresse **LAN** (`192.168.x`, INJOIGNABLE hors réseau local) → utiliser **`COOLIFY_PUBLIC_URL`** pour l'API depuis le poste : `POST $COOLIFY_PUBLIC_URL/api/v1/deploy?uuid=$MNEMO_APP_UUID&force=true`. PS 5.1 : forcer `[Net.ServicePointManager]::SecurityProtocol = Tls12` avant l'appel. · **LLM tokens à l'usage NON chiffré** (dette transparente → story future). · **Prix de vente = [PLACEHOLDER]** (sondage). · **e2e local fragile** : `next start` KO avec `output: standalone` → viser prod via `E2E_BASE_URL=https://infra.ai-mpower.com` (Playwright navigateur propre, PAS claude-in-chrome). · Coolify env vars : champ **`is_buildtime`** (sans underscore, sinon 422). · webhook GitHub→Coolify non configuré (redeploy manuel API).
[BLOQUE]  **S-056 bloquée sur arbitrage Amine** (A/C/différer). Reste tout buildable sans arbitrage.
[NEXT]    **CE QUI RESTE (9 stories)** — ① **S-056** = décision Amine d'abord (A/C/différer). ② **EPIC LLM** restant : **S-053** console admin super-admin GLOBAL (prompts versionnés reco/livrable/agent, greffe dynamique profil+notes) → **S-040** assistant Q&A contextuel (chat + recherche web sourcée ; LA story DÉFCON 1 la plus sensible). ③ **Résidence/DR** S-043→S-048 (spec n°2 validée). ④ **Story LLM tokens** (prix tokens live). ⑤ Backlog test (P2 U5/U7/U8).
[MEMO]    Coffre GLOBAL ~/.claude/secrets/secrets.env.dpapi (load-secrets.ps1, 39 secrets) : SSH, Coolify (`COOLIFY_PUBLIC_URL` pour l'API !, `COOLIFY_API_TOKEN`, `MNEMO_APP_UUID`=`by7kdehyeieujf6oxzzt1r0m`), Firecrawl, Supabase, sondage, LITELLM_*. Anti-leak : jamais afficher une valeur, preuve = code HTTP. DÉCISIONS AMINE verrouillées : **admin prompts = super-admin GLOBAL hors tenant** (S-053) ; **presets scoré/explicable + réconciliation** (FAIT, ADR-020) ; **texte libre INTÉGRÉ** (FAIT S-052) ; **doctrine déterminisme** : le LLM propose/ajuste, le moteur reste déterministe (dette heuristiques = S-056). Mémoires CLÉS : `strate-audit-options-presets-admin` · `strate-reco-vivante-llm-plateforme` · `prix-jamais-hardcodes-feed-live` · `definition-de-termine` · `strate-avis-critique-non-oriente` · `secrets-handling-protocol`. « reprends en Ralph » relit `.ralph/prd.json`+`progress.md`+AGENTS.md AVANT d'agir.
== FIN PASSATION ==
```

---

## COMMENT REPRENDRE
1. Session dans `C:\Users\amans\OneDrive\Projets\Infra`.
2. Charger les accès : `. "C:\Users\amans\.claude\secrets\load-secrets.ps1"` → peuple `$env:*` (DPAPI, déchiffrable sous le compte/machine d'Amine). Dot-sourcer dans CHAQUE commande qui utilise un secret. Protocole anti-leak : jamais afficher une valeur, preuve = code HTTP / résultat.
3. Lire `.ralph/prd.json` + `.ralph/progress.md` + `AGENTS.md` AVANT d'agir (mode Ralph permanent).
4. Vérifs d'entrée : `npm run typecheck && npm test && npm run lint && npm run build` → vert. Prod : `curl -s -o /dev/null -w "%{http_code}" https://infra.ai-mpower.com/health` → 200.
5. Après tout commit de code mergé : **redéployer la prod** : `POST $COOLIFY_PUBLIC_URL/api/v1/deploy?uuid=$MNEMO_APP_UUID&force=true` (Bearer `$env:COOLIFY_API_TOKEN` ; ⚠ `COOLIFY_PUBLIC_URL`, PAS `COOLIFY_URL` qui est l'IP LAN injoignable hors réseau ; PS 5.1 → forcer TLS 1.2), poller `GET .../api/v1/deployments/<deployment_uuid>` jusqu'à `finished`, puis vérifier au **navigateur** (HTML SSR sans le récap/preset, rendus après hydratation) ou via la route concernée. Prod actuelle = `6184e0b` (à jour 2026-05-28T11:55).

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
- **Ralph** : `.ralph/prd.json` (**56 stories, 47 faites, 9 restantes**) · `.ralph/progress.md` (log + patterns). `PRD.md` · `docs/DECISIONS.md` (jusqu'à **ADR-020**) · `AGENTS.md` · `CLAUDE.md`.
- **Mémoires** : `~/.claude/projects/C--Users-amans-OneDrive-Projets-Infra/memory/MEMORY.md` (dont **`strate-audit-options-presets-admin`** = audit + décisions de cette session).
- **Déploiement** : Coolify app `mnemo` uuid `by7kdehyeieujf6oxzzt1r0m`, domaine `https://infra.ai-mpower.com`.
```
== FIN PASSATION ==
```
