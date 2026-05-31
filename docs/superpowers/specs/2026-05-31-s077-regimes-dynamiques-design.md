# S-077 — Régimes réglementaires dynamiques (veille crawl4ai par pays)

> Spec de conception. Statut : **proposée, en attente de revue Amine**. Date : 2026-05-31.
> Indépendante de Lot 2 · A. Appartient à la ligne géographie/veille (suite de S-073/S-076).

## 0. Problème

Aujourd'hui la liste des régimes applicables est **codée en dur** dans le configurateur
(`REGULATION_OPTIONS` : `rgpd / cndp / aiact / hipaa / secret-pro / none`) — Europe-centrique, statique.
Retour Amine : les régimes doivent être **recherchés dynamiquement par crawl4ai** selon **le pays cible**
(hébergement, déjà dans le profil depuis S-076) **et, éventuellement, les pays où résident les clients**
(les sujets de données) — car un régime s'applique souvent selon la **résidence des personnes**, pas
seulement le lieu d'hébergement (ex. RGPD = sujets UE ; LGPD = sujets brésiliens).

## 1. But & succès

**But** : proposer dynamiquement, dans le configurateur, les régimes **applicables** au cas de l'utilisateur
(pays d'hébergement + pays de résidence des clients), sourcés, l'utilisateur confirmant la sélection.

**Succès** :
1. À partir du pays cible (+ pays de résidence optionnels), le configurateur **suggère** des régimes
   sourcés (ex. Kenya → Data Protection Act 2019 ; Brésil → LGPD ; Japon → APPI ; UE → RGPD/AI Act).
2. L'utilisateur **confirme/ajuste** ; les cases manuelles restent disponibles (repli).
3. **DÉFCON 1** : aucun régime/qualification inventé — chaque suggestion est **sourcée + datée** ;
   incertitude → marquée « à confirmer par un conseil » ; la liste actuelle = **seed/repli garanti**.
4. La contrainte « la veille respecte les choix utilisateur » (S-072) est préservée.
5. Qualité : typecheck 0 / lint 0-0 / tests verts / build OK ; i18n fr/en/ar parité.

## 2. Décisions (proposées)

| Sujet | Décision | Note |
|---|---|---|
| **Pattern** | Mirror de `lib/residency/discovery.ts` (veille pays-paramétrée) | requête web → synthèse LLM → résultat sourcé + repli seed + cache ; **réutilise** l'infra crawl4ai/SearXNG/LiteLLM déjà en place. |
| **Entrées** | `pays cible` (obligatoire, depuis `profile.country`) + `paysRésidenceClients[]` (optionnel, NOUVEL input) | le régime applicable dépend des deux ; résidence vide → seul le pays cible. |
| **Sortie** | `RegimeSuggestion[]` : `{ code?, name, scope: "data-protection"\|"ai"\|"sector"\|"other", country, source, confidence }` | `code` rempli si mappable sur l'énum existant (`rgpd`, `cndp`…), sinon régime « libre » sourcé. |
| **Seed/repli** | La liste actuelle + un **seed par pays** des régimes notoires (sourcés) = repli daté garanti | jamais d'écran vide ; live échoue → seed. |
| **Légal** | Statut « applicable, à valider par un conseil » ; jamais d'avis juridique | cohérent avec `lib/legal` (orientation d'ingénierie). |
| **Mapping moteur** | Les régimes confirmés alimentent `profile.regulations` (énum) ; un régime hors-énum est porté comme **donnée libre** (n'altère pas le chiffrage déterministe, comme `otherText`) | DÉFCON 1 : le moteur ne calcule rien de neuf à partir d'un régime non modélisé. |

## 3. Architecture

- **`lib/legal/regime-discovery.ts`** *(pur, I/O injectée — calque de `discovery.ts`)* :
  `discoverRegimesForCountries(target, residences[], deps)` → recherche web (requête orientée pays +
  protection des données + IA) → synthèse LLM (JSON strict, **URL ∈ résultats** = anti-hallucination) →
  `RegimeSuggestion[]` conformes ; `[]` si échec.
- **`lib/legal/regime-seed.ts`** *(seed sourcé)* : régimes notoires par pays (RGPD/UE, CNDP/Maroc,
  LGPD/Brésil, APPI/Japon, PIPA/Corée, DPA 2019/Kenya, NDPR/Nigeria, POPIA/Afrique du Sud, PDPL/ÉAU…),
  chacun avec source + date. `regimesSeedFor(country)`.
- **`lib/legal/regime-discovery-cache.ts`** *(câblage réel + repli + cache TTL)* : SearXNG/Crawl4AI +
  LiteLLM ; fusion live ∪ seed dédupliquée ; `source: live|seed|mixed`.
- **Route `app/api/legal/regimes/route.ts`** : `POST { country, residences[], profile }` → suggestions.
- **UI configurateur** : sous le champ « régimes », un bouton **« Détecter pour {pays} »** (+ multi-input
  « pays de résidence des clients ») → appelle la veille → **pré-coche** les régimes mappables + liste les
  régimes sourcés non mappables (avec lien source) ; les cases manuelles restent maîtres (repli).
- **Profil** : NOUVEAU champ optionnel `clientResidence?: string[]` (codes pays, réutilise le catalogue
  `geography`), additif (pas de cascade moteur).

## 4. Garde-fous DÉFCON 1

Anti-hallucination d'URL (source ∈ résultats web) ; chaque suggestion datée + confiance ; statut
« à valider par un conseil » ; **repli seed garanti** ; aucun statut juridique gravé (doctrine
`jamais-graver-decision-perissable`) ; la veille respecte les choix utilisateur (S-072).

## 5. Hors périmètre (YAGNI)

Vérification de conformité réelle, génération de registre Art. 30, conseil juridique, veille
réglementaire continue (alertes) — relèvent du Lot 3 / couche juridique dérivée.

## 6. Tests

- `regime-discovery.test.ts` (pur) : anti-hallucination, mapping code, dédup, `[]` si LLM KO, contrainte.
- `regime-seed.test.ts` : chaque entrée sourcée + datée ; couverture multi-pays.
- `regime-discovery-cache.test.ts` : repli seed garanti ; fusion live∪seed ; `source`.
- UI : « Détecter » pré-coche les régimes mappables ; repli manuel intact ; i18n.

## 7. Séquence de build interne

1. `regime-seed.ts` (sourcé) + tests. *(pur, non bloquant)*
2. `regime-discovery.ts` (pur, I/O injectée) + tests.
3. `regime-discovery-cache.ts` + route API.
4. Profil `clientResidence?` + wizard (bouton Détecter + multi-input résidence + pré-cochage).
5. i18n fr/en/ar + tests + e2e léger.

---

*Décisions verrouillées rappelées : DÉFCON 1 (aucun régime inventé, sourcé+daté, repli seed),
souveraineté, S-072 (la veille respecte les choix), français irréprochable, RLS si persistance.*
