"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useTransition, type ChangeEvent, type ReactElement } from "react";
import { LOCALE_COOKIE, localeNames, locales } from "@/i18n/config";
import { cn } from "@/lib/utils/cn";

// Sélecteur de langue (S-057). Mode « sans routing » : on persiste la locale dans le
// cookie `NEXT_LOCALE` puis on rafraîchit l'arbre RSC (`router.refresh()`) — équivalent
// moderne du reload, la request config relit le cookie au nouveau rendu serveur.
// Accessible : `<select>` natif étiqueté (clavier + lecteurs d'écran d'emblée).
export function LocaleSwitcher({ className }: { className?: string }): ReactElement {
  const locale = useLocale();
  const t = useTranslations("LocaleSwitcher");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleChange(event: ChangeEvent<HTMLSelectElement>): void {
    const next = event.target.value;
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <label className={cn("inline-flex items-center", className)}>
      <span className="sr-only">{t("label")}</span>
      <select
        value={locale}
        onChange={handleChange}
        disabled={isPending}
        aria-label={t("label")}
        className="rounded-full border border-outline-variant bg-surface-container-lowest px-3 py-1.5 text-body-sm text-on-surface transition-colors hover:bg-surface-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        {locales.map((code) => (
          <option key={code} value={code}>
            {localeNames[code]}
          </option>
        ))}
      </select>
    </label>
  );
}
