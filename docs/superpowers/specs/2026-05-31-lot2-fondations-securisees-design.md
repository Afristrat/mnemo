# Lot 2 · Sous-projet A — Fondations sécurisées (auth + tenancy + coffre)

> Spec de conception (brainstorming). Statut : **proposée, en attente de revue Amine**.
> Date : 2026-05-31. Cycle : cette spec → plan d'implémentation (skill `writing-plans`) → build.

## 0. Contexte & place dans Lot 2

Lot 1 (conseil + 3 moats) est livré et **anonyme** : le profil vit en `localStorage`, aucune
authentification. Lot 2 (« cuisine payante » : agent de provisionnement + monitoring + réseau actif)
exige des **utilisateurs authentifiés rattachés à un `circle`** et un **coffre de secrets vendor**.

Décomposition Lot 2 (validée) — ordre de build, seul **A** est strictement bloquant :

- **A. Fondations sécurisées** *(cette spec)* — auth + tenancy + coffre. Bloque tout.
- **B. Agent de provisionnement** (F10) — flux hybride, exécute l'IaC de l'Exit Escrow.
- **C. Monitoring** (F12) — Infra Health Score + Dispatch Deviation Guide.
- **D. Réseau actif** (F13) — coût réel → recalibration + alertes vendor.

B/C/D ont chacun une partie pure cadrable tôt (connecteurs, calcul IHS, recalibration) ; leur partie
branchée suit l'ordre. Chaque sous-projet aura sa propre spec → plan → build.

## 1. But & critères de succès

**But** : transformer Strate d'anonyme en **multi-tenant authentifié**, avec un **coffre chiffré** pour
les credentials vendor — socle sans lequel l'agent (B) ne peut agir.

**Succès** :
1. Un visiteur peut **continuer à utiliser le configurateur sans compte** (Lot 1 intact, additif).
2. Un utilisateur peut **se connecter** (3 méthodes) ; un **circle personnel** est créé automatiquement ;
   son profil/config localStorage est **migré** dans `configurations`.
3. Un credential vendor peut être **stocké chiffré** et **relu en clair UNIQUEMENT côté serveur** ; il
   n'apparaît **jamais** en clair en base, dans une réponse API, ni au client.
4. Toute lecture/écriture de credential est **tracée** (audit).
5. RLS vérifiée : un non-membre ne voit rien ; un membre ne voit que des **métadonnées** (jamais le
   chiffré) ; seul le rôle serveur déchiffre.
6. Qualité : typecheck 0 / lint 0-0 / tests verts (dont RLS integration + round-trip coffre) / build OK.

## 2. Décisions (tranchées)

| Sujet | Décision | Raison / note |
|---|---|---|
| **Auth** | **Les 3 méthodes** : magic link e-mail, e-mail+mot de passe, OAuth social (Google/GitHub) — via Supabase Auth | Choix utilisateur. ⚠ L'OAuth social crée une dépendance tierce non souveraine → présenté comme **option**, jamais imposé ; magic link mis en avant. |
| **Coffre** | **Chiffrement par enveloppe app-level** (KEK en env serveur, DEK par secret, AES-256-GCM) | Portable (marche sur le Supabase self-hébergé du serveur), explicite, rotation possible. Pas de dépendance pgsodium/KMS. |
| **Tenancy** | 1 utilisateur → **1 circle personnel** auto-créé (owner) | Le plus simple, colle aux rails. Équipes/rôles = plus tard. |
| **Migration anon→auth** | À la 1ʳᵉ connexion, le profil/config `localStorage` est persisté dans `configurations` | Continuité d'expérience, zéro perte. |
| **Anonyme préservé** | Le configurateur reste utilisable **sans compte** ; la connexion est **additive** | Ne casse pas Lot 1 ; l'auth ne devient requise que pour l'agent (B). |

## 3. Modèle de données

**Réutilisé (rails `init_rails`)** : `circles`, `memberships`, `network_consents`, `configurations`,
`cost_observations` + helpers `is_circle_member()`, `is_circle_owner()` + RLS.

**Nouveau — `vendor_credentials`** (coffre) :

