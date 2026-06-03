// Intégrité du Decision Record — sérialisation canonique + empreinte SHA-256. Isomorphe (client + serveur
// Node 18+ via Web Crypto). Le hash certifie qu'un dossier n'a pas été altéré : un tiers recalcule le hash
// du contenu canonique et le compare à l'empreinte publiée. Pas une signature d'authenticité (qui exigerait
// une clé) — une preuve d'INTÉGRITÉ auto-vérifiable, suffisante pour un artefact opposable horodaté.

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Tri récursif des clés → représentation déterministe (indépendante de l'ordre d'insertion). */
function sortDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (isRecord(value)) {
    return Object.keys(value)
      .sort()
      .reduce<Record<string, unknown>>((acc, k) => {
        acc[k] = sortDeep(value[k]);
        return acc;
      }, {});
  }
  return value;
}

/** Sérialisation canonique stable d'un objet (clés triées, récursif) — base du hash. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortDeep(value));
}

/** SHA-256 hexadécimal d'une chaîne (Web Crypto, isomorphe). */
export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Empreinte d'intégrité d'un dossier (hash de sa forme canonique). */
export function computeIntegrityHash(record: unknown): Promise<string> {
  return sha256Hex(canonicalJson(record));
}
