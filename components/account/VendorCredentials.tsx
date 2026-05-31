// Composant client : liste les credentials vendeurs existants + formulaire d'ajout + bouton revoke.
// Les secrets ne sont jamais affichés (ils ne transitent pas par cette vue, qui n'expose que les metadonnees).
"use client";

import { useState, type ReactElement } from "react";
import { useTranslations } from "next-intl";
import { storeVendorCredential, revokeVendorCredential } from "@/app/actions/account";
import type { VendorCredentialMetaRow } from "@/lib/supabase/types";

type Props = { items: VendorCredentialMetaRow[] };

export function VendorCredentials({ items }: Props): ReactElement {
  const t = useTranslations("Account");
  const [provider, setProvider] = useState("");
  const [label, setLabel] = useState("");
  const [kind, setKind] = useState<"api_key" | "oauth_token">("api_key");
  const [secret, setSecret] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleAdd(): Promise<void> {
    setBusy(true);
    await storeVendorCredential({ provider, label, kind, secret });
    setSecret("");
    setBusy(false);
    window.location.reload();
  }

  return (
    <section className="mt-6">
      <h2 className="font-display text-headline-md text-on-surface">{t("vendorTitle")}</h2>
      <p className="mt-1 text-body-sm text-on-surface-variant">{t("vendorIntro")}</p>

      {/* Liste des credentials existants */}
      <ul className="mt-4 space-y-2">
        {items.length === 0 ? (
          <li className="text-body-sm text-on-surface-variant">{t("noCredentials")}</li>
        ) : null}
        {items.map((c) => (
          <li
            key={c.id}
            className="flex items-center justify-between rounded-card bg-surface-container p-3 text-body-sm"
          >
            <span className="text-on-surface">
              <strong>{c.provider}</strong> {"·"} {c.label} {"·"}{" "}
              {c.kind === "api_key" ? t("kindApiKey") : t("kindOauth")}
              {c.revoked_at !== null ? ` · ${t("revoked")}` : ""}
            </span>
            {c.revoked_at === null ? (
              <button
                type="button"
                onClick={() =>
                  void revokeVendorCredential(c.id).then(() => window.location.reload())
                }
                className="text-error"
              >
                {t("revoke")}
              </button>
            ) : null}
          </li>
        ))}
      </ul>

      {/* Formulaire d'ajout d'un nouveau credential */}
      <div className="mt-4 grid gap-2 rounded-card border border-outline p-4">
        <input
          placeholder={t("providerLabel")}
          value={provider}
          onChange={(e) => setProvider(e.target.value)}
          className="rounded-card border border-outline bg-surface px-3 py-2 text-on-surface"
        />
        <input
          placeholder={t("labelLabel")}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="rounded-card border border-outline bg-surface px-3 py-2 text-on-surface"
        />
        <select
          value={kind}
          onChange={(e) => {
            const v = e.target.value;
            if (v === "api_key" || v === "oauth_token") setKind(v);
          }}
          className="rounded-card border border-outline bg-surface px-3 py-2 text-on-surface"
        >
          <option value="api_key">{t("kindApiKey")}</option>
          <option value="oauth_token">{t("kindOauth")}</option>
        </select>
        <input
          type="password"
          placeholder={t("secretLabel")}
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          className="rounded-card border border-outline bg-surface px-3 py-2 text-on-surface"
        />
        <p className="text-xs text-on-surface-variant">{t("secretHint")}</p>
        <button
          type="button"
          onClick={() => void handleAdd()}
          disabled={busy || provider === "" || secret === ""}
          className="rounded-card bg-primary px-4 py-2 text-on-primary disabled:opacity-50"
        >
          {t("store")}
        </button>
      </div>
    </section>
  );
}
