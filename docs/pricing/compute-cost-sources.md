# Strate — Sources des coûts de compute souverain (S-033, DÉFCON 1)

> **Le trou comblé** : la couche C6 portait un forfait d'infra **codé en dur** (30/100/400 €) qui
> n'était ni dimensionné ni sourcé — les serveurs CPU/RAM qui font tourner Postgres, Qdrant,
> l'orchestrateur (LiteLLM/vLLM), l'app et le vault en self-hosted étaient **invisibles**. Cette
> story les modélise comme un poste **dimensionné** (selon preset + volume + users + débit) et
> **sourcé** (prix d'instances réels), au même titre que le pool GPU (S-016).
>
> Référent souverain : **Scaleway** (France/UE, EUR). Prix relevés **en direct** (Firecrawl,
> extraction structurée) le **2026-05-27** sur la page officielle ; le feed live les rafraîchit, le
> seed est repli + baseline de validation (garde-fou S-025). Tarif horaire → mensuel = × 730 h.

## Catalogue d'instances retenu (Scaleway Virtual Instances)

| Type | vCPU | RAM | Prix horaire | ≈ €/mois (×730) | Confiance | Source |
|---|---|---|---|---|---|---|
| **DEV1-M** | 3 | 4 Go | **0,0198 €/h** | ≈ 14,45 € | high | [Scaleway — Virtual Instances pricing](https://www.scaleway.com/en/pricing/virtual-instances-pricing/) |
| **PRO2-XS** | 4 | 16 Go | **0,11 €/h** | ≈ 80,30 € | high | [Scaleway — Virtual Instances pricing](https://www.scaleway.com/en/pricing/virtual-instances-pricing/) |
| **PRO2-S** | 8 | 32 Go | **0,219 €/h** | ≈ 159,87 € | high | [Scaleway — Virtual Instances pricing](https://www.scaleway.com/en/pricing/virtual-instances-pricing/) |

Repères (non retenus comme référents) : OVHcloud Public Cloud (B2-7 ~0,0287 €/h), Hetzner Cloud
(CX22/CX32, ~5–11 €/mois, hors UE-France selon datacenter) — pertinents pour un arbitrage ultérieur.

## Dimensionnement (hypothèses ±30 %, documentées — comme les facteurs média S-016)

- **LIGHT** (services managés : Claude Desktop, Qdrant Cloud free, Supabase free, LLM API) → compute
  souverain minimal = **1× DEV1-M** (vault markdown + glue/scripts). Le gros est managé, compté en
  C1/C3/C5.
- **MEDIUM** (self-host : LiteLLM + Qdrant + Postgres + app) → **PRO2-S** mutualisé, base 1 nœud,
  + 1 nœud si volume ≥ 100 k items ou users > 50.
- **HARD** (on-prem séparé + redondance) → base **2× PRO2-S**, + 1 si volume ≥ 100 k items.
- **Débit** : `reqPerDay = gt10k` → + 1 nœud (charge de requêtes).

> **LLM à l'usage (tokens)** : non inclus dans le compute (serveurs). En HARD, l'inférence tourne sur
> le pool GPU souverain (compté en C6). En LIGHT/MEDIUM, l'API LLM (Mistral/Claude) est un coût à
> l'usage selon le trafic — estimé séparément (couche C6, note), à chiffrer finement dans une story
> dédiée (prix tokens live). Disclaimer ±30 %.
