"use client";

import { useTranslations } from "next-intl";
import { useState, type ReactElement } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import type { Profile, Recommendation } from "@/lib/engine";
import type { SourcedEvidence } from "@/lib/evidence/types";

// Feature A — citations sourcées vérifiables. Confronte les affirmations dures de la reco aux sources
// publiques (SearXNG+LLM côté serveur), horodatées. DÉFCON 1 : rien trouvé = « non attesté » assumé.

type Props = { profile: Profile; recommendation: Recommendation };

export function EvidenceCitationsPanel({ profile }: Props): ReactElement {
  const t = useTranslations("Results.evidenceCitations");
  const [items, setItems] = useState<SourcedEvidence[] | null>(null);
  const [hash, setHash] = useState("");
  const [busy, setBusy] = useState(false);

  const run = async (): Promise<void> => {
    setBusy(true);
    try {
      const res = await fetch("/api/evidence/citations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile }),
      });
      if (!res.ok) return;
      const json: unknown = await res.json();
      if (typeof json === "object" && json !== null && Array.isArray((json as { items?: unknown }).items)) {
        const data = json as { items: SourcedEvidence[]; integrityHash?: string };
        setItems(data.items);
        setHash(typeof data.integrityHash === "string" ? data.integrityHash : "");
      }
    } finally {
      setBusy(false);
    }
  };

  const download = async (): Promise<void> => {
    if (items === null) return;
    const { buildEvidencePack } = await import("@/lib/evidence/pack");
    const { markdown } = await buildEvidencePack(items, t("title"));
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sources-et-preuves.md";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <h2 className="font-display text-headline-md text-on-surface">{t("title")}</h2>
      <p className="mt-1 max-w-2xl text-body-sm text-on-surface-variant">{t("intro")}</p>
      <Button variant="primary" onClick={() => void run()} disabled={busy} className="mt-3">
        {busy ? t("running") : t("runButton")}
      </Button>

      {items !== null ? (
        <div className="mt-4 space-y-2" role="status">
          {items.map((ev, i) => (
            <div
              key={`${ev.claim.subject}-${i}`}
              className="rounded-card border border-outline-variant bg-surface p-3 text-body-sm"
            >
              <p className="font-medium text-on-surface">{ev.claim.subject}</p>
              <p className="text-on-surface-variant">
                {ev.verdict === "attested" ? `✅ ${t("verdictAttested")}` : `◻️ ${t("verdictUnattested")}`} ·{" "}
                {t("confidence", { level: ev.confidence })}
              </p>
              {ev.sources.length > 0 ? (
                <ul className="mt-1 list-disc ps-5">
                  {ev.sources.map((s) => (
                    <li key={s.url}>
                      <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-primary underline">
                        {s.title || s.url}
                      </a>
                      <span className="text-on-surface-variant"> — {s.retrievedAt}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-on-surface-variant/80">{t("noSources")}</p>
              )}
            </div>
          ))}
          {hash !== "" ? <p className="font-mono text-xs text-on-surface-variant">{t("integrity", { hash })}</p> : null}
          <Button variant="secondary" onClick={() => void download()} className="mt-2">
            {t("downloadEvidence")}
          </Button>
        </div>
      ) : null}
      <p className="mt-2 text-body-sm text-on-surface-variant/80">{t("disclaimer")}</p>
    </Card>
  );
}
