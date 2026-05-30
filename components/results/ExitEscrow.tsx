"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState, type ReactElement } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { Catalog } from "@/lib/catalog";
import type { Profile, Recommendation } from "@/lib/engine";
import { useEngineText } from "@/lib/i18n/engine";

type ExitEscrowProps = {
  profile: Profile;
  recommendation: Recommendation;
  /** Catalogue retenu, figé dans manifest.catalog + catalog.json (rejouable) — S-037. */
  catalog?: Catalog;
};

/**
 * Exit Escrow (F7, moat ①) : télécharge un bundle de redéploiement reproductible.
 * fflate + le générateur sont importés dynamiquement (hors bundle initial).
 */
export function ExitEscrow({ profile, recommendation, catalog }: ExitEscrowProps): ReactElement {
  const [busy, setBusy] = useState(false);
  const resolveEngine = useEngineText();
  const t = useTranslations("Results.exitEscrow");

  const download = async (): Promise<void> => {
    setBusy(true);
    try {
      const [{ buildExitBundle }, { zipBundle }] = await Promise.all([
        import("@/lib/exit/bundle"),
        import("@/lib/exit/zip"),
      ]);
      const bundle = buildExitBundle(profile, recommendation, undefined, catalog, resolveEngine);
      // Uint8Array.from → vue adossée à un ArrayBuffer concret (BlobPart valide, sans `as`).
      const blob = new Blob([Uint8Array.from(zipBundle(bundle))], { type: "application/zip" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `mnemo-exit-bundle-${bundle.manifest.generatedAt}.zip`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <h2 className="font-display text-headline-md text-on-surface">{t("title")}</h2>
      <p className="mt-1 max-w-2xl text-body-sm text-on-surface-variant">{t("desc")}</p>
      <div className="mt-4 flex flex-wrap items-center gap-4">
        <Button variant="primary" onClick={() => void download()} disabled={busy}>
          {busy ? t("generating") : t("download")}
        </Button>
        <Link href="/fiduciaire" className="text-body-sm text-secondary underline decoration-dotted">
          {t("charter")}
        </Link>
      </div>
    </Card>
  );
}
