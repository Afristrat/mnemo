# Strate — Sources des coûts d'infra multimédia (S-017)

> **DÉFCON 1.** Aucun chiffre ici n'est inventé. Chaque valeur de la table de prix
> (`lib/pricing/media-seed.ts`) est tracée ci-dessous : figure **réellement publiée** sur une
> page officielle (devise + unité d'origine + URL + date de relevé), puis, si nécessaire, sa
> **conversion** (devise, unité, utilisation) — explicitée pas à pas. Les valeurs **dérivées**
> (conversion de devise, hypothèse d'unité, hypothèse d'utilisation) portent une confiance
> dégradée (`medium`/`low`) et la mention « estimation, à confirmer par devis ».
>
> **Périmètre** : ce sont les **coûts d'infrastructure** payés aux fournisseurs (transparents,
> ±30 %), PAS le prix de vente du service Strate (cf. `docs/pricing/wtp-research.md`).
>
> **Relevé le** : 2026-05-26. **Source web réelle** (4 agents de sourcing). À rafraîchir par le
> feed Firecrawl (`lib/pricing/media-feed.ts`) et à re-sourcer périodiquement.

## Taux de change (pour les prix en USD)

| Paire | Taux | Date | Source |
|---|---|---|---|
| EUR/USD (référence) | **1,1634** | 2026-05-26 | BCE — [taux de référence EUR/USD](https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/eurofxref-graph-usd.en.html) |

**Principe de stockage (S-017).** Le seed (`lib/pricing/media-seed.ts`) conserve chaque prix dans
sa **devise native** (champ `currency`) — aucune conversion figée, fidèle à la source. La conversion
en € est un **étage dédié** (`media-feed.ts › normalizeMediaPricesToEur`) appliqué **au moment du
calcul**, avec un **taux live** récupéré via [Frankfurter](https://www.frankfurter.app) (adossé aux
taux BCE, gratuit, sans clé) et **repli** sur le taux BCE daté ci-dessus (`SEED_USD_TO_EUR ≈
0,85955 = 1 / 1,1634`). Avantages : valeurs fidèles, taux unique et rafraîchissable, affichage du
prix natif **et** converti possible (UI S-022). Toute valeur convertie est `confidence: "medium"` au
minimum (incertitude de change). Les « ≈ € » indiqués plus bas sont calculés au taux BCE de repli,
à titre de repère.

---

## 1. GPU souverain (pool C6) — €/mois par palier

