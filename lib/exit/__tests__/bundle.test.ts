import { describe, it, expect } from "vitest";
import { strFromU8, unzipSync } from "fflate";
import { decidePreset, recommend, type Profile } from "@/lib/engine";
import { seedCatalog } from "@/lib/catalog";
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
    // LIGHT (S-051, modèle scoré) = profil réellement minuscule : volume < 1 Go, solo, public, faible charge.
    const light: Profile = {
      ...PROFILE,
      activity: "particulier",
      sensitivity: "public",
      audit: false,
      bitemporal: false,
      budget: "lt50",
      volume: "lt1",
      users: 1,
      voices: "solo",
      growth: "low",
      reqPerDay: "lt100",
    };
    const reco = recommend(light);
    expect(reco.preset).toBe("LIGHT");
    const compose = buildExitBundle(light, reco).files["docker-compose.yml"];
    expect(compose).toContain("orchestrateur lancé hors conteneur");
  });
});

describe("Exit Escrow piloté par le BackupPlan (S-029)", () => {
  const CRITICAL: Profile = {
    ...PROFILE,
    sensitivity: "secret",
    regulations: ["rgpd", "secret-pro"],
    backup: { criticality: "critical" },
  };

  it("le manifeste porte le plan de sauvegarde réel (cohérence manifest↔plan)", () => {
    const reco = recommend(CRITICAL);
    const { manifest } = buildExitBundle(CRITICAL, reco);
    expect(manifest.backup.criticality).toBe(reco.backup.criticality);
    expect(manifest.backup.erasurePolicy).toBe(reco.backup.erasurePolicy);
    expect(manifest.backup.retentionDays).toBe(reco.backup.retentionDays);
  });

  it("le runbook reflète le plan critique + régulé (crypto-shred, WORM, PITR, rétention)", () => {
    const runbook = buildExitBundle(CRITICAL, recommend(CRITICAL)).files["runbook.md"];
    expect(runbook).toContain("plan « critical »");
    expect(runbook).toContain("crypto-shred");
    expect(runbook).toContain("WORM");
    expect(runbook).toContain("WAL/PITR");
    expect(runbook).toContain("365 jours");
  });

  it("backup.sh dérive sa politique du plan (rétention, tag, immutabilité, WAL)", () => {
    const script = buildExitBundle(CRITICAL, recommend(CRITICAL)).files["scripts/backup.sh"];
    expect(script).toContain("--keep-within 365d");
    expect(script).toContain("--tag critical");
    expect(script).toContain("object-lock");
    expect(script).toContain("WAL");
  });

  it("criticité « aucune » : runbook et backup.sh signalent l'absence de sauvegarde", () => {
    const reco = recommend(PROFILE); // pas de backup → none
    expect(reco.backup.criticality).toBe("none");
    const bundle = buildExitBundle(PROFILE, reco);
    expect(bundle.files["runbook.md"]).toContain("aucune politique de sauvegarde dimensionnée");
    expect(bundle.files["scripts/backup.sh"]).toContain("aucune sauvegarde planifiée");
  });
});

describe("Exit Escrow piloté par le plan résidence/DR (S-047)", () => {
  const DR_CRITICAL: Profile = {
    ...PROFILE,
    sensitivity: "secret",
    regulations: ["rgpd", "secret-pro"],
    backup: { criticality: "critical" }, // → DR hot dérivé
  };

  it("le manifeste porte le plan résidence réel (cohérence manifest↔plan)", () => {
    const reco = recommend(DR_CRITICAL);
    const { manifest } = buildExitBundle(DR_CRITICAL, reco);
    expect(manifest.residency.drTier).toBe(reco.residency.drTier);
    expect(manifest.residency.primaryRegion).toBe(reco.residency.primaryRegion);
    expect(manifest.residency.drTier).toBe("hot");
  });

  it("profil avec DR : terraform/dr.tf généré + runbook avec procédure de bascule régionale", () => {
    const reco = recommend(DR_CRITICAL);
    const bundle = buildExitBundle(DR_CRITICAL, reco);
    expect(Object.keys(bundle.files)).toContain("terraform/dr.tf");
    expect(bundle.files["terraform/dr.tf"]).toContain("multi-région");
    const runbook = bundle.files["runbook.md"];
    expect(runbook).toContain("Résidence & continuité régionale (DR « hot »)");
    expect(runbook).toContain("Procédure de bascule régionale");
    expect(runbook).toContain("RTO régional");
  });

  it("profil sans DR : pas de dr.tf, runbook signale l'absence de DR régional", () => {
    const reco = recommend(PROFILE); // backup none → DR none
    const bundle = buildExitBundle(PROFILE, reco);
    expect(Object.keys(bundle.files)).not.toContain("terraform/dr.tf");
    expect(bundle.files["runbook.md"]).toContain("DR régional** : aucun");
  });

  it("transfert inter-région : le runbook liste le flux + son statut + disclaimer juridique", () => {
    const cross: Profile = { ...PROFILE, residency: { allowedRegions: ["us"], drTier: "warm" } };
    const runbook = buildExitBundle(cross, recommend(cross)).files["runbook.md"];
    expect(runbook).toContain("eu → us");
    expect(runbook).toContain("restreint");
    expect(runbook).toContain("PAS un avis juridique");
  });

  it("conflit résidence × DR (Maroc strict + DR) : runbook expose le conflit + des leviers", () => {
    const conflict: Profile = {
      ...PROFILE,
      zone: "maroc",
      sensitivity: "secret",
      backup: { criticality: "critical" },
    };
    const reco = recommend(conflict);
    expect(reco.residency.conflict.hasConflict).toBe(true);
    const runbook = buildExitBundle(conflict, reco).files["runbook.md"];
    expect(runbook).toContain("Conflit résidence × DR à arbitrer");
  });
});

describe("Catalogue retenu figé (S-037)", () => {
  it("manifest.catalog + catalog.json gèlent composants, provenance et source (rejouable)", () => {
    const reco = recommend(PROFILE);
    const catalog = seedCatalog(decidePreset(PROFILE).preset, PROFILE);
    const bundle = buildExitBundle(PROFILE, reco, new Date("2026-05-25T00:00:00Z"), catalog);
    expect(Object.keys(bundle.files)).toContain("catalog.json");
    const m = bundle.manifest.catalog;
    expect(m).toBeDefined();
    if (m === undefined) return;
    expect(m.assembledAt).toBe(catalog.assembledAt);
    expect(m.source).toBe(catalog.source);
    expect(m.slots).toHaveLength(7);
    expect(m.slots[0].component).toBe(catalog.slots.c0.recommended.name);
    expect(m.slots.every((s) => s.sourceUrl.length > 0)).toBe(true);
    expect(bundle.files["catalog.json"]).toContain(catalog.slots.c0.recommended.name);
  });

  it("sans catalogue : pas de catalog.json ni manifest.catalog (rétro-compat)", () => {
    const bundle = buildExitBundle(PROFILE, recommend(PROFILE));
    expect(Object.keys(bundle.files)).not.toContain("catalog.json");
    expect(bundle.manifest.catalog).toBeUndefined();
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
