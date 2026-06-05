"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState, type ReactElement } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useEngineText } from "@/lib/i18n/engine";
import type { Catalog } from "@/lib/catalog";
import type { Profile, Recommendation } from "@/lib/engine";

// MBOM — Memory-Base Bill of Materials (moat « chaîne de preuve », vague 2 #6) : manifeste signé type SBOM
// (composants sourcés + checksum SHA-256 par fichier + empreinte globale). Construit en async à partir du
// bundle Exit Escrow déjà généré (zéro régression). DÉFCON 1 : checksums calculés, licences non fabriquées.

type MbomPanelProps = { profile: Profile; recommendation: Recommendation; catalog?: Catalog };

export function MbomPanel({ profile, recommendation, catalog }: MbomPanelProps): ReactElement {
  const t = useTranslations("Results.mbom");
  const resolve = useEngineText();
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<{ components: number; files: number; hash: string } | null>(null);

  // Aperçu : nombre de composants + fichiers + empreinte (build léger au montage et sur changement).
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [{ buildExitBundle }, { buildMbom }] = await Promise.all([
        import("@/lib/exit/bundle"),
        import("@/lib/mbom/manifest"),
      ]);
      const bundle = buildExitBundle(profile, recommendation, undefined, catalog, resolve);
      const mbom = await buildMbom(bundle);
      if (!cancelled) setSummary({ components: mbom.components.length, files: mbom.files.length, hash: mbom.integrityHash });
    })();
    return () => {
      cancelled = true;
    };
  }, [profile, recommendation, catalog, resolve]);

  const download = async (format: "md" | "json"): Promise<void> => {
    setBusy(true);
    try {
      const [{ buildExitBundle }, { buildMbom }, { renderMbomMarkdown }] = await Promise.all([
        import("@/lib/exit/bundle"),
        import("@/lib/mbom/manifest"),
        import("@/lib/mbom/render"),
      ]);
      const bundle = buildExitBundle(profile, recommendation, undefined, catalog, resolve);
      const mbom = await buildMbom(bundle);
      const content = format === "md" ? renderMbomMarkdown(mbom, (k, v) => t(k, v)) : JSON.stringify(mbom, null, 2) + "\n";
      const mime = format === "md" ? "text/markdown;charset=utf-8" : "application/json;charset=utf-8";
      const blob = new Blob([content], { type: mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `mbom.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <h2 className="font-display text-headline-md text-on-surface">{t("title")}</h2>
      <p className="mt-1 max-w-2xl text-body-sm text-on-surface-variant">{t("intro")}</p>

      {summary !== null ? (
        <p className="mt-3 text-body-sm text-on-surface">
          {t("summary", { components: summary.components, files: summary.files })}
        </p>
      ) : null}
      {summary !== null ? (
        <p className="mt-1 break-all font-mono text-xs text-on-surface-variant">sha256:{summary.hash}</p>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button variant="primary" onClick={() => void download("md")} disabled={busy}>
          {busy ? t("generating") : t("downloadMd")}
        </Button>
        <Button variant="secondary" onClick={() => void download("json")} disabled={busy}>
          {t("downloadJson")}
        </Button>
      </div>
      <p className="mt-2 text-body-sm text-on-surface-variant/80">{t("disclaimer")}</p>
    </Card>
  );
}
