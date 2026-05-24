# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Nature du dépôt

Collection de **maquettes HTML autonomes** pour **Mnémo**, un produit B2B d'infrastructure de données IA souveraine (positionné comme la « base mémorielle » d'une organisation). Ce n'est **pas** une application : aucun build, aucun bundler, aucun test, aucun `package.json`, pas de dépôt git. Chaque maquette est un fichier HTML autonome qui se rend directement dans le navigateur.

Les maquettes sont générées via **Google Stitch** (cf. le dossier vide `stitch_mn_mo_sovereign_ai_configurator/` et la skill `stitch-design`). Il s'agit d'écrans de prototypage destinés à valider parcours et design avant toute implémentation.

## Structure

Chaque écran = un dossier contenant deux fichiers de même nom de base :
- `code.html` — le prototype (source de vérité éditable)
- `screen.png` — capture de rendu de référence

| Dossier | Écran (`<title>`) |
|---|---|
| `configurateur_mn_mo_parcours_guid/` | Configurator — parcours guidé |
| `configurateur_mn_mo_recommandation_pme_v1/` | Configuration recommandée (PME, v1) |
| `configurateur_mn_mo_recommandation_pme_v2/` | Configuration recommandée (PME, v2) |
| `configurateur_mn_mo_stack_souveraine/` | Configurateur — stack souveraine |
| `console_de_d_ploiement_mn_mo/` | Déploiement |
| `tableau_de_bord_mn_mo_synth_se_souveraine/` | Tableau de bord — synthèse souveraine |
| `mn_mo_brand_identity/DESIGN.md` | Système de design partagé (pas une maquette) |

`_v1` / `_v2` sont des variantes alternatives du **même** écran — comparer avant de modifier, ne pas fusionner sans intention explicite.

## Voir / itérer sur une maquette

Aucune commande de build. Ouvrir un `code.html` dans le navigateur :

```powershell
Start-Process ".\tableau_de_bord_mn_mo_synth_se_souveraine\code.html"
```

Tailwind est chargé via CDN (`cdn.tailwindcss.com`), les polices via Google Fonts. Une connexion réseau est donc requise pour un rendu fidèle. Après modification, comparer le rendu au `screen.png` du dossier.

## Système de design — source de vérité

`mn_mo_brand_identity/DESIGN.md` définit le système de design Mnémo (couleurs, typographie, formes, espacement, composants). **Le lire avant toute modification visuelle** et s'y conformer.

Points structurants à respecter :
- **Tokens dupliqués** : chaque `code.html` réinjecte les couleurs/espacements dans un bloc `tailwind.config` inline (`<script id="tailwind-config">`). En cas de changement de token, mettre à jour `DESIGN.md` (référence) **et** chaque `code.html` concerné pour éviter toute dérive.
- **Trois polices, usages stricts** : Space Grotesk (titres), Inter (corps/UI), JetBrains Mono (**obligatoire** pour toute donnée numérique, clés API, logs, chemins d'infra).
- **Formes** : cartes `14px`, champs de saisie `10px`, boutons en pilule pleine (`9999px`).
- **Accent primaire teal** = actions cœur / statut « souverain » ; **bleu** = réseau/cloud/IA ; **or** = features d'intelligence avancée.

## Français irréprochable (impératif produit)

Tout le contenu est en français et `lang="fr"`. Les **accents sur les majuscules sont obligatoires** (É, À, È, Ç…) — c'est une exigence explicite du système de design (« uphold professional standards »), pas une préférence. Vérifier notamment les titres d'écrans et libellés en capitales. La ponctuation française (espace avant `: ; ! ?`) s'applique.
