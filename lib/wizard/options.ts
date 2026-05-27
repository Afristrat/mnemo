import type {
  Activity,
  Budget,
  ContentType,
  Growth,
  Latency,
  Regulation,
  ReqPerDay,
  Sensitivity,
  TechLevel,
  Voices,
  Volume,
  Zone,
} from "@/lib/engine";

export type Option<T extends string> = { value: T; label: string; hint?: string };

export const ACTIVITY_OPTIONS: Option<Activity>[] = [
  { value: "freelance", label: "Freelance / indépendant" },
  { value: "cabinet-regule", label: "Cabinet régulé", hint: "Avocat, santé, CGP, secret pro" },
  { value: "particulier", label: "Particulier" },
  { value: "agence", label: "Agence / programme d'accompagnement" },
  { value: "pme-startup", label: "PME / startup tech" },
  { value: "recherche", label: "Recherche / académique" },
  { value: "other", label: "Autre" },
];

export const ZONE_OPTIONS: Option<Zone>[] = [
  { value: "ue", label: "Union européenne" },
  { value: "maroc", label: "Maroc" },
  { value: "us", label: "États-Unis" },
  { value: "other", label: "Autre" },
];

export const VOLUME_OPTIONS: Option<Volume>[] = [
  { value: "lt1", label: "< 1 Go", hint: "≈ centaines de documents" },
  { value: "1to10", label: "1 – 10 Go", hint: "≈ milliers de documents" },
  { value: "10to100", label: "10 – 100 Go", hint: "≈ dizaines de milliers" },
  { value: "100to1000", label: "100 Go – 1 To", hint: "gros corpus / médias" },
  { value: "gt1000", label: "> 1 To", hint: "très gros corpus multimédia" },
];

export const GROWTH_OPTIONS: Option<Growth>[] = [
  { value: "low", label: "Faible", hint: "stable, peu d'ajouts" },
  { value: "medium", label: "Modérée", hint: "croissance régulière" },
  { value: "high", label: "Forte", hint: "montée en charge rapide" },
];

export const CONTENT_TYPE_OPTIONS: Option<ContentType>[] = [
  { value: "text", label: "Texte / documents" },
  { value: "audio", label: "Audio", hint: "Transcripts, enregistrements" },
  { value: "video", label: "Vidéo" },
  { value: "images", label: "Images" },
  { value: "code", label: "Code" },
  { value: "structured", label: "Données structurées" },
];

export const REGULATION_OPTIONS: Option<Regulation>[] = [
  { value: "rgpd", label: "RGPD", hint: "Union européenne" },
  { value: "cndp", label: "CNDP", hint: "Maroc, loi 09-08" },
  { value: "aiact", label: "AI Act", hint: "Union européenne" },
  { value: "hipaa", label: "HIPAA", hint: "Santé (US)" },
  { value: "secret-pro", label: "Secret professionnel" },
  { value: "none", label: "Aucun" },
];

export const SENSITIVITY_OPTIONS: Option<Sensitivity>[] = [
  { value: "public", label: "Public", hint: "Diffusable sans risque" },
  { value: "internal", label: "Interne", hint: "Circule en interne, fuite gênante" },
  { value: "confidential", label: "Confidentiel", hint: "Accès restreint, fuite dommageable" },
  { value: "secret", label: "Secret / ultra-sensible", hint: "Fuite critique (secret pro, santé, défense)" },
];

export const TECH_LEVEL_OPTIONS: Option<TechLevel>[] = [
  { value: "none", label: "Non technique" },
  { value: "dev", label: "Développeur" },
  { value: "hybrid", label: "Hybride", hint: "Dev + ops léger" },
  { value: "devops", label: "DevOps confirmé" },
];

export const BUDGET_OPTIONS: Option<Budget>[] = [
  { value: "lt50", label: "< 50 €/mois" },
  { value: "50to200", label: "50 – 200 €/mois" },
  { value: "200to500", label: "200 – 500 €/mois" },
  { value: "500to2k", label: "500 – 2 000 €/mois" },
  { value: "gt2k", label: "> 2 000 €/mois" },
];

export const REQ_PER_DAY_OPTIONS: Option<ReqPerDay>[] = [
  { value: "lt100", label: "< 100 / jour" },
  { value: "lt1k", label: "< 1 000 / jour" },
  { value: "lt10k", label: "< 10 000 / jour" },
  { value: "gt10k", label: "> 10 000 / jour" },
];

export const LATENCY_OPTIONS: Option<Latency>[] = [
  { value: "fast", label: "Rapide", hint: "< 2 s" },
  { value: "acceptable", label: "Acceptable", hint: "2 – 5 s" },
  { value: "relaxed", label: "Tolérante", hint: "> 5 s" },
];

export const VOICES_OPTIONS: Option<Voices>[] = [
  { value: "solo", label: "Solo", hint: "Une voix" },
  { value: "multi", label: "Multi", hint: "2 – 5 voix" },
  { value: "many", label: "Nombreuses", hint: "> 5 voix" },
];
