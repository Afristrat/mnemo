// Stub de `server-only` pour Vitest (S-078). En environnement Node de test, le vrai paquet
// `server-only` lève une erreur à l'import (il n'expose un module vide que via la condition
// d'export `react-server`). On l'alias donc vers ce module vide pour pouvoir tester les modules
// serveur (vault, persistance service-role, client LLM) qui le déclarent. Le garde-fou réel
// (interdire l'import depuis un Client Component) reste assuré au BUILD Next.js.
export {};
