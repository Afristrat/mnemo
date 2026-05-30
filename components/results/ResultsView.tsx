"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useEffect, useMemo, useState, type ReactElement } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { AssistantPanel } from "@/components/assistant/AssistantPanel";
import { CatalogProvenance } from "@/components/results/CatalogProvenance";
import { CostMap, type MediaBreakdown } from "@/components/results/CostMap";
import { EnsembleView } from "@/components/results/EnsembleView";
import { ExitEscrow } from "@/components/results/ExitEscrow";
import { ExportButtons } from "@/components/results/ExportButtons";
import { LayerStack } from "@/components/results/LayerStack";
import { LeadGate } from "@/components/results/LeadGate";
import { LivePriceStatus } from "@/components/results/LivePriceStatus";
import { PriceFreshness } from "@/components/results/PriceFreshness";
import { RadarChart } from "@/components/results/RadarChart";
import { ResidencyPanel } from "@/components/results/ResidencyPanel";
import { SharePanel } from "@/components/results/SharePanel";
import { VerdictView } from "@/components/results/VerdictView";
import { NumberStepper } from "@/components/wizard/NumberStepper";
import { seedCatalog, type Catalog } from "@/lib/catalog";
import { decodeProfileFromParam } from "@/lib/share";
import { useEngineText } from "@/lib/i18n/engine";
import { mergeVerdictNarration, type DisplayVerdict, type NarrationContext, type NarrationTexts } from "@/lib/llm/narrate";
import {
  buildEnsemble,
  decidePreset,
  formatPresetReason,
  profileCostFactors,
  recommend,
  type EnsembleVariantId,
  type MultimodalPriceTable,
  type Profile,
  type Volume,
} from "@/lib/engine";
import { getBackupPrices } from "@/lib/pricing/backup-seed";
import { getComputePrices } from "@/lib/pricing/compute-seed";
import { getMediaPricesEur } from "@/lib/pricing/media-feed";
import { getResidencyPrices } from "@/lib/pricing/residency-seed";
import { DEFAULT_PROFILE, STORAGE_KEY } from "@/lib/wizard/defaultProfile";
import { useOptions } from "@/lib/wizard/useOptions";

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
  const [mode, setMode] = useState<"verdict" | "expert">("expert");
  // Solution affichée par toute la page : null = la recommandation de référence,
  // sinon un scénario de l'ensemble (bascule sans modifier le profil enregistré).
  const [activeVariant, setActiveVariant] = useState<EnsembleVariantId | null>(null);

  // Prix médias réels (€) injectés → coûts multimodaux dans les couches + verdict chiffré.
  // Rendu initial avec le seed sourcé (repli immédiat), puis bascule sur les prix LIVE extraits
  // et réconciliés (S-025) dès que la route serveur répond. Échec/indispo → on reste sur le seed.
  const [prices, setPrices] = useState<MultimodalPriceTable>(() => getMediaPricesEur());
  // Catalogue de composants vivant (S-037) : la veille (Firecrawl + LLM) côté serveur propose des
  // candidats sourcés, validés par garde-fou. Rendu initial = seed (repli immédiat), puis recalcul
  // sur le catalogue live dès que /api/catalog/live répond. Indispo → on reste sur le seed.
  const [liveCatalog, setLiveCatalog] = useState<Catalog | undefined>(undefined);
  const [catalogPending, setCatalogPending] = useState(true);
  // Narration LLM (S-039) : textes (verdict + « pourquoi ce preset ») réécrits selon le profil, repli
  // sur les textes statiques. Les CHIFFRES ne dépendent jamais de la narration (invariant DÉFCON 1).
  const [narration, setNarration] = useState<NarrationTexts | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/pricing/live", { cache: "no-store" });
        if (!response.ok) return;
        const feed: { media?: MultimodalPriceTable } = await response.json();
        if (!cancelled && feed.media !== undefined) setPrices(feed.media);
      } catch {
        /* repli : le seed est déjà en place. */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Veille catalogue : POST du profil de base → Catalog (un candidat sourcé par couche). La clé
  // Firecrawl + la clé LLM ne quittent jamais le serveur ; le navigateur ne parle qu'à notre route.
  useEffect(() => {
    if (base === null) return;
    let cancelled = false;
    setCatalogPending(true);
    void (async () => {
      try {
        const response = await fetch("/api/catalog/live", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(base),
          cache: "no-store",
        });
        if (!response.ok) return;
        const cat: Catalog = await response.json();
        if (!cancelled) setLiveCatalog(cat);
      } catch {
        /* repli : le seed (catalogue effectif ci-dessous) est déjà en place. */
      } finally {
        if (!cancelled) setCatalogPending(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [base]);

  // Partage (S-067) : un profil reçu par lien est PRIORITAIRE sur le localStorage.
  //   ?p=<base64>  → lien ENCODÉ stateless : décodage immédiat (rejoue exactement le profil).
  //   ?s=<uuid>    → lien COURT Supabase : fetch /api/share/[id] → chaîne encodée → décodage.
  // ?p/?s invalides ou absents → repli gracieux sur le localStorage (jamais de crash).
  useEffect(() => {
    let cancelled = false;

    const apply = (profile: Profile): void => {
      if (cancelled) return;
      setBase(profile);
      setVolIndex(Math.max(0, VOLUME_ORDER.indexOf(profile.volume)));
      setUsers(profile.users);
    };

    let params: URLSearchParams | null = null;
    try {
      params = new URLSearchParams(window.location.search);
      if (params.get("mode") === "verdict") setMode("verdict");
    } catch {
      /* pas d'URL exploitable : vue expert + repli localStorage. */
    }

    const encodedParam = params?.get("p") ?? null;
    const shortId = params?.get("s") ?? null;
    const sharedNow = encodedParam !== null ? decodeProfileFromParam(encodedParam) : null;

    if (sharedNow !== null) {
      apply(sharedNow);
    } else if (shortId !== null) {
      void (async () => {
        try {
          const res = await fetch(`/api/share/${encodeURIComponent(shortId)}`, { cache: "no-store" });
          if (res.ok) {
            const data: { encoded?: string } = await res.json();
            const shared = typeof data.encoded === "string" ? decodeProfileFromParam(data.encoded) : null;
            if (shared !== null) {
              apply(shared);
              return;
            }
          }
        } catch {
          /* repli : profil local ci-dessous. */
        }
        apply(loadProfile());
      })();
    } else {
      apply(loadProfile());
    }

    return () => {
      cancelled = true;
    };
  }, []);

  // i18n (S-058) : résolveur des descripteurs du moteur + libellés courts du radar + chrome résultats.
  const resolveEngine = useEngineText();
  const tScoreShort = useTranslations("Results.scoreShort");
  const tR = useTranslations("Results");
  const opts = useOptions();

  const projected = useMemo<Profile | null>(() => {
    if (base === null) return null;
    return { ...base, volume: VOLUME_ORDER[volIndex], users };
  }, [base, volIndex, users]);

  // Catalogue effectif : le live dès qu'il a répondu, sinon le seed (repli immédiat, sortie identique).
  const effectiveCatalog = useMemo<Catalog | undefined>(() => {
    if (liveCatalog !== undefined) return liveCatalog;
    if (projected === null) return undefined;
    return seedCatalog(decidePreset(projected).preset, projected);
  }, [liveCatalog, projected]);

  // Prix backup + compute injectés (seed sourcé) → coûts de sauvegarde ET serveurs visibles (CostMap).
  // Catalogue effectif injecté → la stack reflète la veille (live) ou le repli (seed).
  const result = useMemo(
    () =>
      projected === null
        ? null
        : recommend(projected, prices, effectiveCatalog, getBackupPrices(), getComputePrices(), getResidencyPrices()),
    [projected, prices, effectiveCatalog],
  );
  const ensemble = useMemo(
    () =>
      projected === null
        ? null
        : buildEnsemble(projected, prices, effectiveCatalog, getBackupPrices(), getComputePrices(), getResidencyPrices()),
    [projected, prices, effectiveCatalog],
  );

  // Contexte de narration figé sur le profil de BASE (pas la projection) → on ne re-narre pas à chaque
  // mouvement de slider ; recalculé seulement si le profil/les prix/le catalogue changent.
  const narrationContext = useMemo<NarrationContext | null>(() => {
    if (base === null) return null;
    const r = recommend(base, prices, effectiveCatalog, getBackupPrices(), getComputePrices(), getResidencyPrices());
    // Notes libres saisies au configurateur (S-052) → contexte de personnalisation du ton (jamais
    // un chiffre : le garde-fou `isCleanNarration` rejette toute réintroduction de montant/score).
    const notes = Object.values(base.freeNotes ?? {}).filter(
      (n): n is string => typeof n === "string" && n.trim().length > 0,
    );
    // Précisions « Autre » (S-064) : même canal CONTEXTE-seulement que les notes libres (jamais un
    // chiffre). Préfixées pour que le LLM sache à quel champ elles se rapportent.
    const activityOther = base.otherText?.activity?.trim();
    if (base.activity === "other" && activityOther !== undefined && activityOther.length > 0) {
      notes.push(`Activité (précision « Autre ») : ${activityOther}`);
    }
    const zoneOther = base.otherText?.zone?.trim();
    if (base.zone === "other" && zoneOther !== undefined && zoneOther.length > 0) {
      notes.push(`Zone d'hébergement (précision « Autre ») : ${zoneOther}`);
    }
    const regionOther = base.otherText?.region?.trim();
    const regionIsOther =
      base.residency?.primaryRegion === "other" || (base.residency?.allowedRegions ?? []).includes("other");
    if (regionIsOther && regionOther !== undefined && regionOther.length > 0) {
      notes.push(`Région(s) (précision « Autre ») : ${regionOther}`);
    }
    return {
      activity: base.activity,
      preset: r.preset,
      sensitivity: base.sensitivity,
      zone: base.zone,
      regulations: base.regulations,
      notes,
      base: {
        // Champs du verdict = descripteurs i18n (S-058) → résolus en chaînes localisées avant d'alimenter le LLM.
        pain: resolveEngine(r.verdict.pain),
        risk: resolveEngine(r.verdict.risk),
        gain: resolveEngine(r.verdict.gain),
        nextStep: resolveEngine(r.verdict.nextStep),
        // presetReason est un descripteur composé (S-058) → résolu en chaîne localisée avant le LLM.
        presetReason: formatPresetReason(r.presetReason, resolveEngine),
      },
    };
  }, [base, prices, effectiveCatalog, resolveEngine]);

  useEffect(() => {
    if (narrationContext === null) return;
    let cancelled = false;
    setNarration(null);
    void (async () => {
      try {
        const res = await fetch("/api/llm/narrate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(narrationContext),
          cache: "no-store",
        });
        if (!res.ok) return;
        const data: NarrationTexts = await res.json();
        if (!cancelled) setNarration(data);
      } catch {
        /* repli : les textes statiques restent affichés. */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [narrationContext]);

  if (projected === null || result === null || ensemble === null || effectiveCatalog === undefined) {
    return <p className="p-8 text-center text-on-surface-variant">{tR("loading")}</p>;
  }

  // Mode verdict (chemin 90 s) : synthèse compacte de la recommandation de référence.
  // Narration LLM appliquée aux 4 textes seulement ; les bandes de coût restent celles de la reco.
  if (mode === "verdict") {
    // Résout le verdict moteur (champs textuels = descripteurs i18n) vers sa forme affichable (chaînes),
    // puis applique éventuellement la narration LLM. VerdictView et la fusion n'opèrent que sur des chaînes.
    const displayVerdict: DisplayVerdict = {
      pain: resolveEngine(result.verdict.pain),
      risk: resolveEngine(result.verdict.risk),
      gain: resolveEngine(result.verdict.gain),
      firmPriceTier: resolveEngine(result.verdict.firmPriceTier),
      nextStep: resolveEngine(result.verdict.nextStep),
      variableCostBand: result.verdict.variableCostBand,
      setupCostBand: result.verdict.setupCostBand,
    };
    const verdictToShow = narration === null ? displayVerdict : mergeVerdictNarration(displayVerdict, narration);
    return (
      <div className="space-y-8">
        <VerdictView
          verdict={verdictToShow}
          preset={result.preset}
          onExpert={() => setMode("expert")}
          narrated={narration !== null}
        />
      </div>
    );
  }

  // Solution active : la référence par défaut, ou le scénario sélectionné dans l'ensemble.
  // Toute la vue experte (en-tête, radar, coûts, stack, export, Exit Escrow) la suit.
  const activeVariantData =
    activeVariant === null ? null : (ensemble.variants.find((v) => v.id === activeVariant) ?? null);
  const activeProfile = activeVariantData?.profile ?? projected;
  const activeResult = activeVariantData?.recommendation ?? result;
  // Catalogue figé dans l'export : celui de la recommandation de référence. Les scénarios de
  // l'ensemble explorent sur leur propre seed → on ne leur attache pas le catalogue vivant.
  const exportCatalog = activeVariant === null ? effectiveCatalog : undefined;

  const factorsCost = profileCostFactors(activeProfile);
  const radarData = activeResult.scores.map((s) => ({ label: tScoreShort(s.key), score: s.score }));
  const projectionChanged = base !== null && (projected.volume !== base.volume || projected.users !== base.users);

  // Décomposition de l'apport multimédia (déjà compris dans les couches) pour la CostMap.
  const media: MediaBreakdown = {
    gpuTier: activeResult.sizing.gpu.tier,
    gpuCost: activeResult.sizing.gpu.monthlyCost,
    storageGb: activeResult.sizing.storageGb,
    storageCost: Math.round(activeResult.sizing.storageGb * prices.storagePerGbMonth.amount),
    embeddingsCost: activeResult.sizing.embeddingsMultimodal ? Math.round(prices.multimodalEmbeddings.amount) : 0,
    apiLines: activeResult.sizing.workloads
      .filter((w) => w.mode === "api" && w.monthlyCost > 0)
      .map((w) => ({ label: resolveEngine(w.estimate), cost: w.monthlyCost })),
  };

  return (
    <div className="space-y-8">
      {/* En-tête */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Chip tone="primary">{tR("preset", { preset: activeResult.preset })}</Chip>
          <Chip tone="neutral">{tR("score", { avg: String(activeResult.scoreAvg) })}</Chip>
          <span className="font-mono text-body-md text-on-surface-variant">≈ {activeResult.totalCost} €/mois</span>
        </div>
        <Button variant="secondary" size="sm" onClick={() => setMode("verdict")}>
          {tR("viewVerdict")}
        </Button>
      </div>
      <p className="max-w-2xl text-body-md text-on-surface-variant">
        {activeVariant === null && narration !== null
          ? narration.presetReason
          : formatPresetReason(activeResult.presetReason, resolveEngine)}
      </p>

      {/* Bandeau de scénario actif (bascule depuis l'ensemble) */}
      {activeVariantData !== null ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-primary/40 bg-primary/5 px-4 py-3">
          <p className="text-body-sm text-on-surface">
            {tR.rich("scenarioActive", {
              label: activeVariantData.label,
              b: (chunks) => <strong>{chunks}</strong>,
            })}
          </p>
          <Button variant="secondary" size="sm" onClick={() => setActiveVariant(null)}>
            {tR("backToReco")}
          </Button>
        </div>
      ) : null}

      {/* Lead gate (S-068) : la recette EXPERTE (projection, ensemble, radar, stack, coûts, partage,
          export, Exit Escrow, assistant) ne se déverrouille qu'après saisie nom + e-mail. Le verdict
          90 s (mode="verdict", retour plus haut) reste LIBRE — le bouton « Voir le verdict » ci-dessus
          et le lien « Affiner » ci-dessous restent hors du gate. Décision (S-067) : le partage reste
          DANS la zone gatée (c'est un livrable expert, comme l'export et l'Exit Escrow). */}
      <LeadGate preset={activeResult.preset}>
      {/* Projection */}
      <Card>
        <h2 className="font-display text-headline-md text-on-surface">{tR("project")}</h2>
        <p className="mt-1 text-body-sm text-on-surface-variant">{tR("projectDesc")}</p>
        <div className="mt-4 grid gap-6 sm:grid-cols-2">
          <div>
            <label htmlFor="vol" className="text-label-caps uppercase text-on-surface-variant">
              {tR("volumeLabel", { label: opts.volume[volIndex].label })}
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
              {tR("usersLabel")}
            </span>
            <NumberStepper label={tR("usersLabel")} value={users} onChange={setUsers} />
          </div>
        </div>
        {projectionChanged ? (
          <p className="mt-3 text-body-sm text-primary">{tR("projectionActive")}</p>
        ) : null}
      </Card>

      {/* Ensemble multi-configuration (incertitude) — bascule la page entière */}
      <EnsembleView ensemble={ensemble} activeId={activeVariant} onSelect={setActiveVariant} />

      {/* Radar + scores */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="font-display text-headline-md text-on-surface">{tR("profile10")}</h2>
          <div className="mt-4 flex justify-center">
            <RadarChart data={radarData} />
          </div>
        </Card>
        <Card>
          <h2 className="font-display text-headline-md text-on-surface">{tR("scoreDetail")}</h2>
          <ul className="mt-4 space-y-3">
            {result.scores.map((s) => (
              <li key={s.key}>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-body-sm text-on-surface">{resolveEngine(s.label)}</span>
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
        <h2 className="mb-4 font-display text-headline-lg text-on-surface">{tR("stack")}</h2>
        <LayerStack layers={activeResult.layers} />
      </section>

      {/* Provenance des choix de composants (reco vivante : veille Firecrawl + LLM, repli seed) */}
      <CatalogProvenance catalog={effectiveCatalog} pending={catalogPending && liveCatalog === undefined} />

      {/* Coûts */}
      <CostMap
        layers={activeResult.layers}
        factorsCost={factorsCost}
        activeModules={activeResult.activeModules}
        totalCost={activeResult.totalCost}
        setupCost={activeResult.setupCost}
        media={media}
        backup={activeResult.backup}
        residency={activeResult.residency}
      />

      {/* Résidence & transferts (S-048) : topologie régions + conformité des flux + RTO + conflit. */}
      <ResidencyPanel plan={activeResult.residency} />

      {/* Prix d'infra extraits en direct + garde-fou vs baseline (S-025) */}
      <LivePriceStatus />

      {/* Fraîcheur des prix (price feed Firecrawl) */}
      <PriceFreshness />

      {/* Conformité & risques */}
      <div className="grid gap-6 lg:grid-cols-2">
        {activeResult.compliance.length > 0 ? (
          <Card>
            <h2 className="font-display text-headline-md text-on-surface">{tR("compliance")}</h2>
            <ul className="mt-3 space-y-2 text-body-sm text-on-surface-variant">
              {activeResult.compliance.map((action) => (
                <li key={action.id}>{resolveEngine(action)}</li>
              ))}
            </ul>
          </Card>
        ) : null}
        {activeResult.risks.length > 0 ? (
          <Card>
            <h2 className="font-display text-headline-md text-on-surface">{tR("risks")}</h2>
            <ul className="mt-3 space-y-2 text-body-sm text-on-surface-variant">
              {activeResult.risks.map((risk) => (
                <li key={risk.id}>{resolveEngine(risk)}</li>
              ))}
            </ul>
          </Card>
        ) : null}
      </div>

      <p className="text-body-sm text-on-surface-variant">{tR("disclaimer")}</p>

      {/* Livrable exportable (F6) */}
      <Card>
        <h2 className="font-display text-headline-md text-on-surface">{tR("exportTitle")}</h2>
        <p className="mt-1 text-body-sm text-on-surface-variant">{tR("exportDesc")}</p>
        <div className="mt-4">
          <ExportButtons
            profile={activeProfile}
            recommendation={activeResult}
            ensemble={ensemble}
            catalog={exportCatalog}
          />
        </div>
      </Card>

      {/* Partage de la recommandation (S-067) : lien encodé instantané + lien court Supabase.
          Le profil partagé est celui AFFICHÉ (projection courante) → l'autre session le rejoue. */}
      <SharePanel profile={activeProfile} />

      {/* Exit Escrow, bundle reproductible (F7, moat ①) */}
      <ExitEscrow profile={activeProfile} recommendation={activeResult} catalog={exportCatalog} />

      {/* Assistant Q&A contextuel (S-040) : ne cite que les faits de la reco affichée + web sourcé.
          Les précisions « Autre » (S-064) sont greffées aux FAITS comme CONTEXTE qualitatif seulement. */}
      <AssistantPanel
        reco={activeResult}
        otherPrecisions={{
          activity: base?.activity === "other" ? base.otherText?.activity : undefined,
          zone: base?.zone === "other" ? base.otherText?.zone : undefined,
          region:
            base?.residency?.primaryRegion === "other" || (base?.residency?.allowedRegions ?? []).includes("other")
              ? base?.otherText?.region
              : undefined,
        }}
      />
      </LeadGate>

      <Link
        href="/configurateur"
        className="inline-flex items-center justify-center rounded-full border border-outline-variant px-5 py-2.5 text-body-md font-medium text-on-surface transition-colors hover:bg-surface-container"
      >
        {tR("editProfile")}
      </Link>
    </div>
  );
}
