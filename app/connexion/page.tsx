// Page de connexion : e-mail + mot de passe en methode principale (seule operationnelle en prod),
// magic-link et OAuth en options secondaires (fonctionneront une fois le backend configure).
"use client";

import { useState, type ReactElement } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";

export default function ConnexionPage(): ReactElement {
  const t = useTranslations("Account");
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const [sent, setSent] = useState(false);
  const origin = typeof window === "undefined" ? "" : window.location.origin;

  async function handlePassword(mode: "in" | "up"): Promise<void> {
    setError(false);
    const res =
      mode === "in"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });
    if (res.error !== null) {
      setError(true);
      return;
    }
    window.location.assign("/compte");
  }

  // Magic-link et OAuth passent par /auth/callback (échange du code PKCE contre une session) puis /compte.
  const callback = `${origin}/auth/callback?next=/compte`;

  async function handleMagicLink(): Promise<void> {
    setError(false);
    const res = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: callback },
    });
    if (res.error !== null) {
      setError(true);
      return;
    }
    setSent(true);
  }

  async function handleOauth(provider: "google" | "github"): Promise<void> {
    await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: callback },
    });
  }

  return (
    <main className="mx-auto max-w-md px-6 py-16">
      <h1 className="font-display text-headline-lg text-on-surface">{t("signIn")}</h1>
      <div className="mt-6 space-y-3">
        {/* Methode principale : e-mail + mot de passe */}
        <label className="block">
          <span className="text-label-caps uppercase text-on-surface-variant">{t("emailLabel")}</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-card border border-outline bg-surface px-3 py-2 text-on-surface"
          />
        </label>
        <label className="block">
          <span className="text-label-caps uppercase text-on-surface-variant">{t("passwordLabel")}</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-card border border-outline bg-surface px-3 py-2 text-on-surface"
          />
        </label>
        {error ? <p className="text-body-sm text-error">{t("authError")}</p> : null}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => void handlePassword("in")}
            disabled={email === "" || password === ""}
            className="rounded-card bg-primary px-4 py-2 text-on-primary disabled:opacity-50"
          >
            {t("withPassword")}
          </button>
          <button
            type="button"
            onClick={() => void handlePassword("up")}
            disabled={email === "" || password === ""}
            className="rounded-card border border-outline px-4 py-2 text-on-surface disabled:opacity-50"
          >
            {t("signUp")}
          </button>
        </div>

        {/* Magic-link (secondaire — backend non configure en prod) */}
        <div className="pt-2 text-center text-body-sm text-on-surface-variant">
          {t("orMagicLink")}
        </div>
        <button
          type="button"
          onClick={() => void handleMagicLink()}
          disabled={email === ""}
          className="w-full rounded-card border border-outline px-4 py-2 text-on-surface disabled:opacity-50"
        >
          {sent ? t("magicLinkSent") : t("sendMagicLink")}
        </button>

        {/* OAuth (secondaire — backend non configure en prod) */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => void handleOauth("google")}
            className="rounded-card border border-outline px-4 py-2 text-on-surface"
          >
            {t("oauthGoogle")}
          </button>
          <button
            type="button"
            onClick={() => void handleOauth("github")}
            className="rounded-card border border-outline px-4 py-2 text-on-surface"
          >
            {t("oauthGithub")}
          </button>
        </div>
      </div>
    </main>
  );
}
