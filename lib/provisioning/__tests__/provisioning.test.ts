import { describe, it, expect, vi } from "vitest";
import { seedCatalog } from "@/lib/catalog";
import type { Profile } from "@/lib/engine";
import { deriveProvisioningProcedures } from "@/lib/provisioning/procedures";
import { deriveProvisioningPlan, isAllowedAgentAction, runAgentAction, type AgentAction } from "@/lib/provisioning/plan";

// S-087/S-088 (F10) : procédures guidées (l'utilisateur crée les comptes) + cadre d'optimisation
// (l'agent configure le compte autorisé) + GARDE-FOU DUR (jamais créer de compte / saisir une carte).

function prof(over: Partial<Profile> = {}): Profile {
  return {
    activity: "pme-startup",
    continent: "europe",
    country: "union-europeenne",
    zone: "ue",
    users: 10,
    contentTypes: ["text"],
    volume: "10to100",
    growth: "medium",
    regulations: ["rgpd"],
    sensitivity: "confidential",
    audit: false,
    bitemporal: false,
    techLevel: "devops",
    budget: "500to2k",
    reqPerDay: "lt1k",
    latency: "acceptable",
    voices: "multi",
    modules: { bisect: 0, reversal: 0, prereg: 0, mel: 0, conflict: 0 },
    ...over,
  };
}

const catalog = seedCatalog("MEDIUM", prof());

describe("deriveProvisioningProcedures (S-087)", () => {
  it("une procédure par slot (c0..c6), avec lien officiel sourcé + étapes + champs", () => {
    const procs = deriveProvisioningProcedures(catalog);
    expect(procs.map((p) => p.slot)).toEqual(["c0", "c1", "c2", "c3", "c4", "c5", "c6"]);
    for (const p of procs) {
      expect(p.officialUrl.length).toBeGreaterThan(0); // SOURCÉ, jamais vide
      expect(p.steps.length).toBeGreaterThan(0);
      expect(p.fieldsToNote.length).toBeGreaterThan(0);
      expect(p.kind === "account" || p.kind === "self-host").toBe(true);
      expect(p.steps[0].id.startsWith("provisioning.")).toBe(true); // descripteur i18n, pas de prose
    }
  });
});

describe("deriveProvisioningPlan (S-088)", () => {
  it("une tâche d'optimisation par slot + garde-fou (descripteurs i18n)", () => {
    const plan = deriveProvisioningPlan(catalog);
    expect(plan.tasks).toHaveLength(7);
    expect(plan.tasks.every((t) => t.status === "pending")).toBe(true);
    expect(plan.tasks[0].action.id).toBe("provisioning.task.optimize");
    expect(plan.guardrail.id).toBe("provisioning.guardrail");
  });
});

describe("garde-fou DUR d'exécution (S-088)", () => {
  it("autorise configure/read, INTERDIT create-account/enter-card/financial-commitment", () => {
    expect(isAllowedAgentAction({ type: "configure", target: "x" })).toBe(true);
    expect(isAllowedAgentAction({ type: "read", target: "x" })).toBe(true);
    expect(isAllowedAgentAction({ type: "create-account", target: "x" })).toBe(false);
    expect(isAllowedAgentAction({ type: "enter-card", target: "x" })).toBe(false);
    expect(isAllowedAgentAction({ type: "financial-commitment", target: "x" })).toBe(false);
  });

  it("runAgentAction REJETTE une action interdite SANS appeler l'exécuteur", async () => {
    const exec = vi.fn().mockResolvedValue(undefined);
    const action: AgentAction = { type: "create-account", target: "vendor-x" };
    const r = await runAgentAction(action, exec);
    expect(r).toEqual({ ok: false, reason: "forbidden" });
    expect(exec).not.toHaveBeenCalled(); // l'agent ne crée JAMAIS de compte
  });

  it("runAgentAction exécute une action permise (executor injecté/mocké)", async () => {
    const exec = vi.fn().mockResolvedValue(undefined);
    const r = await runAgentAction({ type: "configure", target: "vendor-x" }, exec);
    expect(r).toEqual({ ok: true });
    expect(exec).toHaveBeenCalledTimes(1);
  });

  it("runAgentAction ne lève jamais : erreur d'exécuteur → executor-error", async () => {
    const exec = vi.fn().mockRejectedValue(new Error("boom"));
    const r = await runAgentAction({ type: "configure", target: "x" }, exec);
    expect(r).toEqual({ ok: false, reason: "executor-error" });
  });
});
