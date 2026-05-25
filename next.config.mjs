/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Le lint est exécuté explicitement via la CLI ESLint (`npm run lint`) et en CI,
  // pas pendant `next build` (séparation des responsabilités, build plus rapide).
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
