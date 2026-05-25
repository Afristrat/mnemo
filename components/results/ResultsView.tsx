"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactElement } from "react";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { CostMap } from "@/components/results/CostMap";
import { EnsembleView } from "@/components/results/EnsembleView";
import { LayerStack } from "@/components/results/LayerStack";
import { PriceFreshness } from "@/components/results/PriceFreshness";
import { RadarChart } from "@/components/results/RadarChart";
import { NumberStepper } from "@/components/wizard/NumberStepper";
import {
  buildEnsemble,
  profileCostFactors,
  recommend,
  type Profile,
  type ScoreKey,
  type Volume,
} from "@/lib/engine";
import { DEFAULT_PROFILE, STORAGE_KEY } from "@/lib/wizard/defaultProfile";
import { VOLUME_OPTIONS } from "@/lib/wizard/options";

const SHORT_LABELS: Record<ScoreKey, string> = {
  conf: "Conformité",
  audit: "Audit",
  stress: "Stress-test",
  sov: "Souveraineté",
  adapt: "Adaptativité",
  ttv: "Time-to-V1",
  mm: "Multimodal",
  cost: "Coût",
};

const VOLUME_ORDER: Volume[] = ["lt1", "1to10", "10to100", "100to1000", "gt1000"];

function loadProfile(): Profile {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved !== null) {
      const parsed: Partial<Profile> = JSON.parse(saved);
      return { ...DEFAULT_PROFILE, ...parsed };
    }
  } catch {
    /* lecture impossible : profil par défaut. */
  }
  return DEFAULT_PROFILE;
}

export function ResultsView(): ReactElement {
  const [base, setBase] = useState<Profile | null>(null);
  const [volIndex, setVolIndex] = useState(1);
  const [users, setUsers] = useState(1);

  useEffect(() => {
    const profile = loadProfile();
    setBase(profile);
    setVolIndex(Math.max(0, VOLUME_ORDER.indexOf(profile.volume)));
    setUsers(profile.users);
  }, []);

  const projected = useMemo<Profile | null>(() => {
    if (base === null) return null;
    return { ...base, volume: VOLUME_ORDER[volIndex], users };
  }, [base, volIndex, users]);

  const result = useMemo(() => (projected === null ? null : recommend(projected)), [projected]);
  const ensemble = useMemo(() => (projected === null ? null : buildEnsemble(projected)), [projected]);

  if (projected === null || result === null || ensemble === null) {
    return <p className="p-8 text-center text-on-surface-variant">Chargement de votre profil…</p>;
  }

  const factorsCost = profileCostFactors(projected);
  const radarData = result.scores.map((s) => ({ label: SHORT_LABELS[s.key], score: s.score }));
  const projectionChanged = base !== null && (projected.volume !== base.volume || projected.users !== base.users);

  return (
    <div className="space-y-8">
      {/* En-tête */}
      <div className="flex flex-wrap items-center gap-3">
        <Chip tone="primary">Preset : {result.preset}</Chip>
        <Chip tone="neutral">Score {result.scoreAvg}/10</Chip>
        <span className="font-mono text-body-md text-on-surface-variant">≈ {result.totalCost} €/mois</span>
      </div>
      <p className="max-w-2xl text-body-md text-on-surface-variant">{result.presetReason}</p>

      {/* Projection */}
      <Card>
        <h2 className="font-display text-headline-md text-on-surface">Se projeter</h2>
        <p className="mt-1 text-body-sm text-on-surface-variant">
          Faites varier l’échelle pour voir l’impact sur le coût. C’est une projection, pas une facture.
        </p>
        <div className="mt-4 grid gap-6 sm:grid-cols-2">
          <div>
            <label htmlFor="vol" className="text-label-caps uppercase text-on-surface-variant">
              Volume de données — {VOLUME_OPTIONS[volIndex].label}
            </label>
            <input
              id="vol"
              type="range"
              min={0}
              max={VOLUME_ORDER.length - 1}
              step={1}
              value={volIndex}
              onChange={(e) => setVolIndex(Number.parseInt(e.target.value, 10))}
              className="mt-2 w-full accent-primary"
            />
          </div>
          <div>
            <span className="mb-2 block text-label-caps uppercase text-on-surface-variant">
              Nombre d’utilisateurs
            </span>
            <NumberStepper label="Nombre d'utilisateurs" value={users} onChange={setUsers} />
          </div>
        </div>
        {projectionChanged ? (
          <p className="mt-3 text-body-sm text-primary">
            Projection active — coût recalculé en direct. Le profil enregistré n’est pas modifié.
          </p>
        ) : null}
      </Card>

      {/* Ensemble multi-configuration (incertitude) */}
      <EnsembleView ensemble={ensemble} />

      {/* Radar + scores */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="font-display text-headline-md text-on-surface">Profil sur 8 dimensions</h2>
          <div className="mt-4 flex justify-center">
            <RadarChart data={radarData} />
          </div>
        </Card>
        <Card>
          <h2 className="font-display text-headline-md text-on-surface">Détail des scores</h2>
          <ul className="mt-4 space-y-3">
            {result.scores.map((s) => (
              <li key={s.key}>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-body-sm text-on-surface">{s.label}</span>
                  <span className="font-mono text-body-sm text-primary">{s.score}/10</span>
                </div>
                <div className="mt-1 h-1.5 w-full rounded-full bg-surface-container">
                  <div className="h-1.5 rounded-full bg-primary" style={{ width: `${s.score * 10}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {/* Stack */}
      <section>
        <h2 className="mb-4 font-display text-headline-lg text-on-surface">Stack recommandée</h2>
        <LayerStack layers={result.layers} />
      </section>

      {/* Coûts */}
      <CostMap
        layers={result.layers}
        factorsCost={factorsCost}
        activeModules={result.activeModules}
        totalCost={result.totalCost}
      />

      {/* Fraîcheur des prix (price feed Firecrawl) */}
      <PriceFreshness />

      {/* Conformité & risques */}
      <div className="grid gap-6 lg:grid-cols-2">
        {result.compliance.length > 0 ? (
          <Card>
            <h2 className="font-display text-headline-md text-on-surface">Actions de conformité</h2>
            <ul className="mt-3 space-y-2 text-body-sm text-on-surface-variant">
              {result.compliance.map((action) => (
                <li key={action}>{action}</li>
              ))}
            </ul>
          </Card>
        ) : null}
        {result.risks.length > 0 ? (
          <Card>
            <h2 className="font-display text-headline-md text-on-surface">Risques détectés</h2>
            <ul className="mt-3 space-y-2 text-body-sm text-on-surface-variant">
              {result.risks.map((risk) => (
                <li key={risk}>{risk}</li>
              ))}
            </ul>
          </Card>
        ) : null}
      </div>

      <p className="text-body-sm text-on-surface-variant">
        Les coûts sont des projections sourcées (±30 %), pas des engagements. Une IA peut se tromper —
        vérifiez chaque source avant décision.
      </p>

      <Link
        href="/configurateur"
        className="inline-flex items-center justify-center rounded-full border border-outline-variant px-5 py-2.5 text-body-md font-medium text-on-surface transition-colors hover:bg-surface-container"
      >
        Modifier mon profil
      </Link>
    </div>
  );
}
