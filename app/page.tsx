import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8 text-center">
      <span className="font-mono text-xs uppercase tracking-widest text-primary">
        Infrastructure de base mémorielle souveraine
      </span>
      <h1 className="font-display text-5xl font-bold tracking-tight">Mnémo</h1>
      <p className="max-w-xl text-body-lg leading-relaxed text-on-surface-variant">
        La base mémorielle souveraine qui grandit avec votre organisation — sans migration, sans
        verrouillage, sans coûts cachés.
      </p>
      <Link
        href="/configurateur"
        className="inline-flex items-center justify-center rounded-full bg-primary px-7 py-3 text-body-lg font-medium text-on-primary transition-colors hover:bg-primary-container"
      >
        Configurer mon infrastructure
      </Link>
      <Link href="/fiduciaire" className="text-body-sm text-secondary underline decoration-dotted">
        Lire la charte fiduciaire — zéro commission cachée
      </Link>
    </main>
  );
}