| Colonne | Type | Note |
|---|---|---|
| `id` | uuid pk | |
| `circle_id` | uuid fk → circles | RLS scope |
| `provider` | text | ex. `hetzner`, `scaleway`, `ovh` (métadonnée, non sensible) |
| `label` | text | libellé utilisateur (non sensible) |
| `kind` | text | `oauth_token` \| `api_key` |
| `ciphertext` | text (base64) | secret chiffré (AES-256-GCM avec la **DEK**) |
| `wrapped_dek` | text (base64) | DEK chiffrée (wrappée) par la **KEK** |
| `iv_secret`, `tag_secret` | text | IV + tag GCM du secret |
| `iv_dek`, `tag_dek` | text | IV + tag GCM de la DEK |
| `key_version` | int | version de la KEK (rotation) |
| `expires_at` | timestamptz null | pour les jetons OAuth |
| `revoked_at` | timestamptz null | révocation logique |
| `created_by` | uuid | auteur |
| `created_at`, `updated_at` | timestamptz | |

**Nouveau — `credential_access`** (audit, exigé threat model) : `id`, `circle_id`, `credential_id` (null
si écriture initiale), `actor` (uuid \| `agent`), `action` (`store`\|`read`\|`rotate`\|`revoke`), `at`,
`context` jsonb (minimal, **jamais de secret**).

**Vue `vendor_credentials_meta`** : expose aux membres du circle UNIQUEMENT les colonnes non sensibles
(`id`, `provider`, `label`, `kind`, `expires_at`, `revoked_at`, `created_at`) — **jamais** les colonnes
chiffrées. C'est ce que l'UI lit.

**RLS** :
- `vendor_credentials` (table de base) : **aucune** policy `select`/`insert`/`update`/`delete` pour le
  rôle `authenticated` → la table de base (donc les colonnes chiffrées) est **inaccessible au client** ;
  seul le rôle serveur (`service_role`, qui contourne la RLS) y lit/écrit. (La RLS Postgres est par
  **ligne**, pas par colonne : on isole le sensible en ne donnant AUCUN accès `authenticated` à la table,
  et on expose le non-sensible via la vue ci-dessous.) Insert/rotate/revoke passent par des **server
  actions** (jamais le client n'écrit ni ne lit le chiffré).
- `vendor_credentials_meta` (vue, `security_invoker`) : `select` réservé aux membres du circle.
- `credential_access` : `select` membres du circle ; `insert` serveur.

## 4. Coffre — schéma de chiffrement par enveloppe

- **KEK** (Key Encryption Key) : 32 octets aléatoires, en **variable d'environnement serveur**
  (`STRATE_VAULT_MASTER_KEY`, base64) — **jamais** en base, **jamais** au client, **jamais** en git
  (même discipline que le coffre DPAPI global). Versionnée (`STRATE_VAULT_KEY_VERSION`).
- **Stockage d'un secret** : (1) générer une **DEK** aléatoire 32 o ; (2) chiffrer le secret avec la DEK
  (AES-256-GCM → `ciphertext`, `iv_secret`, `tag_secret`) ; (3) **wrapper** la DEK avec la KEK
  (AES-256-GCM → `wrapped_dek`, `iv_dek`, `tag_dek`) ; (4) persister + `key_version`.
- **Lecture** (serveur uniquement) : dé-wrapper la DEK avec la KEK, déchiffrer le secret avec la DEK.
- **Rotation KEK** : re-wrapper les DEK avec la nouvelle KEK (les DEK et donc les ciphertext ne changent
  pas → opération peu coûteuse), incrémenter `key_version`.
- **Implémentation** : `lib/vault/` — module **pur** de crypto (Web Crypto / `node:crypto` AES-256-GCM,
  `fetchImpl`-style injectable pour test) + un **accesseur server-only** qui lit la KEK de l'env. La
  fonction de déchiffrement est **interdite côté client** (import `server-only` + garde runtime).
- **Invariant** : le clair n'est jamais sérialisé vers le client ni journalisé ; l'audit ne stocke que
  des métadonnées.

## 5. Auth & tenancy — flux

1. **Connexion** : Supabase Auth (`@supabase/ssr`, déjà dans la stack) — 3 méthodes activées. Session via
   cookies, lue côté serveur (le `middleware.ts` actuel gère la locale → on y ajoute la session).
2. **Bootstrap circle** : à la 1ʳᵉ session sans circle, une **server action** crée un `circle` (owner =
   user) + `membership`, idempotente.
3. **Migration anon→auth** : le client poste son profil `localStorage` à une server action qui l'**upsert**
   dans `configurations` pour le nouveau circle (une seule fois ; ne réécrase pas une config existante).
4. **UI minimale** : bouton connexion/déconnexion + indicateur de compte/circle ; écran « Mes accès
   vendor » (liste **métadonnées** via la vue ; ajouter = server action qui chiffre + trace ; révoquer).
   L'ajout d'un secret se fait dans un champ qui **n'est jamais réaffiché**.

## 6. Threat model (surface critique, spécifiée dès Lot 1)

- **Secrets vendor au repos = cible n°1** → enveloppe AES-256-GCM ; KEK hors DB/hors client/hors git ;
  intégrité GCM (toute altération du ciphertext/tag → échec de déchiffrement).
- **Exfiltration via API/RLS** → colonnes chiffrées inaccessibles au rôle `authenticated` ; UI sur vue
  métadonnées ; déchiffrement `service_role` serveur uniquement.
- **Principe de moindre privilège (agent, B)** : l'agent n'agira que sur un compte **autorisé** par
  l'utilisateur, scopes OAuth minimaux ; **ne crée jamais de compte, ne saisit jamais de carte** (rappel
  F10, hors périmètre A mais le coffre est conçu pour ça).
