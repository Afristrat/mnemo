import {
  render as rtlRender,
  screen,
  fireEvent,
  within,
  waitFor,
  act,
  cleanup,
  type RenderOptions,
} from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactElement, ReactNode } from "react";
import messages from "@/messages/fr.json";

// Rendu de test enveloppé du provider next-intl (S-058) : les composants migrés appellent
// `useTranslations`/`useEngineText` → exigent un contexte intl. On fournit les messages `fr`
// (locale par défaut) pour que les assertions existantes (texte français) restent valides.
// Ré-exports EXPLICITES (pas de `export *`, qui masquerait le `render` personnalisé selon le bundler).

function Providers({ children }: { children: ReactNode }): ReactElement {
  return (
    <NextIntlClientProvider locale="fr" messages={messages}>
      {children}
    </NextIntlClientProvider>
  );
}

function render(
  ui: ReactElement,
  options?: Omit<RenderOptions, "wrapper">,
): ReturnType<typeof rtlRender> {
  return rtlRender(ui, { wrapper: Providers, ...options });
}

export { render, screen, fireEvent, within, waitFor, act, cleanup };
