// Types de la base Strate (rails F9). Tenus à la main, alignés sur la migration
// 20260525010854_init_rails.sql. `circle_id` est le pivot multi-tenant (RLS).

export type CircleRole = "owner" | "admin" | "member";
export type ConsentScope = "cost_network";
export type Currency = "EUR" | "USD";
export type CostPeriod = "monthly" | "usage" | "one_off";

export type CircleRow = { id: string; name: string; owner_id: string; created_at: string };
export type MembershipRow = {
  id: string;
  circle_id: string;
  user_id: string;
  role: CircleRole;
  created_at: string;
};
export type NetworkConsentRow = {
  id: string;
  circle_id: string;
  user_id: string;
  scope: ConsentScope;
  consented: boolean;
  consented_at: string | null;
  revoked_at: string | null;
  created_at: string;
};
export type ConfigurationRow = {
  id: string;
  circle_id: string;
  created_by: string | null;
  label: string | null;
  profile: unknown;
  recommendation: unknown;
  created_at: string;
};
export type CostObservationRow = {
  id: string;
  circle_id: string;
  layer_id: number;
  vendor: string;
  amount: number;
  currency: Currency;
  period: CostPeriod;
  observed_at: string;
  source_url: string | null;
  created_by: string | null;
};

export type NetworkConsentInsert = {
  circle_id: string;
  user_id: string;
  scope: ConsentScope;
  consented: boolean;
  consented_at: string | null;
  revoked_at: string | null;
};

// Conversion & data (S-023), log des simulations + capture e-mail.
export type LeadContext = "exit_intent" | "report" | "other";

export type SimulationLogRow = {
  id: string;
  share_token: string;
  circle_id: string | null;
  created_by: string | null;
  preset: string | null;
  profile: unknown;
  verdict: unknown;
  total_cost: number | null;
  setup_cost: number | null;
  created_at: string;
};
export type SimulationLogInsert = {
  circle_id: string | null;
  created_by: string | null;
  preset: string | null;
  profile: unknown;
  verdict: unknown;
  total_cost: number | null;
  setup_cost: number | null;
};

export type LeadCaptureRow = {
  id: string;
  email: string;
  simulation_id: string | null;
  circle_id: string | null;
  context: LeadContext;
  created_at: string;
};
export type LeadCaptureInsert = {
  email: string;
  simulation_id: string | null;
  circle_id: string | null;
  context: LeadContext;
};

// Veille temps réel du catalogue (S-036) : audit trail des composants proposés par la veille.
// Les unions de valeurs (slot/sovereignty/provenance/confidence) sont garanties par les CHECK
// SQL de la migration ; côté TS on conserve `string` pour ne pas coupler les types base aux types
// du catalogue (le builder y injecte les valeurs typées).
export type CatalogObservationRow = {
  id: string;
  circle_id: string | null;
  created_by: string | null;
  slot: string;
  component: string;
  role: string;
  sovereignty: string;
  provenance: string;
  confidence: string;
  source_url: string;
  source_label: string | null;
  checked_at: string | null;
  assembled_at: string;
  created_at: string;
};
export type CatalogObservationInsert = {
  circle_id: string | null;
  created_by: string | null;
  slot: string;
  component: string;
  role: string;
  sovereignty: string;
  provenance: string;
  confidence: string;
  source_url: string;
  source_label: string | null;
  checked_at: string | null;
  assembled_at: string;
};

// Veille juridique (S-062) : audit trail des révisions de statut de transfert (live/seed/flagged).
// Les unions (status/provenance/confidence/régions) sont garanties par les CHECK SQL ; côté TS on
// conserve `string` pour ne pas coupler les types base aux types de lib/legal (le builder injecte les
// valeurs typées). `source_url` nullable : un statut de résidence stricte (forbidden) n'a pas d'URL.
export type TransferObservationRow = {
  id: string;
  circle_id: string | null;
  created_by: string | null;
  from_region: string;
  to_region: string;
  status: string;
  legal_basis: string;
  provenance: string;
  confidence: string;
  volatile: boolean;
  source_url: string | null;
  source_label: string | null;
  checked_at: string;
  note: string | null;
  created_at: string;
};
export type TransferObservationInsert = {
  circle_id: string | null;
  created_by: string | null;
  from_region: string;
  to_region: string;
  status: string;
  legal_basis: string;
  provenance: string;
  confidence: string;
  volatile: boolean;
  source_url: string | null;
  source_label: string | null;
  checked_at: string;
  note: string | null;
};

// Veille des régimes réglementaires par pays (S-077) : audit trail des régimes DÉCOUVERTS par la veille
// (live). `regime_code` nullable (null = régime libre hors énum moteur) ; unions garanties par les CHECK
// SQL, `string` côté TS pour ne pas coupler aux types de lib/legal (le builder injecte les valeurs typées).
export type RegimeObservationRow = {
  id: string;
  circle_id: string | null;
  created_by: string | null;
  country: string;
  regime_code: string | null;
  regime_name: string;
  scope: string;
  provenance: string;
  confidence: string;
  source_url: string | null;
  source_label: string | null;
  checked_at: string;
  note: string | null;
  created_at: string;
};
export type RegimeObservationInsert = {
  circle_id: string | null;
  created_by: string | null;
  country: string;
  regime_code: string | null;
  regime_name: string;
  scope: string;
  provenance: string;
  confidence: string;
  source_url: string | null;
  source_label: string | null;
  checked_at: string;
  note: string | null;
};

