"use client";

import { useTranslations } from "next-intl";
import { useCallback, useState, type ReactElement } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { Recommendation } from "@/lib/engine";
import { useEngineText } from "@/lib/i18n/engine";
import { serializeRecoFacts, type ChatTurn, type OtherPrecisions } from "@/lib/llm/assistant";
import type { WebSearchResult } from "@/lib/pricing/scraper";

// Assistant Q&A contextuel (S-040). Le panneau envoie la question + l'historique + les FAITS de la
// recommandation AFFICHÉE (chiffres autoritatifs) à /api/llm/chat. DÉFCON 1 : l'assistant ne cite que
// ces faits ou des résultats web sourcés (URL) ; disclaimer IA visible. Repli gracieux si LLM KO.

type Source = WebSearchResult;
type Message = { role: "user" | "assistant"; content: string; sources?: Source[] };
type ChatResponse = { ok?: boolean; answer?: string; reason?: string; sources?: Source[] };

export function AssistantPanel({
  reco,
  otherPrecisions,
}: {
  reco: Recommendation;
  /** Précisions libres « Autre » du profil (S-064), greffées aux FAITS comme CONTEXTE qualitatif. */
  otherPrecisions?: OtherPrecisions;
}): ReactElement {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const resolveEngine = useEngineText();
  const t = useTranslations("Assistant");

  const send = useCallback(async (): Promise<void> => {
    const question = input.trim();
    if (question === "" || busy) return;
    const history: ChatTurn[] = messages.map((m) => ({ role: m.role, content: m.content }));
    setMessages((prev) => [...prev, { role: "user", content: question }]);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/llm/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, history, recoFacts: serializeRecoFacts(reco, resolveEngine, otherPrecisions) }),
      });
      const data: ChatResponse = await res.json();
      if (res.ok && data.ok === true && typeof data.answer === "string") {
        setMessages((prev) => [...prev, { role: "assistant", content: data.answer ?? "", sources: data.sources }]);
      } else {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: t("unavailable") },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: t("connectionError") },
      ]);
    }
    setBusy(false);
  }, [input, busy, messages, reco, resolveEngine, otherPrecisions, t]);

  return (
    <Card>
      <h2 className="font-display text-headline-md text-on-surface">{t("title")}</h2>
      <p className="mt-1 text-body-sm text-on-surface-variant">{t("intro")}</p>

      {messages.length > 0 ? (
        <ul className="mt-4 space-y-3">
          {messages.map((m, i) => (
            <li
              key={i}
              className={
                m.role === "user"
                  ? "rounded-card bg-primary/5 p-3 text-body-md text-on-surface"
                  : "rounded-card bg-surface-container p-3 text-body-md text-on-surface"
              }
            >
              <span className="block text-label-caps uppercase text-on-surface-variant">
                {m.role === "user" ? t("you") : t("assistant")}
              </span>
              <p className="mt-1 whitespace-pre-wrap">{m.content}</p>
              {m.sources !== undefined && m.sources.length > 0 ? (
                <ul className="mt-2 space-y-1">
                  {m.sources.map((s) => (
                    <li key={s.url} className="text-body-sm">
                      <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-secondary underline decoration-dotted">
                        {s.title === "" ? s.url : s.title}
                      </a>
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          rows={2}
          placeholder={t("placeholder")}
          className="min-w-0 flex-1 rounded-input bg-surface-container p-3 text-body-md text-on-surface ring-1 ring-outline/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        />
        <Button onClick={() => void send()} disabled={busy || input.trim() === ""}>
          {busy ? t("sending") : t("send")}
        </Button>
      </div>
    </Card>
  );
}
