import { describe, expect, it, vi } from "vitest";
import { buildExternalDriftClaims, runExternalDrift } from "../external-drift";
import { buildExitBundle } from "@/lib/exit/bundle";
import { recommend } from "@/lib/engine";
import { baseProfile } from "./fixture";
import type { LlmResult } from "@/lib/llm";
import type { WebSearchResult } from "@/lib/pricing/scraper";

const profile = baseProfile();
const { manifest } = buildExitBundle(profile, recommend(profile));

describe("buildExternalDriftClaims", () => {
  it("un claim 'external_drift' par composant signé, avec asOf", () => {
    const claims = buildExternalDriftClaims(manifest, "2026-01-01");
    expect(claims.length).toBeGreaterThan(0);
    expect(claims.every((c) => c.kind === "external_drift" && c.asOf === "2026-01-01")).toBe(true);
  });
});

describe("runExternalDrift", () => {
  it("agrège les signaux et compte changed/unknown", async () => {
    const results: WebSearchResult[] = [{ title: "T", url: "https://x.example", snippet: "s" }];
    const deps = {
      search: vi.fn(async () => results),
      llm: vi.fn(
        async (): Promise<LlmResult> => ({
          ok: true,
          content: JSON.stringify({ verdict: "changed", rationale: "acquired", sourceUrls: ["https://x.example"] }),
        }),
      ),
    };
    const report = await runExternalDrift(manifest, "2026-01-01", deps, "2026-06-10");
    expect(report.signals.length).toBeGreaterThan(0);
    expect(report.changedCount).toBeGreaterThanOrEqual(1);
    expect(report.inSync).toBe(false);
    expect(report.asOf).toBe("2026-01-01");
  });

  it("recherche vide → signaux 'unknown' (repli seed), inSync vrai", async () => {
    const deps = {
      search: vi.fn(async () => []),
      llm: vi.fn(async (): Promise<LlmResult> => ({ ok: false, reason: "x" })),
    };
    const report = await runExternalDrift(manifest, "2026-01-01", deps, "2026-06-10");
    expect(report.changedCount).toBe(0);
    expect(report.inSync).toBe(true);
    expect(report.unknownCount).toBe(report.signals.length);
  });
});
