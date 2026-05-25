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

export default nextConfig;
