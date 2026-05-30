"use client";

import { useTranslations } from "next-intl";
import { QRCodeSVG } from "qrcode.react";
import { useCallback, useMemo, useState, type ReactElement } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { encodeProfileToParam } from "@/lib/share";
import type { Profile } from "@/lib/engine";

// Partage de la recommandation (S-067). Deux mécanismes complémentaires :
//   1) Lien ENCODÉ (instantané, stateless) : le Profile courant est sérialisé en base64 URL-safe dans
//      `/resultats?p=<...>`. Aucun aller-retour réseau, rejoue exactement le profil sur une autre session.
//   2) Lien COURT (Supabase) : POST /api/share stocke le profil encodé → renvoie un id imprévisible ;
//      le lien `/resultats?s=<id>` recharge le profil par cet id (RPC SECURITY DEFINER).
// Le profil partagé est celui AFFICHÉ (la projection courante). Aucun secret côté client.

type CreateResponse = { id?: string; error?: string };

export function SharePanel({ profile }: { profile: Profile }): ReactElement {
  const t = useTranslations("Results.share");
  const [copied, setCopied] = useState<"none" | "encoded" | "short">("none");
  const [shortBusy, setShortBusy] = useState(false);
  const [shortError, setShortError] = useState(false);
  const [shortUrl, setShortUrl] = useState<string | null>(null);

  // Lien encodé construit côté client (origine courante + profil sérialisé). Recalculé si le profil change.
  const encodedUrl = useMemo(() => {
    const param = encodeProfileToParam(profile);
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return `${origin}/resultats?p=${param}`;
  }, [profile]);

  const copy = useCallback(async (text: string, which: "encoded" | "short"): Promise<void> => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which);
      window.setTimeout(() => setCopied("none"), 2500);
    } catch {
      /* presse-papier indisponible : l'utilisateur peut sélectionner le lien affiché. */
    }
  }, []);

  const createShort = useCallback(async (): Promise<void> => {
    if (shortBusy) return;
    setShortBusy(true);
    setShortError(false);
    try {
      const res = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ encoded: encodeProfileToParam(profile) }),
      });
      const data: CreateResponse = await res.json();
      if (!res.ok || typeof data.id !== "string") {
        setShortError(true);
        return;
      }
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      setShortUrl(`${origin}/resultats?s=${data.id}`);
    } catch {
      setShortError(true);
    } finally {
      setShortBusy(false);
    }
  }, [profile, shortBusy]);

  return (
    <Card>
      <h2 className="font-display text-headline-md text-on-surface">{t("title")}</h2>
      <p className="mt-1 text-body-sm text-on-surface-variant">{t("desc")}</p>

      {/* Lien encodé (instantané) */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button variant="primary" size="sm" onClick={() => void copy(encodedUrl, "encoded")}>
          {copied === "encoded" ? t("copied") : t("copyLink")}
        </Button>
        <span className="text-body-sm text-on-surface-variant">{t("copyHint")}</span>
      </div>

      {/* Lien court (Supabase) */}
      <div className="mt-4 border-t border-outline-variant pt-4">
        {shortUrl === null ? (
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="secondary" size="sm" onClick={() => void createShort()} disabled={shortBusy}>
              {shortBusy ? t("creating") : t("createShort")}
            </Button>
            <span className="text-body-sm text-on-surface-variant">{t("shortHint")}</span>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <code className="break-all rounded-card bg-surface-container px-3 py-1.5 font-mono text-body-sm text-on-surface">
                {shortUrl}
              </code>
              <Button variant="secondary" size="sm" onClick={() => void copy(shortUrl, "short")}>
                {copied === "short" ? t("copied") : t("copyShort")}
              </Button>
            </div>
            {/* QR code du lien COURT uniquement (le lien encodé est trop long pour un QR fiable). Rendu
                localement (qrcode.react), sans appel externe. Fond blanc + modules sombres = lisibilité. */}
            <div className="flex items-center gap-4">
              <div className="shrink-0 rounded-card bg-white p-3">
                <QRCodeSVG value={shortUrl} size={120} marginSize={0} title={t("qrHint")} />
              </div>
              <span className="text-body-sm text-on-surface-variant">{t("qrHint")}</span>
            </div>
          </div>
        )}
        {shortError ? <p className="mt-2 text-body-sm text-error">{t("shortError")}</p> : null}
      </div>
    </Card>
  );
}
