// Tableau de bord du compte : identité + méthode de connexion, plans sauvegardés (cercle), gestion du
// consentement réseau, et coffre de credentials fournisseurs. Redirige vers /connexion si non authentifié
// (vérification serveur via getUser). Toutes les lectures passent par le client de session (RLS pivot circle).
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import type { ReactElement } from "react";
import { getAuthUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";
import { VendorCredentials } from "@/components/account/VendorCredentials";
import { SignOutButton } from "@/components/account/SignOutButton";
import { NetworkConsent } from "@/components/account/NetworkConsent";
import { profileFromUnknown, encodeProfileToParam } from "@/lib/share/encode";
import type { VendorCredentialMetaRow } from "@/lib/supabase/types";

type SavedPlan = { id: string; label: string | null; created_at: string; href: string | null };

export default async function ComptePage(): Promise<ReactElement> {
  const user = await getAuthUser();
  if (user === null) redirect("/connexion");

  const t = await getTranslations("Account");
  const supabase = await createClient();

  // Méthode de connexion (provider) — issue des métadonnées d'authentification.
  const { data: authData } = await supabase.auth.getUser();
  const provider = authData.user?.app_metadata?.provider ?? "email";
  const providerLabel =
    provider === "google" ? t("providerGoogle") : provider === "github" ? t("providerGithub") : t("providerEmail");

  // Cercle de l'utilisateur (premier membership).
  const { data: mem } = await supabase.from("memberships").select("circle_id").limit(1).maybeSingle();
  const circleId = mem?.circle_id ?? null;

  // Plans sauvegardés du cercle (RLS : membre du cercle). Lien « Reprendre » seulement si le profil est valide.
  let plans: SavedPlan[] = [];
  let consented = false;
  if (circleId !== null) {
    const { data: configs } = await supabase
      .from("configurations")
      .select("id,label,created_at,profile")
      .eq("circle_id", circleId)
      .order("created_at", { ascending: false });
    plans = (configs ?? []).map((c) => {
      const prof = profileFromUnknown(c.profile);
      return {
        id: c.id,
        label: c.label,
        created_at: c.created_at,
        href: prof !== null ? `/resultats?p=${encodeProfileToParam(prof)}` : null,
      };
    });

    const { data: consent } = await supabase
      .from("network_consents")
      .select("consented")
      .eq("circle_id", circleId)
      .eq("scope", "cost_network")
      .maybeSingle();
    consented = consent?.consented ?? false;
  }

  // Coffre de credentials fournisseurs (métadonnées seulement).
  const { data: credData } = await supabase
    .from("vendor_credentials_meta")
    .select("*")
    .order("created_at", { ascending: false });
  const items: VendorCredentialMetaRow[] = credData ?? [];

  return (
    <main className="mx-auto max-w-2xl space-y-6 px-6 py-12">
      <h1 className="font-display text-headline-lg text-on-surface">{t("myAccount")}</h1>

      {/* Identité */}
      <Card>
        <h2 className="font-display text-headline-md text-on-surface">{t("identityTitle")}</h2>
        <p className="mt-2 text-body-sm text-on-surface">{t("signedInAs", { email: user.email ?? "—" })}</p>
        <p className="mt-1 text-body-sm text-on-surface-variant">
          {t("loginMethodLabel")} : <span className="text-on-surface">{providerLabel}</span>
        </p>
        <SignOutButton />
      </Card>

      {/* Plans sauvegardés */}
      <Card>
        <h2 className="font-display text-headline-md text-on-surface">{t("plansTitle")}</h2>
        <p className="mt-1 text-body-sm text-on-surface-variant">{t("plansIntro")}</p>
        {plans.length === 0 ? (
          <p className="mt-3 text-body-sm text-on-surface-variant">
            {t("plansEmpty")}{" "}
            <a href="/configurateur" className="text-secondary underline decoration-dotted">
              {t("plansCta")}
            </a>
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {plans.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between rounded-card bg-surface-container p-3 text-body-sm"
              >
                <span className="text-on-surface">
                  {p.label ?? "—"}{" "}
                  <span className="font-mono text-on-surface-variant/80">· {p.created_at.slice(0, 10)}</span>
                </span>
                {p.href !== null ? (
                  <a href={p.href} className="text-secondary underline decoration-dotted">
                    {t("planResume")}
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Réseau & consentement */}
      <Card>
        <h2 className="font-display text-headline-md text-on-surface">{t("networkTitle")}</h2>
        <p className="mt-1 text-body-sm text-on-surface-variant">{t("networkIntro")}</p>
        <NetworkConsent consented={consented} />
      </Card>

      {/* Coffre de credentials fournisseurs */}
      <Card>
        <VendorCredentials items={items} />
      </Card>
    </main>
  );
}
