# Strate — Bases légales des transferts inter-juridiction (S-043)

> ⚠ **Orientation d'ingénierie, PAS un avis juridique.** Sert à afficher un statut **indicatif, daté
> et révisable** dans le configurateur (résidence / réplication inter-région). Ne remplace pas une
> analyse par un conseil qualifié.
>
> **DÉFCON 1 + doctrine « tout vivant + filet ».** Un statut juridique **n'est jamais gravé comme
> permanent** : il porte sa **date de relevé**, sa **confiance**, et un flag **`volatile`** quand il
> est juridiquement instable. Preuve de l'instabilité au relevé : le **DPF UE-US est valide mais sous
> pourvoi CJUE (C-703/25 P)** — deux cadres transatlantiques ont déjà été invalidés (Safe Harbor 2015,
> Privacy Shield 2020) ; le **Maroc n'a pas d'adéquation UE à ce jour** mais cela peut évoluer. La
> **veille live** des statuts (LLM + sources officielles, via le registre de prompts S-053) =
> **story dédiée (S-062)**. Ce tableau est le **repli daté**.
>
> **Relevé le** : 2026-05-29 (sources primaires/officielles : EUR-Lex, gdpr-info, Commission
> européenne, Bulletin Officiel marocain publié par la CNDP, Cornell LII).

## Régions modélisées

`eu` (UE/EEE) · `maroc` · `us` · `other` (autre pays tiers). Aligné 1-1 sur `Profile.zone`.

## Tableau des bases légales (état daté + révisable)

| Flux | Statut | `volatile` | Base légale | Citation (verbatim) | Source | Confiance |
|---|---|---|---|---|---|---|
| **eu → eu** (intra-EEE) | `ok` | non | RGPD art. 1(3) — libre circulation ; le Chapitre V (transferts pays tiers) ne s'applique pas. | « The free movement of personal data within the Union shall be neither restricted nor prohibited for reasons connected with the protection of natural persons with regard to the processing of personal data. » | [RGPD art. 1](https://gdpr-info.eu/art-1-gdpr/) | high |
| **eu → us** | `restricted` | **oui** | RGPD chap. V art. 44-46 ; adéquation partielle **EU-US Data Privacy Framework** (10/07/2023) si destinataire **certifié DPF**, sinon **SCC** (art. 46). | EC : « On 10 July the European Commission adopted its adequacy decision for the EU-US Data Privacy Framework. » — liste : « the United States (commercial organisations participating in the EU-US Data Privacy Framework) » | [EC — EU-US data transfers](https://commission.europa.eu/law/law-topic/data-protection/international-dimension-data-protection/eu-us-data-transfers_en) | medium |
| **eu → maroc** | `restricted` | **oui** | Maroc **sans décision d'adéquation UE** (absent de la liste officielle, vérifié 2026-05-29) → transfert pays tiers via **SCC/garanties art. 46** + TIA. | Liste d'adéquation EC (Maroc **absent**) : Andorre, Argentine, Brésil, Canada, Féroé, Guernesey, Israël, Île de Man, Japon, Jersey, N.-Zélande, Corée du Sud, Suisse, RU, USA (DPF), Uruguay. | [EC — Adequacy decisions](https://commission.europa.eu/law/law-topic/data-protection/international-dimension-data-protection/adequacy-decisions_en) | high |
| **eu → other** (pays tiers, général) | `restricted` | non | RGPD chap. V art. 44 (principe), 45 (adéquation), 46 (SCC). | Art. 44 : « Any transfer of personal data… to a third country or to an international organisation shall take place only if… the conditions laid down in this Chapter are complied with… » | [RGPD art. 44](https://gdpr-info.eu/art-44-gdpr/) · [45](https://gdpr-info.eu/art-45-gdpr/) · [46](https://gdpr-info.eu/art-46-gdpr/) | high |
| **maroc → hors Maroc** | `restricted` | non | Loi **09-08** art. 43 (principe : pays à « niveau suffisant ») + art. 44 (dérogations / **autorisation CNDP**) ; sanction pénale art. 60. | Art. 43 al. 1 : « Le responsable d'un traitement ne peut transférer des données à caractère personnel vers un Etat étranger que si cet Etat assure un niveau de protection suffisant… » — Art. 44 al. 3 : transfert « Sur autorisation expresse et motivée de la Commission nationale… » | [CNDP — Loi 09-08 (B.O. 5714)](https://www.cndp.ma/wp-content/uploads/2023/11/Loi-09-08-Fr.pdf) | high |
| **→ us, données régulées** | flag **`cloudAct`** (risque, pas un statut RGPD) | non | **US CLOUD Act** (2018), codifié **18 U.S.C. § 2713** : autorités US peuvent exiger des données d'un fournisseur soumis à juridiction US, où qu'elles soient stockées. | « …regardless of whether such communication, record, or other information is located within or outside of the United States. » | [Cornell LII — 18 U.S.C. § 2713](https://www.law.cornell.edu/uscode/text/18/2713) · [DOJ CLOUD Act](https://www.justice.gov/criminal/cloud-act-resources) | high |
| **noTransfer = true** (résidence stricte) | `forbidden` | non | Décision de résidence stricte de l'organisation (toute copie hors juridiction interdite). | — (contrainte produit, dérivée de `sensitivity=secret` / régime régulé) | — | high |

## Notes datées sur les points sensibles (à revérifier — `volatile`)

**(A) DPF UE-US — relevé 2026-05-29** : décision d'adéquation du **10/07/2023 toujours en vigueur**
(NE PAS afficher « annulé »). A survécu au recours *Latombe c./ Commission* (**T-553/23**, Tribunal UE,
arrêt du **3 sept. 2025**, [Curia CP 106/25](https://curia.europa.eu/site/upload/docs/application/pdf/2025-09/cp250106en.pdf)).
**Pourvoi pendant devant la CJUE** (référencé **C-703/25 P** par source secondaire de premier plan,
à reconfirmer sur curia.europa.eu). Précédents : Safe Harbor → *Schrems I* (2015), Privacy Shield →
*Schrems II* (2020), tous deux invalidés. **Traiter le DPF comme « valide mais sous appel »** ;
conserver des SCC (art. 46) en filet. Pastille UI : « statut évolutif, vérifié le 2026-05-29 ».

**(B) Adéquation Maroc — relevé 2026-05-29** : **pas** de décision d'adéquation UE. Côté marocain, la
CNDP tient sa propre liste de pays « niveau suffisant » (loi 09-08, art. 28-10° / 43 al. 3) ; l'UE y
est généralement reconnue, mais un transfert Maroc→pays non listé exige l'**autorisation CNDP**
(art. 44-3°) ou une dérogation. Sanction pénale art. 60 (3 mois–1 an + amende 20 000–200 000 DH).

## Doctrine de mise à jour (NE PAS figer)

1. **Veille live primaire** (S-062) : rafraîchissement des statuts via LLM + sources officielles,
   réconcilié contre ce repli (statut divergent → flag « à revérifier » + confiance basse).
2. **Seed = repli daté** ; tout retour de `lookupTransferBasis` porte `checkedAt` + `volatile` +
   disclaimer « ingénierie, pas avis juridique ».
3. **Jamais d'affichage d'un statut sans sa date** ni sans son caractère révisable.
