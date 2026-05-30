"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState, type ReactElement } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { Input } from "@/components/ui/Input";
import { createClient } from "@/lib/supabase/client";

// Console admin (S-053). Édition « tout éditable » (option C) : le super-admin réécrit librement le
// gabarit ; aucun garde-fou de contenu (les validateurs serveur bornent toujours la sortie). Les
// placeholders {{…}} sont remplis par le code au runtime. Repli sur le défaut si aucune version active.

type PromptMeta = { label: string; description: string; placeholders: string[] };
type PromptVersion = { id: string; promptKey: string; version: number; content: string; isActive: boolean; createdAt: string };
type AdminData = { keys: string[]; meta: Record<string, PromptMeta>; defaults: Record<string, string>; versions: PromptVersion[] };

function activeContent(data: AdminData, key: string): string {
  const active = data.versions.find((v) => v.promptKey === key && v.isActive);
  return active?.content ?? data.defaults[key] ?? "";
}

function AdminLogin(): ReactElement {
  const t = useTranslations("Admin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const signIn = useCallback(async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error: e } = await supabase.auth.signInWithPassword({ email, password });
      if (e !== null) {
        setError(t("signInRefused"));
        setBusy(false);
        return;
      }
      window.location.reload();
    } catch {
      setError(t("authUnavailable"));
      setBusy(false);
    }
  }, [email, password, t]);

  return (
    <Card>
      <h1 className="font-display text-headline-md text-on-surface">{t("loginTitle")}</h1>
      <p className="mt-1 text-body-md text-on-surface-variant">{t("loginDesc")}</p>
      <div className="mt-6 space-y-3">
        <Input type="email" placeholder={t("emailPlaceholder")} value={email} onChange={(e) => setEmail(e.target.value)} />
        <Input type="password" placeholder={t("passwordPlaceholder")} value={password} onChange={(e) => setPassword(e.target.value)} />
        {error !== null ? <p className="text-body-sm text-error">{error}</p> : null}
        <Button onClick={() => void signIn()} disabled={busy || email === "" || password === ""}>
          {busy ? t("signingIn") : t("signIn")}
        </Button>
      </div>
    </Card>
  );
}

function PromptEditor(): ReactElement {
  const t = useTranslations("Admin");
  const [data, setData] = useState<AdminData | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (): Promise<void> => {
    const res = await fetch("/api/admin/prompts", { cache: "no-store" });
    if (!res.ok) {
      setStatus(t("loadError"));
      return;
    }
    const next: AdminData = await res.json();
    setData(next);
    setSelected((prev) => prev ?? next.keys[0] ?? null);
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (data !== null && selected !== null) setDraft(activeContent(data, selected));
  }, [data, selected]);

  const save = useCallback(async (): Promise<void> => {
    if (selected === null) return;
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch("/api/admin/prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ promptKey: selected, content: draft }),
      });
      const body: { version?: number; error?: string } = await res.json();
      if (!res.ok) {
        setStatus(t("saveFail", { error: body.error ?? t("saveError") }));
      } else {
        setStatus(t("versionActivated", { version: body.version ?? t("versionUnknown") }));
        await load();
      }
    } catch {
      setStatus(t("networkFail"));
    }
    setBusy(false);
  }, [selected, draft, load, t]);

  if (data === null) return <p className="text-on-surface-variant">{t("loading")}</p>;

  const meta = selected !== null ? data.meta[selected] : undefined;
  const versionsForKey = selected !== null ? data.versions.filter((v) => v.promptKey === selected) : [];
  const activeVersion = versionsForKey.find((v) => v.isActive);
  const isDirty = selected !== null && draft !== activeContent(data, selected);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-headline-md text-on-surface">{t("promptsTitle")}</h1>
        <Button variant="ghost" size="sm" onClick={() => void createClient().auth.signOut().then(() => window.location.reload())}>
          {t("signOut")}
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {data.keys.map((key) => (
          <Button key={key} variant={key === selected ? "primary" : "secondary"} size="sm" onClick={() => setSelected(key)}>
            {data.meta[key]?.label ?? key}
          </Button>
        ))}
      </div>

      {selected !== null && meta !== undefined ? (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-body-lg text-on-surface">{meta.label}</h2>
            <span className="text-body-sm text-on-surface-variant">
              {activeVersion !== undefined ? t("activeVersion", { version: activeVersion.version }) : t("noActiveVersion")}
              {versionsForKey.length > 0 ? t("versionsCount", { count: versionsForKey.length }) : ""}
            </span>
          </div>
          <p className="mt-1 text-body-sm text-on-surface-variant">{meta.description}</p>
          {meta.placeholders.length > 0 ? (
            <p className="mt-2 flex flex-wrap items-center gap-2 text-body-sm text-on-surface-variant">
              {t("placeholdersIntro")}
              {meta.placeholders.map((p) => (
                <Chip key={p} tone="neutral">{`{{${p}}}`}</Chip>
              ))}
            </p>
          ) : null}
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={16}
            className="mt-3 w-full rounded-input bg-surface-container p-3 font-mono text-code-md text-on-surface ring-1 ring-outline/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
          />
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Button onClick={() => void save()} disabled={busy || !isDirty || draft.trim() === ""}>
              {busy ? t("activating") : t("activate")}
            </Button>
            {isDirty ? (
              <Button variant="ghost" size="sm" onClick={() => setDraft(activeContent(data, selected))}>
                {t("cancelChanges")}
              </Button>
            ) : null}
            {status !== null ? <span className="text-body-sm text-on-surface-variant">{status}</span> : null}
          </div>
          <p className="mt-3 text-body-sm text-on-surface-variant">{t("editableNote")}</p>
        </Card>
      ) : null}
    </div>
  );
}

export function AdminPrompts({
  authed,
  isSuperAdmin,
  email,
}: {
  authed: boolean;
  isSuperAdmin: boolean;
  email: string | null;
}): ReactElement {
  const t = useTranslations("Admin");
  if (!authed) return <AdminLogin />;
  if (!isSuperAdmin) {
    return (
      <Card>
        <h1 className="font-display text-headline-md text-on-surface">{t("accessDenied")}</h1>
        <p className="mt-1 text-body-md text-on-surface-variant">
          {t("notSuperAdmin", { email: email ?? "" })}
        </p>
        <Button
          className="mt-4"
          variant="ghost"
          size="sm"
          onClick={() => void createClient().auth.signOut().then(() => window.location.reload())}
        >
          {t("signOut")}
        </Button>
      </Card>
    );
  }
  return <PromptEditor />;
}
