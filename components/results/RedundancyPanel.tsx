"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState, type ReactElement } from "react";
import { Card } from "@/components/ui/Card";
import { CONTINENTS, jurisdictionFor, type Continent, type Profile } from "@/lib/engine";

type RedundancyPanelProps = {
  profile: Profile;
};

// Type minimal côté client (pas d'import du module serveur) — fournisseur découvert/seed, sourcé.
type ProviderView = {
  name: string;
  continent: Continent;
  country: string;
  sovereignty: "sovereign" | "eu-hosted" | "hyperscaler";
  note: string;
  source: { label: string; url: string; checkedAt: string };
  provenance: "live" | "seed";
};

const CONTINENT_KEY: Record<Continent, "europe" | "northAmerica" | "latam" | "africa" | "middleEast" | "apac"> = {
  europe: "europe",
  "north-america": "northAmerica",
  latam: "latam",
  africa: "africa",
  "middle-east": "middleEast",
  apac: "apac",
};

const SOVEREIGNTY_KEY: Record<ProviderView["sovereignty"], "sovSovereign" | "sovEuHosted" | "sovHyperscaler"> = {
  sovereign: "sovSovereign",
  "eu-hosted": "sovEuHosted",
  hyperscaler: "sovHyperscaler",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** Parse défensif de la réponse `/api/residency/providers` (jamais de `as`, type guards). */
function parseProviders(data: unknown): ProviderView[] {
  if (!isRecord(data) || !Array.isArray(data.providers)) return [];
  const out: ProviderView[] = [];
  for (const item of data.providers) {
    if (!isRecord(item)) continue;
    const name = typeof item.name === "string" ? item.name : "";
    const continent = CONTINENTS.find((c) => c === item.continent);
    const sov = item.sovereignty;
    const sovereignty = sov === "sovereign" || sov === "eu-hosted" || sov === "hyperscaler" ? sov : "hyperscaler";
    const src = isRecord(item.source) ? item.source : {};
    if (name === "" || continent === undefined) continue;
    out.push({
      name,
      continent,
      country: typeof item.country === "string" ? item.country : "",
      sovereignty,
      note: typeof item.note === "string" ? item.note : "",
      source: {
        label: typeof src.label === "string" ? src.label : name,
        url: typeof src.url === "string" ? src.url : "",
        checkedAt: typeof src.checkedAt === "string" ? src.checkedAt : "",
      },
      provenance: item.provenance === "live" ? "live" : "seed",
    });
  }
  return out;
}

/**
 * Panneau Redondance multi-continent (S-073 T4) : trouve des fournisseurs souverains dans un pays cible
 * (veille `/api/residency/providers`, bornée par les contraintes utilisateur S-072 comme ABSOLUES, repli
 * annuaire seed garanti) et laisse composer une topologie multi-fournisseur redondante (plusieurs
 * solutions infra, sécurité par diversité de juridictions). Chaque fournisseur est sourcé + daté.
 */
export function RedundancyPanel({ profile }: RedundancyPanelProps): ReactElement {
  const t = useTranslations("Results.redundancyPanel");
  const tOptions = useTranslations("Options");
  // Pré-remplissage depuis le configurateur (S-076 → S-073) : le pays choisi ouvre la découverte sur la
  // bonne cible. Toujours non vide (même « Union européenne » / « Autre » : le repli annuaire seed couvre).
  const initialCountry = ((): string => {
    const j = jurisdictionFor(profile.country);
    return j === undefined ? "" : tOptions(j.labelKey);
  })();
  const [continent, setContinent] = useState<Continent>(profile.continent);
  const [country, setCountry] = useState(initialCountry);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [providers, setProviders] = useState<ProviderView[] | null>(null);
  const [selected, setSelected] = useState<Record<string, ProviderView>>({});

  const selectedList = useMemo(() => Object.values(selected), [selected]);
  const selectedCountries = useMemo(
    () => new Set(selectedList.map((p) => `${p.continent}|${p.country}`)).size,
    [selectedList],
  );

  // Recherche EN AMONT et SANS CLIC (décision Amine) : la découverte se déclenche automatiquement
  // au chargement (pays du profil) puis à chaque changement de continent/pays, débouncée pour ne pas
  // spammer pendant la saisie. Le repli annuaire seed garantit toujours un résultat.
  const runSearch = useCallback(
    async (cont: Continent, ctry: string): Promise<void> => {
      const target = ctry.trim();
      if (target === "") return;
      setLoading(true);
      setError(false);
      try {
        const res = await fetch("/api/residency/providers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ continent: cont, country: target, profile }),
          cache: "no-store",
        });
        if (!res.ok) {
          setError(true);
          setProviders([]);
          return;
        }
        setProviders(parseProviders(await res.json()));
      } catch {
        setError(true);
        setProviders([]);
      } finally {
        setLoading(false);
      }
    },
    [profile],
  );

  useEffect(() => {
    if (country.trim() === "") return;
    const id = setTimeout(() => void runSearch(continent, country), 500);
    return () => clearTimeout(id);
  }, [continent, country, runSearch]);

  function toggle(p: ProviderView): void {
    setSelected((prev) => {
      const next = { ...prev };
      const key = `${p.continent}|${p.name}`;
      if (next[key] === undefined) next[key] = p;
      else delete next[key];
      return next;
    });
  }

  return (
    <Card>
      <h3 className="font-display text-headline-md text-on-surface">{t("title")}</h3>
      <p className="mt-1 text-body-sm text-on-surface-variant">{t("intro")}</p>
      <p className="mt-2 rounded-card bg-surface-container p-3 text-body-sm text-on-surface-variant">{t("constraintNote")}</p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 sm:items-end">
        <label className="block">
          <span className="text-label-caps uppercase text-on-surface-variant">{t("continentLabel")}</span>
          <select
            value={continent}
            onChange={(e) => {
              const next = CONTINENTS.find((c) => c === e.target.value);
              if (next !== undefined) setContinent(next);
            }}
            className="mt-1 w-full rounded-card border border-outline bg-surface px-3 py-2 text-body-md text-on-surface"
          >
            {CONTINENTS.map((c) => (
              <option key={c} value={c}>
                {t(CONTINENT_KEY[c])}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="flex items-center gap-2 text-label-caps uppercase text-on-surface-variant">
            {t("countryLabel")}
            {loading ? <span className="font-mono normal-case text-on-surface-variant/70">· {t("searching")}</span> : null}
          </span>
          <input
            type="text"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            placeholder={t("countryPlaceholder")}
            className="mt-1 w-full rounded-card border border-outline bg-surface px-3 py-2 text-body-md text-on-surface"
          />
        </label>
      </div>

      {error ? <p className="mt-3 text-body-sm text-error">{t("error")}</p> : null}

      {providers !== null && !error ? (
        providers.length === 0 ? (
          <p className="mt-3 text-body-sm text-on-surface-variant">{t("noResults")}</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {providers.map((p) => {
              const key = `${p.continent}|${p.name}`;
              const checked = selected[key] !== undefined;
              return (
                <li key={key} className="rounded-card bg-surface-container p-3 text-body-sm">
                  <label className="flex items-start gap-3">
                    <input type="checkbox" checked={checked} onChange={() => toggle(p)} className="mt-1" />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-on-surface">{p.name}</span>
                        <span className="text-on-surface-variant">· {p.country}</span>
                        <span className="rounded-full bg-surface px-2 py-0.5 text-xs text-on-surface-variant">
                          {t(SOVEREIGNTY_KEY[p.sovereignty])}
                        </span>
                        <span
                          className={`font-mono text-xs ${p.provenance === "live" ? "text-primary" : "text-on-surface-variant/70"}`}
                        >
                          {p.provenance === "live" ? t("provenanceLive") : t("provenanceSeed")}
                        </span>
                      </span>
                      {p.note !== "" ? <span className="mt-1 block text-on-surface-variant">{p.note}</span> : null}
                      {p.source.url !== "" ? (
                        <a
                          href={p.source.url}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="mt-1 inline-block text-xs text-primary underline"
                        >
                          {t("sourceLabel", { date: p.source.checkedAt })}
                        </a>
                      ) : null}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        )
      ) : (
        <p className="mt-3 text-body-sm text-on-surface-variant/80">{t("emptyHint")}</p>
      )}

      {selectedList.length > 0 ? (
        <div className="mt-4 rounded-card border border-primary/40 bg-primary/5 p-4 text-body-sm">
          <p className="font-medium text-on-surface">{t("selectedTitle")}</p>
          <p className="mt-1 text-on-surface-variant">
            {t("selectedSummary", { providers: selectedList.length, locations: selectedCountries })}
          </p>
          <p className="mt-2 text-on-surface-variant/80">
            {selectedList.length >= 2 ? t("redundancyOk") : t("redundancyHint")}
          </p>
          {selectedCountries >= 2 ? (
            <p className="mt-2 text-on-surface-variant/80">⚖ {t("legalCaveat")}</p>
          ) : null}
          <p className="mt-1 text-on-surface-variant/80">€ {t("costCaveat")}</p>
        </div>
      ) : null}
    </Card>
  );
}
