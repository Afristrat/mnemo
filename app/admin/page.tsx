import type { ReactElement } from "react";
import { AdminPrompts } from "@/components/admin/AdminPrompts";
import { createClient } from "@/lib/supabase/server";

// Console admin super-admin (S-053) — rôle GLOBAL, hors RLS de cercle. La page détermine l'état d'auth
// côté serveur (session + appartenance super_admins) et délègue le rendu (connexion / 403 / éditeur).
export const dynamic = "force-dynamic";

export default async function AdminPage(): Promise<ReactElement> {
  let authed = false;
  let isSuperAdmin = false;
  let email: string | null = null;
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    const user = data.user;
    if (user !== null) {
      authed = true;
      email = user.email ?? null;
      const { data: sa } = await supabase
        .from("super_admins")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();
      isSuperAdmin = sa !== null;
    }
  } catch {
    // Config Supabase absente : l'écran de connexion signalera l'indisponibilité.
  }
  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <AdminPrompts authed={authed} isSuperAdmin={isSuperAdmin} email={email} />
    </main>
  );
}
