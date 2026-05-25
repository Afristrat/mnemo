# Journal de décisions (ADR) — Mnémo

> Registre des arbitrages d'architecture pris en autonomie pendant le Ralph Loop.
> **Protocole** (consigne Amine, 2026-05-25) : en run autonome, à chaque décision à
> trancher, choisir l'option **la plus exhaustive / complète**, même plus complexe,
> et la consigner ici. Ne jamais s'arrêter pour demander tant que l'intégralité n'est
> pas livrée et testée.

Format : décision · contexte · options · choix · conséquences.

---

## ADR-001 — Clés Supabase locales : nouveau système `sb_publishable` / `sb_secret`

- **Contexte** : la CLI Supabase 2.101 (Docker local) émet le nouveau système de clés
  (`sb_publishable_…`, `sb_secret_…`) au lieu des JWT `anon` / `service_role`. Le
  `.env.example` (S-001) référence les anciens noms.
- **Choix** : `.env.local` mappe `NEXT_PUBLIC_SUPABASE_ANON_KEY` ← publishable (clé
  publique client) et `SUPABASE_SERVICE_ROLE_KEY` ← secret (clé serveur, bypass RLS).
- **Conséquence** : en S-012, mettre à jour `.env.example` + le client `@supabase/ssr`
  pour acter la nouvelle terminologie. Aucune clé sensible (instance locale).

## ADR-002 — Baseline du price feed généré par le code, jamais à la main

- **Contexte** : la détection de variation (F4) compare une empreinte de figures à un
  snapshot de référence. Saisir ce snapshot à la main = risque de divergence vs
  l'extracteur réel + risque DÉFCON 1 (donnée fabriquée).
- **Choix** : `scripts/capture-baseline.mts` produit les empreintes via l'extracteur de
  production (`node --experimental-strip-types`). Pages usage-based (0 figure) →
  `fingerprint: null`, confiance medium, note « à vérifier manuellement ».
- **Conséquence** : reproductible, daté, honnête. Régénérer après évolution de
  l'extracteur ou re-calibration.

## ADR-003 — Export PDF (S-009) : génération de fichier réelle via jsPDF (option exhaustive)

- **Contexte** : F6 exige un livrable exportable MD **et** PDF, sources cliquables,
  disclaimer. Options : (a) `window.print()` + CSS print (pas de fichier généré,
  dépend du dialogue navigateur) ; (b) génération programmatique d'un PDF.
- **Choix (le plus exhaustif)** : modèle de livrable **pur** partagé
  (`lib/export/model.ts`) → rendu Markdown pur (`markdown.ts`) **et** rendu PDF réel
  (`pdf.ts`, jsPDF) avec liens cliquables (`textWithLink`) et pagination automatique.
  jsPDF est agnostique du framework → zéro friction React 19.
- **Conséquence** : 2 fichiers téléchargeables. Le parcours de téléchargement navigateur
  est couvert par l'E2E Playwright (S-013).

## ADR-004 — `npm audit` : 7 advisories modérées dev/build-time acceptées

- **Contexte** : `npm audit` remonte 7 vulnérabilités modérées : `esbuild ≤0.24.2`
  (chaîne vite/vitest, **dev-only**) et `postcss <8.5.10` (chaîne next, **build-time**).
  Toutes pré-existantes depuis S-001 ; **aucune** introduite par jsPDF (vérifié :
  jsPDF n'apparaît pas dans le rapport).
- **Choix** : NE PAS lancer `npm audit fix --force` — il imposerait `vitest@4`
  (breaking) et `next@9.3.3` (downgrade majeur absurde), soit une régression pire que
  le risque. Aucune des deux ne s'exécute dans le bundle runtime livré au client.
- **Conséquence** : risque accepté et tracé. À résorber proprement quand Next/vitest
  publieront des versions corrigées non cassantes (à revoir en S-014, avec la
  migration ESLint CLI). Surveillance : `npm audit` au CI.

## ADR-005 — Exit Escrow (S-010) : bundle complet, ZIP client via fflate, manifeste = ancre de cohérence

- **Contexte** : F7 (moat ①) exige un bundle reproductible téléchargeable + un test
  d'intégration prouvant sa cohérence avec la reco. Choix du périmètre et du zippeur.
- **Choix (le plus exhaustif)** : bundle riche — `manifest.json` (machine), `README`,
  `docker-compose.yml` paramétré, `terraform/` (main + tfvars), `vault/` (squelette de
  secrets, **jamais** de valeur), `runbook.md` (déploiement + backup 3-2-1 + MEL +
  incident), `scripts/re-embed.sh` + `backup.sh`. Génération **pure** (`lib/exit/bundle.ts`)
  → ZIP **côté client** via `fflate` (zéro dépendance transitive, vs jszip). Le test
  d'intégration vérifie `manifest == reco` (couches/coût/preset) + round-trip zip/unzip.
- **Conséquence** : `fflate` ajouté (0 vuln). `new Blob([Uint8Array.from(bytes)])` pour
  un BlobPart valide sans `as`. Import dynamique (hors bundle initial). Le redeploy réel
  end-to-end (docker compose up) sera exercé hors-app ; ici on garantit la cohérence
  descriptive, conformément à l'acceptance.
