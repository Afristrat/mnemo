"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState, type ReactElement } from "react";
import { Button } from "@/components/ui/Button";
import type { Profile } from "@/lib/engine";
import { STORAGE_KEY } from "@/lib/wizard/defaultProfile";

// Intake libre (S-038) : l'utilisateur décrit son besoin en langage naturel (ou à la voix) ; la route
// /api/llm/intake fait extraire + VALIDER/BORNER un Profile (le LLM ne calcule rien), qu'on persiste
// dans la source de vérité (localStorage) avant d'ouvrir le configurateur pré-rempli. Saisie manuelle
// toujours disponible (repli si le LLM est indisponible).

// Web Speech API (dictée « si dispo ») — typage minimal, sans `any`, via augmentation de Window.
type SpeechAlternative = { transcript: string };
type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  onresult: ((event: { results: ArrayLike<ArrayLike<SpeechAlternative>> }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  }
}

function speechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;
}

type IntakeResponse = { profile?: Profile; applied?: string[]; rejected?: string[] };

type State =
  | { kind: "idle" }
  | { kind: "busy" }
  | { kind: "error" };

export function IntakeField(): ReactElement {
  const router = useRouter();
  const t = useTranslations("Intake");
  const locale = useLocale();
  const [text, setText] = useState("");
  const [state, setState] = useState<State>({ kind: "idle" });
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const analyse = useCallback(async (): Promise<void> => {
    if (text.trim() === "") return;
    setState({ kind: "busy" });
    try {
      const res = await fetch("/api/llm/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) {
        setState({ kind: "error" });
        return;
      }
      const data: IntakeResponse = await res.json();
      if (data.profile !== undefined) {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(data.profile));
        } catch {
          /* stockage indisponible : le configurateur retombera sur le profil par défaut. */
        }
      }
      // Le configurateur (route distincte) se monte à neuf et réhydrate depuis localStorage.
      router.push("/configurateur");
    } catch {
      setState({ kind: "error" });
    }
  }, [text, router]);

  const toggleDictation = useCallback((): void => {
    const Ctor = speechRecognitionCtor();
    if (Ctor === null) return;
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const rec = new Ctor();
    rec.lang = locale === "en" ? "en-US" : "fr-FR";
    rec.interimResults = false;
    rec.onresult = (event): void => {
      let transcript = "";
      for (let i = 0; i < event.results.length; i += 1) {
        const alt = event.results[i]?.[0];
        if (alt !== undefined) transcript += alt.transcript;
      }
      setText((prev) => (prev === "" ? transcript : `${prev} ${transcript}`));
    };
    rec.onend = (): void => setListening(false);
    recognitionRef.current = rec;
    rec.start();
    setListening(true);
  }, [listening, locale]);

  const dictationAvailable = speechRecognitionCtor() !== null;

  return (
    <div className="w-full max-w-2xl text-left">
      <label htmlFor="intake-text" className="text-label-caps uppercase text-on-surface-variant">
        {t("label")}
      </label>
      <textarea
        id="intake-text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        placeholder={t("placeholder")}
        className="mt-2 w-full rounded-input border border-outline-variant bg-surface p-3 text-body-md text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      />
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button onClick={() => void analyse()} disabled={state.kind === "busy" || text.trim() === ""}>
          {state.kind === "busy" ? t("analyzing") : t("analyze")}
        </Button>
        {dictationAvailable ? (
          <button
            type="button"
            onClick={toggleDictation}
            aria-pressed={listening}
            className="rounded-full border border-outline-variant px-4 py-2 text-body-sm font-medium text-on-surface transition-colors hover:bg-surface-container"
          >
            {listening ? t("listening") : t("dictate")}
          </button>
        ) : null}
      </div>
      {state.kind === "error" ? (
        <p className="mt-2 text-body-sm text-error">{t("error")}</p>
      ) : null}
      <p className="mt-2 text-body-sm text-on-surface-variant">{t("disclaimer")}</p>
    </div>
  );
}
