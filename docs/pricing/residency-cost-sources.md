# Strate — Sources des coûts d'egress inter-région & sécurisation inter-site (S-043)

> **DÉFCON 1 + doctrine « tout vivant + filet ».** Ces valeurs sont un **repli daté + baseline de
> validation**, **PAS** des décisions gravées. La valeur effective vient de la **veille live**
> (extraction Firecrawl, réconciliée vs cette baseline — cf. `lib/pricing/live-feed.ts`,
> `reconcile.ts`). Un prix d'hébergeur change (ex. **OVHcloud est passé à l'egress gratuit en
> janv. 2026** ; Scaleway révise sa grille) → ne jamais figer une valeur comme « vraie pour
> toujours ». Chaque entrée porte URL + date de relevé + confiance ; devises **natives** (pas de
> conversion gravée).
>
> **Multi-segment, pas de référent unique** (retour Amine 2026-05-29) : une solution souveraine
> couvre le **spectre des profils d'hébergement** — self-hosted/bare-metal (à sécuriser), souverains
> UE, et hyperscalers en repères. Le moteur (S-044) choisit le vecteur selon le profil.
>
> **Relevé le** : 2026-05-29 (recherche web réelle, pages officielles ; 2 agents de sourcing +
> vérification). À re-sourcer périodiquement / brancher la veille live.

## Egress / transfert inter-région — par profil d'hébergement (vecteurs first-class)

Valeurs **normalisées en €/Go ou $/Go** (devise native conservée) pour éviter le piège des unités
mixtes (Go ≠ Gio ≠ To) signalé au sourcing ; la figure publiée d'origine est rappelée en note.

