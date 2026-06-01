"use client";

import { useTranslations } from "next-intl";
import { useState, type ReactElement } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { Profile, Recommendation } from "@/lib/engine";

// Guaranteed Migration / In-Switch (Lot 3 F14, S-085) : télécharge un bundle de migration (double-run
// + critères de bascule + rollback garanti). fflate + générateur importés dynamiquement.

export function MigrationBundle({ profile, recommendation }: { profile: Profile; recommendation: Recommendation }): ReactElement {
  const [busy, setBusy] = useState(false);
  const t = useTranslations("Results.migrationBundle");

  const download = async (): Promise<void> => {
    setBusy(true);
    try {
      const { buildMigrationBundle, zipMigrationBundle } = await import("@/lib/migration/bundle");
      const generatedAt = new Date().toISOString().slice(0, 10);
      const bundle = buildMigrationBundle(profile, recommendation, { generatedAt });
      const blob = new Blob([Uint8Array.from(zipMigrationBundle(bundle))], { type: "application/zip" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `mnemo-migration-bundle-${generatedAt}.zip`;
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
      <div className="mt-4">
        <Button variant="primary" onClick={() => void download()} disabled={busy}>
          {busy ? t("generating") : t("download")}
        </Button>
      </div>
    </Card>
  );
}
