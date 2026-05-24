import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// Démonte les composants rendus après chaque test (évite l'accumulation dans le DOM jsdom).
afterEach(() => {
  cleanup();
});
