import { describe, it, expect } from "vitest";
import { POST } from "@/app/api/legal/regimes/route";

// S-077 tranche 3 : validation de la route régimes. On ne teste QUE les chemins de garde (400) qui
// court-circuitent AVANT toute I/O (veille web / persistance) → déterministe, sans réseau ni base.

function postReq(body: string): Request {
  return new Request("http://localhost/api/legal/regimes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
}

describe("POST /api/legal/regimes (validation)", () => {
  it("400 si le JSON est invalide", async () => {
    expect((await POST(postReq("pas du json"))).status).toBe(400);
  });

  it("400 si le corps n'est pas un objet", async () => {
    expect((await POST(postReq(JSON.stringify(["x"])))).status).toBe(400);
  });

  it("400 si le pays cible (country) est absent ou vide", async () => {
    expect((await POST(postReq(JSON.stringify({ residences: ["bresil"] })))).status).toBe(400);
    expect((await POST(postReq(JSON.stringify({ country: "   " })))).status).toBe(400);
  });
});
