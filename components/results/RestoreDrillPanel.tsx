"use client";

import { useTranslations } from "next-intl";
import { useState, type ReactElement } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useEngineText } from "@/lib/i18n/engine";
import { verifyCertificate, type RestoreVerdict } from "@/lib/restore-drill/certificate";
import type { Profile, Recommendation } from "@/lib/engine";

// Restore Drill certifié (moat « chaîne de preuve », vague 2 #2) : la sortie Exit Escrow devient TESTABLE.
// Deux modes (A local sur données réelles, B CI jetable sur données synthétiques) expliqués à l'utilisateur.
// Strate ne fabrique JAMAIS de RTO : elle fournit le kit (dans le bundle) et VÉRIFIE le certificat produit.

type RestoreDrillPanelProps = { profile: Profile; recommendation: Recommendation };

export function RestoreDrillPanel({ profile, recommendation }: RestoreDrillPanelProps): ReactElement {
  const t = useTranslations("Results.restoreDrill");
  const resolve = useEngineText();
  const [busy, setBusy] = useState(false);
  const [raw, setRaw] = useState("");
  const [verdict, setVerdict] = useState<RestoreVerdict | null>(null);
  const [sealedJson, setSealedJson] = useState<string | null>(null);

  const downloadKit = async (): Promise<void> => {
    setBusy(true);
    try {
      const [{ buildExitBundle }, { zipBundle }, { buildRestoreDrillKit }] = await Promise.all([
        import("@/lib/exit/bundle"),
        import("@/lib/exit/zip"),
        import("@/lib/restore-drill/kit"),
      ]);
      const { manifest } = buildExitBundle(profile, recommendation, undefined, undefined, resolve);
      const kit = buildRestoreDrillKit(recommendation, manifest);
      const blob = new Blob([Uint8Array.from(zipBundle({ files: kit, manifest }))], { type: "application/zip" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "restore-drill-kit.zip";
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setBusy(false);
    }
  };

  // Un certificat de drill arrive SANS empreinte → on le SCELLE (calcul SHA-256 → artefact opposable
  // téléchargeable). Un certificat déjà scellé (avec empreinte) → on le VÉRIFIE (re-hash + comparaison).
  const verify = async (): Promise<void> => {
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = null;
    }
    const alreadySealed = typeof parsed === "object" && parsed !== null && typeof (parsed as { integrityHash?: unknown }).integrityHash === "string";
    if (alreadySealed) {
      setSealedJson(null);
      setVerdict(await verifyCertificate(parsed));
    } else {
      const { sealCertificate } = await import("@/lib/restore-drill/certificate");
      const { sealedJson: sealed, verdict: v } = await sealCertificate(parsed);
      setSealedJson(sealed);
      setVerdict(v);
    }
  };

  const downloadSealed = (): void => {
    if (sealedJson === null) return;
    const blob = new Blob([sealedJson], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "restore-certificate.sealed.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <h2 className="font-display text-headline-md text-on-surface">{t("title")}</h2>
      <p className="mt-1 max-w-2xl text-body-sm text-on-surface-variant">{t("intro")}</p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="rounded-card bg-surface-container p-4">
          <p className="text-label-caps uppercase text-on-surface-variant">{t("modeATitle")}</p>
          <p className="mt-1 text-body-sm text-on-surface">{t("modeADesc")}</p>
        </div>
        <div className="rounded-card bg-surface-container p-4">
          <p className="text-label-caps uppercase text-on-surface-variant">{t("modeBTitle")}</p>
          <p className="mt-1 text-body-sm text-on-surface">{t("modeBDesc")}</p>
        </div>
      </div>

      <Button variant="secondary" onClick={() => void downloadKit()} disabled={busy} className="mt-4">
        {busy ? t("generating") : t("downloadKit")}
      </Button>

      <div className="mt-6">
        <label htmlFor="cert" className="text-label-caps uppercase text-on-surface-variant">
          {t("verifyTitle")}
        </label>
        <p className="mt-1 text-body-sm text-on-surface-variant">{t("verifyDesc")}</p>
        <textarea
          id="cert"
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          rows={5}
          placeholder={t("verifyPlaceholder")}
          className="mt-2 w-full rounded-card border border-outline-variant bg-surface p-3 font-mono text-xs text-on-surface"
        />
        <Button variant="primary" onClick={() => void verify()} disabled={raw.trim() === ""} className="mt-2">
          {t("verifyButton")}
        </Button>
      </div>

      {verdict !== null ? (
        <div
          className={`mt-4 rounded-card border p-4 text-body-sm ${verdict.valid ? "border-primary/40 bg-primary/5" : "border-error/40 bg-error/5"}`}
          role="status"
        >
          <p className={`font-medium ${verdict.valid ? "text-primary" : "text-error"}`}>
            {verdict.valid ? t("resultPass") : t("resultFail")}
          </p>
          <p className="mt-1 text-on-surface-variant">
            {t("resultLine", {
              rto: verdict.rtoMinutes ?? 0,
              dataset:
                verdict.dataset === null ? "—" : t(verdict.dataset === "real" ? "datasetReal" : "datasetSynthetic"),
              passed: verdict.passedCount,
              total: verdict.totalCount,
              integrity: verdict.integrityOk ? t("integrityOk") : t("integrityFail"),
            })}
          </p>
          {verdict.issues.length > 0 ? (
            <ul className="mt-2 list-disc space-y-1 ps-5 text-on-surface-variant">
              {verdict.issues.map((i) => (
                <li key={i}>{i}</li>
              ))}
            </ul>
          ) : null}
          {sealedJson !== null ? (
            <div className="mt-3">
              <p className="text-on-surface-variant/80">{t("sealedNote")}</p>
              <Button variant="secondary" onClick={downloadSealed} className="mt-2">
                {t("downloadSealed")}
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}
