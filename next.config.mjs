import createNextIntlPlugin from "next-intl/plugin";

// Fondation i18n (S-057) : pointe explicitement vers la request config (chemin par défaut,
// rendu explicite pour la lisibilité). Mode « sans routing » → locale par cookie, cf. i18n/.
const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Sortie autonome : image Docker minimale pour Coolify (server.js + deps strictes).
  output: "standalone",
  // Le lint est exécuté explicitement via la CLI ESLint (`npm run lint`) et en CI,
  // pas pendant `next build` (séparation des responsabilités, build plus rapide).
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default withNextIntl(nextConfig);
