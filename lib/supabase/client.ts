"use client";

// Client Supabase navigateur (@supabase/ssr). N'utilise QUE la clé publishable
// (publique), jamais la clé secrète. Références littérales à process.env pour que
// Next inline les variables NEXT_PUBLIC_* dans le bundle client.

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./types";

export function createClient(): ReturnType<typeof createBrowserClient<Database>> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("Config Supabase manquante : NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  }
  return createBrowserClient<Database>(url, key);
}
