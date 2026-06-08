import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Callback OAuth / magic-link (flux PKCE @supabase/ssr) : le fournisseur (ou le lien e-mail) redirige ici
// avec un `?code=…` à ÉCHANGER contre une session (pose les cookies). Sans cette route, OAuth/magic-link
// atterriraient sur /compte sans session établie → boucle de connexion. `next` borné à un chemin interne
// (anti open-redirect). Repli : /connexion?error=auth (jamais de fuite de détail). Prêt pour S-089 : devient
// fonctionnel dès que SMTP (magic-link) + apps OAuth Google/GitHub sont branchés côté Supabase.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Origine canonique configurée (publique, stable, non secrète). On NE dérive JAMAIS l'origine de redirection
// d'un en-tête client (`Host`/`x-forwarded-host` sont usurpables → open-redirect). En prod on redirige
// toujours sur cette origine ; en dev local, l'origine de la requête. `url.hostname` provient du bind
// serveur (fixé par Next, pas du client) → décision dev/prod non usurpable.
const CANONICAL_ORIGIN = process.env.NEXT_PUBLIC_SITE_URL ?? "https://infra.ai-mpower.com";

function publicOrigin(url: URL): string {
  const isLocalServer = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  return isLocalServer ? url.origin : CANONICAL_ORIGIN;
}

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const origin = publicOrigin(url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/compte";
  // N'accepter qu'un chemin relatif interne (pas `//host` ni une URL absolue) → anti open-redirect.
  const dest = next.startsWith("/") && !next.startsWith("//") ? next : "/compte";
  const fail = NextResponse.redirect(new URL("/connexion?error=auth", origin));

  if (code === null) return fail;
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error !== null) return fail;
  } catch {
    return fail;
  }
  return NextResponse.redirect(new URL(dest, origin));
}
