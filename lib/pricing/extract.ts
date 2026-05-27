// Extraction et empreinte des figures monétaires d'une page vendor (F4, price feed).
// Pur et déterministe : aucune dépendance réseau ni UI, entièrement testable.

export type Currency = "USD" | "EUR";

export type MoneyToken = { amount: number; currency: Currency; raw: string };

// Bornes anti-bruit : les pages vendor contiennent des compteurs animés
// (ex. « $00123456789… ») et des identifiants. On rejette tout nombre dont la
// partie chiffres dépasse 9 caractères ou dont la valeur sort d'une plage plausible.
const MAX_DIGITS = 9;
const MAX_AMOUNT = 1_000_000;

function parseAmount(raw: string): number | null {
  const digitsOnly = raw.replace(/[^\d]/g, "");
  if (digitsOnly.length === 0 || digitsOnly.length > MAX_DIGITS) return null;
  // Pages vendor anglophones : « . » décimal, « , » séparateur de milliers.
  const amount = Number.parseFloat(raw.replace(/,/g, ""));
  if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_AMOUNT) return null;
  return amount;
}

const USD_RE = /\$\s?(\d[\d,]*(?:\.\d+)?)/g;
const EUR_RE = /€\s?(\d[\d,]*(?:\.\d+)?)|(\d[\d,]*(?:\.\d+)?)\s?€/g;

function collect(markdown: string, regex: RegExp, currency: Currency): MoneyToken[] {
  const tokens: MoneyToken[] = [];
  for (const match of markdown.matchAll(regex)) {
    const captured = match[1] ?? match[2];
    if (captured === undefined) continue;
    const amount = parseAmount(captured);
    if (amount === null) continue;
    tokens.push({ amount, currency, raw: match[0].trim() });
  }
  return tokens;
}

/**
 * Extrait les figures monétaires plausibles d'un markdown de page vendor,
 * dédupliquées (devise + montant) et triées de façon déterministe.
 */
export function extractMoneyTokens(markdown: string): MoneyToken[] {
  const all = [...collect(markdown, USD_RE, "USD"), ...collect(markdown, EUR_RE, "EUR")];
  const seen = new Map<string, MoneyToken>();
  for (const token of all) {
    seen.set(`${token.currency}:${token.amount}`, token);
  }
  return [...seen.values()].sort((a, b) =>
    a.currency === b.currency ? a.amount - b.amount : a.currency.localeCompare(b.currency),
  );
}

/** Empreinte stable d'un jeu de figures (djb2). Indépendante de l'ordre source. */
export function figuresFingerprint(tokens: MoneyToken[]): string {
  const canonical = tokens
    .map((t) => `${t.currency}:${t.amount}`)
    .sort()
    .join("|");
  let hash = 5381;
  for (let i = 0; i < canonical.length; i += 1) {
    hash = (hash * 33 + canonical.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(16);
}

/**
 * Compare l'empreinte observée à celle d'un snapshot de référence.
 * `changed` reste false quand aucune référence n'existe encore (premier relevé).
 */
export function detectVariation(
  baselineFingerprint: string | null,
  observed: MoneyToken[],
): { changed: boolean; fingerprint: string } {
  const fingerprint = figuresFingerprint(observed);
  return {
    changed: baselineFingerprint !== null && baselineFingerprint !== fingerprint,
    fingerprint,
  };
}
