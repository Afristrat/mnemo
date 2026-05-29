import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import type { AbstractIntlMessages } from "next-intl";
import { LOCALE_COOKIE, LOCALE_HEADER, defaultLocale, isLocale, type Locale } from "./config";

// Chargeurs statiques (un par locale) : chemins littéraux → TypeScript résout le type
// du JSON et le valide contre `AbstractIntlMessages`, sans `any` ni `as` (cf. CLAUDE.md).
const loaders: Record<Locale, () => Promise<{ default: AbstractIntlMessages }>> = {
  fr: () => import("../messages/fr.json"),
  en: () => import("../messages/en.json"),
};

// next-intl (App Router, mode « sans routing ») : la locale provient du cookie `NEXT_LOCALE`.
// Au tout premier accès, le cookie n'est pas encore lisible sur la requête courante ; le
// middleware a alors posé un en-tête interne (`x-next-locale`) issu de la négociation
// Accept-Language. Repli final : `fr`.
export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const headerStore = await headers();
  const fromCookie = cookieStore.get(LOCALE_COOKIE)?.value;
  const fromHeader = headerStore.get(LOCALE_HEADER);
  const candidate = fromCookie ?? fromHeader ?? defaultLocale;
  const locale: Locale = isLocale(candidate) ? candidate : defaultLocale;

  const messages = (await loaders[locale]()).default;
  return { locale, messages };
});
