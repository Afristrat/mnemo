// Page de compte : affiche les metadonnees de l'utilisateur connecte + ses credentials vendeurs.
// Redirige vers /connexion si non authentifie (verification serveur via getAuthUser).
import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { VendorCredentials } from "@/components/account/VendorCredentials";
import { getTranslations } from "next-intl/server";
import type { VendorCredentialMetaRow } from "@/lib/supabase/types";
import type { ReactElement } from "react";

export default async function ComptePage(): Promise<ReactElement> {
  const user = await getAuthUser();
  if (user === null) redirect("/connexion");

  const t = await getTranslations("Account");
  const supabase = await createClient();
  const { data } = await supabase
    .from("vendor_credentials_meta")
    .select("*")
    .order("created_at", { ascending: false });
  const items: VendorCredentialMetaRow[] = data ?? [];

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="font-display text-headline-lg text-on-surface">{t("myAccount")}</h1>
      <VendorCredentials items={items} />
    </main>
  );
}