- **Auditabilité** : `credential_access` trace chaque store/read/rotate/revoke.
- **Anti-leak transcript/logs** : aucune valeur de secret en clair en log, en réponse, ni en chat.

## 7. Hors périmètre (YAGNI maintenant)

Invitations d'équipe & rôles fins, SSO entreprise, bascule multi-circle dans l'UI, partage d'accès entre
membres, révocation OAuth distante chez le vendor (relève de B), KMS externe.

## 8. Tests

- **Coffre (unitaire, pur)** : round-trip chiffre→déchiffre ; ciphertext ≠ clair ; **altération
  (ciphertext/tag modifié) → échec** ; rotation KEK → clair préservé ; le clair n'apparaît pas dans la
  forme persistée.
- **RLS (integration, pattern `*.rls.integration.test` existant)** : membre voit la vue métadonnées et
  **pas** le chiffré ; non-membre ne voit rien ; `service_role` déchiffre.
- **Auth (e2e)** : connexion (magic link mocké) → circle auto-créé → profil migré dans `configurations`.

## 9. Séquence de build interne à A

1. `lib/vault/` (crypto pur + accesseur server-only) + tests. *(pur, non bloquant)*
2. Migration `vendor_credentials` + `credential_access` + vue `vendor_credentials_meta` + RLS.
3. Câblage Supabase Auth (3 providers) + session dans `middleware.ts`.
4. Bootstrap circle + migration anon→auth (server actions).
5. UI minimale (connexion, indicateur compte, écran « Mes accès vendor »).

## 10. Dette assumée & tracée (auth — décision Amine 2026-05-31)

Le MVP livre **e-mail + mot de passe** (fonctionnel + vérifié en prod, avec `AUTOCONFIRM=true`). Les deux
autres méthodes sont gardées comme **dette explicite** (bloquées sur des credentials externes que seul
Amine peut fournir) — le **code UI supporte déjà les 3**, seule la config backend manque :

- **DETTE-AUTH-1 — Magic link** : nécessite un **vrai SMTP** sur le Supabase serveur (aujourd'hui
  `SMTP_HOST=supabase-mail` = faux serveur de dev → aucun e-mail délivré). À faire : fournir un SMTP
  (hôte/port/user/pass) → renseigner les `SMTP_*` du `.env` Supabase + redémarrer `auth`.
- **DETTE-AUTH-2 — OAuth Google/GitHub** : nécessite des **apps OAuth** (client_id/secret) créées dans
  les consoles Google/GitHub d'Amine + décommenter les `GOTRUE_EXTERNAL_*` du docker-compose. Redirection
  à déclarer : `https://db.ai-mpower.com/auth/v1/callback`.
- **DETTE-AUTH-3 — `AUTOCONFIRM=true`** : compromis de sécurité temporaire (pas de vérification de
  possession de l'e-mail). À **repasser à `false`** dès que DETTE-AUTH-1 (SMTP réel) est levée.
- **DETTE-VAULT-1 — `server-only`** : `lib/vault/server.ts` + `credentials.ts` reposent sur la discipline
  d'import (commentaire) faute du package `server-only` (non installé, casserait les tests vitest sous
  jsdom). Risque pratique faible (KEK lue de `process.env`, indisponible client ; aucun import client
  aujourd'hui). À durcir : `npm i server-only` + `import "server-only"` + alias vitest vers un module vide.

Ces dettes sont reportées dans la passation à la clôture de Lot 2 · A. Elles ne bloquent pas la livraison
du MVP auth, mais doivent être levées avant une ouverture publique large.

---

*Décisions produit verrouillées rappelées : souveraineté (OAuth social = option, pas défaut),
DÉFCON 1 (aucun secret en clair exposé), français irréprochable, RLS sur toutes les tables.
Dette auth (§10) = assumée et tracée, jamais silencieuse.*
