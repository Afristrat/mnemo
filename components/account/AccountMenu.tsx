// Composant de navigation : lien de connexion si non authentifié, ou e-mail du compte connecté.
// Utilise onAuthStateChange pour rester synchrone avec la session Supabase côté navigateur.
"use client";

import { useEffect, useState, type ReactElement } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";

export function AccountMenu(): ReactElement {
  const t = useTranslations("Account");
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    void supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) =>
      setEmail(session?.user?.email ?? null),
    );
    return () => sub.subscription.unsubscribe();
  }, []);

  if (email === null) {
    return (
      <Link
        href="/connexion"
        className="text-body-sm text-on-surface-variant transition-colors hover:text-on-surface"
      >
        {t("signIn")}
      </Link>
    );
  }

  return (
    <Link
      href="/compte"
      className="text-body-sm text-on-surface-variant transition-colors hover:text-on-surface"
    >
      {t("signedInAs", { email })}
    </Link>
  );
}
