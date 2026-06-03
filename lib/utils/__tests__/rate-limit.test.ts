import { describe, it, expect, beforeEach } from "vitest";
import { rateLimit, __resetRateLimit } from "@/lib/utils/rate-limit";

describe("rateLimit (durcissement avant ouverture)", () => {
  beforeEach(() => {
    __resetRateLimit();
  });

  it("autorise jusqu'à la limite, puis bloque avec un Retry-After", () => {
    for (let i = 0; i < 3; i++) expect(rateLimit("k", 3, 1000, 1000).ok).toBe(true);
    const blocked = rateLimit("k", 3, 1000, 1000);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });

  it("réinitialise le compteur une fois la fenêtre passée", () => {
    for (let i = 0; i < 3; i++) rateLimit("k", 3, 1000, 1000);
    expect(rateLimit("k", 3, 1000, 2001).ok).toBe(true);
  });

  it("isole les clés (IP × route distinctes)", () => {
    for (let i = 0; i < 3; i++) rateLimit("a", 3, 1000, 1000);
    expect(rateLimit("b", 3, 1000, 1000).ok).toBe(true);
  });
});
