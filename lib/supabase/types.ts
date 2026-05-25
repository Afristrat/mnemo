// Types de la base Mnémo (rails F9). Tenus à la main, alignés sur la migration
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

type TableShape<Row, Insert> = { Row: Row; Insert: Insert; Update: Partial<Insert> };

export type Database = {
  public: {
    Tables: {
      circles: TableShape<CircleRow, Omit<CircleRow, "id" | "created_at">>;
      memberships: TableShape<MembershipRow, Omit<MembershipRow, "id" | "created_at">>;
      network_consents: TableShape<NetworkConsentRow, NetworkConsentInsert>;
      configurations: TableShape<ConfigurationRow, Omit<ConfigurationRow, "id" | "created_at">>;
      cost_observations: TableShape<CostObservationRow, Omit<CostObservationRow, "id" | "observed_at">>;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
};
