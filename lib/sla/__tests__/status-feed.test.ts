import { describe, it, expect, vi } from "vitest";
import {
  parseStatuspageIncidents,
  parseGcpIncidents,
  fetchProviderStatus,
  type ProviderStatus,
} from "@/lib/sla/status-feed";
import { seedStatusFor } from "@/lib/sla/status-seed";
import type { StatusSource } from "@/lib/sla/status-source";

// SLA #5 — disponibilité OBSERVÉE. Parseurs purs testés sur fixtures réalistes (forme réelle des pages
// de statut Statuspage / Google Cloud). La donnée affichée en prod est live ; ici on fige pour tester.

const NOW = new Date("2026-06-08T00:00:00.000Z");

// Fixture Statuspage (/api/v2/incidents.json) — forme réelle (Scaleway/Outscale/Anthropic).
const STATUSPAGE = {
  incidents: [
    {
      name: "Elevated errors on Claude Opus",
      impact: "minor",
      status: "resolved",
      started_at: "2026-06-07T10:00:00Z",
      created_at: "2026-06-07T10:05:00Z",
      resolved_at: "2026-06-07T12:00:00Z",
      shortlink: "https://stspg.io/abc",
    },
    {
      name: "API latency in fr-par",
      impact: "major",
      status: "monitoring", // en cours
      started_at: "2026-06-08T08:00:00Z",
      resolved_at: null,
      shortlink: "https://stspg.io/def",
    },
    {
      name: "Vieux incident hors fenêtre",
      impact: "minor",
      status: "resolved",
      started_at: "2026-01-01T00:00:00Z",
      resolved_at: "2026-01-01T01:00:00Z",
      shortlink: "https://stspg.io/old",
    },
  ],
};

// Fixture Google Cloud (incidents.json) — tableau racine.
const GCP = [
  {
    external_desc: "Compute Engine networking issue",
    severity: "high",
    status_impact: "SERVICE_OUTAGE",
    begin: "2026-06-06T09:00:00Z",
    end: "2026-06-06T11:00:00Z",
    uri: "incidents/xyz123",
  },
  {
    external_desc: "Ongoing storage degradation",
    severity: "medium",
    status_impact: "SERVICE_DISRUPTION",
    begin: "2026-06-08T06:00:00Z",
    end: null,
    uri: "incidents/ongoing9",
  },
];

describe("parseStatuspageIncidents (SLA #5 observé)", () => {
  it("normalise les incidents, détecte un incident en cours, borne à la fenêtre récente", () => {
    const r = parseStatuspageIncidents(STATUSPAGE, { now: NOW, sinceDays: 90, limit: 5 });
    expect(r.operational).toBe(false); // un incident "monitoring" en cours
    expect(r.recentIncidents).toHaveLength(2); // le vieux (janvier) est hors fenêtre 90 j
    // tri décroissant par date de début
    expect(r.recentIncidents[0].title).toBe("API latency in fr-par");
    expect(r.recentIncidents[0].impact).toBe("major");
    expect(r.recentIncidents[1].resolvedAt).toBe("2026-06-07T12:00:00Z");
    expect(r.recentIncidents[1].url).toBe("https://stspg.io/abc");
  });

  it("opérationnel si tous les incidents sont résolus", () => {
    const allResolved = { incidents: STATUSPAGE.incidents.filter((i) => i.status === "resolved") };
    expect(parseStatuspageIncidents(allResolved, { now: NOW }).operational).toBe(true);
  });

  it("ne lève pas sur une entrée malformée", () => {
    expect(parseStatuspageIncidents({ incidents: [{}, 42, null] }, { now: NOW }).recentIncidents).toEqual([]);
  });
});

describe("parseGcpIncidents (SLA #5 observé)", () => {
  it("mappe la sévérité, construit l'URL, détecte l'incident non clôturé récent", () => {
    const r = parseGcpIncidents(GCP, { now: NOW, sinceDays: 90 });
    expect(r.operational).toBe(false); // incident end=null récent
    expect(r.recentIncidents).toHaveLength(2);
    const ongoing = r.recentIncidents.find((i) => i.resolvedAt === null);
    expect(ongoing?.impact).toBe("major"); // medium → major
    const outage = r.recentIncidents.find((i) => i.title.includes("networking"));
    expect(outage?.impact).toBe("critical"); // high → critical
    expect(outage?.url).toBe("https://status.cloud.google.com/incidents/xyz123");
  });
});

describe("fetchProviderStatus (live + repli)", () => {
  const source: StatusSource = {
    id: "scaleway",
    name: "Scaleway",
    scope: "sovereign-eu",
    kind: "statuspage",
    endpoint: "https://status.scaleway.com/api/v2/incidents.json",
    pageUrl: "https://status.scaleway.com/",
  };
  const seed: ProviderStatus = seedStatusFor(source, "2026-06-01");

  it("live : parse l'endpoint et marque provenance=live", async () => {
    const fetchJson = vi.fn().mockResolvedValue(STATUSPAGE);
    const s = await fetchProviderStatus(source, { fetchJson, now: NOW, seed });
    expect(s.provenance).toBe("live");
    expect(s.operational).toBe(false);
    expect(s.checkedAt).toBe("2026-06-08");
  });

  it("repli : si le fetch lève, renvoie le seed daté (provenance=seed), sans throw", async () => {
    const fetchJson = vi.fn().mockRejectedValue(new Error("network"));
    const s = await fetchProviderStatus(source, { fetchJson, now: NOW, seed });
    expect(s.provenance).toBe("seed");
    expect(s.operational).toBeNull();
    expect(s.sourceUrl).toBe(source.pageUrl);
  });
});