// Partage de la recommandation par lien court (S-067) : profil encodé derrière un id imprévisible.
export type SharedRecoRow = {
  id: string;
  circle_id: string | null;
  created_by: string | null;
  encoded: string;
  created_at: string;
};
export type SharedRecoInsert = {
  id?: string; // facultatif : la colonne a un default gen_random_uuid() ; la route le fournit (insert sans RETURNING)
  circle_id: string | null;
  created_by: string | null;
  encoded: string;
};

// Lead gate (S-068) : capture nom + e-mail avant la recette experte. `preset` = preset courant
// au moment de la capture (facultatif). PII → aucune lecture publique (anon INSERT uniquement).
export type LeadRow = {
  id: string;
  circle_id: string | null;
  created_by: string | null;
  name: string;
  email: string;
  preset: string | null;
  created_at: string;
};
export type LeadInsert = {
  circle_id: string | null;
  created_by: string | null;
  name: string;
  email: string;
  preset: string | null;
};

// Console admin super-admin (S-053) : prompts système versionnés + table des super-admins globaux.
export type SuperAdminRow = { user_id: string; created_at: string };
export type PromptRow = {
  id: string;
  prompt_key: string;
  version: number;
  content: string;
  is_active: boolean;
  author: string | null;
  created_at: string;
};
export type PromptInsert = {
  prompt_key: string;
  version: number;
  content: string;
  is_active: boolean;
  author: string | null;
};

// Coffre de credentials vendeurs (Lot 2-A) : credentials chiffrés + audit trail.
export type VendorCredentialKind = "oauth_token" | "api_key";

/** Ligne complète de la table `vendor_credentials` (colonnes chiffrées incluses — serveur uniquement). */
export type VendorCredentialRow = {
  id: string;
  circle_id: string;
  provider: string;
  label: string;
  kind: VendorCredentialKind;
  ciphertext: string;
  wrapped_dek: string;
  iv_secret: string;
  tag_secret: string;
  iv_dek: string;
  tag_dek: string;
  key_version: number;
  expires_at: string | null;
  revoked_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type VendorCredentialInsert = {
  circle_id: string;
  provider: string;
  label: string;
  kind: VendorCredentialKind;
  ciphertext: string;
  wrapped_dek: string;
  iv_secret: string;
  tag_secret: string;
  iv_dek: string;
  tag_dek: string;
  key_version: number;
  expires_at?: string | null;
  revoked_at?: string | null;
  created_by?: string | null;
};

/** Métadonnées exposées par la vue `vendor_credentials_meta` (jamais le chiffré). */
export type VendorCredentialMetaRow = {
  id: string;
  circle_id: string;
  provider: string;
  label: string;
  kind: VendorCredentialKind;
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string;
};

export type CredentialAction = "store" | "read" | "rotate" | "revoke";
export type CredentialAccessRow = {
  id: string;
  circle_id: string;
  credential_id: string | null;
  actor: string;
  action: CredentialAction;
  context: Record<string, unknown>;
  at: string;
};

export type CredentialAccessInsert = {
  circle_id: string;
  credential_id?: string | null;
  actor: string;
  action: CredentialAction;
  context: Record<string, unknown>;
};

// `Relationships: []` est requis par le contrat `GenericTable` de @supabase/supabase-js (v2) : sans
// lui, les requêtes typées `<Database>` résolvent les lignes en `never`. Aucune relation FK déclarée ici.
type TableShape<Row, Insert> = { Row: Row; Insert: Insert; Update: Partial<Insert>; Relationships: [] };

export type Database = {
  public: {
    Tables: {
      circles: TableShape<CircleRow, Omit<CircleRow, "id" | "created_at">>;
      memberships: TableShape<MembershipRow, Omit<MembershipRow, "id" | "created_at">>;
      network_consents: TableShape<NetworkConsentRow, NetworkConsentInsert>;
      configurations: TableShape<ConfigurationRow, Omit<ConfigurationRow, "id" | "created_at">>;
      cost_observations: TableShape<CostObservationRow, Omit<CostObservationRow, "id" | "observed_at">>;
      simulation_log: TableShape<SimulationLogRow, SimulationLogInsert>;
      lead_capture: TableShape<LeadCaptureRow, LeadCaptureInsert>;
      catalog_observations: TableShape<CatalogObservationRow, CatalogObservationInsert>;
      transfer_status_observations: TableShape<TransferObservationRow, TransferObservationInsert>;
      regime_observations: TableShape<RegimeObservationRow, RegimeObservationInsert>;
      super_admins: TableShape<SuperAdminRow, SuperAdminRow>;
      prompts: TableShape<PromptRow, PromptInsert>;
      shared_reco: TableShape<SharedRecoRow, SharedRecoInsert>;
      leads: TableShape<LeadRow, LeadInsert>;
      vendor_credentials: TableShape<VendorCredentialRow, VendorCredentialInsert>;
      credential_access: TableShape<CredentialAccessRow, CredentialAccessInsert>;
    };
    Views: {
      // Vue read-only exposant uniquement les metadonnees (jamais le chiffre).
      vendor_credentials_meta: {
        Row: VendorCredentialMetaRow;
        Insert: never;
        Update: never;
        Relationships: [];
      };
    };
    Functions: {
      get_simulation_by_token: { Args: { token: string }; Returns: SimulationLogRow[] };
      get_shared_reco: { Args: { reco_id: string }; Returns: SharedRecoRow[] };
      is_super_admin: { Args: Record<string, never>; Returns: boolean };
    };
  };
};
