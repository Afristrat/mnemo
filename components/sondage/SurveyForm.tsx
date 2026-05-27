"use client";

import { useState, type ReactElement } from "react";

type Market = "maroc" | "ue" | "autre";

const CONJOINT_TASKS = [
  {
    a: "Déploiement UE · monitoring · support standard",
    b: "On-prem souverain · monitoring + recalibration · support prioritaire",
    priceA: 290,
    priceB: 690,
  },
  {
    a: "Hybride · déploiement seul · support standard",
    b: "UE · monitoring + recalibration + négo fournisseurs · support dédié",
    priceA: 190,
    priceB: 990,
  },
  {
    a: "On-prem · monitoring · support prioritaire",
    b: "UE · déploiement + monitoring · support standard",
    priceA: 1200,
    priceB: 490,
  },
] as const;

export function SurveyForm(): ReactElement {
  const [market, setMarket] = useState<Market>("ue");
  const [taille, setTaille] = useState("");
  const [role, setRole] = useState("");
  const [vw, setVw] = useState({ tooExpensive: "", tooCheap: "", expensiveOk: "", bargain: "" });
  const [choices, setChoices] = useState<Record<number, string>>({});
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");

  const setVwField = (k: keyof typeof vw, v: string): void => setVw((p) => ({ ...p, [k]: v }));

  const submit = async (): Promise<void> => {
    setStatus("sending");
    const meta = { market, taille: taille || null, role: role || null };
    try {
      const r1 = await fetch("/api/sondage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "van_westendorp", market, payload: vw, meta }),
      });
      const r2 = await fetch("/api/sondage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "conjoint", market, payload: { choices, tasks: CONJOINT_TASKS }, meta }),
      });
      setStatus(r1.ok && r2.ok ? "done" : "error");
    } catch {
      setStatus("error");
    }
  };

  if (status === "done") {
    return (
      <div className="rounded-2xl border border-teal-200 bg-teal-50 p-8 text-center">
        <p className="text-lg font-semibold text-teal-800">Merci ! 🙏</p>
        <p className="mt-2 text-sm text-slate-600">Votre avis nous aide à fixer un prix juste. Aucune donnée personnelle n’est conservée au-delà de ces réponses.</p>
      </div>
    );
  }

  const cur = market === "maroc" ? "MAD/mois" : "€/mois";
  const inputCls = "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-teal-500 focus:outline-none";
  const labelCls = "block text-sm font-medium text-slate-700";

  return (
    <div className="space-y-8">
      {/* Contexte */}
      <section className="space-y-4">
        <div>
          <span className={labelCls}>Votre marché</span>
          <div className="mt-2 flex gap-2">
            {(["maroc", "ue", "autre"] as Market[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMarket(m)}
                className={`rounded-full px-4 py-1.5 text-sm font-medium ${market === m ? "bg-teal-600 text-white" : "border border-slate-300 text-slate-700"}`}
              >
                {m === "maroc" ? "Maroc" : m === "ue" ? "Union européenne" : "Autre"}
              </button>
            ))}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label>
            <span className={labelCls}>Taille de l’organisation</span>
            <select value={taille} onChange={(e) => setTaille(e.target.value)} className={inputCls}>
              <option value="">—</option>
              <option>1–10</option><option>11–50</option><option>51–200</option><option>200+</option>
            </select>
          </label>
          <label>
            <span className={labelCls}>Votre rôle (optionnel)</span>
            <input value={role} onChange={(e) => setRole(e.target.value)} placeholder="Dirigeant, DSI…" className={inputCls} />
          </label>
        </div>
      </section>

      {/* Van Westendorp */}
      <section>
        <h2 className="text-lg font-semibold text-slate-900">Le juste prix du service</h2>
        <p className="mt-1 text-sm text-slate-600">
          Strate déploie et exploite votre mémoire d’organisation (l’infra reste payée à vos fournisseurs, à part).
          Pour <b>l’abonnement au service</b>, indiquez un montant ({cur}) :
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label><span className={labelCls}>À partir de quel prix est-ce <b>trop cher</b> ?</span><input inputMode="numeric" value={vw.tooExpensive} onChange={(e) => setVwField("tooExpensive", e.target.value)} className={inputCls} /></label>
          <label><span className={labelCls}>À quel prix est-ce <b>si bas</b> que vous doutez du sérieux ?</span><input inputMode="numeric" value={vw.tooCheap} onChange={(e) => setVwField("tooCheap", e.target.value)} className={inputCls} /></label>
          <label><span className={labelCls}><b>Cher</b>, mais vous y réfléchiriez ?</span><input inputMode="numeric" value={vw.expensiveOk} onChange={(e) => setVwField("expensiveOk", e.target.value)} className={inputCls} /></label>
          <label><span className={labelCls}>Une <b>bonne affaire</b> ?</span><input inputMode="numeric" value={vw.bargain} onChange={(e) => setVwField("bargain", e.target.value)} className={inputCls} /></label>
        </div>
      </section>

      {/* Conjoint */}
      <section>
        <h2 className="text-lg font-semibold text-slate-900">Que choisiriez-vous ?</h2>
        <p className="mt-1 text-sm text-slate-600">Pour chaque paire, l’offre que vous préféreriez (ou aucune).</p>
        <div className="mt-4 space-y-4">
          {CONJOINT_TASKS.map((t, i) => (
            <div key={i} className="rounded-xl border border-slate-200 p-4">
              <div className="grid gap-2 sm:grid-cols-2">
                {(["a", "b"] as const).map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setChoices((p) => ({ ...p, [i]: opt }))}
                    className={`rounded-lg border p-3 text-left text-sm ${choices[i] === opt ? "border-teal-600 bg-teal-50" : "border-slate-200"}`}
                  >
                    <div className="text-slate-700">{opt === "a" ? t.a : t.b}</div>
                    <div className="mt-1 font-mono font-semibold text-teal-700">{opt === "a" ? t.priceA : t.priceB} {cur}</div>
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setChoices((p) => ({ ...p, [i]: "none" }))}
                className={`mt-2 text-xs ${choices[i] === "none" ? "font-semibold text-teal-700" : "text-slate-500"}`}
              >
                Aucune des deux
              </button>
            </div>
          ))}
        </div>
      </section>

      {status === "error" ? <p className="text-sm text-red-600">Un souci est survenu. Réessayez dans un instant.</p> : null}

      <button
        type="button"
        onClick={() => void submit()}
        disabled={status === "sending"}
        className="w-full rounded-full bg-teal-600 px-6 py-3 font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
      >
        {status === "sending" ? "Envoi…" : "Envoyer mes réponses"}
      </button>
    </div>
  );
}
