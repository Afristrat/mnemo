import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { LOCALE_COOKIE, LOCALE_HEADER, defaultLocale, isLocale, type Locale } from "@/i18n/config";

// Négociation Accept-Language minimale (sans dépendance externe) : on trie les langues
// déclarées par qualité décroissante et on retient la première dont la base (fr, en…)
// est supportée. Repli : locale par défaut.
function negotiate(header: string | null): Locale {
  if (!header) return defaultLocale;
  const ranked = header
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().split(";");
      const qParam = params.find((p) => p.trim().startsWith("q="));
      const quality = qParam ? Number.parseFloat(qParam.split("=")[1]) : 1;
      return { base: tag.trim().toLowerCase().split("-")[0], quality: Number.isNaN(quality) ? 0 : quality };
    })
    .sort((a, b) => b.quality - a.quality);
  for (const { base } of ranked) {
    if (isLocale(base)) return base;
  }
  return defaultLocale;
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const existing = request.cookies.get(LOCALE_COOKIE)?.value;
  const resolved: Locale = isLocale(existing) ? existing : negotiate(request.headers.get("accept-language"));

  // Transmettre la locale au rendu de CETTE requête (le cookie tout juste posé n'est pas
  // encore lisible côté serveur sur la même requête) via un en-tête interne.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(LOCALE_HEADER, resolved);
  const response = NextResponse.next({ request: { headers: requestHeaders } });

  // Persister le cookie uniquement s'il est absent/invalide (le sélecteur de langue,
  // côté client, prime ensuite et n'est jamais écrasé ici).
  if (!isLocale(existing)) {
    response.cookies.set(LOCALE_COOKIE, resolved, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });
  }

  // Rafraîchissement de session Supabase : maintient le jeton à jour sans bloquer
  // l'expérience anonyme (Lot 1) si Supabase est indisponible ou non configuré.
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (
      supabaseUrl !== undefined &&
      supabaseAnon !== undefined &&
      supabaseUrl.length > 0 &&
      supabaseAnon.length > 0
    ) {
      const supabase = createServerClient(supabaseUrl, supabaseAnon, {
        cookies: {
          getAll: () => request.cookies.getAll(),
          setAll: (cookiesToSet) => {
            for (const { name, value, options } of cookiesToSet) {
              response.cookies.set(name, value, options);
            }
          },
        },
      });
      await supabase.auth.getUser(); // rafraîchit le jeton ; ne JAMAIS logguer le résultat
    }
  } catch {
    /* Supabase indisponible/non configuré : l'expérience anonyme (Lot 1) reste intacte. */
  }

  return response;
}

export const config = {
  // Exécuter sur les pages uniquement : exclure l'API, les assets Next et tout fichier
  // statique (présence d'un point dans le chemin).
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
