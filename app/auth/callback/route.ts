import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Callback OAuth / magic-link (flux PKCE @supabase/ssr) : le fournisseur (ou le lien e-mail) redirige ici
// avec un `?code=…` à ÉCHANGER contre une session (pose les cookies). Sans cette route, OAuth/magic-link
// atterriraient sur /compte sans session établie → boucle de connexion. `next` borné à un chemin interne
// (anti open-redirect). Repli : /connexion?error=auth (jamais de fuite de détail). Prêt pour S-089 : devient
// fonctionnel dès que SMTP (magic-link) + apps OAuth Google/GitHub sont branchés côté Supabase.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Origine PUBLIQUE de la requête. Derrière le proxy (Coolify/traefik), `req.url` porte l'adresse de bind
 * interne (`http://0.0.0.0:3000`) — rediriger dessus enverrait l'utilisateur sur une URL injoignable. On
 * reconstruit donc depuis `x-forwarded-host`/`x-forwarded-proto` (repli : Host, puis l'origine de req.url).
 */
function publicOrigin(req: Request, url: URL): string {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (host === null || host === "") return url.origin;
  const proto = req.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
  return `${proto}://${host}`;
}

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const origin = publicOrigin(req, url);
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
