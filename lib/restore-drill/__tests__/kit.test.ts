import { describe, expect, it } from "vitest";
import { buildRestoreDrillKit } from "../kit";
import { buildExitBundle } from "@/lib/exit/bundle";
import { recommend, type Profile } from "@/lib/engine";

const PROFILE: Profile = {
  activity: "pme-startup",
  continent: "europe",
  country: "union-europeenne",
  zone: "ue",
  users: 5,
  contentTypes: ["text", "audio"],
  volume: "10to100",
  growth: "high",
  regulations: ["rgpd"],
  sensitivity: "confidential",
  audit: true,
  bitemporal: true,
  techLevel: "devops",
  budget: "200to500",
  reqPerDay: "lt1k",
  latency: "fast",
  voices: "multi",
  modules: { bisect: 1, reversal: 2, prereg: 0, mel: 3, conflict: 2 },
};

function kit(): Record<string, string> {
  const reco = recommend(PROFILE);
  const { manifest } = buildExitBundle(PROFILE, reco);
  return buildRestoreDrillKit(reco, manifest);
}

describe("buildRestoreDrillKit", () => {
  it("produit les fichiers attendus", () => {
    const files = kit();
    for (const p of [
      "restore-drill.sh",
      ".github/workflows/restore-drill.yml",
      "DRILL.md",
      "restore-certificate.schema.json",
      "drill/seed/atom-001.md",
    ]) {
      expect(Object.keys(files)).toContain(p);
    }
  });

  it("DRILL.md explique les deux modes + leurs limites + la checklist", () => {
    const md = kit()["DRILL.md"];
    expect(md).toMatch(/Mode A/);
    expect(md).toMatch(/Mode B/);
    expect(md).toMatch(/synthétique/);
    expect(md).toMatch(/services up/i);
    expect(md).toMatch(/RTO/);
  });

  it("le seed synthétique ne contient jamais de donnée réelle (mention explicite)", () => {
    expect(kit()["drill/seed/atom-001.md"]).toMatch(/synthétique|démo|fictif/i);
  });

  it("restore-drill.sh réutilise le compose et chronomètre le RTO", () => {
    const sh = kit()["restore-drill.sh"];
    expect(sh).toMatch(/docker compose/);
    expect(sh).toMatch(/restore-certificate\.json/);
    expect(sh).toMatch(/rtoMinutes/);
  });

  it("le schéma JSON est un JSON valide décrivant le certificat", () => {
    const schema: unknown = JSON.parse(kit()["restore-certificate.schema.json"]);
    expect(schema).toHaveProperty("properties");
  });
});
