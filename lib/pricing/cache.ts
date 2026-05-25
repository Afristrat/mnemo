// Cache mémoire à TTL pour le price feed : évite de re-scraper Firecrawl à chaque
// requête (coût + latence). Volatile par instance serveur ; la persistance durable
// arrivera avec Supabase (S-012). `now` injectable pour les tests.

export type CacheEntry<T> = { at: number; value: T };

export class TtlCache<T> {
  private readonly store = new Map<string, CacheEntry<T>>();

  constructor(private readonly ttlMs: number) {}

  get(key: string, now: number): T | null {
    const entry = this.store.get(key);
    if (entry === undefined) return null;
    if (now - entry.at > this.ttlMs) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  set(key: string, value: T, now: number): void {
    this.store.set(key, { at: now, value });
  }
}
