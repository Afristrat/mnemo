import Link from "next/link";
import { QuickProfileForm } from "@/components/quick-profile/QuickProfileForm";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-6 px-6 py-12 text-center">
      <span className="font-mono text-xs uppercase tracking-widest text-primary">
        Infrastructure de base mémorielle souveraine
      </span>
      <h1 className="font-display text-5xl font-bold tracking-tight">Mnémo</h1>
      <p className="max-w-xl text-body-lg leading-relaxed text-on-surface-variant">
        En 90 secondes : un verdict chiffré et sourcé sur votre base mémorielle souveraine — sans
        migration, sans verrouillage, sans coûts cachés.
      </p>

      <QuickProfileForm />

      <Link href="/fiduciaire" className="text-body-sm text-secondary underline decoration-dotted">
        Lire la charte fiduciaire — zéro commission cachée
      </Link>
    </main>
  );
}
