"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState, type ReactElement } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useEngineText } from "@/lib/i18n/engine";
import type { Catalog } from "@/lib/catalog";
import type { Profile, Recommendation } from "@/lib/engine";
import type { Mbom } from "@/lib/mbom/manifest";
import type { MbomSignature } from "@/lib/mbom/signature";

// MBOM — Memory-Base Bill of Materials (moat « chaîne de preuve », vague 2 #6 + vague 3 T2) : manifeste type
// SBOM (composants sourcés + checksum SHA-256 par fichier + empreinte globale) que l'on peut désormais SIGNER
// (Ed25519, authenticité — au-delà de l'intégrité). Construit UNE fois à partir du bundle Exit Escrow ; la
// signature porte sur l'empreinte figée. La vérification tourne côté client avec la seule clé publique.

type MbomPanelProps = { profile: Profile; recommendation: Recommendation; catalog?: Catalog };

type SignState = "idle" | "unavailable" | "error";
type VerifyState = { valid: boolean; keyTrusted: boolean; signedAt: string } | "invalid" | null;

export function MbomPanel({ profile, recommendation, catalog }: MbomPanelProps): ReactElement {
  const t = useTranslations("Results.mbom");
  const resolve = useEngineText();
  const [mbom, setMbom] = useState<Mbom | null>(null);
  const [signature, setSignature] = useState<MbomSignature | null>(null);
  const [signing, setSigning] = useState(false);
  const [signState, setSignState] = useState<SignState>("idle");
  const [busy, setBusy] = useState(false);
  const [verifyInput, setVerifyInput] = useState("");
  const [verifyResult, setVerifyResult] = useState<VerifyState>(null);

  // Construit le MBOM une seule fois (empreinte figée) ; toute évolution des entrées le reconstruit et
  // invalide la signature précédente (l'empreinte change).
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [{ buildExitBundle }, { buildMbom }] = await Promise.all([
        import("@/lib/exit/bundle"),
        import("@/lib/mbom/manifest"),
      ]);
      const bundle = buildExitBundle(profile, recommendation, undefined, catalog, resolve);
      const m = await buildMbom(bundle);
      if (!cancelled) {
        setMbom(m);
        setSignature(null);
        setSignState("idle");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [profile, recommendation, catalog, resolve]);

  const sign = async (): Promise<void> => {
    if (mbom === null) return;
    setSigning(true);
    setSignState("idle");
    try {
      const res = await fetch("/api/mbom/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ integrityHash: mbom.integrityHash }),
      });
      if (res.status === 503) {
        setSignState("unavailable");
        return;
      }
      if (!res.ok) {
        setSignState("error");
        return;
      }
      const data: { signature?: MbomSignature } = await res.json();
      setSignature(data.signature ?? null);
    } catch {
      setSignState("error");
    } finally {
      setSigning(false);
    }
  };

  const download = async (format: "md" | "json"): Promise<void> => {
    if (mbom === null) return;
    setBusy(true);
    try {
      const { renderMbomMarkdown } = await import("@/lib/mbom/render");
      const doc = signature !== null ? { ...mbom, signature } : mbom;
      const content =
        format === "md"
          ? renderMbomMarkdown(mbom, (k, v) => t(k, v), signature ?? undefined)
          : JSON.stringify(doc, null, 2) + "\n";
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

  const verify = async (): Promise<void> => {
    setVerifyResult(null);
    try {
      const { parseSignedMbom, verifyMbomSignature } = await import("@/lib/mbom/signature");
      const parsed = parseSignedMbom(JSON.parse(verifyInput));
      if (parsed === null) {
        setVerifyResult("invalid");
        return;
      }
      const r = await verifyMbomSignature(parsed);
      setVerifyResult({ valid: r.valid, keyTrusted: r.keyTrusted, signedAt: parsed.signature.signedAt });
    } catch {
      setVerifyResult("invalid");
    }
  };

  return (
    <Card>
      <h2 className="font-display text-headline-md text-on-surface">{t("title")}</h2>
      <p className="mt-1 max-w-2xl text-body-sm text-on-surface-variant">{t("intro")}</p>

      {mbom !== null ? (
        <p className="mt-3 text-body-sm text-on-surface">
          {t("summary", { components: mbom.components.length, files: mbom.files.length })}
        </p>
      ) : null}
      {mbom !== null ? (
        <p className="mt-1 break-all font-mono text-xs text-on-surface-variant">sha256:{mbom.integrityHash}</p>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button variant="primary" onClick={() => void download("md")} disabled={busy || mbom === null}>
          {busy ? t("generating") : t("downloadMd")}
        </Button>
        <Button variant="secondary" onClick={() => void download("json")} disabled={busy || mbom === null}>
          {t("downloadJson")}
        </Button>
        <Button variant="secondary" onClick={() => void sign()} disabled={signing || mbom === null}>
          {signing ? t("signing") : t("signButton")}
        </Button>
      </div>

      {signature !== null ? (
        <p className="mt-2 break-all text-body-sm text-tertiary">
          {t("signed", { date: signature.signedAt })}
        </p>
      ) : null}
      {signState === "unavailable" ? (
        <p className="mt-2 text-body-sm text-on-surface-variant/80">{t("signUnavailable")}</p>
      ) : null}
      {signState === "error" ? <p className="mt-2 text-body-sm text-error">{t("signError")}</p> : null}

      <div className="mt-6 border-t border-outline-variant pt-4">
        <h3 className="font-display text-title-md text-on-surface">{t("verifyTitle")}</h3>
        <p className="mt-1 max-w-2xl text-body-sm text-on-surface-variant">{t("verifyIntro")}</p>
        <textarea
          value={verifyInput}
          onChange={(e) => setVerifyInput(e.target.value)}
          placeholder={t("verifyPlaceholder")}
          className="mt-3 h-28 w-full rounded-md border border-outline-variant bg-surface p-2 font-mono text-xs text-on-surface"
        />
        <div className="mt-3">
          <Button variant="secondary" onClick={() => void verify()} disabled={verifyInput.trim() === ""}>
            {t("verifyButton")}
          </Button>
        </div>
        {verifyResult === "invalid" ? (
          <p className="mt-2 text-body-sm text-error">{t("verifyMalformed")}</p>
        ) : null}
        {verifyResult !== null && verifyResult !== "invalid" ? (
          <p className={`mt-2 text-body-sm ${verifyResult.valid ? "text-tertiary" : "text-error"}`}>
            {verifyResult.valid
              ? t("verifyValid", { date: verifyResult.signedAt })
              : verifyResult.keyTrusted
                ? t("verifyTampered")
                : t("verifyUntrusted")}
          </p>
        ) : null}
      </div>

      <p className="mt-4 text-body-sm text-on-surface-variant/80">{t("disclaimer")}</p>
    </Card>
  );
}
