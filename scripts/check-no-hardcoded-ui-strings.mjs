// Garde-fou « zéro chaîne en dur » (S-058, chantier c). Empêche la régression i18n : une chaîne
// USER-FACING en français ne doit JAMAIS être écrite en dur dans un composant ou une page rendue —
// tout passe par next-intl (`t()`/`useTranslations`/`getTranslations`) ou, pour le moteur, par un
// descripteur `Message` résolu en présentation.
//
// Heuristique robuste et à faible bruit : les CLÉS i18n et les identifiants sont ASCII
// (`Wizard.title`…), donc toute chaîne littérale contenant un ACCENT FRANÇAIS dans le périmètre
// rendu est, par construction, du texte non traduit. Le français porte presque toujours un accent →
// ce signal capte l'immense majorité des régressions, sans faux positif (le code/les clés n'en ont pas).
//
// PÉRIMÈTRE : `components/**` + `app/**` RENDUS, en EXCLUANT `app/api/**` (handlers de routes : leurs
// messages JSON sont localisés quand la locale atteint le serveur — S-059) et les tests. Les chaînes
// de CONTEXTE LLM (prompts) vivent dans `lib/llm/**` (hors périmètre, localisées en S-059).
//
// Exécution : `npm run check:i18n` (intégré au lint CI). Sortie non nulle = chaîne FR en dur détectée.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOTS = ["components", "app"];
// Exclusions : __tests__ (non rendus), app/api (route handlers — locale injectée à l'appel),
// app/actions (server actions — leurs chaînes sont des labels de données BDD, pas de l'UI rendue).
const EXCLUDE_DIR = /[\\/]__tests__([\\/]|$)|^app[\\/]api([\\/]|$)|^app[\\/]actions([\\/]|$)/;
const ACCENT = /[àâäéèêëïîôöùûüÿçœæÀÂÄÉÈÊËÏÎÔÖÙÛÜŸÇŒÆ]/;
// Exceptions explicites (chaîne exacte → raison). Vide : aucune chaîne FR en dur légitime aujourd'hui.
const ALLOWLIST = new Set();

function walk(dir) {
  const out = [];
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (EXCLUDE_DIR.test(full)) continue;
    if (statSync(full).isDirectory()) {
      out.push(...walk(full));
    } else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

/** Retire commentaires de bloc et de ligne (la prose FR explicative y est légitime). */
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

const offenders = [];
for (const root of ROOTS) {
  for (const file of walk(root)) {
    const src = stripComments(readFileSync(file, "utf8"));
    // Chaînes simples, doubles et gabarits.
    const re = /(["'`])((?:\\.|(?!\1)[\s\S])*?)\1/g;
    let m;
    while ((m = re.exec(src)) !== null) {
      const value = m[2];
      if (value.trim().length <= 2 || !ACCENT.test(value) || ALLOWLIST.has(value)) continue;
      const line = src.slice(0, m.index).split("\n").length;
      offenders.push(`${file.replace(/\\/g, "/")}:${line}  «${value.slice(0, 80)}»`);
    }
  }
}

if (offenders.length > 0) {
  console.error(`✗ ${offenders.length} chaîne(s) FR en dur (rendue) détectée(s) — passer par t()/Message :`);
  for (const o of offenders) console.error(`  ${o}`);
  process.exit(1);
}
console.log("✓ Zéro chaîne FR accentuée en dur dans components/ et app/ (hors app/api) — garde i18n S-058.");
