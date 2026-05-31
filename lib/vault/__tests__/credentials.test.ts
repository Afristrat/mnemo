import { describe, it, expect } from "vitest";
import { storeVendorCredentialRecord } from "@/lib/vault/credentials";

function fakeAdmin() {
  const inserts: { table: string; row: Record<string, unknown> }[] = [];
  return {
    inserts,
    from(table: string) {
      return {
        insert: async (row: Record<string, unknown>) => {
          inserts.push({ table, row });
          return { error: null };
        },
      };
    },
  };
}

const ENV = { STRATE_VAULT_MASTER_KEY: Buffer.alloc(32, 7).toString("base64"), STRATE_VAULT_KEY_VERSION: "1" };

describe("storeVendorCredentialRecord", () => {
  it("chiffre le secret avant insertion et trace l'accès, sans jamais persister le clair", async () => {
    const admin = fakeAdmin();
    await storeVendorCredentialRecord(admin, {
      circleId: "c1", userId: "u1", provider: "hetzner", label: "Prod", kind: "api_key", secret: "SK_PLAIN_123",
    }, ENV);

    const credInsert = admin.inserts.find((i) => i.table === "vendor_credentials");
    expect(credInsert).toBeDefined();
    expect(JSON.stringify(credInsert?.row)).not.toContain("SK_PLAIN_123");
    expect(credInsert?.row.ciphertext).toBeTypeOf("string");

    const audit = admin.inserts.find((i) => i.table === "credential_access");
    expect(audit?.row).toMatchObject({ circle_id: "c1", action: "store", actor: "u1" });
    expect(JSON.stringify(audit?.row)).not.toContain("SK_PLAIN_123");
  });
});
