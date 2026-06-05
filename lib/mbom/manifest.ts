// MBOM — Memory-Base Bill of Materials (moat « chaîne de preuve », vague 2 #6). Manifeste signé type SBOM
// des ingrédients de la base mémorielle : composants (couches + catalogue sourcé), checksum SHA-256 PAR
// FICHIER du bundle Exit Escrow, empreinte globale. DÉFCON 1 : checksums CALCULÉS (jamais simulés) ;
// licences incluses seulement si connues (sinon null = à confirmer) ; aucune version fabriquée.
// Construit en async (Web Crypto) à partir du bundle déjà généré → zéro régression sur buildExitBundle.

import { sha256Hex, canonicalJson } from "@/lib/decision/integrity";
import type { ExitBundle } from "@/lib/exit/bundle";

export const MBOM_VERSION = 1;

export type MbomComponent = {
  layer: number | null;
  name: string;
  choice: string;
  provenance: string | null;
  sourceUrl: string | null;
  /** Licence si connue ; null = à confirmer (jamais fabriquée). */
  licence: string | null;
};

export type Mbom = {
  version: number;
  product: string;
  generatedAt: string;
  components: MbomComponent[];
  files: { path: string; sha256: string }[];
  integrityHash: string;
  disclaimer: string;
};

const DISCLAIMER =
  "Liste d'ingrédients vérifiable : checksums SHA-256 calculés, sources datées. Licences/versions non confirmées = « à valider ». Une IA peut se tromper.";

/** Dérive les composants du manifeste : couches + (si présent) catalogue sourcé retenu. Pur. */
function componentsOf(bundle: ExitBundle): MbomComponent[] {
  const m = bundle.manifest;
  const byLayer = new Map<number, { provenance: string | null; sourceUrl: string | null }>();
  if (m.catalog !== undefined) {
    // Le catalogue retenu porte la provenance + la source par slot (c0..c6 → couches 0..6).
    for (const slot of m.catalog.slots) {
      const layerId = Number.parseInt(slot.slot.replace(/^c/, ""), 10);
      if (Number.isFinite(layerId)) byLayer.set(layerId, { provenance: slot.provenance, sourceUrl: slot.sourceUrl });
    }
  }
  return m.layers.map((l): MbomComponent => {
    const cat = byLayer.get(l.id);
    return {
      layer: l.id,
      name: l.name,
      choice: l.choice,
      provenance: cat?.provenance ?? null,
      sourceUrl: cat?.sourceUrl ?? null,
      licence: null,
    };
  });
}

/** Construit le MBOM à partir du bundle Exit Escrow déjà généré. Async (checksums Web Crypto). */
export async function buildMbom(bundle: ExitBundle): Promise<Mbom> {
  const components = componentsOf(bundle);
  const files = await Promise.all(
    Object.entries(bundle.files).map(async ([path, content]) => ({ path, sha256: await sha256Hex(content) })),
  );
  files.sort((a, b) => a.path.localeCompare(b.path));
  const generatedAt = bundle.manifest.generatedAt;
  const product = bundle.manifest.product;
  const integrityHash = await sha256Hex(canonicalJson({ version: MBOM_VERSION, product, generatedAt, components, files }));
  return { version: MBOM_VERSION, product, generatedAt, components, files, integrityHash, disclaimer: DISCLAIMER };
}
