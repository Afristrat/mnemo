"use client";

import { useState, type ReactElement } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { Profile, Recommendation } from "@/lib/engine";

type ExitEscrowProps = {
  profile: Profile;
  recommendation: Recommendation;
};

/**
 * Exit Escrow (F7, moat ①) : télécharge un bundle de redéploiement reproductible.
 * fflate + le générateur sont importés dynamiquement (hors bundle initial).
 */
export function ExitEscrow({ profile, recommendation }: ExitEscrowProps): ReactElement {
  const [busy, setBusy] = useState(false);

  const download = async (): Promise<void> => {
    setBusy(true);
    try {
      const [{ buildExitBundle }, { zipBundle }] = await Promise.all([
        import("@/lib/exit/bundle"),
        import("@/lib/exit/zip"),
      ]);
      const bundle = buildExitBundle(profile, recommendation);
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
      <h2 className="font-display text-headline-md text-on-surface">Exit Escrow — emporter toute la stack</h2>
      <p className="mt-1 max-w-2xl text-body-sm text-on-surface-variant">
        Téléchargez un bundle reproductible : IaC (Compose + Terraform), squelette de coffre, runbook,
        scripts de ré-embedding et de backup. La recette est ouverte — vous pouvez tout redéployer
        ailleurs, sans Mnémo. Zéro vendor lock-in, par construction.
      </p>
      <div className="mt-4">
        <Button variant="primary" onClick={() => void download()} disabled={busy}>
          {busy ? "Génération du bundle…" : "Télécharger le bundle (.zip)"}
        </Button>
      </div>
    </Card>
  );
}
