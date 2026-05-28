// Client Supabase service-role (S-053) — SERVEUR UNIQUEMENT, bypass RLS.
//
// Sert à l'app publique pour LIRE le prompt actif (table `prompts`, fermée par RLS aux super-admins),
// sans session utilisateur. La clé secrète (`SUPABASE_SERVICE_ROLE_KEY`) n'est JAMAIS exposée au
// client/bundle. Repli : si l'URL ou la clé manque → `null` (les appelants retombent sur le défaut).
// Ne JAMAIS importer ce module depuis un composant client.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

export function createAdminClient(): SupabaseClient<Database> | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url === undefined || key === undefined || url === "" || key === "") return null;
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
