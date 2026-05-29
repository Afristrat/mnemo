import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// jsdom n'implémente pas window.scrollTo (utilisé par le wizard au changement d'étape) → stub no-op.
if (typeof window !== "undefined") {
  window.scrollTo = () => {};
}

// Démonte les composants rendus après chaque test (évite l'accumulation dans le DOM jsdom).
afterEach(() => {
  cleanup();
});
