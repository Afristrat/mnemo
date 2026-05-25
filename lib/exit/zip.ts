// Empaquetage ZIP du bundle Exit Escrow via fflate (zéro dépendance transitive).
// Les chemins contenant « / » deviennent des entrées arborescentes valides.

import { strToU8, zipSync } from "fflate";
import type { ExitBundle } from "./bundle";

export function zipBundle(bundle: ExitBundle): Uint8Array {
  const entries: Record<string, Uint8Array> = {};
  for (const [path, content] of Object.entries(bundle.files)) {
    entries[path] = strToU8(content);
  }
  return zipSync(entries, { level: 6 });
}
