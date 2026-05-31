# Coût d'inférence LLM à l'usage — sources (S-074)

> Tarification au **1M de tokens** (entrée + sortie), décision Amine. Lève la dette « LLM à l'usage non
> chiffré » (S-033/S-041). Doctrine `prix-jamais-hardcodes` : ce seed est un **repli daté + sourcé**, à
> rafraîchir par la veille (devises **natives USD** + étage FX→€ runtime via `SEED_USD_TO_EUR`, BCE daté).
> Multi-segment (pas de référent unique) : souverain-compatible + UE souverain + hyperscaler repère.

Modélisation du **volume** (hypothèses ±30 %, jamais un prix) : par requête RAG ≈ **2 500 tokens in**
(contexte récupéré + système + question) + **600 tokens out** (réponse) ; volume mensuel = `reqPerDay`
× 30. **Anti double-comptage** : inférence **auto-hébergée** (preset HARD on-prem, ou préférence
souveraineté) → coût à l'usage **0** (déjà compté dans le compute/GPU souverain). Sinon (API) : tokens
× prix/1M du modèle par défaut.

| Modèle | Souveraineté | $/1M in | $/1M out | Source (relevé 2026-05-31) |
|---|---|---|---|---|
| **DeepSeek V4 Flash** (défaut proxy) | sovereign (open-weights, auto-hébergeable) | 0,14 | 0,28 | <https://api-docs.deepseek.com/quick_start/pricing> |
| Mistral Small 4 | eu-hosted | 0,10 | 0,30 | <https://mistral.ai/pricing> |
| Mistral Large 3 | eu-hosted | 0,50 | 1,50 | <https://mistral.ai/pricing> |
| OpenAI GPT-5 mini | api-third-party | 0,25 | 2,00 | <https://openai.com/api/pricing/> |

Confiance **medium** : pages vendor officielles récentes, mais **volatiles** (promos DeepSeek, révisions
Mistral) → à confirmer/rafraîchir par la veille live (même pattern que la veille catalogue/prix). Le
FX USD→€ appliqué = `SEED_USD_TO_EUR` (BCE daté, partagé avec les médias S-017), rafraîchissable live.
Le **modèle facturé par défaut** = DeepSeek V4 Flash (le moins cher, routé par défaut par le proxy
LiteLLM, souverain-compatible). Les autres = alternatives sourcées (transparence, jamais imposées).

⚠ DÉFCON 1 : le LLM ne calcule **jamais** un coût ; l'estimation est purement déterministe (volume ×
prix sourcé), bornée ±30 %, et chaque prix porte sa source + sa date.
