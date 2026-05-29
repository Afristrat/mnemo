"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState, type FormEvent, type ReactElement, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { isValidEmail, isValidName } from "@/lib/conversion/log";

// Lead gate (S-068) : enveloppe la recette EXPERTE (stack, carte de coûts, ensemble, radar, export,
// Exit Escrow). Tant que le lead n'est pas fourni, on affiche un formulaire nom + e-mail ; une fois
// fourni, on déverrouille les `children`. L'état « débloqué » est persisté en localStorage → on ne
// redemande JAMAIS à la même personne. La persistance serveur (/api/lead) est best-effort : un échec
// réseau NE bloque PAS l'utilisateur (on débloque quand même côté client — repli gracieux).

const UNLOCK_KEY = "strate.leadUnlocked.v1";

type LeadGateProps = {
  children: ReactNode;
  /** Preset courant, joint à la capture (facultatif, contexte commercial). */
  preset?: string;
};

function readUnlocked(): boolean {
  try {
    return localStorage.getItem(UNLOCK_KEY) === "1";
  } catch {
    return false;
  }
}

export function LeadGate({ children, preset }: LeadGateProps): ReactElement {
  const t = useTranslations("Results.leadGate");
  // Hydratation : on part VERROUILLÉ côté serveur/premier rendu (pas d'accès localStorage), puis on
  // relit l'état réel au montage → évite tout mismatch d'hydratation.
  const [unlocked, setUnlocked] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setUnlocked(readUnlocked());
  }, []);

  const persistUnlock = useCallback((): void => {
    try {
      localStorage.setItem(UNLOCK_KEY, "1");
    } catch {
      /* localStorage indisponible : on déverrouille quand même pour la session courante. */
    }
    setUnlocked(true);
  }, []);

  const submit = useCallback(
    async (event: FormEvent<HTMLFormElement>): Promise<void> => {
      event.preventDefault();
      setTouched(true);
      if (!isValidName(name) || !isValidEmail(email) || busy) return;
      setBusy(true);
      try {
        // Best-effort : on tente la persistance serveur mais on ne bloque jamais l'utilisateur dessus.
        await fetch("/api/lead", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email, preset }),
        });
      } catch {
        /* repli gracieux : panne réseau → on débloque quand même côté client. */
      } finally {
        persistUnlock();
        setBusy(false);
      }
    },
    [name, email, busy, preset, persistUnlock],
  );

  if (unlocked) return <>{children}</>;

  const nameError = touched && !isValidName(name);
  const emailError = touched && !isValidEmail(email);

  return (
    <Card>
      <h2 className="font-display text-headline-md text-on-surface">{t("title")}</h2>
      <p className="mt-1 max-w-2xl text-body-md text-on-surface-variant">{t("desc")}</p>

      <form className="mt-6 grid max-w-xl gap-4" onSubmit={(e) => void submit(e)} noValidate>
        <div>
          <label htmlFor="lead-name" className="mb-1.5 block text-label-caps uppercase text-on-surface-variant">
            {t("nameLabel")}
          </label>
          <Input
            id="lead-name"
            type="text"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("namePlaceholder")}
            aria-invalid={nameError}
          />
          {nameError ? <p className="mt-1 text-body-sm text-error">{t("nameError")}</p> : null}
        </div>
        <div>
          <label htmlFor="lead-email" className="mb-1.5 block text-label-caps uppercase text-on-surface-variant">
            {t("emailLabel")}
          </label>
          <Input
            id="lead-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("emailPlaceholder")}
            aria-invalid={emailError}
          />
          {emailError ? <p className="mt-1 text-body-sm text-error">{t("emailError")}</p> : null}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? t("submitting") : t("submit")}
          </Button>
          <span className="text-body-sm text-on-surface-variant">{t("hint")}</span>
        </div>
      </form>
    </Card>
  );
}
