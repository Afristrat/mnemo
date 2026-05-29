import { render as rtlRender, type RenderOptions } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactElement, ReactNode } from "react";
import messages from "@/messages/fr.json";

// Rendu de test enveloppé du provider next-intl (S-058) : les composants migrés appellent
// `useTranslations`/`useEngineText` → exigent un contexte intl. On fournit les messages `fr`
// (locale par défaut) pour que les assertions existantes (texte français) restent valides.
// Drop-in : on ré-exporte tout @testing-library/react, `render` local prime sur le star-export.

function Providers({ children }: { children: ReactNode }): ReactElement {
  return (
    <NextIntlClientProvider locale="fr" messages={messages}>
      {children}
    </NextIntlClientProvider>
  );
}

export function render(
  ui: ReactElement,
  options?: Omit<RenderOptions, "wrapper">,
): ReturnType<typeof rtlRender> {
  return rtlRender(ui, { wrapper: Providers, ...options });
}

export * from "@testing-library/react";
