"use client";

import { useTranslations } from "next-intl";
import { useState, type ReactElement } from "react";
import { setNetworkConsent } from "@/app/actions/account";

// Gestion du consentement réseau (opt-in partage du coût réel, F9). Bascule via server action puis
// recharge pour refléter l'état persisté (trace RGPD horodatée côté serveur).
export function NetworkConsent({ consented }: { consented: boolean }): ReactElement {
  const t = useTranslations("Account");
  const [busy, setBusy] = useState(false);

  const toggle = async (): Promise<void> => {
    setBusy(true);
    try {
      await setNetworkConsent(!consented);
      window.location.reload();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3">
      <p className={`text-body-sm ${consented ? "text-tertiary" : "text-on-surface-variant"}`}>
        {consented ? t("consentActive") : t("consentInactive")}
      </p>
      <button
        type="button"
        disabled={busy}
        onClick={() => void toggle()}
        className="mt-2 rounded-card border border-outline px-4 py-2 text-body-sm text-on-surface disabled:opacity-50"
      >
        {consented ? t("consentDisable") : t("consentEnable")}
      </button>
    </div>
  );
}
