// Barrel du catalogue de composants (reco vivante, spec n°3).
export type {
  Catalog,
  CatalogSlot,
  ComponentCandidate,
  ComponentSovereignty,
  Provenance,
  SlotId,
} from "./types";
export { seedCatalog } from "./catalog-seed";
export { reconcileCatalog } from "./reconcile";
export { buildCatalogObservations } from "./observation";
