import { describe, it, expect } from "vitest";
import type { LlmMessage, LlmResult } from "@/lib/llm";
import type { WebSearchResult } from "@/lib/pricing/scraper";
import {
  discoverRegimesForCountries,
  mapRegimeCode,
  parseDiscoveredRegimes,
  regimeDiscoveryQuery,
  type RegimeDiscoverDeps,
} from "@/lib/legal/regime-discovery";

// S-077 tranche 2 : veille pure (I/O injectée). Garde-fous DÉFCON 1 — anti-hallucination d'URL, mapping
// du code moteur, dédup, jamais d'avis juridique (existence seulement), `[]` si I/O KO (repli seed).

const RESULTS: WebSearchResult[] = [
  { title: "ANPD — LGPD", url: "https://www.gov.br/anpd/pt-br", snippet: "Lei Geral de Proteção de Dados" },
  { title: "EUR-Lex GDPR", url: "https://eur-lex.europa.eu/eli/reg/2016/679/oj", snippet: "Regulation 2016/679" },
];

function deps(content: string, results: WebSearchResult[] = RESULTS): RegimeDiscoverDeps {
  return {
    search: async () => results,
    llm: async (): Promise<LlmResult> => ({ ok: true, content }),
    now: () => new Date("2026-06-01T00:00:00Z"),
  };
}

describe("mapRegimeCode", () => {
  it("mappe les régimes reconnaissables sur l'énum moteur, null sinon", () => {
    expect(mapRegimeCode("RGPD")).toBe("rgpd");
    expect(mapRegimeCode("UK GDPR + Data Protection Act 2018")).toBe("rgpd");
    expect(mapRegimeCode("EU AI Act")).toBe("aiact");
    expect(mapRegimeCode("HIPAA (health)")).toBe("hipaa");
    expect(mapRegimeCode("Loi 09-08 (CNDP)")).toBe("cndp");
    expect(mapRegimeCode("LGPD (Lei 13.709/2018)")).toBe("lgpd"); // Brésil modélisé (S-077, T5)
    expect(mapRegimeCode("APPI")).toBe("appi"); // Japon modélisé (S-077, T5)
    expect(mapRegimeCode("POPIA")).toBeNull(); // régime non modélisé → reste libre (affichage-seul)
  });
});

describe("parseDiscoveredRegimes (anti-hallucination + mapping)", () => {
  it("retient les régimes dont l'URL ∈ résultats, mappe le code, défaut conservateur", () => {
    const content = JSON.stringify({
      regimes: [
        { name: "LGPD", scope: "data-protection", country: "bresil", sourceUrl: "https://www.gov.br/anpd/pt-br" },
        { name: "GDPR", scope: "data-protection", country: "union-europeenne", sourceUrl: "https://eur-lex.europa.eu/eli/reg/2016/679/oj" },
      ],
    });
    const out = parseDiscoveredRegimes(content, RESULTS, "bresil", "2026-06-01");
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ name: "LGPD", code: "lgpd", provenance: "live", confidence: "low" });
    expect(out[1].code).toBe("rgpd");
    expect(out.every((x) => x.source.checkedAt === "2026-06-01")).toBe(true);
  });

  it("rejette une source inventée (URL hors résultats) — anti-hallucination", () => {
    const content = JSON.stringify({
      regimes: [{ name: "Fake Law", scope: "data-protection", country: "x", sourceUrl: "https://invented.example/law" }],
    });
    expect(parseDiscoveredRegimes(content, RESULTS, "x", "2026-06-01")).toEqual([]);
  });

  it("dédoublonne par (pays, nom) et tolère un scope invalide → other", () => {
    const content = JSON.stringify({
      regimes: [
        { name: "LGPD", scope: "weird", country: "bresil", sourceUrl: "https://www.gov.br/anpd/pt-br" },
        { name: "lgpd", scope: "data-protection", country: "Bresil", sourceUrl: "https://www.gov.br/anpd/pt-br" },
      ],
    });
    const out = parseDiscoveredRegimes(content, RESULTS, "bresil", "2026-06-01");
    expect(out).toHaveLength(1);
    expect(out[0].scope).toBe("other");
  });

  it("JSON invalide → []", () => {
    expect(parseDiscoveredRegimes("pas du json", RESULTS, "x", "2026-06-01")).toEqual([]);
  });
});

describe("discoverRegimesForCountries", () => {
  const content = JSON.stringify({
    regimes: [{ name: "LGPD", scope: "data-protection", country: "bresil", sourceUrl: "https://www.gov.br/anpd/pt-br" }],
  });

  it("retourne les régimes sourcés (chemin nominal)", async () => {
    const out = await discoverRegimesForCountries(["bresil"], deps(content));
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe("LGPD");
  });

  it("recherche vide → []", async () => {
    const out = await discoverRegimesForCountries(["bresil"], deps(content, []));
    expect(out).toEqual([]);
  });

  it("LLM en échec → []", async () => {
    const d: RegimeDiscoverDeps = { search: async () => RESULTS, llm: async () => ({ ok: false, reason: "down" }) };
    expect(await discoverRegimesForCountries(["bresil"], d)).toEqual([]);
  });

  it("I/O qui lève → [] (ne propage jamais)", async () => {
    const d: RegimeDiscoverDeps = {
      search: async () => {
        throw new Error("réseau");
      },
      llm: async (_m: LlmMessage[]): Promise<LlmResult> => ({ ok: true, content }),
    };
    expect(await discoverRegimesForCountries(["bresil"], d)).toEqual([]);
  });

  it("la requête web inclut les pays cibles", () => {
    expect(regimeDiscoveryQuery(["bresil", "japon"])).toContain("bresil, japon");
  });
});
