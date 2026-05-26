import { describe, it, expect } from "vitest";
import { strFromU8, unzipSync } from "fflate";
import { recommend, type Profile } from "@/lib/engine";
import { buildExitBundle } from "@/lib/exit/bundle";
import { zipBundle } from "@/lib/exit/zip";

const PROFILE: Profile = {
  activity: "pme-startup",
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

const EXPECTED_FILES = [
  "manifest.json",
  "README.md",
  "docker-compose.yml",
  "terraform/main.tf",
  "terraform/terraform.tfvars",
  "vault/.env.example",
  "vault/README.md",
  "runbook.md",
  "scripts/re-embed.sh",
  "scripts/backup.sh",
];

describe("buildExitBundle", () => {
  it("contient tous les artefacts attendus (IaC + vault + runbook + scripts + manifeste)", () => {
    const bundle = buildExitBundle(PROFILE, recommend(PROFILE), new Date("2026-05-25T00:00:00Z"));
    expect(Object.keys(bundle.files).sort()).toEqual([...EXPECTED_FILES].sort());
    expect(bundle.manifest.generatedAt).toBe("2026-05-25");
  });

  it("le manifeste est cohérent avec la recommandation (couches, coût, preset)", () => {
    const reco = recommend(PROFILE);
    const { manifest } = buildExitBundle(PROFILE, reco);
    expect(manifest.preset).toBe(reco.preset);
    expect(manifest.totalCost).toBe(reco.totalCost);
    expect(manifest.scoreAvg).toBe(reco.scoreAvg);
    expect(manifest.layers).toHaveLength(7);
    expect(manifest.layers.map((l) => l.choice)).toEqual(reco.layers.map((l) => l.choice));
  });

  it("le Compose et le manifeste reflètent les choix réels de la stack", () => {
    const reco = recommend(PROFILE);
    const bundle = buildExitBundle(PROFILE, reco);
    const compose = bundle.files["docker-compose.yml"];
    expect(compose).toContain(`preset ${reco.preset}`);
    expect(compose).toContain(reco.layers[3].choice); // C3 retrieval
    expect(compose).toContain(reco.layers[5].choice); // C5 stockage
    // Le vault n'expose jamais de valeur de secret.
    expect(bundle.files["vault/.env.example"]).toContain("ANTHROPIC_API_KEY=");
  });

  it("ne lève pas selon le preset (LIGHT inclus, sans orchestrateur conteneurisé)", () => {
    const light: Profile = { ...PROFILE, sensitivity: "public", audit: false, bitemporal: false, budget: "lt50", volume: "lt1" };
    const reco = recommend(light);
    expect(reco.preset).toBe("LIGHT");
    const compose = buildExitBundle(light, reco).files["docker-compose.yml"];
    expect(compose).toContain("orchestrateur lancé hors conteneur");
  });
});

describe("zipBundle", () => {
  it("produit un ZIP qui se dézippe en restituant les fichiers à l'identique", () => {
    const bundle = buildExitBundle(PROFILE, recommend(PROFILE), new Date("2026-05-25T00:00:00Z"));
    const zipped = zipBundle(bundle);
    expect(zipped.byteLength).toBeGreaterThan(500);

    const unzipped = unzipSync(zipped);
    expect(Object.keys(unzipped).sort()).toEqual([...EXPECTED_FILES].sort());
    expect(strFromU8(unzipped["manifest.json"])).toBe(bundle.files["manifest.json"]);
    expect(strFromU8(unzipped["runbook.md"])).toBe(bundle.files["runbook.md"]);
  });
});
