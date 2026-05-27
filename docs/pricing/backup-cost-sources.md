# Strate — Sources des coûts de sauvegarde (S-025)

> **DÉFCON 1.** Coûts spécifiques au backup (egress, stockage froid/archive, retrait, transfert hors-site).
> Chaque valeur est **réellement publiée** (URL + date + confiance). Devises natives ; ici tout est en
> **EUR** (référent souverain = Scaleway, France/UE) → aucune conversion. Le stockage **chaud** est
> réutilisé du seed médias (`media-cost-sources.md` : Scaleway Standard Multi-AZ **0,0146 €/Go/mois**).
>
> **Relevé le** : 2026-05-27 (recherche web réelle, 2 agents de sourcing). À re-sourcer périodiquement.

## Référent retenu : Scaleway (souverain FR, EUR)

| Poste (clé table) | Valeur retenue | Confiance | Source | Repères (non retenus) |
|---|---|---|---|---|
| `egressPerGb` (sortie / restauration) | **0,01 €/Go** (au-delà de 75 Go/mois gratuits) | high | [Scaleway — Storage pricing](https://www.scaleway.com/en/pricing/storage/) | OVH egress **gratuit** ; Backblaze B2 gratuit jusqu'à 3× le stockage moyen puis 0,01 $/Go ; AWS S3 0,09 $/Go (1ᵉʳ palier) |
| `archiveStoragePerGbMonth` (stockage froid) | **0,00254 €/Go/mois** (Scaleway Glacier / Cold) | high | [Scaleway — Storage pricing](https://www.scaleway.com/en/pricing/storage/) | OVH Cold Archive 0,0000027 $/Gio/h (≈ 0,00197 $/Gio/mois, FR, min 180 j) ; AWS Glacier Flexible 0,0036 $/Go ; AWS Deep Archive 0,00099 $/Go |
| `archiveRetrievalPerGb` (retrait d'archive) | **0,009 €/Go** (restore Scaleway Cold) | high | [Scaleway — Storage pricing](https://www.scaleway.com/en/pricing/storage/) | OVH Cold Archive retrait 0,011 $/Gio ; AWS Glacier Standard 0,01 $/Go, Deep 0,02 $/Go |
| `offsiteBandwidthPerGb` (copie hors-site) | **0,01 €/Go** (= egress Scaleway pour expédier la copie) | medium | [Scaleway — Storage pricing](https://www.scaleway.com/en/pricing/storage/) | proxy par l'egress ; varie selon destination/fournisseur — « estimation, à confirmer par devis » |

## Notes (cadrage, sourcées)

- **Scaleway** : egress 75 Go/mois gratuits puis 0,01 €/Go ; classe Glacier/Cold 0,00254 €/Go/mois + retrait 0,009 €/Go (valeurs EUR publiées telles quelles).
- **OVHcloud** : « no charges for ingress/egress or API calls » → egress **réseau gratuit** ; mais facture la **donnée restaurée** par classe (Cold Archive : stockage 0,0000027 $/Gio/h + retrait 0,011 $/Gio, **région France**, min 180 j, unité **Gio** ≠ Go). Non retenu comme référent (USD + Gio) mais repère pertinent.
- **Backblaze B2** : tier unique « always-hot » 6,95 $/To/mois ; **pas de tier froid** ; egress gratuit jusqu'à 3× le stockage moyen mensuel puis 0,01 $/Go.
- **AWS** (référence US, USD) : Glacier Flexible 0,0036 $/Go-mois (retrait Standard 0,01 $/Go) ; Deep Archive 0,00099 $/Go-mois (retrait Standard 0,02 $/Go) ; egress 0,09 $/Go (1ᵉʳ palier). Référence de marché, non retenu (non souverain UE).

## Mise à jour

Ré-exécuter le sourcing (pages officielles) à chaque révision. Si un référent **USD** est introduit
(ex. AWS/B2), appliquer l'étage FX (`media-feed`, taux BCE/Frankfurter) — ici inutile (tout EUR).