Le pool GPU souverain est dimensionné par paliers (`GpuTier`). Les **tarifs horaires** sont
sourcés (Scaleway, **France/UE**, EUR — cohérent avec le positionnement souverain) ; le **coût
mensuel** = tarif horaire × **utilisation estimée** (hypothèse de modélisation, d'où `confidence:
"medium"`). 730 h ≈ 1 mois continu.

Figures horaires relevées (officielles, EUR, 2026-05-26) :

| GPU (Scaleway, PAR) | €/heure | URL |
|---|---|---|
| L4 24 Go | 0,75 €/h | https://www.scaleway.com/en/pricing/gpu/ |
| L40S 48 Go | 1,40 €/h | https://www.scaleway.com/en/l40s-gpu-instance/ |
| H100 80 Go | 2,73 €/h | https://www.scaleway.com/en/h100/ |

> Repères de marché (corroboration, non retenus car non souverains UE) : RunPod L4 0,39 $/h, A100 80 Go 1,39 $/h, H100 PCIe 2,89 $/h (runpod.io/pricing) ; OVHcloud (Gravelines, FR) L4 1 $/h, A100-180 3,07 $/h, H100-380 2,99 $/h (ovhcloud.com/en/public-cloud/prices) ; Lambda H100 SXM 4,29 $/h (lambda.ai).

Coûts mensuels retenus (table) :

| Palier | Base (sourcée) | Utilisation (hypothèse) | €/mois | Confiance | Note |
|---|---|---|---|---|---|
| `none` | — | — | 0 | high | Pas de GPU souverain. |
| `shared` | L4 0,75 €/h | ~200 h/mois (mutualisé, usage partiel) | **150** | medium | Estimation, à confirmer par devis. |
| `dedicated-small` | L4 0,75 €/h | 730 h (1 GPU continu) | **548** | medium | Estimation, à confirmer par devis. |
| `dedicated-large` | H100 2,73 €/h | 730 h (continu) | **1993** | medium | Estimation, à confirmer par devis. |

---

## 2. Stockage objet (couche C5) — €/Go/mois

| Valeur | Devise/unité d'origine | €/Go/mois retenu | Confiance | Source |
|---|---|---|---|---|
| Scaleway Object Storage — Standard Multi-AZ, **0,0146 €/Go/mois** (région Paris) | EUR, /Go/mois (publié tel quel) | **0,0146** | high | https://www.scaleway.com/en/pricing/storage/ |

> Repères : Scaleway One-Zone 0,00752 €/Go/mois ; Backblaze B2 6,95 $/To/mois (≈ 0,00597 €/Go/mois après conversion) — backblaze.com/cloud-storage/pricing. Scaleway Multi-AZ retenu (souverain UE, valeur EUR directe).

---

## 3. Embeddings multimodaux (couche C4) — forfait €/mois

C4 utilise un modèle d'embedding multimodal (coût supérieur au texte seul). Aucun fournisseur ne
publie un « forfait mensuel » : la tarification est à l'usage (tokens + pixels). La valeur est
donc une **estimation forfaitaire** du surcoût multimodal mensuel typique.

| Base sourcée | Forfait retenu | Confiance | Note |
|---|---|---|---|
| Voyage `voyage-multimodal-3` : 0,12 $/1M tokens (texte) + 0,60 $/1Md pixels — [docs.voyageai.com/docs/pricing](https://docs.voyageai.com/docs/pricing) (ex. image 1000×1000 px ≈ 0,0006 $) | **30 €/mois** | low | Estimation, à confirmer par devis (surcoût multimodal vs texte). |

> Repères : Jina embeddings 0,050 $/1M tokens (jina.ai/embeddings) ; Cohere Embed v4 — **aucun tarif unitaire public** (Model Vault par instance uniquement, cohere.com/pricing) → écarté.

---

## 4. API à l'usage — par modalité × volet (mode `api`)

Le seed stocke la **valeur native par unité** consommée par le moteur (`min` pour audio/vidéo,
`image` pour images), en **devise native** ; la conversion d'**unité** (par caractère/image → par
minute) est explicitée et bake la confiance ; la conversion de **devise** est faite au runtime
(FX). Le « ≈ € » est au taux BCE de repli (repère).

| Clé table | Base sourcée (officielle) | Stocké (natif) | Dérivation d'unité | ≈ €/unité (repère) | Confiance | Source |
|---|---|---|---|---|---|---|
| `audio.ingest` (transcription) | OpenAI whisper-1 : **0,006 $/min** | 0,006 $/min | — | ≈ 0,00516 € | medium | https://developers.openai.com/api/docs/models/whisper-1 |
| `audio.generate` (synthèse vocale) | OpenAI tts-1 : **15 $/1M caractères** | 0,0135 $/min | × ~900 car./min (≈150 mots/min) | ≈ 0,0116 € | low | https://developers.openai.com/api/docs/models/tts-1 |
| `video.ingest` (analyse vidéo) | Google Vision : **1,50 $/1000 images** | 0,09 $/min | × ~1 img/s (60 img/min) | ≈ 0,0774 € | low | https://cloud.google.com/vision/pricing |
| `video.generate` (génération vidéo) | Runway Gen-4 Turbo : **0,05 $/s** (5 crédits/s × 0,01 $) | 3 $/min | × 60 s/min | ≈ 2,58 € | medium | https://docs.dev.runwayml.com/guides/pricing |
| `images.ingest` (OCR/vision) | Google Vision DOCUMENT_TEXT_DETECTION : **0,0015 $/image** | 0,0015 $/image | — | ≈ 0,00129 € | medium | https://cloud.google.com/vision/pricing |
| `images.generate` (génération image) | OpenAI gpt-image-1 (medium, 1024²) : **0,042 $/image** | 0,042 $/image | — | ≈ 0,0361 € | medium | https://developers.openai.com/api/docs/guides/image-generation |

> Repères audio : Deepgram Nova-3 0,0077 $/min ; AssemblyAI Universal-2 0,15 $/h (≈ 0,0025 $/min) — deepgram.com/pricing, assemblyai.com/pricing.
> Repères vidéo gén. : Google Veo 3 Fast 0,10 $/s (720p), Sora 2 0,10 $/s — ai.google.dev/gemini-api/docs/pricing, developers.openai.com/api/docs/pricing.
> Repères image gén. : Stability SD 3.5 Large 0,065 $/image, gpt-image-1-mini 0,011 $/image (medium) — platform.stability.ai/pricing.
> **NON TROUVÉ / sur devis** (au 2026-05-26) : Pika, Kling (pas de tarif API unitaire officiel) ; Cohere Embed v4 (pas de tarif unitaire) ; DALL·E 3 (retiré du pricing API, remplacé par gpt-image). Tesseract = open source (Apache 2.0), coût = infra self-host seule.

---

## Mise à jour

- Ré-exécuter le sourcing (pages officielles) + rafraîchir le taux BCE à chaque révision.
- Le feed Firecrawl (`media-feed.ts`) signale la **fraîcheur/disponibilité** des pages source ; il
  ne ré-extrait pas les prix dérivés (conversion/hypothèses) → toute variation détectée = revue
  manuelle, jamais une réécriture automatique du seed.
