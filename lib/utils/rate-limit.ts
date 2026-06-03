// Rate-limit par clé (IP × route), fenêtre fixe. État en mémoire (par instance — borne l'abus/coût même
// sans store distribué). Calcul PUR (`now` injecté) → testable. Nettoyage opportuniste pour borner la Map.

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 5000;

export type RateVerdict = { ok: boolean; retryAfterSec: number };

export function rateLimit(key: string, limit: number, windowMs: number, now: number): RateVerdict {
  // Purge opportuniste des fenêtres expirées si la Map enfle (anti-fuite mémoire).
  if (buckets.size > MAX_BUCKETS) {
    for (const [k, b] of buckets) {
      if (now >= b.resetAt) buckets.delete(k);
    }
  }
  const bucket = buckets.get(key);
  if (bucket === undefined || now >= bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterSec: 0 };
  }
  if (bucket.count >= limit) {
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)) };
  }
  bucket.count += 1;
  return { ok: true, retryAfterSec: 0 };
}

/** Vide l'état (tests uniquement). */
export function __resetRateLimit(): void {
  buckets.clear();
}