| Vecteur (clé) | Classe | Egress inter-région | Devise | Confiance | Source | Note (figure publiée, conditions) |
|---|---|---|---|---|---|---|
| `self-hosted-baremetal` (Hetzner) | self-hosted | **0,001 €/Go** (overage) | EUR | medium | [Hetzner Cloud pricing](https://www.hetzner.com/cloud/pricing/) | **20 To/mois inclus** en EU (US 1 To) ; au-delà **1,00 €/To = 0,001 €/Go** ; trafic **privé même-zone gratuit**, inter-zone via IP publique consomme le quota. Profil idéal self-hosted : egress quasi inclus. **Surface à sécuriser** (liaison inter-site chiffrée — cf. sécurisation ci-dessous). |
| `ovh` | sovereign-eu | **0,00 €/Go** | EUR | high | [OVHcloud Object Storage](https://www.ovhcloud.com/en/public-cloud/object-storage/) | « no charges for API calls, incoming traffic, or outgoing traffic » — egress **gratuit** (toutes classes/régions, depuis ~janv. 2026). Inter-région objet non facturé. |
| `scaleway` | sovereign-eu | **0,01 €/Go** | EUR | high | [Scaleway Storage pricing](https://www.scaleway.com/en/pricing/storage/) | **75 Go/mois gratuits** puis 0,01 €/Go ; **intra-région gratuit** (PAR↔PAR…) ; **inter-région** (AMS↔PAR↔WAW) au **tarif egress standard**. ⚠ MAJ tarifaire 1ᵉʳ juin 2026 = **File Storage uniquement** (pas l'egress Object Storage, vérifié). **Live-câblé** via `live-feed.ts` (poste `backup.egress`). |
| `ionos` | sovereign-eu | **0,030 €/Go** (palier 2–10 To) | EUR | high | [IONOS Object Storage pricing](https://docs.ionos.com/cloud/backup-and-storage/ionos-object-storage/overview/pricing) | **2 To/mois gratuits** puis paliers dégressifs **0,030 → 0,025 → 0,020 → 0,015 €/Go** ; **1 To = 1 024 Go**. Transfert **inter-pays IONOS facturé comme egress public** (le seul des souverains avec un coût marginal inter-région clair). IONOS SE = EUR. |
| `outscale` | secnumcloud | **0,00 €/Go** (EU/US) | EUR | high | [Outscale pricing](https://en.outscale.com/pricing/) | « Inbound and outbound traffic included (except for Asia) » ; région souveraine **cloudgouv-eu-west-1 (SecNumCloud)** incluse. Exception **Asie** : 0,009 €/Gio. |
| `gcp` (repère) | hyperscaler | **0,05 $/Gio** (NA↔Europe) | USD | medium | [GCP pricing announce](https://cloud.google.com/vpc/pricing-announce) | Table officielle (effective 2024-02-01) : inter-région NA↔Europe **0,05 $/Gio** ; NA↔NA 0,02 ; Asie↔Asie 0,08. **Intra-Europe ~0,02 $/Gio NON CONFIRMÉ** (parfois confondu avec la réplication storage). Egress Internet 0,12 $/Gio (1ᵉʳ palier). **Repère non souverain UE.** |
| `aws` (repère) | hyperscaler | **0,02 $/Go** (inter-région, repère) | USD | low | [AWS S3 pricing](https://aws.amazon.com/s3/pricing/) | Inter-région S3 US ~0,01 $/Go (medium) ; valeur générale inter-région **0,02 $/Go** souvent citée (non rendue sur table officielle) ; **egress Internet 0,09 $/Go** (UE, 1ᵉʳ palier). **Repère non souverain UE.** |

**Azure** : **NON CONFIRMÉ** — la table tarifaire (bandwidth) est rendue en JavaScript et n'a pas pu
être lue sur source officielle au relevé. Valeurs forum (~0,02 $/Go inter-région, ~0,087 $/Go egress)
**non retenues** (DÉFCON 1 : pas d'invention). À relever manuellement sur
[azure.microsoft.com/pricing/details/bandwidth](https://azure.microsoft.com/en-us/pricing/details/bandwidth/)
avant tout affichage chiffré.

## Sécurisation de la liaison inter-site (self-hosted — « surface à sécuriser ») — chiffré (S-061)

Le vrai souverain = self-hosted, qui introduit une **liaison inter-site à chiffrer et superviser**.
S-043 a **flagué** cette surface + donné la fourchette ; **S-061 chiffre le poste** (`lib/engine/residency.ts`
`costInterSiteSecurity`, prix injectés via `InterSiteSecurityPrices`, seed = repli daté).

**Doctrine DÉFCON 1 du modèle** : seuls les postes **chiffrables vendeur** sont figés — la **VM passerelle**
(la liaison chiffrée WireGuard/IPsec + le mTLS reposent sur des logiciels open-source, **licence 0 €** ; le
coût est l'instance) et l'**alternative managée** (mesh/SASE par utilisateur). La **supervision + le
durcissement** = OPEX / main-d'œuvre interne → **flaggés « à chiffrer en devis », JAMAIS un montant inventé**.
Le coût retenu (intégré au coût résidence, C6) = l'approche **self-hosted** (cohérente avec l'infra) ;
l'alternative managée est **chiffrée pour comparaison, jamais imposée** (avis non orienté).

| Poste | Coût retenu (seed) | Devise | Confiance | Source | Note |
|---|---|---|---|---|---|
| **Passerelle chiffrée self-hosted** / site/mois | **3,79 €/mois** (VM CX22) | EUR | high | [Hetzner Cloud pricing](https://www.hetzner.com/cloud/pricing/) | VM passerelle dédiée **CX22** (2 vCPU/4 Go/40 Go) ; **WireGuard/IPsec + mTLS** (PKI open-source type step-ca) = **licence 0 €** ([wireguard.com](https://www.wireguard.com/), GPLv2). Ajustement tarifaire Hetzner eff. **1ᵉʳ avr. 2026**. |
| **Supervision + durcissement** | **OPEX — à chiffrer en devis** | — | — | — | Main-d'œuvre interne (monitoring, rotation clés, mises à jour, durcissement initial). **Non figé** (DÉFCON 1 : pas de prix au doigt mouillé). |
| **Alternative managée** (Tailscale) / utilisateur/mois | **8 $** (Standard) | USD | high | [tailscale.com/pricing](https://tailscale.com/pricing) | Personal **0 € ≤ 6 users** ; **Standard 8 $** ; Premium 18 $ ; Enterprise sur devis. Exploitation incluse. |
| **Alternative managée** (Cloudflare) / utilisateur/mois | **0 € ≤ 50 users → 7 $** | USD | high | [cloudflare.com Zero Trust](https://www.cloudflare.com/plans/zero-trust-services/) | Free ≤ 50 users ; Teams Standard 7 $/u/mois ; Tunnel sans charge au Go, pas de VM requise. |
| **OVHcloud vRack** (réseau privé L2 inter-DC) | inclus | — | medium | [ovhcloud.com/network/vrack](https://www.ovhcloud.com/en/network/vrack/) | Réseau privé inter-DC inclus dans la plupart des zones (CSP souverain UE) — pertinent si l'hébergement n'est pas bare-metal pur. |

**Modèle de coût** (`costInterSiteSecurity`, monotone) : self-hosted = `passerelle/mois × nb de sites
sécurisés` (primaire + réplicas) ; managé = `tarif/utilisateur × utilisateurs`. Devise USD du managé →
**étage FX au runtime** (taux BCE/Frankfurter, cf. `media-feed`) — pas de conversion € gravée. Le poste
n'est ajouté que pour un profil **self-hosted multi-région** (`Profile.residency.selfHosted` + DR/réplica) ;
hébergement souverain managé / hyperscaler ⇒ liaison sur backbone privé du fournisseur, **pas de poste à part**.
Relevé **2026-05-29** (pages officielles : Hetzner CX22 3,79 €, Tailscale Standard 8 $, Cloudflare ZT 7 $).

## Doctrine de mise à jour (NE PAS figer)

1. **Veille live primaire** : la valeur effective vient de l'extraction Firecrawl réconciliée
   (`reconcilePrice`, bande ±60 %) — Scaleway egress déjà live via `live-feed.ts`. Étendre aux autres
   vecteurs = intégration S-046 / story veille.
2. **Seed = repli daté + baseline** uniquement ; jamais le chemin autoritaire.
3. **Re-sourcer** les pages officielles à chaque révision ; appliquer l'**étage FX** (taux BCE/Frankfurter,
   cf. `media-feed`) pour les vecteurs **USD** (GCP/AWS) — ne pas graver de conversion €.
4. **NON CONFIRMÉ / NON TROUVÉ assumés** (Azure, intra-EU GCP, Infomaniak overage) : jamais comblés
   par mémoire.
