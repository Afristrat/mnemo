// Seed sourcé : annuaire de fournisseurs d'infrastructure souverains PAR CONTINENT (S-073, tranche 1).
//
// DÉFCON 1 — ce que ce fichier EST et N'EST PAS :
//   • EST : un repli daté documentant l'EXISTENCE + le pays + la classe de souveraineté + une SOURCE
//     publique pour des fournisseurs réels, afin de couvrir « tous les continents » et la redondance
//     multi-fournisseur (vision Amine). Chaque entrée porte une URL + une date de vérification.
//   • N'EST PAS : une grille de prix egress (jamais fabriquée — devis/veille par fournisseur, tranches
//     ultérieures), ni un statut juridique de transfert par pays (géré par lib/legal, conservateur).
//
// La classification `sovereignty` est éditoriale (positionnement public déclaré par le fournisseur) :
// la veille (tranche 3) l'affine et la confronte aux contraintes utilisateur (S-072) ; l'UI de
// redondance (tranche 4) consomme cet annuaire. Repli, jamais vérité gravée.
//
// Sources vérifiées le 2026-05-31.

import type { SovereignProvider } from "@/lib/engine/providers";

const CHECKED = "2026-05-31";

export const SOVEREIGN_PROVIDERS_SEED: SovereignProvider[] = [
  // --- Europe (cœur historique du moteur ; déjà chiffré côté egress dans residency-seed) ---
  {
    name: "OVHcloud",
    continent: "europe",
    country: "France",
    sovereignty: "sovereign",
    note: "Cloud souverain européen ; gamme Bare Metal / Public Cloud ; offre certifiée disponible.",
    source: { label: "OVHcloud", url: "https://www.ovhcloud.com/fr/", checkedAt: CHECKED },
  },
  {
    name: "Scaleway",
    continent: "europe",
    country: "France",
    sovereignty: "sovereign",
    note: "Fournisseur français (groupe Iliad) ; instances GPU et stockage objet souverains.",
    source: { label: "Scaleway", url: "https://www.scaleway.com/fr/", checkedAt: CHECKED },
  },
  {
    name: "Outscale (Dassault Systèmes)",
    continent: "europe",
    country: "France",
    sovereignty: "sovereign",
    note: "Qualifié SecNumCloud (ANSSI) ; cible secteurs régulés / souveraineté forte.",
    source: { label: "3DS Outscale", url: "https://fr.outscale.com/", checkedAt: CHECKED },
  },
  {
    name: "IONOS",
    continent: "europe",
    country: "Allemagne",
    sovereignty: "sovereign",
    note: "Fournisseur allemand ; cloud souverain UE, partenaire d'initiatives de souveraineté.",
    source: { label: "IONOS", url: "https://www.ionos.fr/", checkedAt: CHECKED },
  },
  {
    name: "Infomaniak",
    continent: "europe",
    country: "Suisse",
    sovereignty: "sovereign",
    note: "Cloud suisse (hors UE) ; data centers en Suisse, positionnement souveraineté/éthique.",
    source: { label: "Infomaniak", url: "https://www.infomaniak.com/fr", checkedAt: CHECKED },
  },
  {
    name: "Hetzner",
    continent: "europe",
    country: "Allemagne",
    sovereignty: "eu-hosted",
    note: "Hébergeur allemand bon marché ; data centers DE/FI. Souveraineté UE, pas de qualif. spécifique.",
    source: { label: "Hetzner", url: "https://www.hetzner.com/", checkedAt: CHECKED },
  },

  // --- Afrique ---
  {
    name: "UniCloud Africa",
    continent: "africa",
    country: "Nigeria / Kenya / Afrique du Sud",
    sovereignty: "sovereign",
    note: "Cloud panafricain ; infrastructures locales (via Open Access Data Centres) pour résidence des données sur le continent.",
    source: { label: "UniCloud Africa", url: "https://unicloudafrica.africa/", checkedAt: CHECKED },
  },
  {
    name: "iXAfrica × Baobab Cloud",
    continent: "africa",
    country: "Kenya",
    sovereignty: "sovereign",
    note: "Plateforme cloud public souveraine lancée au Kenya (2026) ; positionnement « zéro frais d'egress ».",
    source: {
      label: "TechAfrica News — iXAfrica/Baobab (2026)",
      url: "https://techafricanews.com/2026/05/22/ixafrica-data-centres-and-baobab-cloud-services-launch-sovereign-public-cloud-platform-in-kenya/",
      checkedAt: CHECKED,
    },
  },

  // --- Moyen-Orient ---
  {
    name: "Core42 (G42)",
    continent: "middle-east",
    country: "Émirats arabes unis",
    sovereignty: "sovereign",
    note: "Filiale G42 (Abou Dabi) ; cloud souverain (dont offre bâtie sur Azure) pour secteur public/régulé.",
    source: { label: "Core42", url: "https://www.core42.ai/", checkedAt: CHECKED },
  },
  {
    name: "STC Cloud (solutions by stc)",
    continent: "middle-east",
    country: "Arabie saoudite",
    sovereignty: "sovereign",
    note: "Opérateur télécom saoudien ; cloud avec résidence des données en Arabie saoudite.",
    source: { label: "solutions by stc", url: "https://www.solutions.com.sa/", checkedAt: CHECKED },
  },
  {
    name: "e& enterprise",
    continent: "middle-east",
    country: "Émirats arabes unis / Qatar",
    sovereignty: "sovereign",
    note: "Branche entreprise d'e& (ex-Etisalat) ; services cloud régionaux Golfe.",
    source: { label: "e& enterprise", url: "https://www.eand.com/en/business.html", checkedAt: CHECKED },
  },

  // --- Asie-Pacifique (APAC) ---
  {
    name: "Sakura Internet",
    continent: "apac",
    country: "Japon",
    sovereignty: "sovereign",
    note: "Fournisseur japonais ; enregistré ISMAP (cadre gouvernemental japonais), data centers au Japon.",
    source: {
      label: "eSolia — Cloud Sovereignty Japan",
      url: "https://esolia.co.jp/en/articles/cloud-sovereignty-japan/",
      checkedAt: CHECKED,
    },
  },
  {
    name: "NTT Communications",
    continent: "apac",
    country: "Japon",
    sovereignty: "sovereign",
    note: "Conglomérat japonais bâtissant un cloud souverain APAC (normes de sécurité domestiques).",
    source: { label: "NTT", url: "https://www.global.ntt/", checkedAt: CHECKED },
  },
  {
    name: "NAVER Cloud",
    continent: "apac",
    country: "Corée du Sud",
    sovereignty: "sovereign",
    note: "« Neocloud » coréen ; IA souveraine (LLM HyperCLOVA X), conformité PIPA, localisation des données.",
    source: {
      label: "CRN Asia — NAVER Cloud sovereign AI (2026)",
      url: "https://www.crnasia.com/news/2026/cloud/south-korea-s-naver-cloud-focused-on-providing-sovereign-ai",
      checkedAt: CHECKED,
    },
  },

  // --- Amérique latine ---
  {
    name: "Serpro — Government Cloud",
    continent: "latam",
    country: "Brésil",
    sovereignty: "sovereign",
    note: "Entreprise publique fédérale brésilienne ; cloud gouvernemental, données on-shore (stratégie souveraine).",
    source: { label: "Serpro", url: "https://www.serpro.gov.br/", checkedAt: CHECKED },
  },

  // --- Amérique du Nord (présence ; redondance hors-UE assumée) ---
  {
    name: "OVHcloud Canada",
    continent: "north-america",
    country: "Canada",
    sovereignty: "eu-hosted",
    note: "Région canadienne d'OVHcloud (Beauharnois, Québec) ; résidence des données au Canada hors juridiction US.",
    source: { label: "OVHcloud", url: "https://www.ovhcloud.com/en-ca/", checkedAt: CHECKED },
  },
];
