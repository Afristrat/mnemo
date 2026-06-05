import { describe, expect, it } from "vitest";
import { buildMbom } from "../manifest";
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

function bundle() {
  return buildExitBundle(PROFILE, recommend(PROFILE));
}

describe("buildMbom", () => {
  it("produit un checksum SHA-256 par fichier du bundle", async () => {
    const b = bundle();
    const mbom = await buildMbom(b);
    expect(mbom.files.length).toBe(Object.keys(b.files).length);
    for (const f of mbom.files) {
      expect(f.sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(Object.keys(b.files)).toContain(f.path);
    }
  });

  it("dérive un composant par couche, licence inconnue = null (jamais fabriquée)", async () => {
    const b = bundle();
    const mbom = await buildMbom(b);
    expect(mbom.components.length).toBe(b.manifest.layers.length);
    for (const c of mbom.components) {
      expect(c.licence).toBeNull();
      expect(typeof c.name).toBe("string");
    }
  });

  it("a une empreinte globale stable et re-vérifiable", async () => {
    const b = bundle();
    const a1 = await buildMbom(b);
    const a2 = await buildMbom(b);
    expect(a1.integrityHash).toBe(a2.integrityHash);
    expect(a1.integrityHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("change d'empreinte si un fichier du bundle change", async () => {
    const b = bundle();
    const base = await buildMbom(b);
    const tampered = { ...b, files: { ...b.files, "README.md": (b.files["README.md"] ?? "") + "\nALTÉRÉ" } };
    const after = await buildMbom(tampered);
    expect(after.integrityHash).not.toBe(base.integrityHash);
  });
});
