// lib/supabase/auth.ts
// Identité serveur : TOUJOURS via getUser() (vérifie le JWT côté Supabase), jamais getSession() seul.

import { createClient } from "./server";

export async function getAuthUser(): Promise<{ id: string; email: string | null } | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error !== null || data.user === null) return null;
  return { id: data.user.id, email: data.user.email ?? null };
}
