import { describe, expect, it } from "vitest";
import { renderMbomMarkdown } from "../render";
import type { Mbom } from "../manifest";

const t = (k: string, v?: Record<string, string | number>): string => (v ? `${k}:${JSON.stringify(v)}` : k);

const mbom: Mbom = {
  version: 1,
  product: "Strate, base mémorielle IA souveraine",
  generatedAt: "2026-06-05",
  components: [
    { layer: 3, name: "Base vectorielle", choice: "Qdrant", provenance: "seed", sourceUrl: "https://qdrant.tech", licence: null },
  ],
  files: [{ path: "README.md", sha256: "a".repeat(64) }],
  integrityHash: "b".repeat(64),
  disclaimer: "checksums calculés",
};

describe("renderMbomMarkdown", () => {
  it("rend les composants, les checksums, l'empreinte et un disclaimer", () => {
    const md = renderMbomMarkdown(mbom, t);
    expect(md).toMatch(/Qdrant/);
    expect(md).toMatch(/README\.md/);
    expect(md).toMatch(new RegExp("a".repeat(64)));
    expect(md).toMatch(new RegExp("sha256:b".repeat(1) + "b".repeat(63)));
    expect(md).toMatch(/docTitle/);
    expect(md).toMatch(/disclaimer/);
  });

  it("affiche « à confirmer » pour une licence inconnue", () => {
    const md = renderMbomMarkdown(mbom, t);
    expect(md).toMatch(/toConfirm/);
  });

  it("ajoute le bloc signature quand une signature est fournie (vague 3 T2)", () => {
    const md = renderMbomMarkdown(mbom, t, {
      algo: "Ed25519",
      version: 1,
      publicKey: "PUBKEYb64",
      message: "strate-mbom-v1:" + "b".repeat(64),
      value: "SIGb64",
      signedAt: "2026-06-08T12:00:00.000Z",
    });
    expect(md).toMatch(/signatureTitle/);
    expect(md).toMatch(/Ed25519/);
    expect(md).toMatch(/PUBKEYb64/);
    expect(md).toMatch(/SIGb64/);
    expect(md).toMatch(/sigVerifyHint/);
  });

  it("n'ajoute PAS de bloc signature en l'absence de signature", () => {
    expect(renderMbomMarkdown(mbom, t)).not.toMatch(/signatureTitle/);
  });
});
