import { describe, it, expect, vi } from "vitest";
import {
  parseStatuspageIncidents,
  parseGcpIncidents,
  parseRssIncidents,
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

// Fixture RSS (AWS/Azure) — forme réelle (RSS 2.0, items horodatés).
const RSS = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel>
  <item><title><![CDATA[Increased API error rates [Resolved]]]></title><pubDate>Sat, 07 Jun 2026 10:00:00 GMT</pubDate><link>https://status.aws.amazon.com/i/1</link></item>
  <item><title>Network connectivity in eu-west-1</title><pubDate>Fri, 06 Jun 2026 08:00:00 GMT</pubDate><link>https://status.aws.amazon.com/i/2</link></item>
</channel></rss>`;

describe("parseRssIncidents (AWS/Azure)", () => {
  it("extrait les items (titre CDATA, date, lien), opérationnel = null (non dérivable)", () => {
    const r = parseRssIncidents(RSS, { now: NOW, sinceDays: 90 });
    expect(r.operational).toBeNull();
    expect(r.recentIncidents).toHaveLength(2);
    expect(r.recentIncidents[0].title).toBe("Increased API error rates [Resolved]");
    expect(r.recentIncidents[0].startedAt).toBe("2026-06-07T10:00:00.000Z");
    expect(r.recentIncidents[0].url).toBe("https://status.aws.amazon.com/i/1");
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
  const rssSource: StatusSource = {
    id: "aws",
    name: "AWS",
    scope: "hyperscaler",
    kind: "rss",
    endpoint: "https://status.aws.amazon.com/rss/all.rss",
    pageUrl: "https://health.aws.amazon.com/health/status",
  };
  const seed: ProviderStatus = seedStatusFor(source, "2026-06-01");

  it("live (statuspage) : parse le texte JSON et marque provenance=live", async () => {
    const fetchText = vi.fn().mockResolvedValue(JSON.stringify(STATUSPAGE));
    const s = await fetchProviderStatus(source, { fetchText, now: NOW, seed });
    expect(s.provenance).toBe("live");
    expect(s.operational).toBe(false);
    expect(s.checkedAt).toBe("2026-06-08");
  });

  it("live (rss) : parse le XML et liste les incidents (operational null)", async () => {
    const fetchText = vi.fn().mockResolvedValue(RSS);
    const s = await fetchProviderStatus(rssSource, { fetchText, now: NOW, seed: seedStatusFor(rssSource, "2026-06-01") });
    expect(s.provenance).toBe("live");
    expect(s.operational).toBeNull();
    expect(s.recentIncidents.length).toBe(2);
  });

  it("repli : un JSON invalide bascule sur le seed daté (provenance=seed), sans throw", async () => {
    const fetchText = vi.fn().mockResolvedValue("pas du json");
    const s = await fetchProviderStatus(source, { fetchText, now: NOW, seed });
    expect(s.provenance).toBe("seed");
    expect(s.operational).toBeNull();
    expect(s.sourceUrl).toBe(source.pageUrl);
  });
});
