"use client";

import { useTranslations } from "next-intl";
import { type ReactElement } from "react";
import { createClient } from "@/lib/supabase/client";

// Déconnexion : efface la session Supabase (cookies @supabase/ssr) puis renvoie à l'accueil.
export function SignOutButton(): ReactElement {
  const t = useTranslations("Account");
  const onClick = async (): Promise<void> => {
    try {
      await createClient().auth.signOut();
    } catch {
      /* session déjà absente / config manquante : on redirige quand même */
    }
    window.location.assign("/");
  };
  return (
    <button
      type="button"
      onClick={() => void onClick()}
      className="mt-3 rounded-card border border-outline px-4 py-2 text-body-sm text-on-surface"
    >
      {t("signOut")}
    </button>
  );
}
