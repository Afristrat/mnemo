import { describe, it, expect } from "vitest";
import { checkCronAuth } from "@/lib/utils/cron-auth";

describe("checkCronAuth (S-084 veille planifiée)", () => {
  it("disabled quand aucun secret n'est configuré (cron désactivé)", () => {
    expect(checkCronAuth("Bearer anything", undefined)).toBe("disabled");
    expect(checkCronAuth("Bearer anything", "")).toBe("disabled");
  });

  it("unauthorized quand le header est absent ou incorrect", () => {
    expect(checkCronAuth(null, "s3cret")).toBe("unauthorized");
    expect(checkCronAuth("Bearer wrong", "s3cret")).toBe("unauthorized");
    expect(checkCronAuth("s3cret", "s3cret")).toBe("unauthorized"); // sans le préfixe Bearer
  });

  it("ok quand le Bearer correspond exactement", () => {
    expect(checkCronAuth("Bearer s3cret", "s3cret")).toBe("ok");
  });
});
