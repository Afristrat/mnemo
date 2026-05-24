import type { Metadata } from "next";
import { Wizard } from "@/components/wizard/Wizard";

export const metadata: Metadata = {
  title: "Configurateur — Mnémo",
  description: "Profilez votre besoin en quelques étapes pour obtenir une stack de base mémorielle souveraine recommandée.",
};

export default function ConfigurateurPage() {
  return (
    <main className="mx-auto max-w-5xl px-container-margin py-section-padding">
      <header className="mb-8">
        <span className="font-mono text-xs uppercase tracking-widest text-primary">
          Configurateur
        </span>
        <h1 className="mt-2 font-display text-headline-lg text-on-surface">
          Quelle infrastructure pour votre base mémorielle ?
        </h1>
        <p className="mt-2 max-w-2xl text-body-lg text-on-surface-variant">
          Répondez à quelques questions : Mnémo recommande une stack souveraine sur 7 couches,
          avec un coût projeté et des sources vérifiables.
        </p>
      </header>
      <Wizard />
    </main>
  );
}
